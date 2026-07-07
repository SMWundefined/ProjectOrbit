# ProjectOrbit

A two-faced portfolio: a terminal whose only interface is an AI trained on
one subject, and a "retro" static site for the pre-AI web nostalgics.

**Live at [wadoodsultan.com](https://wadoodsultan.com)**

Visitors land in a WSL-flavored terminal and simply talk. There are no
commands to learn — everything typed goes to **WadoodLLM**, a
retrieval-augmented LLM that answers questions about the site's owner from
private markdown notes (markdown → chunks → embeddings → ChromaDB →
Groq/Ollama). Typing `retro` warps — through an actual wormhole animation —
to `/retro`, a fully static portfolio with a living neural-network canvas,
a star that lives its stellar lifecycle down the page margin, and zero AI.

```
WadoodLLM ✦ what does he do at Meta?
...streams a grounded answer from the owner's actual notes...
```

Personal data is never committed: the markdown notes live on the owner's
machine and in a private S3 bucket only the server can read. The repo stays
fully open-sourceable and forkable.

## Why

- A portfolio that demonstrates the engineering it describes: RAG,
  embeddings, vector search, streaming, prompt hardening, and clean
  dependency-free frontend work.
- Privacy by architecture — personal data files are gitignored and consumed
  locally at build/runtime; analytics are self-hosted and cookieless.
- Forkable: bring your own markdown files and env vars; nothing personal is
  hardcoded in source.

## Architecture

```
                        Browser (wadoodsultan.com)
                                  │ HTTPS
                         ┌────────▼────────┐
                         │   CloudFront    │
                         └──┬─────┬─────┬──┘
                  static    │     │     │  /api/*  and  /stats/*
             ┌──────────────▼─┐   │   ┌─▼───────────────────────────────┐
             │ S3 (private,   │   │   │ EC2 (Ubuntu, systemd)           │
             │ OAC) dist/     │   │   │  orbit-web : Node/Astro, :4321  │
             │ client         │   │   │  orbit-rag : Python,     :8001  │
             └────────────────┘   │   │  umami     : analytics,  :3100  │
                                  │   │  chroma_db + chat.jsonl on EBS  │
                                  │   └──┬──────────────┬───────────────┘
                                  │      │ generation   │ data sync
                                  │  ┌───▼────────┐  ┌──▼───────────────┐
                                  │  │ Groq API   │  │ S3 private data  │
                                  │  │ llama-3.1  │  │ bucket (md files)│
                                  │  └────────────┘  └──────────────────┘

  Local dev: same code, no AWS — npm run dev + rag_server.py; the chat
  endpoint falls back to local Ollama when GROQ_API_KEY is empty.
  CI/CD: push to main → GitHub Actions → S3 sync + CloudFront invalidation.
  Server code deploys separately (rebuild + restart on the instance).
```

### Life of a chat message (short version)

Everything typed in the terminal POSTs to `/api/chat` and passes through
layered gates — cheapest and most deterministic first: small talk answered
in persona without the LLM, then deterministic refusals for relay requests,
prompt-injection attempts, and off-topic asks, then vector retrieval with a
per-session cache, and finally a similarity gate — if the notes can't
support an answer, the model isn't allowed to invent one. Generation
streams from Groq (or local Ollama) under a hardened single-subject system
prompt. Self-hosted, cookieless analytics record which questions the notes
couldn't answer, so the knowledge base improves where visitors actually
push on it.

## Quick start

Prerequisites: Node 18+, Python 3.10+, and either a
[Groq](https://console.groq.com) key or [Ollama](https://ollama.com).

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
#    a) Groq (fast, free tier): set GROQ_API_KEY in .env
#    b) Local Ollama: leave GROQ_API_KEY empty and
ollama pull llama3.1:latest # or any model; set OLLAMA_MODEL to match

# 5. Run (two processes, plus Ollama if using option b)
python scripts/rag_server.py
npm run dev                 # http://localhost:4321
```

Then just type a question at the prompt. `retro` switches to the static
site; `clear` and `exit` are the only other words the terminal keeps for
itself.

## Using it with your own data

1. Fork the repo.
2. Copy `src/data/template-professional.md` to `src/data/professional.md`
   and replace the fictional content with yours, keeping the structure
   (`#` sections, `**bold**` job titles, one bullet per project/skill
   category — the chunker keys on these markers).
3. Optionally add `src/data/community.md` and `src/data/personal.md`
   (see `scripts/README-scripts.md` for their sections). HTML comments are
   stripped at ingest, so `<!-- TODO -->` notes never reach the model.
4. Fill in `.env` — every name, link, and title shown in the UI comes from
   env vars, so the source stays personal-data-free.
5. Edit `src/data/retro-content.ts` for the static `/retro` pages (they
   render at build time and don't touch the AI pipeline).
6. Re-run `python scripts/ingest.py` whenever the data files change.

Your `professional.md`, `community.md`, `personal.md`, `.env`, and
`chroma_db/` never leave your machine: all are gitignored.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHROMA_PATH` | `./chroma_db` | ChromaDB persistence directory |
| `DATA_DIR` | `./src/data` | Markdown data location |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model (ingest + query must match) |
| `GROQ_API_KEY` | empty | Groq API key; empty = fall back to Ollama |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq generation model |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL (fallback / local dev) |
| `OLLAMA_MODEL` | `llama3.1:latest` | Ollama model (`ollama pull` it first) |
| `RAG_SERVER_URL` | `http://127.0.0.1:8001` | Retrieval sidecar URL |
| `RAG_SERVER_PORT` / `RAG_SERVER_HOST` | `8001` / `127.0.0.1` | Sidecar bind (Docker overrides host to `0.0.0.0`) |
| `RAG_MIN_SIMILARITY` | `0.32` | Below this cosine score the LLM may not answer |
| `CHAT_LOG_FILE` | empty | JSONL chat telemetry path (empty = no file log) |
| `UMAMI_URL` / `UMAMI_WEBSITE_ID` | empty | Self-hosted Umami endpoint + site id (empty = no analytics events) |
| `PUBLIC_SITE_TITLE` / `PUBLIC_TAB_TITLE` | `guest@orbit: ~` | Terminal title bar / browser tab |
| `PUBLIC_TERMINAL_USER` / `PUBLIC_TERMINAL_HOST` | `guest` / `orbit` | Terminal identity |
| `PUBLIC_GITHUB_URL`, `PUBLIC_LINKEDIN_URL`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_WEBSITE_URL` | empty | Contact surfaces + AI fallback links |

## Project layout

```
src/pages/index.astro              terminal page (static shell)
src/components/Terminal.astro      terminal window, backdrop, wormhole exit
src/lib/terminal.ts                UI controller: input, history, streaming,
                                   ghost hints, virtual-keyboard handling
src/pages/api/chat.ts              chat endpoint: guards → RAG → LLM stream,
                                   persona pools, telemetry
src/pages/retro/*.astro            static portfolio pages (About → Contact)
src/components/retro/              neural canvas, page transitions + life
                                   star, black-hole menu, timeline
src/data/retro-content.ts          all /retro content (single source object)
src/data/*.md                      AI knowledge base (gitignored; template
                                   provided)
src/styles/                        global tokens + retro theme
scripts/ingest.py                  markdown → chunks → embeddings → ChromaDB
scripts/rag_server.py              localhost retrieval sidecar
scripts/setup-ec2.sh               server bootstrap (systemd services)
scripts/update-data.sh             data refresh: S3 → EC2 → re-ingest
public/                            favicons, resume, robots.txt, sitemap.xml
```

## Switching LLM backends

The chat endpoint picks its generator from one env var — no code changes:

| Want | Set in `.env` (or `/opt/projectorbit/.env` on EC2) |
| --- | --- |
| **Groq** (production default) | `GROQ_API_KEY=gsk_...` |
| **Local Ollama** (dev / offline) | `GROQ_API_KEY=` (empty) — uses `OLLAMA_HOST`/`OLLAMA_MODEL` |
| **Homelab server** | `GROQ_API_KEY=` (empty) and `OLLAMA_HOST=http://your-homelab-host:11434` — any machine running Ollama works, including over Tailscale/WireGuard |

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

## Deployment

Production is AWS: CloudFront serves the static build from a private S3
bucket (OAC), and `/api/*` + `/stats/*` route to an EC2 instance running
the Node server, the Python RAG sidecar, and self-hosted Umami as systemd
services. Personal data lives in a private S3 bucket only the instance can
read. See `scripts/setup-ec2.sh` (server bootstrap) and
`scripts/update-data.sh` (data refresh workflow).

### CI/CD (GitHub Actions)

Pushes to `main` trigger `.github/workflows/deploy.yml`: build → sync
`dist/client/` to S3 → invalidate CloudFront.

Configure in repo **Settings → Secrets and variables → Actions**:

**Secrets**: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (deploy IAM user
with S3 write + CloudFront invalidation rights), `S3_BUCKET_NAME`,
`CLOUDFRONT_DISTRIBUTION_ID`.

**Variables** (public — they're rendered into the site): the `PUBLIC_*`
values from `.env.example`. CI has no `.env` (it's gitignored), so without
these the deployed site renders the anonymous `guest@orbit` fallback.

Server-side changes (anything under `src/pages/api/` or `scripts/`) deploy
by pulling `main` on the instance, rebuilding, and restarting `orbit-web` —
or by re-running `setup-ec2.sh`, which does all of it.

## Contributing

Issues and PRs welcome. Keep these invariants:

- No personal data or credentials in source, ever — identity flows from
  env vars and gitignored data files.
- Minimal UI: every element needs a purpose.
- The chat endpoint's guard order (small talk → relay → injection →
  off-topic → similarity gate) is a security boundary — the LLM never sees
  what a regex already refused.
- `npm run build` must pass; test the chat path with
  `python scripts/ingest.py --dry-run` and a local Ollama model.

## License

[MIT](LICENSE)
