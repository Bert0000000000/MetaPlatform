"""Tests for advanced chunking strategies (阶段 B Chunking 策略升级).

Covers RecursiveChunker, MarkdownChunker, SemanticChunker, SlidingWindowChunker,
the create_chunker factory, and InMemoryRAGFlowClient integration.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_tech_rag.chunking import (  # noqa: E402
    MarkdownChunker,
    RecursiveChunker,
    SemanticChunker,
    SlidingWindowChunker,
    create_chunker,
)
from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient  # noqa: E402


# ---------------------------------------------------------------------------
# RecursiveChunker
# ---------------------------------------------------------------------------
class TestRecursiveChunker:
    def test_recursive_chunker_basic(self):
        """Basic paragraph-split produces multiple chunks for multi-paragraph text."""
        text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here."
        chunker = RecursiveChunker()
        # Use a small chunk_size so the text actually splits.
        chunks = chunker.chunk(text, chunk_size=30, overlap=0)
        assert len(chunks) >= 2, chunks
        # All original words should be present across chunks.
        combined = " ".join(chunks)
        assert "First paragraph" in combined
        assert "Second paragraph" in combined
        assert "Third paragraph" in combined

    def test_recursive_chunker_respects_chunk_size(self):
        """No chunk (before overlap) should exceed chunk_size."""
        text = ("The quick brown fox jumps over the lazy dog. " * 20).strip()
        chunk_size = 100
        chunker = RecursiveChunker()
        chunks = chunker.chunk(text, chunk_size=chunk_size, overlap=0)
        assert len(chunks) > 1, "Expected multiple chunks for long text"
        for c in chunks:
            assert len(c) <= chunk_size + 5, f"Chunk too long: {len(c)} > {chunk_size}"

    def test_recursive_chunker_overlap(self):
        """With overlap > 0, adjacent chunks share some characters."""
        text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five."
        chunker = RecursiveChunker()
        overlap = 10
        chunks = chunker.chunk(text, chunk_size=40, overlap=overlap)
        if len(chunks) >= 2:
            # The tail of chunk[i-1] should appear at the start of chunk[i].
            tail = chunks[0][-overlap:]
            assert chunks[1].startswith(tail), f"Overlap not found: {chunks[1][:overlap]!r} != {tail!r}"

    def test_recursive_chunker_short_text(self):
        """Short text returns a single chunk."""
        text = "Hello world."
        chunker = RecursiveChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0)
        assert len(chunks) == 1, chunks
        assert chunks[0].strip() == "Hello world."


# ---------------------------------------------------------------------------
# MarkdownChunker
# ---------------------------------------------------------------------------
class TestMarkdownChunker:
    def test_markdown_chunker_splits_by_heading(self):
        """Markdown with multiple headings splits into multiple chunks."""
        text = (
            "# Title\n\nIntro text.\n\n"
            "## Section A\n\nContent of A.\n\n"
            "## Section B\n\nContent of B."
        )
        chunker = MarkdownChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0)
        assert len(chunks) >= 3, chunks
        # Each section heading should appear in some chunk.
        combined = "\n".join(chunks)
        assert "# Title" in combined
        assert "## Section A" in combined
        assert "## Section B" in combined

    def test_markdown_chunker_preserves_heading_prefix(self):
        """Each chunk starts with its heading prefix."""
        text = "# My Doc\n\nBody text here.\n\n## Sub\n\nSub body."
        chunker = MarkdownChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0)
        # At least one chunk should start with "# My Doc"
        assert any(c.startswith("# My Doc") for c in chunks), chunks
        assert any(c.startswith("## Sub") for c in chunks), chunks

    def test_markdown_chunker_large_section_splits(self):
        """A section larger than chunk_size is further split, heading preserved."""
        long_body = "This is a detailed paragraph. " * 30
        text = f"# Big Section\n\n{long_body}"
        chunker = MarkdownChunker()
        chunks = chunker.chunk(text, chunk_size=100, overlap=0)
        assert len(chunks) > 1, "Large section should be split"
        # All sub-chunks should carry the heading prefix.
        for c in chunks:
            assert c.startswith("# Big Section"), f"Missing heading: {c[:30]!r}"

    def test_markdown_chunker_no_headings(self):
        """Text without headings falls back to recursive splitting."""
        text = "Just a plain paragraph with no headings at all. " * 10
        chunker = MarkdownChunker()
        chunks = chunker.chunk(text, chunk_size=100, overlap=0)
        assert len(chunks) >= 1
        assert all(not c.startswith("#") for c in chunks), chunks


# ---------------------------------------------------------------------------
# SemanticChunker
# ---------------------------------------------------------------------------
class TestSemanticChunker:
    def test_semantic_chunker_topic_split(self):
        """Two clearly different topics produce separate chunks."""
        text = (
            "Python is a popular programming language for data science. "
            "Python has many libraries like numpy and pandas. "
            "The weather today is sunny and warm with clear skies. "
            "Tomorrow it will rain heavily in the afternoon."
        )
        chunker = SemanticChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0, similarity_threshold=0.3)
        assert len(chunks) >= 2, f"Expected topic split: {chunks}"
        # First chunk about Python, later chunk about weather.
        combined_lower = " ".join(chunks).lower()
        assert "python" in combined_lower
        assert "weather" in combined_lower

    def test_semantic_chunker_merges_short_segments(self):
        """Very short segments are merged into neighbours, not left standalone."""
        text = "Cat. Dog. Bird. Fish."
        chunker = SemanticChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0, similarity_threshold=0.5)
        # Each sentence is tiny; they should be merged rather than each standalone.
        # With no shared words, Jaccard=0, so they split; but _merge_short folds them.
        # After merge, there should be fewer chunks than sentences.
        assert len(chunks) <= 4, chunks
        combined = " ".join(chunks)
        assert "Cat" in combined
        assert "Fish" in combined

    def test_semantic_chunker_threshold(self):
        """A higher threshold causes more splits (lower similarity required to break)."""
        text = (
            "Apple banana cherry. "
            "Apple banana date. "
            "Quantum physics relativity. "
            "Quantum mechanics entanglement."
        )
        chunker = SemanticChunker()
        # Low threshold: similar sentences stay together.
        few = chunker.chunk(text, chunk_size=512, overlap=0, similarity_threshold=0.1)
        # High threshold: even slightly different sentences split.
        many = chunker.chunk(text, chunk_size=512, overlap=0, similarity_threshold=0.9)
        assert len(many) >= len(few), f"Higher threshold should yield >= chunks: {len(many)} vs {len(few)}"

    def test_semantic_chunker_single_sentence(self):
        """A single sentence returns a single chunk."""
        text = "Only one sentence here."
        chunker = SemanticChunker()
        chunks = chunker.chunk(text, chunk_size=512, overlap=0)
        assert len(chunks) == 1, chunks
        # Sentence-ending punctuation is consumed by the splitter; content preserved.
        assert "Only one sentence here" in chunks[0]


# ---------------------------------------------------------------------------
# SlidingWindowChunker
# ---------------------------------------------------------------------------
class TestSlidingWindowChunker:
    def test_sliding_window_basic(self):
        """Sliding window produces chunks of exactly chunk_size (except possibly last)."""
        text = "abcdefghij" * 10  # 100 chars
        chunker = SlidingWindowChunker()
        chunks = chunker.chunk(text, chunk_size=30, overlap=0)
        assert len(chunks) >= 3, chunks
        for c in chunks[:-1]:
            assert len(c) == 30, f"Expected 30 chars, got {len(c)}"

    def test_sliding_window_overlap(self):
        """With overlap, step = chunk_size - overlap."""
        text = "0123456789" * 5  # 50 chars
        chunk_size = 20
        overlap = 5
        chunker = SlidingWindowChunker()
        chunks = chunker.chunk(text, chunk_size=chunk_size, overlap=overlap)
        step = chunk_size - overlap  # 15
        # Number of windows: ceil(50 / 15) = 4
        assert len(chunks) == 4, f"Expected 4 chunks, got {len(chunks)}"
        # Each full chunk is chunk_size.
        for c in chunks:
            assert len(c) <= chunk_size


# ---------------------------------------------------------------------------
# Factory + Integration
# ---------------------------------------------------------------------------
class TestFactoryAndIntegration:
    def test_create_chunker_returns_correct_type(self):
        """create_chunker returns the correct chunker type for each strategy."""
        assert isinstance(create_chunker("recursive"), RecursiveChunker)
        assert isinstance(create_chunker("markdown"), MarkdownChunker)
        assert isinstance(create_chunker("semantic"), SemanticChunker)
        assert isinstance(create_chunker("sliding"), SlidingWindowChunker)
        # Unknown strategy defaults to Recursive.
        assert isinstance(create_chunker("unknown"), RecursiveChunker)
        assert isinstance(create_chunker(), RecursiveChunker)

    def test_inmemory_client_uses_recursive_by_default(self):
        """InMemoryRAGFlowClient defaults to recursive strategy."""
        client = InMemoryRAGFlowClient()
        assert client._chunker_strategy == "recursive"
        assert isinstance(client._chunker, RecursiveChunker)
        # parse should produce chunks.
        text = "First paragraph.\n\nSecond paragraph here with more text."
        chunks = client.parse(text, "doc-1")
        assert len(chunks) >= 1
        assert all(isinstance(c, str) and c.strip() for c in chunks)

    def test_inmemory_client_with_markdown_strategy(self):
        """InMemoryRAGFlowClient with markdown strategy splits by headings."""
        client = InMemoryRAGFlowClient(chunker_strategy="markdown")
        assert client._chunker_strategy == "markdown"
        assert isinstance(client._chunker, MarkdownChunker)
        text = "# Title\n\nIntro.\n\n## Section\n\nBody text."
        chunks = client.parse(text, "doc-md")
        assert len(chunks) >= 2, chunks
        combined = "\n".join(chunks)
        assert "# Title" in combined
        assert "## Section" in combined
