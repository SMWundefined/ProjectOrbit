# scripts/

Python tooling for the ProjectOrbit RAG pipeline.

## Setup

Requires Python 3.10+.

```bash
# from the project root (a virtualenv is recommended)
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -r scripts/requirements.txt
```

The first install downloads PyTorch via sentence-transformers, which is large
(a few GB). The embedding model itself (~90 MB) downloads automatically on the
first real run and is cached afterwards.

## Configuration

`ingest.py` reads the project `.env` (copy `.env.example` if you have none):

| Variable          | Default                                  | Meaning                          |
| ----------------- | ---------------------------------------- | -------------------------------- |
| `DATA_DIR`        | `./src/data`                             | Where your markdown data lives   |
| `CHROMA_PATH`     | `./chroma_db`                            | Where ChromaDB persists vectors  |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model (keep in sync with the chat endpoint) |

It expects up to three files in `DATA_DIR` (all gitignored — see
`src/data/template-professional.md` for the format):

- `professional.md` — education, work experience, projects, skills
- `community.md` — conferences, summits, community involvement
- `personal.md` — bio, socials, contact, interests, fallback links

Missing files are skipped with a notice, so a fresh fork can start with just a
copy of the template.

## Running

```bash
# preview the chunking without embedding anything (fast, no model download)
python scripts/ingest.py --dry-run

# full run: chunk -> embed -> store in ChromaDB
python scripts/ingest.py
```

Re-running replaces the `portfolio` collection wholesale, so the store always
mirrors the current state of your data files.

## Expected output

```
ProjectOrbit ingest
===================
Data dir   : ./src/data
Chroma path: ./chroma_db
Model      : sentence-transformers/all-MiniLM-L6-v2

professional.md
  School and Education                 1 chunk
  Work Experience                      4 chunks
  Projects                             9 chunks
  ...

Total: NN chunks

Loading embedding model (sentence-transformers/all-MiniLM-L6-v2)...
Embedding NN chunks...
Stored in ChromaDB collection 'portfolio' at ./chroma_db
```

A `chunk` is one unit of retrievable context: a single job, a single project,
a single skill category, or a whole short section. Each chunk is stored with
`{section, file, type, source}` metadata so the chat endpoint can cite and
filter by origin.
