"""Document chunking service (P1-RAG-03).

Reads an uploaded document, parses it based on file type, splits the text
into overlapping chunks, and persists them to the ``rag_document_chunk``
table.
"""

from __future__ import annotations

import io
from typing import Any

from app.common.errors import DocumentNotFoundError, UnsupportedFileTypeError
from app.models.repository import (
    DocumentChunkRepository,
    DocumentRepository,
    _new_chunk_id,
)
from app.models.schemas import (
    DocumentChunk,
    DocumentStatus,
    EmbeddingStatus,
)
from app.services.document_service import FileStorage

# Chunking parameters.
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100


class ChunkService:
    def __init__(
        self,
        chunk_repository: DocumentChunkRepository,
        doc_repository: DocumentRepository,
        storage: FileStorage,
    ) -> None:
        self._chunk_repo = chunk_repository
        self._doc_repo = doc_repository
        self._storage = storage

    # ----------------------------------------------------------- public API

    async def chunk_document(self, document_id: str, tenant_id: str) -> int:
        """Parse and chunk a document. Returns the number of chunks created."""

        doc = await self._doc_repo.get(document_id, tenant_id)
        if doc is None:
            raise DocumentNotFoundError(
                f"文档不存在: id={document_id}",
                data={"id": document_id},
            )

        content = await self._storage.read(doc.storage_path)
        text = self._parse_content(content, doc.file_type)
        chunks = self._split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

        # Remove any existing chunks (supports re-chunking).
        await self._chunk_repo.delete_by_document(document_id, tenant_id)

        for index, chunk_text in enumerate(chunks):
            chunk = DocumentChunk(
                id=_new_chunk_id(),
                tenant_id=tenant_id,
                document_id=document_id,
                chunk_index=index,
                content=chunk_text,
                token_count=len(chunk_text),
                embedding_status=EmbeddingStatus.PENDING,
            )
            await self._chunk_repo.create(chunk)

        await self._doc_repo.update(
            document_id,
            tenant_id,
            {
                "status": DocumentStatus.CHUNKED,
                "chunk_count": len(chunks),
            },
        )

        return len(chunks)

    async def list_chunks(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]:
        """Return all chunks for a document, ordered by chunk_index."""

        # Verify document exists and belongs to tenant.
        doc = await self._doc_repo.get(document_id, tenant_id)
        if doc is None:
            raise DocumentNotFoundError(
                f"文档不存在: id={document_id}",
                data={"id": document_id},
            )
        return await self._chunk_repo.list_by_document(document_id, tenant_id)

    # ----------------------------------------------------------- parsing

    @staticmethod
    def _parse_content(content: bytes, file_type: str) -> str:
        """Decode raw file bytes into plain text based on file type."""

        if file_type in ("TEXT", "MARKDOWN"):
            return content.decode("utf-8", errors="replace")

        if file_type == "PDF":
            return ChunkService._parse_pdf(content)

        if file_type == "WORD":
            return ChunkService._parse_docx(content)

        raise UnsupportedFileTypeError(
            f"不支持的文件类型: {file_type}",
            data={"fileType": file_type},
        )

    @staticmethod
    def _parse_pdf(content: bytes) -> str:
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(content))
        parts: list[str] = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)

    @staticmethod
    def _parse_docx(content: bytes) -> str:
        from docx import Document as DocxDocument

        doc = DocxDocument(io.BytesIO(content))
        parts = [para.text for para in doc.paragraphs]
        return "\n".join(parts)

    # ----------------------------------------------------------- chunking

    @staticmethod
    def _split_text(
        text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
    ) -> list[str]:
        """Split *text* into overlapping chunks of *chunk_size* characters.

        An *overlap* of N means each chunk (except the first) starts N
        characters before the end of the previous chunk.
        """

        if not text:
            return []

        chunks: list[str] = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = start + chunk_size
            chunks.append(text[start:end])
            if end >= text_len:
                break
            start = end - overlap
        return chunks
