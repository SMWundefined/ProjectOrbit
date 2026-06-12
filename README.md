# ProjectOrbit

A terminal-style portfolio website with a local-first AI assistant.

**Live at [wadoodsultan.com](https://wadoodsultan.com)**

Visitors land in a WSL-flavored terminal: they run commands like `about`,
`skills`, and `projects` to explore your background — or type `ai-chat` and
ask questions in plain English. Answers come from a RAG pipeline (your
markdown notes → embeddings → ChromaDB) feeding an LLM — Groq's API for
speed in production, or local Ollama when no API key is set. Your personal
data is never committed to the repo: it lives on your machine and in a
private S3 bucket only the server can read.

```
wadood@host:~$ ai-chat
Entering AI chat. Ask about my experience, projects, or interests.
ai ✦ what's your kubernetes experience?
...streams a grounded answer from your actual resume...
```

## Why

- A portfolio that demonstrates the engineering it describes: RAG,
  embeddings, vector search, streaming, and clean frontend work.
- Privacy by architecture — personal data files are gitignored and consumed
  locally at build/runtime, so the repo stays fully open-sourceable.
- Forkable: bring your own markdown files and env vars; nothing personal is
  hardcoded in source.

## Screenshots

<!-- TODO: Add screenshots/GIFs here.
     Suggested shots:
     1. The terminal with `help` output (full window incl. backdrop)
     2. `skills` ASCII bars
     3. ai-chat mode mid-stream (gold prompt visible)
     Record a short GIF of the streaming response if possible. -->

_Screenshots coming soon._

## Architecture

```
                         Browser (wadoodsultan.com)
                                   │ HTTPS
                          ┌────────▼────────┐
                          │   CloudFront    │
                          └───┬─────────┬───┘
                   static     │         │     /api/*
              ┌───────────────▼──┐   ┌──▼──────────────────────────┐
              │ S3 (private,OAC) │   │ EC2 t3.small                │
              │ dist/client      │   │  orbit-web  : Node, :4321   │
              └──────────────────┘   │  orbit-rag  : Python, :8001 │
                                     │  chroma_db on EBS           │
                                     └──┬─────────────┬────────────┘
                                        │ generation  │ data sync
                              ┌─────────▼──┐   ┌──────▼──────────────┐
                              │ Groq API   │   │ S3 private data     │
                              │ llama-3.1  │   │ bucket (md files)   │
                              └────────────┘   └─────────────────────┘

  Local dev: same code, no AWS — npm run dev + rag_server.py, and the
  chat endpoint falls back to local Ollama when GROQ_API_KEY is empty.
  CI/CD: push to main → GitHub Actions → S3 sync + CloudFront invalidation.
```

## Quick start

Prerequisites: Node 18+, Python 3.10+, [Ollama](https://ollama.com).

```bash
git clone https://github.com/SMWundefined/ProjectOrbit.git
cd ProjectOrbit

# 1. Frontend
npm install
cp .env.example .env        # then fill in the PUBLIC_* values

# 2. Data — start from the template (real files are gitignored)
cp src/data/template-professional.md src/data/professional.md
# edit src/data/professional.md (+ optional community.md / personal.md)

# 3. Python pipeline
pip install -r scripts/requirements.txt
python scripts/ingest.py    # chunks + embeds your data into chroma_db/

# 4. LLM — pick one:
#    a) Groq (fast, free tier): create a key at https://console.groq.com
#       and set GROQ_API_KEY in .env
#    b) Local Ollama: leave GROQ_API_KEY empty and
ollama pull llama3.1:latest # or any model; set OLLAMA_MODEL to match

# 5. Run (two processes, plus Ollama if using option b)
python scripts/rag_server.py
npm run dev                 # http://localhost:4321
```

Type `help` in the terminal, then `ai-chat` to talk to the assistant.

## Using it with your own data

1. Fork the repo.
2. Copy `src/data/template-professional.md` to `src/data/professional.md`
   and replace the fictional content with yours, keeping the structure
   (`#` sections, `**bold**` job titles, one bullet per project/skill
   category — the chunker keys on these markers).
3. Optionally add `src/data/community.md` and `src/data/personal.md`
   (see `scripts/README-scripts.md` for their sections).
4. Fill in `.env` — every name, link, and title shown in the UI comes from
   env vars, so the source stays personal-data-free.
5. Re-run `python scripts/ingest.py` whenever the data files change.

Your `professional.md`, `community.md`, `personal.md`, `.env`, and
`chroma_db/` never leave your machine: all are gitignored.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHROMA_PATH` | `./chroma_db` | ChromaDB persistence directory |
| `DATA_DIR` | `./src/data` | Markdown data location |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model (ingest + query must match) |
| `GROQ_API_KEY` | empty | Groq API key from [console.groq.com](https://console.groq.com); empty = fall back to Ollama |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq generation model |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL (fallback / local dev) |
| `OLLAMA_MODEL` | `llama3.1:latest` | Ollama model (`ollama pull` it first) |
| `RAG_SERVER_URL` | `http://127.0.0.1:8001` | Retrieval sidecar URL |
| `RAG_SERVER_PORT` / `RAG_SERVER_HOST` | `8001` / `127.0.0.1` | Sidecar bind (Docker overrides host to `0.0.0.0`) |
| `RAG_MIN_SIMILARITY` | `0.32` | Below this cosine score, answer with fallback links |
| `PUBLIC_SITE_TITLE` | `guest@orbit: ~` | Browser tab + title bar text |
| `PUBLIC_TERMINAL_USER` / `PUBLIC_TERMINAL_HOST` | `guest` / `orbit` | Prompt renders `user@host:~$` |
| `PUBLIC_GITHUB_URL`, `PUBLIC_LINKEDIN_URL`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_WEBSITE_URL` | empty | `contact` command + AI fallback links |

## Project layout

```
src/components/Terminal.astro   terminal window, backdrop, parallax
src/lib/commands.ts             command registry (pure logic)
src/lib/terminal.ts             UI controller: input, history, chat mode
src/pages/api/chat.ts           RAG + Ollama streaming endpoint
src/data/                       your markdown data (gitignored except template)
scripts/ingest.py               markdown -> chunks -> embeddings -> ChromaDB
scripts/rag_server.py           localhost retrieval sidecar
scripts/README-scripts.md       pipeline details and expected output
```

## Switching LLM backends

The chat endpoint picks its generator from one env var — no code changes:

| Want | Set in `.env` (or `/opt/projectorbit/.env` on EC2) |
| --- | --- |
| **Groq** (production default) | `GROQ_API_KEY=gsk_...` |
| **Local Ollama** (dev / offline) | `GROQ_API_KEY=` (empty) — uses `OLLAMA_HOST`/`OLLAMA_MODEL` |
| **Homelab server** (future) | `GROQ_API_KEY=` (empty) and `OLLAMA_HOST=http://your-homelab-host:11434` — any machine running Ollama works, including over Tailscale/WireGuard |

After editing the env on EC2, re-run `bash setup-ec2.sh` (env values are
inlined into the server bundle at build time, so a rebuild + restart is the
reliable path — the script does both).

## Docker

Run the whole stack (Astro server + RAG sidecar) in containers:

```bash
docker compose build                                       # one-time / after changes
docker compose run --rm rag-sidecar python scripts/ingest.py   # build the vector store
docker compose up                                          # http://localhost:4321
```

Notes:

- `.env` is read at container start (secrets are never baked into images;
  see `.dockerignore`). `PUBLIC_*` values pass as build args because they
  are inlined into the static HTML.
- ChromaDB (`chroma_db/`) and `src/data/` mount as volumes — re-run the
  ingest one-liner after editing data files.
- Ollama is **not** containerized; the compose file points the fallback at
  the host's Ollama via `host.docker.internal`. Groq needs no container.
- Without Docker, everything still runs natively: `npm run dev` +
  `python scripts/rag_server.py` (see Quick start).

## Deployment

The production architecture is AWS: CloudFront serves the static build from
a private S3 bucket (`dist/client/`), and `/api/*` routes to an EC2 instance
running the Node server (`dist/server/entry.mjs`) plus the Python RAG
sidecar as systemd services. Personal data lives in a private S3 bucket
only the instance role can read. See `scripts/setup-ec2.sh` (server
bootstrap) and `scripts/update-data.sh` (data refresh workflow).

### CI/CD (GitHub Actions)

Pushes to `main` trigger `.github/workflows/deploy.yml`: build → sync
`dist/client/` to S3 → invalidate CloudFront.

Configure in repo **Settings → Secrets and variables → Actions**:

**Secrets** (sensitive):

| Secret | Value |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials for a deploy IAM user with S3 write + CloudFront invalidation rights |
| `S3_BUCKET_NAME` | The static site bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | The distribution in front of it |

**Variables** (public — they're rendered into the site): the seven
`PUBLIC_*` values from `.env.example` (`PUBLIC_SITE_TITLE`,
`PUBLIC_TERMINAL_USER`, `PUBLIC_TERMINAL_HOST`, `PUBLIC_GITHUB_URL`,
`PUBLIC_LINKEDIN_URL`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_WEBSITE_URL`).
CI has no `.env` (it's gitignored), so without these the deployed site
renders the anonymous `guest@orbit` fallback.

Server-side changes (anything under `src/pages/api/` or `scripts/`) deploy
by re-running `setup-ec2.sh` on the instance — it pulls `main`, rebuilds,
and restarts the services.

## Contributing

Issues and PRs welcome. Keep these invariants:

- No personal data or credentials in source, ever — identity flows from
  env vars and gitignored data files.
- Minimal UI: every element needs a purpose.
- `npm run build` must pass; test the chat path with
  `python scripts/ingest.py --dry-run` and a local Ollama model.

## License

[MIT](LICENSE)
