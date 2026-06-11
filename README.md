# ProjectOrbit

A terminal-style portfolio website with a local-first AI assistant.

Visitors land in a WSL-flavored terminal: they run commands like `about`,
`skills`, and `projects` to explore your background — or type `ai-chat` and
ask questions in plain English. Answers come from a local RAG pipeline
(your markdown notes → embeddings → ChromaDB) and a local LLM via Ollama.
No personal data is committed to the repo and no third-party AI API is
involved: your data and the model both live on your machine.

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
                ┌──────────────────────────────┐
   Browser ───▶ │ Astro terminal UI (static)   │
                │ src/lib/commands.ts          │
                └──────────────┬───────────────┘
                               │ POST /api/chat {query, sessionId}
                ┌──────────────▼───────────────┐
                │ Astro API endpoint (Node)    │
                │ session cache · threshold    │
                └───────┬──────────────┬───────┘
          top-k chunks  │              │  prompt + context
                ┌───────▼──────┐  ┌────▼─────────┐
                │ rag_server.py │  │ Ollama       │
                │ MiniLM + Chroma│ │ llama3.1     │
                └───────▲──────┘  └──────────────┘
                        │ reads
                ┌───────┴──────┐
                │ chroma_db/   │  ◀── scripts/ingest.py ◀── src/data/*.md
                └──────────────┘
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

# 4. Local LLM
ollama pull llama3.1:latest # or any model; set OLLAMA_MODEL to match

# 5. Run (three processes)
ollama serve                # usually already running as a service
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
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.1:latest` | Generation model (`ollama pull` it first) |
| `RAG_SERVER_URL` | `http://127.0.0.1:8001` | Retrieval sidecar URL |
| `RAG_SERVER_PORT` | `8001` | Sidecar port |
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

## Deployment

Coming soon: AWS deployment guide (S3 data sync, server hosting for the
endpoint and sidecar, domain + TLS). The site builds with the Node adapter
(`npm run build` → `node dist/server/entry.mjs`), so any box that can run
Node, Python, and Ollama can serve it today.

## Contributing

Issues and PRs welcome. Keep these invariants:

- No personal data or credentials in source, ever — identity flows from
  env vars and gitignored data files.
- Minimal UI: every element needs a purpose.
- `npm run build` must pass; test the chat path with
  `python scripts/ingest.py --dry-run` and a local Ollama model.

## License

[MIT](LICENSE)
