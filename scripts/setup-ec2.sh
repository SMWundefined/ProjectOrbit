#!/usr/bin/env bash
# ProjectOrbit EC2 bootstrap — run ON a fresh Ubuntu 24.04 instance as ubuntu:
#   bash setup-ec2.sh
#
# Installs Node 20 + Python tooling, clones the repo, pulls personal data
# from the private S3 bucket, ingests it into ChromaDB, and installs two
# systemd services:
#   orbit-rag.service  — Python retrieval sidecar on 127.0.0.1:8001
#   orbit-web.service  — Astro/Node server on 0.0.0.0:4321 (chat API)
#
# Network exposure is controlled by the AWS security group (4321 from
# CloudFront's origin-facing range only, 22 from the owner's IP only),
# so no host firewall is configured here — one layer, no lockout risk.
#
# REQUIRED before first run: /opt/projectorbit/.env must exist with at
# least GROQ_API_KEY and the PUBLIC_* values (scp it from your machine;
# see README-scripts.md). The script stops with a clear error otherwise.

set -euo pipefail

REPO_URL="https://github.com/SMWundefined/ProjectOrbit.git"
BRANCH="main"
APP_DIR="/opt/projectorbit"
DATA_BUCKET="projectorbit-data-633017683854"
AWS_REGION="us-east-1"

log() { echo -e "\n==> $*"; }

# --- swap: pip installing torch on 2 GB RAM needs headroom ---------------
if [ ! -f /swapfile ]; then
  log "Creating 2G swapfile"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# --- system packages ------------------------------------------------------
log "Installing system packages"
sudo apt-get update -y
sudo apt-get install -y git curl unzip python3 python3-venv python3-pip

if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  log "Installing Node 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v aws >/dev/null; then
  log "Installing AWS CLI v2"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q -o /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi

# --- application checkout --------------------------------------------------
if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning $REPO_URL ($BRANCH)"
  sudo mkdir -p "$APP_DIR"
  sudo chown ubuntu:ubuntu "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  log "Updating existing checkout"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

# --- env check: secrets never live in git ---------------------------------
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found."
  echo "Copy your server env file first, e.g. from your machine:"
  echo "  scp -i ~/.ssh/projectorbit-key.pem .env ubuntu@<elastic-ip>:$APP_DIR/.env"
  exit 1
fi
if ! grep -q '^GROQ_API_KEY=.\+' "$APP_DIR/.env"; then
  echo "ERROR: GROQ_API_KEY is empty in $APP_DIR/.env — the server would"
  echo "fall back to Ollama, which is not installed on this instance."
  exit 1
fi

# --- python venv + dependencies -------------------------------------------
if [ ! -d "$APP_DIR/.venv" ]; then
  log "Creating Python venv"
  python3 -m venv "$APP_DIR/.venv"
fi
log "Installing Python requirements (first run downloads PyTorch, be patient)"
"$APP_DIR/.venv/bin/pip" install --no-cache-dir -q -r scripts/requirements.txt

# --- node build -------------------------------------------------------------
log "Installing npm dependencies and building"
npm ci
npm run build

# --- personal data from S3 --------------------------------------------------
log "Syncing personal data from s3://$DATA_BUCKET"
aws s3 sync "s3://$DATA_BUCKET" "$APP_DIR/src/data" --region "$AWS_REGION" \
  --exclude "*" --include "professional.md" --include "community.md" --include "personal.md"

# --- ingest (only when the vector store is missing or empty) ---------------
if [ ! -d "$APP_DIR/chroma_db" ] || [ -z "$(ls -A "$APP_DIR/chroma_db" 2>/dev/null)" ]; then
  log "ChromaDB empty — running ingest"
  "$APP_DIR/.venv/bin/python" scripts/ingest.py
else
  log "ChromaDB present — skipping ingest (run update-data.sh to refresh)"
fi

# --- systemd services --------------------------------------------------------
log "Installing systemd services"

sudo tee /etc/systemd/system/orbit-rag.service >/dev/null <<EOF
[Unit]
Description=ProjectOrbit RAG retrieval sidecar
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/.venv/bin/python scripts/rag_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/orbit-web.service >/dev/null <<EOF
[Unit]
Description=ProjectOrbit Astro server (chat API)
After=network-online.target orbit-rag.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
Environment=HOST=0.0.0.0
Environment=PORT=4321
EnvironmentFile=-$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/dist/server/entry.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable orbit-rag.service orbit-web.service
# restart (not just enable --now) so re-runs pick up new builds
sudo systemctl restart orbit-rag.service orbit-web.service

log "Done. Service status:"
sudo systemctl --no-pager --lines 3 status orbit-rag.service orbit-web.service || true

echo
echo "Smoke test from this box:"
echo "  curl -s http://127.0.0.1:8001/health"
echo "  curl -s -X POST http://127.0.0.1:4321/api/chat -H 'Content-Type: application/json' \\"
echo "       -d '{\"query\":\"what are your skills?\",\"sessionId\":\"ec2-smoke\"}'"
