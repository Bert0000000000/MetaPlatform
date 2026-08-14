"""RAGFlowClient (ingest pipeline: DeepDoc parsing + chunking).

v3.0 Plan D: RAGFlow is the document parsing + chunking service.
- Input: PDF / DOCX / MD / TXT (binary or text)
- Output: list of cleaned text chunks
- Protocol: parse() -> chunks

Current: InMemory placeholder (pluggable chunking strategies via chunking.py).
Real RAGFlow: infiniflow/ragflow:v0.13 HTTP API.

PATCH fix 1 (chunk_strategy/size/overlap 真正生效)
--------------------------------------------------
The RAG retrieval configuration page (mate-app-kb ``KbRetrievalConfig``)
and the IAM SystemConfig admin page (``rag.chunk.*`` keys) both store
chunking parameters. Before this patch the backend InMemoryRAGFlowClient
was constructed once with hard-coded defaults so any runtime update was
silently ignored ("config stored but not effective").

We now accept ``chunker_strategy`` / ``chunk_size`` / ``overlap`` as
per-call kwargs on both ``parse()`` and ``parse_bytes()``. The underlying
``Chunker`` instance is cached by ``(strategy, chunk_size, overlap)`` so
the override is cheap. When the caller omits an override the instance
default applies, so the existing API contract is fully preserved.

P1.5 architecture hook: file-type parser dispatch
-------------------------------------------------
``parse_bytes`` consults ``parser_registry`` (``.ext`` -> parser_fn) before
falling back to the text-encoding fallback path. Real DeepDoc parsers
(PDF/Word/PPT) will be added in P1.6 by extending ``parser_registry``;
the wiring + fallback path is in place and unit-tested.
"""
from __future__ import annotations

import os
import threading
import uuid
from collections.abc import Callable
from typing import Protocol

from mate_tech_rag.chunking import Chunker, create_chunker


class RAGFlowClient(Protocol):
    def parse(self, content: str, document_id: str, *, metadata: dict[str, str] | None = None) -> list[str]: ...
    def parse_bytes(self, raw: bytes, document_id: str, *, filename: str = "", metadata: dict[str, str] | None = None) -> list[str]: ...
    def count(self) -> int: ...


# A parser_fn takes (raw bytes, document_id, filename, metadata) plus
# optional chunk_size/overlap kwargs, and returns a list of cleaned text
# chunks. Raising or returning an empty list signals "use the fallback".
ParserFn = Callable[..., list[str]]


def _md_parser(
    raw: bytes,
    document_id: str,
    filename: str,
    metadata: dict[str, str] | None,
    *,
    chunk_size: int = 512,
    overlap: int = 64,
) -> list[str]:
    """Markdown parser: decode UTF-8 and route through MarkdownChunker."""
    text = raw.decode("utf-8", errors="replace")
    if not text.strip():
        return []
    chunker: Chunker = create_chunker("markdown")
    chunks = chunker.chunk(text, chunk_size=chunk_size, overlap=overlap)
    return [c for c in chunks if c.strip()]


class InMemoryRAGFlowClient:
    """Lightweight InMemory RAGFlow with pluggable chunking strategies.

    Supports recursive / markdown / semantic / sliding-window chunking via
    the ``chunker_strategy`` parameter. Real RAGFlow does DeepDoc (layout
    analysis, table extraction, OCR); this implementation focuses on
    text-mode fallback.

    Per-call chunking override
    --------------------------
    ``parse()`` and ``parse_bytes()`` accept optional ``chunker_strategy``,
    ``chunk_size`` and ``overlap`` keyword arguments. When supplied they
    override the instance defaults; otherwise the constructor defaults
    apply. The underlying ``Chunker`` instance is cached by the effective
    ``(strategy, chunk_size, overlap)`` triple so repeated calls with the
    same config reuse the same object.

    P1.5 file-type dispatch
    -----------------------
    ``parse_bytes`` looks up the file extension in ``parser_registry`` and,
    on hit, invokes the registered parser (with per-call chunk_size/overlap).
    On miss or parser failure, falls back to the text-encoding path with the
    configured chunking strategy.
    """

    DEFAULT_CHUNK_SIZE = 512
    DEFAULT_OVERLAP = 64
    DEFAULT_STRATEGY = "recursive"

    # Default registry: built-in markdown parser; everything else falls
    # through to the text-encoding fallback. Real DeepDoc / Word / PPT
    # parsers will be added in P1.6 by extending this dict.
    parser_registry: dict[str, ParserFn] = {
        ".md": _md_parser,
        ".markdown": _md_parser,
    }

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP,
        chunker_strategy: str = DEFAULT_STRATEGY,
        *,
        parser_registry: dict[str, ParserFn] | None = None,
    ) -> None:
        self._chunks: dict[str, tuple[str, str, str]] = {}  # cid -> (document_id, text, meta)
        self._lock = threading.Lock()
        self._chunk_size = chunk_size
        self._overlap = overlap
        self._chunker_strategy = chunker_strategy
        self._default_chunker: Chunker = create_chunker(chunker_strategy)
        # Backward-compat alias — pre-PATCH tests reference ``client._chunker``
        # to introspect the default chunker instance. Keep this attribute so
        # the legacy tests keep passing.
        self._chunker: Chunker = self._default_chunker
        # Cache chunker instances by (strategy, chunk_size, overlap) so a
        # per-call override does not rebuild the strategy object every time.
        self._chunker_cache: dict[tuple[str, int, int], Chunker] = {
            (chunker_strategy, chunk_size, overlap): self._default_chunker,
        }
        # Per-instance registry (defaults to class registry, can be overridden).
        self._parser_registry: dict[str, ParserFn] = (
            dict(parser_registry) if parser_registry is not None else dict(self.parser_registry)
        )

    # ------------------------------------------------------------------
    # Override resolution
    # ------------------------------------------------------------------
    def _resolve_chunk_config(
        self,
        chunker_strategy: str | None,
        chunk_size: int | None,
        overlap: int | None,
    ) -> tuple[str, int, int]:
        """Return the effective (strategy, chunk_size, overlap) for a call."""
        eff_strategy = chunker_strategy if chunker_strategy is not None else self._chunker_strategy
        eff_size = self._chunk_size if chunk_size is None else int(chunk_size)
        eff_overlap = self._overlap if overlap is None else int(overlap)
        return eff_strategy, eff_size, eff_overlap

    def _resolve_chunker(
        self,
        chunker_strategy: str | None,
        chunk_size: int | None,
        overlap: int | None,
    ) -> tuple[Chunker, int, int]:
        """Return the cached chunker + effective (chunk_size, overlap)."""
        eff_strategy, eff_size, eff_overlap = self._resolve_chunk_config(
            chunker_strategy, chunk_size, overlap,
        )
        key = (eff_strategy, eff_size, eff_overlap)
        cached = self._chunker_cache.get(key)
        if cached is None:
            cached = create_chunker(eff_strategy)
            self._chunker_cache[key] = cached
        return cached, eff_size, eff_overlap

    @staticmethod
    def _ext_of(filename: str) -> str:
        """Lower-case file extension including leading dot; empty if none."""
        if not filename:
            return ""
        _, ext = os.path.splitext(filename)
        return ext.lower()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def parse(
        self,
        content: str,
        document_id: str,
        *,
        metadata: dict[str, str] | None = None,
        chunker_strategy: str | None = None,
        chunk_size: int | None = None,
        overlap: int | None = None,
    ) -> list[str]:
        """Parse text content into chunks using the configured chunking strategy.

        ``chunker_strategy`` / ``chunk_size`` / ``overlap`` are per-call
        overrides; when omitted the instance defaults apply.
        """
        if not content.strip():
            return []
        chunker, eff_size, eff_overlap = self._resolve_chunker(
            chunker_strategy, chunk_size, overlap,
        )
        chunks = chunker.chunk(content, chunk_size=eff_size, overlap=eff_overlap)
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

    def parse_bytes(
        self,
        raw: bytes,
        document_id: str,
        *,
        filename: str = "",
        metadata: dict[str, str] | None = None,
        chunker_strategy: str | None = None,
        chunk_size: int | None = None,
        overlap: int | None = None,
    ) -> list[str]:
        """Parse binary file via extension-based dispatch.

        Resolution order:
          1. ``parser_registry[".ext"]`` (built-in or caller-registered parser)
             — receives the per-call ``chunk_size``/``overlap``.
          2. Text-encoding fallback (UTF-8 / GBK / latin-1) using the
             resolved ``chunker_strategy`` / ``chunk_size`` / ``overlap``.
        """
        ext = self._ext_of(filename)
        parser = self._parser_registry.get(ext) if ext else None

        meta = dict(metadata or {})
        if filename:
            meta["filename"] = filename

        eff_strategy, eff_size, eff_overlap = self._resolve_chunk_config(
            chunker_strategy, chunk_size, overlap,
        )

        chunks: list[str] | None = None
        if parser is not None:
            try:
                chunks = parser(
                    raw, document_id, filename, meta,
                    chunk_size=eff_size,
                    overlap=eff_overlap,
                )
            except Exception:
                # Registry parser failed — degrade to fallback.
                chunks = None

        if chunks is None:
            # No registry hit (or registry parser failed): text fallback
            # honours the per-call chunking override.
            return self._text_fallback_decode(
                raw, document_id, meta,
                chunker_strategy=eff_strategy,
                chunk_size=eff_size,
                overlap=eff_overlap,
            )

        # Stash each non-empty chunk in the in-memory store, mirroring parse().
        result: list[str] = []
        with self._lock:
            for text in chunks:
                if not text.strip():
                    continue
                cid = str(uuid.uuid4())
                self._chunks[cid] = (document_id, text, str(meta))
                result.append(text)
        return result

    def _text_fallback_decode(
        self,
        raw: bytes,
        document_id: str,
        meta: dict[str, str],
        *,
        chunker_strategy: str = DEFAULT_STRATEGY,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP,
    ) -> list[str]:
        """Try UTF-8 / GBK / latin-1, then parse with the configured chunker."""
        for enc in ("utf-8", "utf-8-sig", "gbk", "latin-1"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            return []
        return self.parse(
            text,
            document_id,
            metadata=meta,
            chunker_strategy=chunker_strategy,
            chunk_size=chunk_size,
            overlap=overlap,
        )

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)