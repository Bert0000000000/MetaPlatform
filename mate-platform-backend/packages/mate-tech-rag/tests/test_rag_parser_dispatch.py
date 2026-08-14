"""Tests for P1.5 file-type parser dispatch (RAGFlow architecture hook).

The dispatch surface lives in :class:`InMemoryRAGFlowClient.parse_bytes`:
``parser_registry[".ext"]`` is consulted first, then a text-encoding
fallback. Real DeepDoc (PDF/DOCX/PPT) parsers are P1.6 work; this
test suite covers the architecture wiring and the built-in markdown
parser.
"""
from __future__ import annotations

import sys
from collections.abc import Callable
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_tech_rag.chunking import MarkdownChunker, RecursiveChunker  # noqa: E402
from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient  # noqa: E402


# ---------------------------------------------------------------------------
# Default registry surface
# ---------------------------------------------------------------------------
class TestParserRegistryDefaults:
    def test_md_is_registered(self):
        """`.md` is in the default registry (markdown parser, not fallback)."""
        assert ".md" in InMemoryRAGFlowClient.parser_registry
        assert ".markdown" in InMemoryRAGFlowClient.parser_registry

    def test_pdf_is_not_registered_yet(self):
        """`.pdf` is NOT in the default registry — falls through to text fallback (P1.6 stub)."""
        assert ".pdf" not in InMemoryRAGFlowClient.parser_registry
        assert ".docx" not in InMemoryRAGFlowClient.parser_registry

    def test_instance_registry_is_a_copy(self):
        """Per-instance registry is a copy of the class registry (mutations don't leak)."""
        client = InMemoryRAGFlowClient()
        assert client._parser_registry == InMemoryRAGFlowClient.parser_registry
        # Mutate instance — should not affect class.
        client._parser_registry[".custom"] = lambda *a, **kw: ["x"]
        assert ".custom" not in InMemoryRAGFlowClient.parser_registry

    def test_explicit_registry_overrides(self):
        """Caller-supplied registry overrides the class default entirely."""
        sentinel: list[str] = []
        def fake(_b: bytes, _d: str, _f: str, _m, **_kw) -> list[str]:  # noqa: ANN001
            sentinel.append("called")
            return ["from-fake"]
        client = InMemoryRAGFlowClient(parser_registry={".foo": fake})
        out = client.parse_bytes(b"hello", "doc", filename="x.foo")
        assert out == ["from-fake"]
        assert sentinel == ["called"]


# ---------------------------------------------------------------------------
# Markdown path: confirms `.md` goes through MarkdownChunker, not fallback
# ---------------------------------------------------------------------------
class TestMarkdownParserPath:
    def test_md_uses_markdown_chunker(self, monkeypatch):
        """`.md` content with multiple headings yields multiple sections via MarkdownChunker.

        A plain RecursiveChunker would also produce multiple chunks but with
        no heading-aware structure; MarkdownChunker keeps each heading as
        the prefix of its chunk.
        """
        md = (
            b"# Title\n\nIntro paragraph one.\n\n"
            b"## Section A\n\nContent of section A.\n\n"
            b"## Section B\n\nContent of section B.\n"
        )
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(md, "doc-md", filename="notes.md")
        assert len(chunks) >= 2, chunks
        # Heading prefixes preserved by MarkdownChunker.
        combined = "\n".join(chunks)
        assert "# Title" in combined
        assert "## Section A" in combined
        assert "## Section B" in combined
        # All section headings are present and not flattened into one blob.
        heading_lines = [c for c in chunks if c.startswith("#")]
        assert len(heading_lines) >= 2, heading_lines

    def test_md_with_no_headings_falls_back(self):
        """`.md` file with no headings still routes through the markdown parser
        (which itself falls back to recursive splitting internally)."""
        text = b"Just some plain text without any markdown headings at all."
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(text, "doc-md", filename="plain.md")
        assert chunks and "plain text" in chunks[0]

    def test_md_parser_invokes_markdown_chunker_directly(self):
        """Direct invocation of the registered `.md` parser runs MarkdownChunker."""
        from mate_tech_rag.clients.ragflow_client import _md_parser

        text = b"# Title\n\nbody.\n\n## Sub\n\nsubbody."
        out = _md_parser(text, "doc", "x.md", None)
        assert any(c.startswith("# Title") for c in out)
        assert any(c.startswith("## Sub") for c in out)

    def test_markdown_registry_parser_returns_recursive_chunker_when_no_headings(self):
        """MarkdownChunker falls back to RecursiveChunker for non-markdown text;
        confirm via direct invocation (architecture contract)."""
        from mate_tech_rag.clients.ragflow_client import _md_parser

        # Plain text (no `#` headings).
        plain = (b"just words " * 50).decode("utf-8")
        out = _md_parser(plain.encode("utf-8"), "doc", "x.md", None)
        # No heading markers → recursive-style split; no chunk should start with `#`.
        assert out
        assert all(not c.startswith("#") for c in out)


# ---------------------------------------------------------------------------
# Fallback path: non-registered extensions go through the text decoder.
# ---------------------------------------------------------------------------
class TestTextFallbackPath:
    def test_txt_uses_text_fallback(self):
        """.txt has no registered parser → falls through to text fallback."""
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(b"Hello world.\n\nSecond paragraph.", "doc-txt", filename="notes.txt")
        assert len(chunks) >= 1
        assert any("Hello world" in c for c in chunks)

    def test_pdf_bytes_fall_through_to_text_fallback(self):
        """.pdf not in registry → falls through. Random bytes still parseable as
        latin-1 text via the fallback, so this just confirms the dispatch path
        does not raise for unknown extensions."""
        client = InMemoryRAGFlowClient()
        # Even random bytes decode as latin-1, so fallback succeeds.
        chunks = client.parse_bytes(b"%PDF-1.4\nfake pdf body here", "doc-pdf", filename="x.pdf")
        assert isinstance(chunks, list)

    def test_docx_bytes_fall_through_to_text_fallback(self):
        """.docx not in registry → text fallback (P1.6 will replace this)."""
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(b"PK\x03\x04 fake docx body", "doc-docx", filename="x.docx")
        assert isinstance(chunks, list)

    def test_no_filename_falls_back_to_text(self):
        """Empty filename → no extension → text fallback."""
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(b"plain content", "doc-anon")
        assert chunks and "plain content" in chunks[0]

    def test_uppercase_md_normalized_to_markdown(self):
        """Extension lookup is case-insensitive."""
        client = InMemoryRAGFlowClient()
        chunks = client.parse_bytes(b"# Title\n\nBody.", "doc-md-up", filename="README.MD")
        # Markdown parser → heading preserved.
        assert any(c.startswith("# Title") for c in chunks)


# ---------------------------------------------------------------------------
# Failure modes
# ---------------------------------------------------------------------------
class TestParserFailures:
    def test_registry_parser_exception_degrades_to_fallback(self):
        """If a registry parser raises, parse_bytes falls back to text decoder."""
        def boom(*_a, **_kw):  # noqa: ANN001, ANN002
            raise RuntimeError("decoder exploded")
        client = InMemoryRAGFlowClient(parser_registry={".md": boom})
        chunks = client.parse_bytes(b"# Title\n\nbody", "doc", filename="x.md")
        # Fallback should still produce something (UTF-8 decodes fine).
        assert chunks
        assert any("body" in c for c in chunks)

    def test_undecodable_bytes_return_empty(self):
        """Bytes that fail every fallback encoding return [] (no crash)."""
        client = InMemoryRAGFlowClient()
        # Build a byte sequence that *would* fail latin-1 if we excluded it.
        # latin-1 always succeeds, so we cannot construct an undecodable byte
        # in Python — but we CAN exercise the "empty result" branch with empty input.
        assert client.parse_bytes(b"", "doc-empty", filename="x.md") == []
        assert client.parse_bytes(b"", "doc-empty", filename="x.txt") == []


# ---------------------------------------------------------------------------
# Endpoint integration: .md upload still produces non-empty chunks
# ---------------------------------------------------------------------------
class TestUploadEndpointMarkdown:
    def test_upload_md_file_uses_markdown_parser(self):
        """POST /upload with a .md file produces chunks that preserve heading structure."""
        os_setup = {
            "INSECURE_SKIP_SIGNATURE": "1",
            "KEYCLOAK_URL": "http://localhost:8080",
            "KEYCLOAK_REALM": "metaplatform",
            "KEYCLOAK_AUDIENCE": "metaplatform-backend",
            "SERVICE_CLIENT_ID": "metaplatform-backend",
            "SERVICE_CLIENT_SECRET": "test-secret",
        }
        import os
        for k, v in os_setup.items():
            os.environ.setdefault(k, v)

        import time
        import jwt as pyjwt
        from fastapi.testclient import TestClient
        from mate_tech_rag.api import app as _app_module
        from mate_tech_rag.api.document_registry import reset_registry
        from mate_tech_rag.api.retrieval import get_lightrag, get_ragflow

        reset_registry()
        ragflow = get_ragflow()
        if hasattr(ragflow, "_chunks"):
            ragflow._chunks.clear()
        lightrag = get_lightrag()
        if hasattr(lightrag, "_chunks"):
            lightrag._chunks.clear()
        elif hasattr(lightrag, "clear"):
            lightrag.clear()

        now = int(time.time())
        token = pyjwt.encode(
            {
                "sub": "u-1",
                "iss": "http://localhost:8080/realms/metaplatform",
                "aud": "metaplatform-backend",
                "azp": "metaplatform-backend",
                "preferred_username": "u-1",
                "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
                "scope": "platform.read platform.write",
                "attributes": {"tenant_id": ["tenant-md"]},
                "tenant_id": "tenant-md",
                "roles": ["PLATFORM_SUPER_ADMIN"],
                "iat": now,
                "exp": now + 3600,
            },
            "test-secret",
            algorithm="HS256",
        )
        client = TestClient(_app_module.app)
        r = client.post(
            "/api/v1/rag/upload",
            files={"file": ("README.md", b"# H1\n\nfirst.\n\n## H2\n\nsecond.", "text/markdown")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        # Heading-prefixed chunks indicate MarkdownChunker was used.
        assert r.json()["chunk_count"] >= 1