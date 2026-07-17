"""Knowledge base CRUD service (P1-RAG-02).

Handles create/list/get/update/delete. Enforces UNIQUE(tenant_id, name)
and cascades document deletion when a knowledge base is removed.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from app.common.errors import (
    KnowledgeBaseAlreadyExistsError,
    KnowledgeBaseNotFoundError,
)
from app.models.repository import (
    DocumentRepository,
    KnowledgeBaseRepository,
    _new_kb_id,
)
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    KnowledgeBase,
    KnowledgeBaseStatus,
    SearchConfig,
    UpdateKnowledgeBaseRequest,
    UpdateSearchConfigRequest,
)


class KnowledgeBaseService:
    def __init__(
        self,
        kb_repository: KnowledgeBaseRepository,
        doc_repository: DocumentRepository,
    ) -> None:
        self._kb_repo = kb_repository
        self._doc_repo = doc_repository

    # ----------------------------------------------------------------- create

    async def create(
        self, tenant_id: str, req: CreateKnowledgeBaseRequest
    ) -> KnowledgeBase:
        # Enforce UNIQUE(tenant_id, name).
        existing = await self._kb_repo.get_by_name(tenant_id, req.name)
        if existing is not None:
            raise KnowledgeBaseAlreadyExistsError(
                f"知识库名称已存在: name={req.name}",
                data={"name": req.name},
            )

        kb = KnowledgeBase(
            id=_new_kb_id(),
            tenant_id=tenant_id,
            name=req.name,
            description=req.description,
            status=KnowledgeBaseStatus.ACTIVE,
        )
        return await self._kb_repo.create(kb)

    # ------------------------------------------------------------------- list

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[KnowledgeBaseStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[KnowledgeBase], int]:
        return await self._kb_repo.list(
            tenant_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------- get

    async def get(self, tenant_id: str, kb_id: str) -> KnowledgeBase:
        kb = await self._kb_repo.get(kb_id, tenant_id)
        if kb is None:
            raise KnowledgeBaseNotFoundError(
                f"知识库不存在: id={kb_id}",
                data={"id": kb_id},
            )
        return kb

    # ---------------------------------------------------------------- update

    async def update(
        self, tenant_id: str, kb_id: str, req: UpdateKnowledgeBaseRequest
    ) -> KnowledgeBase:
        kb = await self.get(tenant_id, kb_id)

        fields: dict[str, Any] = {}

        if req.name is not None and req.name != kb.name:
            dup = await self._kb_repo.get_by_name(tenant_id, req.name)
            if dup is not None and dup.id != kb_id:
                raise KnowledgeBaseAlreadyExistsError(
                    f"知识库名称已存在: name={req.name}",
                    data={"name": req.name},
                )
            fields["name"] = req.name

        if req.description is not None:
            fields["description"] = req.description

        if req.status is not None:
            fields["status"] = req.status

        if not fields:
            return kb

        updated = await self._kb_repo.update(kb_id, tenant_id, fields)
        if updated is None:
            raise KnowledgeBaseNotFoundError(
                f"知识库不存在: id={kb_id}",
                data={"id": kb_id},
            )
        return updated

    # ---------------------------------------------------------------- delete

    async def delete(self, tenant_id: str, kb_id: str) -> dict[str, Any]:
        await self.get(tenant_id, kb_id)
        # Cascade-delete all documents belonging to this KB.
        deleted_docs = await self._doc_repo.delete_by_kb(kb_id, tenant_id)
        await self._kb_repo.delete(kb_id, tenant_id)
        return {"id": kb_id, "deleted": True, "deletedDocuments": deleted_docs}

    # ------------------------------------------------------- doc count update

    async def increment_doc_count(
        self, tenant_id: str, kb_id: str, delta: int = 1
    ) -> None:
        await self._kb_repo.increment_doc_count(kb_id, tenant_id, delta)

    # ------------------------------------------------------- search config

    async def get_search_config(
        self, tenant_id: str, kb_id: str
    ) -> SearchConfig:
        """Return the search configuration for a KB, or defaults if unset."""

        kb = await self._kb_repo.get(kb_id, tenant_id)
        if kb is None:
            raise KnowledgeBaseNotFoundError(
                f"知识库不存在: id={kb_id}",
                data={"id": kb_id},
            )
        if kb.search_config:
            try:
                data = json.loads(kb.search_config)
                return SearchConfig(**data)
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        return SearchConfig()

    async def update_search_config(
        self, tenant_id: str, kb_id: str, req: UpdateSearchConfigRequest
    ) -> SearchConfig:
        """Merge *req* into the existing search config and persist it."""

        kb = await self._kb_repo.get(kb_id, tenant_id)
        if kb is None:
            raise KnowledgeBaseNotFoundError(
                f"知识库不存在: id={kb_id}",
                data={"id": kb_id},
            )

        # Load current config (or defaults).
        current = SearchConfig()
        if kb.search_config:
            try:
                data = json.loads(kb.search_config)
                current = SearchConfig(**data)
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        # Apply overrides from the request.
        updated = current.model_copy(
            update={
                k: v
                for k, v in req.model_dump(exclude_unset=True).items()
                if v is not None
            }
        )

        config_json = updated.model_dump_json()
        await self._kb_repo.update(kb_id, tenant_id, {"search_config": config_json})
        return updated
