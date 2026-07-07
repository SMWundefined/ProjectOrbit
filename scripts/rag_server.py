"""ProjectOrbit retrieval sidecar.

A tiny localhost-only HTTP server that gives the Astro chat endpoint
access to the ChromaDB store written by ingest.py, using the exact same
sentence-transformers model for query embedding — so similarity scores
are directly comparable to what was ingested.

Endpoints
---------
GET  /health          -> {"status": "ok", "chunks": <count>}
POST /query           {"query": str, "k": int}
                      -> {"results": [{"text", "score", "metadata"}, ...]}
                      score is cosine similarity (1 = identical, 0 = unrelated)

Usage
-----
    python scripts/rag_server.py        # serves on 127.0.0.1:8001

Run ingest.py at least once first. No external web access: the server
binds to localhost only and serves your already-local data.
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency hint beats a traceback
    sys.exit("Missing dependency. Run: pip install -r scripts/requirements.txt")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
PORT = int(os.getenv("RAG_SERVER_PORT", "8001"))
# 127.0.0.1 everywhere except containers, where Docker networking needs 0.0.0.0
HOST = os.getenv("RAG_SERVER_HOST", "127.0.0.1")
COLLECTION_NAME = "portfolio"
MAX_K = 10


def load_retriever():
    import chromadb
    from sentence_transformers import SentenceTransformer

    print(f"Loading embedding model ({EMBEDDING_MODEL})...")
    model = SentenceTransformer(EMBEDDING_MODEL)

    client = chromadb.PersistentClient(path=str(PROJECT_ROOT / CHROMA_PATH))
    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        sys.exit(
            f"Collection '{COLLECTION_NAME}' not found at {CHROMA_PATH}. "
            "Run `python scripts/ingest.py` first."
        )
    return model, collection


MODEL, COLLECTION = load_retriever()


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - http.server naming
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "chunks": COLLECTION.count()})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - http.server naming
        if self.path != "/query":
            self._send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            query = str(payload.get("query", "")).strip()
            k = max(1, min(int(payload.get("k", 5)), MAX_K))
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "invalid request body"})
            return

        if not query:
            self._send_json(400, {"error": "query must be a non-empty string"})
            return

        embedding = MODEL.encode([query])[0]
        found = COLLECTION.query(
            query_embeddings=[embedding.tolist()],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        results = [
            {
                "text": document,
                # cosine distance -> cosine similarity
                "score": round(1.0 - distance, 4),
                "metadata": metadata,
            }
            for document, metadata, distance in zip(
                found["documents"][0], found["metadatas"][0], found["distances"][0]
            )
        ]
        self._send_json(200, {"results": results})

    def log_message(self, format: str, *args) -> None:
        print(f"[rag-server] {self.address_string()} {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"RAG server ready on http://{HOST}:{PORT} "
          f"({COLLECTION.count()} chunks in '{COLLECTION_NAME}')")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
