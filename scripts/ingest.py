"""ProjectOrbit RAG ingestion.

Reads personal markdown files from DATA_DIR, chunks them by structure,
embeds each chunk locally with sentence-transformers, and stores
everything in a persistent ChromaDB collection at CHROMA_PATH.

Chunking rules
--------------
- ``#`` headings split a file into sections.
- Work Experience sections split further: every line starting with a
  ``**bold**`` job title becomes its own chunk (title + its bullets).
- Project sections produce one chunk per bullet (one bullet = one project).
- Skills sections produce one chunk per bullet (one bullet = one category).
- Every other section is stored as a single chunk.

Each chunk carries metadata: {section, file, type, source}.

Usage
-----
    python scripts/ingest.py            # chunk, embed, store
    python scripts/ingest.py --dry-run  # chunk and print summary only
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency hint beats a traceback
    sys.exit("Missing dependency. Run: pip install -r scripts/requirements.txt")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
DATA_DIR = os.getenv("DATA_DIR", "./src/data")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
COLLECTION_NAME = "portfolio"

DATA_FILES = ("professional.md", "community.md", "personal.md")


@dataclass
class Chunk:
    text: str
    section: str
    file: str
    type: str
    source: str = "local"


def strip_html_comments(text: str) -> str:
    """Remove <!-- TODO --> guidance comments so they are never embedded."""
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def split_sections(text: str) -> list[tuple[str, str]]:
    """Split markdown into (heading, body) pairs on top-level # headings."""
    sections: list[tuple[str, str]] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    for line in text.splitlines():
        if line.startswith("# "):
            if current_heading is not None:
                sections.append((current_heading, "\n".join(current_lines)))
            current_heading = line[2:].strip()
            current_lines = []
        elif current_heading is not None:
            current_lines.append(line)

    if current_heading is not None:
        sections.append((current_heading, "\n".join(current_lines)))
    return sections


def clean_body(body: str) -> str:
    """Drop separator rules and surplus blank lines."""
    lines = [line.rstrip() for line in body.splitlines()]
    lines = [line for line in lines if not re.fullmatch(r"-{3,}", line.strip())]
    return "\n".join(lines).strip()


# A job title line is `**Title** - ...` at the start of a line. Bold mid-bullet
# emphasis like `**\- Promoted...` must not start a new chunk.
JOB_TITLE_RE = re.compile(r"^\*\*(?!\\)")


def chunk_jobs(body: str) -> list[str]:
    """One chunk per job: the bold title line plus everything until the next."""
    chunks: list[str] = []
    current: list[str] = []
    for line in body.splitlines():
        if JOB_TITLE_RE.match(line) and current:
            chunks.append("\n".join(current).strip())
            current = []
        current.append(line)
    if current:
        chunks.append("\n".join(current).strip())
    return [c for c in chunks if c]


def chunk_bullets(body: str) -> list[str]:
    """One chunk per top-level bullet (projects, skill categories)."""
    return [line.strip() for line in body.splitlines() if line.strip().startswith("- ")]


def chunk_section(file_name: str, heading: str, body: str) -> list[Chunk]:
    body = clean_body(body)
    if not body:
        return []

    lowered = heading.lower()

    if "experience" in lowered:
        texts, chunk_type = chunk_jobs(body), "job"
    elif "project" in lowered:
        texts, chunk_type = chunk_bullets(body), "project"
    elif "skill" in lowered:
        texts, chunk_type = chunk_bullets(body), "skill-category"
    else:
        texts, chunk_type = [body], "section"

    # Prefix the section name so retrieval keeps context even for short chunks.
    return [
        Chunk(text=f"{heading}\n{text}", section=heading, file=file_name, type=chunk_type)
        for text in texts
        if text
    ]


def load_chunks(data_dir: Path) -> tuple[list[Chunk], list[str]]:
    chunks: list[Chunk] = []
    missing: list[str] = []
    for file_name in DATA_FILES:
        path = data_dir / file_name
        if not path.exists():
            missing.append(file_name)
            continue
        text = strip_html_comments(path.read_text(encoding="utf-8"))
        for heading, body in split_sections(text):
            chunks.extend(chunk_section(file_name, heading, body))
    return chunks, missing


def print_summary(chunks: list[Chunk], missing: list[str]) -> None:
    print()
    print("ProjectOrbit ingest")
    print("===================")
    print(f"Data dir   : {DATA_DIR}")
    print(f"Chroma path: {CHROMA_PATH}")
    print(f"Model      : {EMBEDDING_MODEL}")

    for file_name in DATA_FILES:
        file_chunks = [c for c in chunks if c.file == file_name]
        if not file_chunks:
            continue
        print(f"\n{file_name}")
        seen: list[str] = []
        for chunk in file_chunks:
            if chunk.section not in seen:
                seen.append(chunk.section)
        for section in seen:
            count = sum(1 for c in file_chunks if c.section == section)
            label = "chunk" if count == 1 else "chunks"
            print(f"  {section:<36} {count} {label}")

    for file_name in missing:
        print(f"\n{file_name}: not found, skipped "
              f"(copy template-professional.md if you are setting up a fork)")

    print(f"\nTotal: {len(chunks)} chunks")


def store(chunks: list[Chunk]) -> None:
    # Imported lazily so --dry-run works before heavy deps are installed.
    import chromadb
    from sentence_transformers import SentenceTransformer

    print(f"\nLoading embedding model ({EMBEDDING_MODEL})...")
    model = SentenceTransformer(EMBEDDING_MODEL)

    print(f"Embedding {len(chunks)} chunks...")
    embeddings = model.encode([c.text for c in chunks], show_progress_bar=False)

    client = chromadb.PersistentClient(path=str(PROJECT_ROOT / CHROMA_PATH))
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass  # first run, nothing to replace
    collection = client.create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})

    collection.add(
        ids=[f"{c.file}::{i}" for i, c in enumerate(chunks)],
        documents=[c.text for c in chunks],
        embeddings=embeddings.tolist(),
        metadatas=[
            {"section": c.section, "file": c.file, "type": c.type, "source": c.source}
            for c in chunks
        ],
    )
    print(f"Stored in ChromaDB collection '{COLLECTION_NAME}' at {CHROMA_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest markdown data into ChromaDB")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="chunk and print the summary without embedding or storing",
    )
    args = parser.parse_args()

    data_dir = PROJECT_ROOT / DATA_DIR
    if not data_dir.exists():
        sys.exit(f"Data directory not found: {data_dir}")

    chunks, missing = load_chunks(data_dir)
    if not chunks:
        sys.exit("No chunks produced — are the data files empty?")

    print_summary(chunks, missing)

    if args.dry_run:
        print("Dry run: nothing embedded or stored.")
        return

    store(chunks)


if __name__ == "__main__":
    main()
