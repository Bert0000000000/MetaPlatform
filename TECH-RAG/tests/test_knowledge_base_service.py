"""Tests for KnowledgeBaseService (P1-RAG-02)."""

from __future__ import annotations

import pytest

from app.common.errors import (
    KnowledgeBaseAlreadyExistsError,
    KnowledgeBaseNotFoundError,
)
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    KnowledgeBaseStatus,
    UpdateKnowledgeBaseRequest,
)
from app.services.knowledge_base_service import KnowledgeBaseService

TENANT = "tenant-test"


def _make_request(
    name: str = "test-kb",
    description: str = "A test knowledge base",
) -> CreateKnowledgeBaseRequest:
    return CreateKnowledgeBaseRequest(name=name, description=description)


# ----------------------------------------------------------------- create


async def test_create_knowledge_base_success(
    kb_service: KnowledgeBaseService,
) -> None:
    """Creating a knowledge base returns a persisted record with ACTIVE status."""

    kb = await kb_service.create(TENANT, _make_request())

    assert kb.id.startswith("kb-")
    assert kb.tenant_id == TENANT
    assert kb.name == "test-kb"
    assert kb.description == "A test knowledge base"
    assert kb.status == KnowledgeBaseStatus.ACTIVE
    assert kb.doc_count == 0


async def test_create_knowledge_base_name_duplicate(
    kb_service: KnowledgeBaseService,
) -> None:
    """Creating two knowledge bases with the same name in the same tenant raises 40901."""

    req = _make_request(name="dup-name")
    await kb_service.create(TENANT, req)

    with pytest.raises(KnowledgeBaseAlreadyExistsError) as exc_info:
        await kb_service.create(TENANT, req)

    assert int(exc_info.value.code) == 40901
    assert exc_info.value.http_status == 409


# ------------------------------------------------------------------- get


async def test_get_knowledge_base_not_found(
    kb_service: KnowledgeBaseService,
) -> None:
    """Getting a non-existent knowledge base raises 40401."""

    with pytest.raises(KnowledgeBaseNotFoundError) as exc_info:
        await kb_service.get(TENANT, "kb-nonexistent")

    assert int(exc_info.value.code) == 40401


# ---------------------------------------------------------------- update


async def test_update_knowledge_base_success(
    kb_service: KnowledgeBaseService,
) -> None:
    """Updating a knowledge base name and description works."""

    kb = await kb_service.create(TENANT, _make_request())

    updated = await kb_service.update(
        TENANT,
        kb.id,
        UpdateKnowledgeBaseRequest(
            name="updated-name",
            description="updated description",
        ),
    )

    assert updated.name == "updated-name"
    assert updated.description == "updated description"


# ---------------------------------------------------------------- delete


async def test_delete_knowledge_base_cascades(
    kb_service: KnowledgeBaseService,
    doc_service,
) -> None:
    """Deleting a knowledge base cascades to its documents."""

    from app.models.schemas import Document, DocumentStatus

    kb = await kb_service.create(TENANT, _make_request())

    # Manually insert a document via the doc repository to simulate existing docs.
    from app.models.repository import _new_doc_id

    doc = Document(
        id=_new_doc_id(),
        tenant_id=TENANT,
        kb_id=kb.id,
        filename="test.txt",
        file_size=100,
        file_type="TEXT",
        storage_path="/mock/test.txt",
        status=DocumentStatus.UPLOADED,
    )
    await doc_service._doc_repo.create(doc)

    result = await kb_service.delete(TENANT, kb.id)

    assert result["deleted"] is True
    assert result["deletedDocuments"] == 1
