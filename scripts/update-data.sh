#!/usr/bin/env bash
# ProjectOrbit "update my resume" workflow — run from your LOCAL machine
# (Git Bash or WSL on Windows) at the project root:
#   bash scripts/update-data.sh
#
# 1. Uploads your edited markdown data files to the private S3 bucket
# 2. SSHes into the EC2 instance, pulls the fresh data down, re-runs
#    ingest.py, and restarts the retrieval sidecar
#
# Requires: aws CLI configured locally, the EC2 key at $SSH_KEY.

set -euo pipefail

DATA_BUCKET="projectorbit-data-633017683854"
AWS_REGION="us-east-1"
EC2_HOST="ubuntu@52.91.152.40"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/projectorbit-key.pem}"
APP_DIR="/opt/projectorbit"
DATA_DIR="src/data"

FILES=(professional.md community.md personal.md)

echo "==> Uploading data files to s3://$DATA_BUCKET"
for f in "${FILES[@]}"; do
  if [ -f "$DATA_DIR/$f" ]; then
    aws s3 cp "$DATA_DIR/$f" "s3://$DATA_BUCKET/$f" --region "$AWS_REGION"
  else
    echo "    (skipping $f — not present locally)"
  fi
done

echo "==> Refreshing data + vector store on EC2"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$EC2_HOST" bash -s <<EOF
set -euo pipefail
cd "$APP_DIR"
aws s3 sync "s3://$DATA_BUCKET" "$APP_DIR/$DATA_DIR" --region "$AWS_REGION" \
  --exclude "*" --include "professional.md" --include "community.md" --include "personal.md"
"$APP_DIR/.venv/bin/python" scripts/ingest.py
sudo systemctl restart orbit-rag.service
sleep 3
curl -sf http://127.0.0.1:8001/health && echo
EOF

echo "==> Done. New data is live."
