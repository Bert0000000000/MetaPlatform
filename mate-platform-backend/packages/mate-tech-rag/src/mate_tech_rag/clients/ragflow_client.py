"""RAGFlowClient (ingest pipeline: DeepDoc parsing + chunking).

v3.0 Plan D: RAGFlow is the document parsing + chunking service.
- Input: PDF / DOCX / MD / TXT (binary or text)
- Output: list of cleaned text chunks
- Protocol: parse() -> chunks

Current: InMemory placeholder (pluggable chunking strategies via chunking.py).
Real RAGFlow: infiniflow/ragflow:v0.13 HTTP API.
"""
from __future__ import annotations

import threading
import uuid
from typing import Protocol

from mate_tech_rag.chunking import Chunker, create_chunker


class RAGFlowClient(Protocol):
    def parse(self, content: str, document_id: str, *, metadata: dict[str, str] | None = None) -> list[str]: ...
    def parse_bytes(self, raw: bytes, document_id: str, *, filename: str = "", metadata: dict[str, str] | None = None) -> list[str]: ...
    def count(self) -> int: ...


class InMemoryRAGFlowClient:
    """Lightweight InMemory RAGFlow with pluggable chunking strategies.

    Supports recursive / markdown / semantic / sliding-window chunking via
    the ``chunker_strategy`` parameter. Real RAGFlow does DeepDoc (layout
    analysis, table extraction, OCR); this implementation focuses on
    text-mode fallback.
    """

    DEFAULT_CHUNK_SIZE = 512
    DEFAULT_OVERLAP = 64

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP,
        chunker_strategy: str = "recursive",
    ) -> None:
        self._chunks: dict[str, tuple[str, str, str]] = {}  # cid -> (document_id, text, meta)
        self._lock = threading.Lock()
        self._chunk_size = chunk_size
        self._overlap = overlap
        self._chunker_strategy = chunker_strategy
        self._chunker: Chunker = create_chunker(chunker_strategy)

    def parse(self, content: str, document_id: str, *, metadata: dict[str, str] | None = None) -> list[str]:
        """Parse text content into chunks using the configured chunking strategy."""
        if not content.strip():
            return []
        chunks = self._chunker.chunk(content, chunk_size=self._chunk_size, overlap=self._overlap)
        # Assign chunk ids
        result: list[str] = []
        with self._lock:
            for text in chunks:
                if not text.strip():
                    continue
                cid = str(uuid.uuid4())
                self._chunks[cid] = (document_id, text, str(metadata or {}))
                result.append(text)
        return result

    def parse_bytes(self, raw: bytes, document_id: str, *, filename: str = "", metadata: dict[str, str] | None = None) -> list[str]:
        """Parse binary file. Currently supports text-like encodings only."""
        for enc in ("utf-8", "utf-8-sig", "gbk", "latin-1"):
            try:
                text = raw.decode(enc)
                meta = dict(metadata or {})
                if filename:
                    meta["filename"] = filename
                return self.parse(text, document_id, metadata=meta)
            except UnicodeDecodeError:
                continue
        return []

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)
