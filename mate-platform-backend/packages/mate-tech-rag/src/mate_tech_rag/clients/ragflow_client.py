"""RAGFlowClient (ingest pipeline: DeepDoc parsing + chunking).

v3.0 Plan D: RAGFlow is the document parsing + chunking service.
- Input: PDF / DOCX / MD / TXT (binary or text)
- Output: list of cleaned text chunks
- Protocol: parse() -> chunks

Current: InMemory placeholder (regex-based paragraph split + length-based chunking).
Real RAGFlow: infiniflow/ragflow:v0.13 HTTP API.
"""
from __future__ import annotations

import re
import threading
import uuid
from typing import Protocol

_PARAGRAPH_RE = re.compile(r"\n\s*\n")
_SENTENCE_RE = re.compile(r"(?<=[.!?。!?])\s+")


class RAGFlowClient(Protocol):
    def parse(self, content: str, document_id: str, *, metadata: dict[str, str] | None = None) -> list[str]: ...
    def parse_bytes(self, raw: bytes, document_id: str, *, filename: str = "", metadata: dict[str, str] | None = None) -> list[str]: ...
    def count(self) -> int: ...


class InMemoryRAGFlowClient:
    """Lightweight InMemory RAGFlow: paragraph split + sentence-boundary chunking.

    Real RAGFlow does DeepDoc (layout analysis, table extraction, OCR).
    This implementation focuses on text-mode fallback.
    """

    DEFAULT_CHUNK_SIZE = 256
    DEFAULT_OVERLAP = 32

    def __init__(self, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_OVERLAP) -> None:
        self._chunks: dict[str, tuple[str, str, str]] = {}  # cid -> (document_id, text, meta)
        self._lock = threading.Lock()
        self._chunk_size = chunk_size
        self._overlap = overlap

    def parse(self, content: str, document_id: str, *, metadata: dict[str, str] | None = None) -> list[str]:
        """Parse text content into chunks."""
        paragraphs = [p.strip() for p in _PARAGRAPH_RE.split(content) if p.strip()]
        if not paragraphs:
            return []
        chunks: list[str] = []
        for para in paragraphs:
            if len(para) <= self._chunk_size:
                chunks.append(para)
            else:
                chunks.extend(self._split_long_paragraph(para))
        # Assign chunk ids
        result: list[str] = []
        with self._lock:
            for text in chunks:
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

    def _split_long_paragraph(self, para: str) -> list[str]:
        """Split long paragraph by sentence boundaries with overlap."""
        sentences = _SENTENCE_RE.split(para)
        chunks: list[str] = []
        current = ""
        for sent in sentences:
            if len(current) + len(sent) + 1 > self._chunk_size and current:
                chunks.append(current.strip())
                # Keep tail as overlap
                tail = current[-self._overlap :] if len(current) > self._overlap else ""
                current = tail + " " + sent
            else:
                current = (current + " " + sent).strip()
        if current:
            chunks.append(current)
        return chunks

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)
