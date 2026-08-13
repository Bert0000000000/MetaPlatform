"""Advanced chunking strategies for RAG document processing.

Strategies:
1. RecursiveChunker — 递归分隔符分块(\\n\\n → \\n → 。 → . → space)
2. MarkdownChunker — Markdown 结构感知(按 #/##/### 标题分块)
3. SemanticChunker — 基于句子相似度的语义分块(相邻句子 Jaccard 相似度低于阈值时断开)
4. SlidingWindowChunker — 可配置 window_size + overlap 的滑动窗口
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from mate_tech_rag.tokenize import tokenize_for_match


class Chunker(Protocol):
    def chunk(self, text: str, *, chunk_size: int = 512, overlap: int = 64) -> list[str]: ...


@dataclass
class ChunkConfig:
    chunk_size: int = 512
    overlap: int = 64
    min_chunk_size: int = 50
    strategy: str = "recursive"  # recursive / markdown / semantic / sliding


def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    """Add character-level overlap between adjacent chunks.

    Each chunk (except the first) is prefixed with the tail of the previous chunk.
    """
    if overlap <= 0 or len(chunks) <= 1:
        return chunks
    result: list[str] = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_tail = chunks[i - 1][-overlap:] if len(chunks[i - 1]) > overlap else chunks[i - 1]
        result.append(prev_tail + chunks[i])
    return result


# ---------------------------------------------------------------------------
# 1. RecursiveChunker
# ---------------------------------------------------------------------------
class RecursiveChunker:
    """递归分隔符分块:从粗到细分隔。

    Uses a list of separators ordered from coarsest to finest. At each level,
    splits by the current separator; if a resulting piece is still longer than
    chunk_size, recursively splits it with the next (finer) separator.
    """

    SEPARATORS = ["\n\n\n", "\n\n", "\n", "。", ".", "!", "?", "；", ";", " ", ""]

    def chunk(self, text: str, *, chunk_size: int = 512, overlap: int = 64) -> list[str]:
        text = text.strip()
        if not text:
            return []
        raw = self._recursive_split(text, self.SEPARATORS, chunk_size)
        # Drop empty / whitespace-only pieces.
        pieces = [p for p in raw if p.strip()]
        return _apply_overlap(pieces, overlap)

    def _recursive_split(self, text: str, separators: list[str], chunk_size: int) -> list[str]:
        """Recursively split text using separators from coarse to fine."""
        if len(text) <= chunk_size:
            return [text]
        if not separators:
            # No more separators: hard-split by character.
            return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]

        sep = separators[0]
        remaining_seps = separators[1:]

        if sep == "":
            # Final fallback: character split.
            return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]

        parts = text.split(sep)
        result: list[str] = []
        for part in parts:
            if not part:
                continue
            if len(part) <= chunk_size:
                result.append(part)
            else:
                result.extend(self._recursive_split(part, remaining_seps, chunk_size))
        return result


# ---------------------------------------------------------------------------
# 2. MarkdownChunker
# ---------------------------------------------------------------------------
class MarkdownChunker:
    """Markdown 结构感知:按标题分块,保留标题层级。

    Splits by ATX headings (# ~ ######). Each heading and its body become one
    chunk. If a section is still larger than chunk_size, it is further split
    with RecursiveChunker. The heading prefix is preserved on each sub-chunk.
    """

    HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)

    def __init__(self) -> None:
        self._recursive = RecursiveChunker()

    def chunk(self, text: str, *, chunk_size: int = 512, overlap: int = 64) -> list[str]:
        text = text.strip()
        if not text:
            return []

        # Find all heading positions.
        matches = list(self.HEADING_RE.finditer(text))
        if not matches:
            # No headings: fall back to recursive split.
            return self._recursive.chunk(text, chunk_size=chunk_size, overlap=overlap)

        sections: list[str] = []
        # Content before the first heading (preamble).
        if matches[0].start() > 0:
            preamble = text[: matches[0].start()].strip()
            if preamble:
                sections.append(preamble)

        for i, m in enumerate(matches):
            heading_line = m.group(0)  # full line e.g. "## Title"
            body_start = m.end()
            body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            body = text[body_start:body_end].strip()
            section = heading_line + "\n" + body if body else heading_line
            sections.append(section)

        # Further split oversized sections, preserving heading prefix.
        final: list[str] = []
        for section in sections:
            if len(section) <= chunk_size:
                final.append(section)
            else:
                # Determine heading prefix (first line).
                lines = section.split("\n", 1)
                heading_prefix = lines[0] if self.HEADING_RE.match(lines[0]) else ""
                rest = lines[1] if len(lines) > 1 else ""
                if heading_prefix:
                    sub = self._recursive.chunk(rest, chunk_size=max(chunk_size - len(heading_prefix) - 1, 100), overlap=overlap)
                    for s in sub:
                        final.append(heading_prefix + "\n" + s)
                else:
                    final.extend(self._recursive.chunk(section, chunk_size=chunk_size, overlap=overlap))

        return final


# ---------------------------------------------------------------------------
# 3. SemanticChunker
# ---------------------------------------------------------------------------
class SemanticChunker:
    """基于句子相似度的语义分块。

    Does NOT depend on an embedding model. Uses simple bag-of-words Jaccard
    similarity between adjacent sentences: when similarity drops below
    ``similarity_threshold``, a new chunk is started. Short segments are merged
    up to ``chunk_size``.
    """

    SENTENCE_END_RE = re.compile(r"[。.!?！？\n]+")

    def chunk(
        self,
        text: str,
        *,
        chunk_size: int = 512,
        overlap: int = 64,
        similarity_threshold: float = 0.3,
    ) -> list[str]:
        text = text.strip()
        if not text:
            return []

        # 1. Split into sentences (keep the trailing punctuation).
        sentences = self._split_sentences(text)
        if not sentences:
            return []

        # Single sentence -> single chunk.
        if len(sentences) == 1:
            return [sentences[0]]

        # 2. Compute similarity between adjacent sentences; start new segment
        #    when similarity < threshold.
        segments: list[str] = [sentences[0]]
        for i in range(1, len(sentences)):
            sim = self._jaccard(sentences[i - 1], sentences[i])
            current = segments[-1]
            if sim < similarity_threshold or len(current) >= chunk_size:
                segments.append(sentences[i])
            else:
                segments[-1] = current + " " + sentences[i]

        # 3. Merge segments shorter than min_chunk_size into neighbours.
        merged = self._merge_short(segments, chunk_size)
        return _apply_overlap(merged, overlap)

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences on ending punctuation / newlines."""
        # Insert a placeholder after each sentence-ending punctuation.
        parts = self.SENTENCE_END_RE.split(text)
        return [p.strip() for p in parts if p.strip()]

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        """Bag-of-words tokenization, CJK-aware (see ``tokenize_for_match``)."""
        return tokenize_for_match(text)

    def _jaccard(self, a: str, b: str) -> float:
        sa = self._tokenize(a)
        sb = self._tokenize(b)
        if not sa and not sb:
            return 1.0
        union = sa | sb
        if not union:
            return 0.0
        return len(sa & sb) / len(union)

    @staticmethod
    def _merge_short(segments: list[str], chunk_size: int) -> list[str]:
        min_chunk = 50
        if not segments:
            return []
        merged: list[str] = [segments[0]]
        for seg in segments[1:]:
            if len(merged[-1]) < min_chunk and len(merged[-1]) + len(seg) + 1 <= chunk_size:
                merged[-1] = merged[-1] + " " + seg
            else:
                merged.append(seg)
        # If the last segment is very short, fold into previous.
        if len(merged) > 1 and len(merged[-1]) < min_chunk:
            merged[-2] = merged[-2] + " " + merged[-1]
            merged.pop()
        return merged


# ---------------------------------------------------------------------------
# 4. SlidingWindowChunker
# ---------------------------------------------------------------------------
class SlidingWindowChunker:
    """滑动窗口分块:固定大小窗口 + 重叠。

    Steps through the text in increments of (chunk_size - overlap) characters,
    emitting a chunk of chunk_size characters at each step.
    """

    def chunk(self, text: str, *, chunk_size: int = 512, overlap: int = 64) -> list[str]:
        text = text.strip()
        if not text:
            return []
        if chunk_size <= 0:
            return []
        if overlap >= chunk_size:
            overlap = chunk_size - 1
        step = chunk_size - overlap
        if step <= 0:
            step = 1
        return [text[i : i + chunk_size] for i in range(0, len(text), step) if text[i : i + chunk_size].strip()]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def create_chunker(strategy: str = "recursive") -> Chunker:
    """Create a chunker instance by strategy name.

    Supported strategies: recursive (default), markdown, semantic, sliding.
    """
    if strategy == "markdown":
        return MarkdownChunker()
    if strategy == "semantic":
        return SemanticChunker()
    if strategy == "sliding":
        return SlidingWindowChunker()
    return RecursiveChunker()
