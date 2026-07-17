"""Prompt template service: CRUD, versioning, render, rollback, preview."""

from __future__ import annotations

import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.chat.service import ChatService
from app.common.errors import (
    InvalidParamError,
    PromptKeyExistsError,
    PromptNotFoundError,
    PromptRenderFailedError,
    PromptVariableMissingError,
)
from app.prompts.repository import PromptRepository
from app.prompts.schemas import (
    PromptCreateRequest,
    PromptDefaultParams,
    PromptPreviewRequest,
    PromptRecord,
    PromptRenderRequest,
    PromptRollbackRequest,
    PromptStatus,
    PromptUpdateRequest,
    PromptVariableDef,
    PromptVersionRecord,
    extract_variable_names,
)


_VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_prompt_id() -> str:
    return f"prm-{uuid.uuid4().hex[:16]}"


class PromptService:
    def __init__(
        self,
        repository: PromptRepository,
        chat_service: ChatService,
    ) -> None:
        self._repo = repository
        self._chat = chat_service

    # ------------------------------------------------------------------ CRUD

    def create(
        self,
        tenant_id: str,
        request: PromptCreateRequest,
        *,
        created_by: str = "system",
    ) -> PromptRecord:
        if self._repo.key_exists(tenant_id, request.promptKey):
            raise PromptKeyExistsError(
                f"Prompt key 已存在: {request.promptKey}",
                data={"promptKey": request.promptKey},
            )

        variables = self._normalize_variables(request.template, list(request.variables))
        record = PromptRecord(
            prompt_id=_make_prompt_id(),
            tenant_id=tenant_id,
            prompt_key=request.promptKey,
            name=request.name,
            description=request.description,
            category=request.category,
            template=request.template,
            variables=variables,
            default_model=request.defaultModel,
            default_params=request.defaultParams.model_dump() if request.defaultParams else None,
            tags=list(request.tags),
            version=1,
            is_latest=True,
            status=PromptStatus.ACTIVE,
            change_log="初始版本",
            created_by=created_by,
            updated_by=created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        version = PromptVersionRecord(**record.model_dump())
        self._repo.insert(record, [version])
        return record

    def list(
        self,
        tenant_id: str,
        *,
        keyword: Optional[str] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        all_items = self._repo.list(
            tenant_id,
            keyword=keyword,
            tags=tags,
            category=category,
            status=status,
        )
        total = len(all_items)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = all_items[start:end]
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return {
            "items": [self._to_list_item(p) for p in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        }

    def detail(self, tenant_id: str, prompt_id: str) -> PromptRecord:
        record = self._repo.get(prompt_id)
        if record is None or record.tenant_id != tenant_id:
            raise PromptNotFoundError(
                f"Prompt 模板不存在: promptId={prompt_id}",
                data={"promptId": prompt_id},
            )
        return record

    def update(
        self,
        tenant_id: str,
        prompt_id: str,
        request: PromptUpdateRequest,
        *,
        updated_by: str = "system",
    ) -> PromptRecord:
        current = self.detail(tenant_id, prompt_id)

        new_template = request.template if request.template is not None else current.template
        new_variables: List[PromptVariableDef]
        if request.variables is not None:
            new_variables = self._normalize_variables(new_template, list(request.variables))
        else:
            new_variables = self._normalize_variables(new_template, list(current.variables))

        next_version = current.version + 1
        updated = PromptRecord(
            prompt_id=current.prompt_id,
            tenant_id=current.tenant_id,
            prompt_key=current.prompt_key,
            name=request.name if request.name is not None else current.name,
            description=request.description if request.description is not None else current.description,
            category=request.category if request.category is not None else current.category,
            template=new_template,
            variables=new_variables,
            default_model=request.defaultModel if request.defaultModel is not None else current.default_model,
            default_params=(
                request.defaultParams.model_dump() if request.defaultParams is not None else current.default_params
            ),
            tags=list(request.tags) if request.tags is not None else list(current.tags),
            version=next_version,
            is_latest=True,
            status=current.status,
            change_log=request.changeLog or "",
            created_by=current.created_by,
            updated_by=updated_by,
            created_at=current.created_at,
            updated_at=_now(),
        )
        self._repo.update(updated)
        version = PromptVersionRecord(
            **updated.model_dump(),
            previous_version=current.version,
        )
        self._repo.save_version(version)
        return updated

    def delete(self, tenant_id: str, prompt_id: str) -> Dict[str, Any]:
        record = self.detail(tenant_id, prompt_id)
        versions = self._repo.list_versions(prompt_id)
        self._repo.remove(prompt_id)
        return {
            "promptId": prompt_id,
            "deleted": True,
            "deletedVersions": len(versions),
        }

    # --------------------------------------------------------------- versions

    def list_versions(self, tenant_id: str, prompt_id: str) -> List[PromptVersionRecord]:
        self.detail(tenant_id, prompt_id)  # ensure exists & tenant match
        return self._repo.list_versions(prompt_id)

    def get_version(
        self,
        tenant_id: str,
        prompt_id: str,
        version: int,
    ) -> PromptVersionRecord:
        self.detail(tenant_id, prompt_id)
        version_record = self._repo.get_version(prompt_id, version)
        if version_record is None:
            raise PromptNotFoundError(
                f"Prompt 版本不存在: promptId={prompt_id}, version={version}",
                data={"promptId": prompt_id, "version": version},
            )
        return version_record

    def rollback(
        self,
        tenant_id: str,
        prompt_id: str,
        request: PromptRollbackRequest,
        *,
        updated_by: str = "system",
    ) -> PromptRecord:
        current = self.detail(tenant_id, prompt_id)
        target = self.get_version(tenant_id, prompt_id, request.targetVersion)

        next_version = current.version + 1
        rolled = PromptRecord(
            prompt_id=current.prompt_id,
            tenant_id=current.tenant_id,
            prompt_key=current.prompt_key,
            name=target.name,
            description=target.description,
            category=target.category,
            template=target.template,
            variables=list(target.variables),
            default_model=target.default_model,
            default_params=target.default_params,
            tags=list(target.tags),
            version=next_version,
            is_latest=True,
            status=current.status,
            change_log=request.changeLog or f"回滚到 v{request.targetVersion}",
            created_by=current.created_by,
            updated_by=updated_by,
            created_at=current.created_at,
            updated_at=_now(),
        )
        self._repo.update(rolled)
        version = PromptVersionRecord(
            **rolled.model_dump(),
            rolled_back_from=current.version,
            rolled_back_to=request.targetVersion,
        )
        self._repo.save_version(version)
        return rolled

    # ----------------------------------------------------------------- render

    def render(
        self,
        tenant_id: str,
        prompt_id: str,
        request: PromptRenderRequest,
    ) -> Dict[str, Any]:
        record = self.detail(tenant_id, prompt_id)
        source = self._resolve_version(record, request.version)

        rendered, replaced, missing = self._render_template(
            source.template,
            source.variables,
            request.variables,
        )
        if missing:
            required_missing = [
                v.name
                for v in source.variables
                if v.required and v.name in missing
            ]
            if required_missing:
                raise PromptVariableMissingError(
                    f"必填变量未提供: {required_missing}",
                    data={"missingVariables": required_missing},
                )

        return {
            "promptId": prompt_id,
            "version": source.version,
            "renderedPrompt": rendered,
            "replacedVariables": replaced,
            "missingVariables": missing,
        }

    def preview(
        self,
        tenant_id: str,
        prompt_id: str,
        request: PromptPreviewRequest,
        *,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        record = self.detail(tenant_id, prompt_id)
        source = self._resolve_version(record, request.version)

        rendered, _replaced, missing = self._render_template(
            source.template,
            source.variables,
            request.variables,
        )
        if missing:
            required_missing = [
                v.name
                for v in source.variables
                if v.required and v.name in missing
            ]
            if required_missing:
                raise PromptVariableMissingError(
                    f"必填变量未提供: {required_missing}",
                    data={"missingVariables": required_missing},
                )

        model_id = request.model or source.default_model
        if not model_id:
            raise InvalidParamError(
                "缺少模型参数",
                data={"field": "model"},
            )

        params = request.params or PromptDefaultParams()
        if source.default_params:
            merged = dict(source.default_params)
            if params.temperature is not None:
                merged["temperature"] = params.temperature
            if params.maxTokens is not None:
                merged["maxTokens"] = params.maxTokens
        else:
            merged = params.model_dump()

        start = time.monotonic()
        chat_resp = self._chat.text_chat(
            tenant_id,
            model_id,
            rendered,
            system_prompt=None,
            temperature=merged.get("temperature"),
            max_tokens=merged.get("maxTokens"),
        )
        latency = int((time.monotonic() - start) * 1000)

        return {
            "promptId": prompt_id,
            "version": source.version,
            "renderedPrompt": rendered,
            "model": model_id,
            "provider": chat_resp.provider,
            "response": {
                "content": chat_resp.content,
                "finishReason": chat_resp.finishReason,
            },
            "usage": chat_resp.usage.model_dump(),
            "latency": {
                "totalMs": latency,
                "providerMs": chat_resp.latencyMs,
            },
        }

    # ----------------------------------------------------------- helpers

    def _resolve_version(
        self,
        record: PromptRecord,
        version: Optional[int],
    ) -> PromptRecord:
        if version is None or version == record.version:
            return record
        version_record = self._repo.get_version(record.prompt_id, version)
        if version_record is None:
            raise PromptNotFoundError(
                f"Prompt 版本不存在: version={version}",
                data={"version": version},
            )
        return version_record

    def _normalize_variables(
        self,
        template: str,
        variables: List[PromptVariableDef],
    ) -> List[PromptVariableDef]:
        """Auto-create variable definitions for placeholders without one."""

        found = set(extract_variable_names(template))
        defined = {v.name: v for v in variables}
        result = list(variables)
        for name in found:
            if name not in defined:
                result.append(PromptVariableDef(name=name, type="string", required=True))
        return result

    def _render_template(
        self,
        template: str,
        variables: List[PromptVariableDef],
        values: Dict[str, Any],
    ) -> tuple[str, List[str], List[str]]:
        rendered = template
        replaced: List[str] = []
        missing: List[str] = []

        found = set(extract_variable_names(template))
        for name in found:
            if name in values:
                rendered = _VARIABLE_PATTERN.sub(
                    lambda m, val=values[name]: str(val) if m.group(1) == name else m.group(0),
                    rendered,
                )
                replaced.append(name)
            else:
                missing.append(name)

        # Defensive: after loop there should be no placeholders if all provided.
        remaining = set(extract_variable_names(rendered))
        if remaining:
            missing = sorted(set(missing) | remaining)

        return rendered, sorted(replaced), sorted(missing)

    def _to_list_item(self, record: PromptRecord) -> Dict[str, Any]:
        return {
            "promptId": record.prompt_id,
            "promptKey": record.prompt_key,
            "name": record.name,
            "category": record.category,
            "version": record.version,
            "tags": list(record.tags),
            "status": record.status.value,
            "defaultModel": record.default_model,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def to_detail(self, record: PromptRecord) -> Dict[str, Any]:
        return {
            "promptId": record.prompt_id,
            "promptKey": record.prompt_key,
            "name": record.name,
            "description": record.description,
            "category": record.category,
            "template": record.template,
            "variables": [v.model_dump() for v in record.variables],
            "defaultModel": record.default_model,
            "defaultParams": record.default_params,
            "tags": list(record.tags),
            "version": record.version,
            "status": record.status.value,
            "createdBy": record.created_by,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def to_version_item(self, version: PromptVersionRecord) -> Dict[str, Any]:
        preview = version.template
        if len(preview) > 120:
            preview = preview[:120] + "..."
        return {
            "version": version.version,
            "changeLog": version.change_log,
            "templatePreview": preview,
            "createdBy": version.created_by,
            "createdAt": version.created_at,
        }
