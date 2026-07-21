"""Code module business service (V12-02).

Wires together:
- LLM-driven code generation via ``ChatService.text_chat`` (REQ-038)
- Sandbox execution (REQ-041 / REQ-042)
- Template CRUD (REQ-043)
- Snippet CRUD + version history + diff (REQ-040 / REQ-044)
- Share-link / export generation (REQ-045)
"""

from __future__ import annotations

import difflib
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.chat.service import ChatService
from app.code import sandbox
from app.code.repository import (
    CodeShareRepository,
    CodeSnippetRepository,
    CodeTemplateRepository,
)
from app.code.schemas import (
    CodeExecuteRequest,
    CodeGenResult,
    CodeShareRecord,
    CodeShareRequest,
    CodeSnippetCreateRequest,
    CodeSnippetDiffResult,
    CodeSnippetRecord,
    CodeSnippetUpdateRequest,
    CodeSnippetVersionRecord,
    CodeTemplateCreateRequest,
    CodeTemplateRecord,
    CodeTemplateUpdateRequest,
    ExecutionResult,
    normalize_language,
)
from app.common.errors import InvalidParamError


# Default model id used for code generation when the caller does not
# specify one.  ``doubao-pro-32k`` is part of the seeded catalog and
# supports plain chat, which keeps the path runnable in tests without
# extra setup.
_DEFAULT_MODEL_ID = "m-volcengine-doubao-pro-32k"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_template_id() -> str:
    return f"ct-{uuid.uuid4().hex[:16]}"


def _make_snippet_id() -> str:
    return f"sn-{uuid.uuid4().hex[:16]}"


def _make_share_id() -> str:
    return f"cs-{uuid.uuid4().hex[:12]}"


# ----------------------------------------------------------- prompt templates


_CODE_GEN_SYSTEM_PROMPT = (
    "你是 Mate Platform 的代码生成助手。"
    "根据用户的自然语言描述生成可直接运行的高质量代码。"
    "严格遵守以下规则：\n"
    "1. 只输出代码块（使用 ```language 包裹）和一段简短说明，不要多余对话；\n"
    "2. 代码必须完整、可运行，包含必要的导入与初始化；\n"
    "3. Python 沙箱禁用 os/sys/subprocess/socket/open 等模块，"
    "请使用 math/json/re/datetime/collections/itertools/io.StringIO 等安全模块；\n"
    "4. SQL 仅允许 SELECT 查询，作用于 employees(id,name,department_id,salary,hire_date)、"
    "departments(id,name,manager)、orders(id,customer,amount,order_date) 三张示例表；\n"
    "5. TypeScript 输出可在浏览器中直接运行的代码片段；\n"
    "6. 在代码块后用 JSON 行 ``{\"dependencies\":[...]}`` 列出第三方依赖（可空）。\n"
    "返回格式示例：\n"
    "```python\n<code>\n```\n"
    "说明：xxx\n"
    "{\"dependencies\": []}"
)


def _extract_code_block(content: str, language: str) -> str:
    """Pull the first fenced code block for ``language`` out of ``content``."""

    fence_pattern = re.compile(
        r"```(?:[a-zA-Z]*\n)?(.*?)```",
        re.DOTALL,
    )
    matches = fence_pattern.findall(content)
    if matches:
        return matches[0].strip("\n")

    # No fenced block → treat the whole response as code if it looks like code.
    return content.strip()


def _extract_dependencies(content: str) -> List[str]:
    """Extract the optional ``{"dependencies":[...]}`` JSON line."""

    match = re.search(r'\{"dependencies"\s*:\s*\[([^\]]*)\]\}', content)
    if not match:
        return []
    raw = match.group(1).strip()
    if not raw:
        return []
    parts = [p.strip().strip('"').strip("'") for p in raw.split(",")]
    return [p for p in parts if p]


def _extract_description(content: str, code: str) -> str:
    """Return the human-readable description that accompanies the code block."""

    if not code:
        return content.strip()
    idx = content.find(code[:32])
    if idx == -1:
        # Fallback: strip fenced blocks and JSON tail.
        cleaned = re.sub(r"```.*?```", "", content, flags=re.DOTALL)
        cleaned = re.sub(r'\{"dependencies"\s*:\s*\[[^\]]*\]\}', "", cleaned)
        return cleaned.strip() or "生成的代码"
    # Strip everything up to and including the code block, then strip the
    # JSON tail that follows it.
    after = content[idx + len(code):]
    after = re.sub(r"```", "", after, count=1)
    after = re.sub(r'\{"dependencies"\s*:\s*\[[^\]]*\]\}', "", after)
    return after.strip() or "生成的代码"


class CodeService:
    """Orchestrates code generation / execution / templates / snippets / share."""

    def __init__(
        self,
        chat_service: ChatService,
        template_repo: CodeTemplateRepository,
        snippet_repo: CodeSnippetRepository,
        share_repo: CodeShareRepository,
    ) -> None:
        self._chat = chat_service
        self._templates = template_repo
        self._snippets = snippet_repo
        self._shares = share_repo

    # ----------------------------------------------------- REQ-038 generate

    async def generate(
        self,
        tenant_id: str,
        description: str,
        language: str,
        *,
        context: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> CodeGenResult:
        normalized = normalize_language(language)
        if normalized not in {"python", "typescript", "sql"}:
            raise InvalidParamError(
                f"不支持的代码语言: {language}",
                data={"language": language},
            )

        prompt = (
            f"请用 {normalized} 语言生成代码，需求如下：\n"
            f"{description}\n"
        )
        if context:
            prompt += f"\n上下文：\n{context}\n"

        target_model = model_id or _DEFAULT_MODEL_ID
        chat_resp = await self._chat.text_chat(
            tenant_id,
            target_model,
            prompt,
            system_prompt=_CODE_GEN_SYSTEM_PROMPT,
            temperature=0.2,
            max_tokens=2048,
        )
        content = chat_resp.content or ""
        code = _extract_code_block(content, normalized)
        deps = _extract_dependencies(content)
        desc = _extract_description(content, code)
        return CodeGenResult(
            language=normalized,
            code=code,
            description=desc,
            dependencies=deps,
        )

    # ------------------------------------------- REQ-041 / REQ-042 execute

    def execute(self, request: CodeExecuteRequest) -> ExecutionResult:
        normalized = normalize_language(request.language)
        return sandbox.execute(
            request.code,
            normalized,
            timeout_ms=request.timeoutMs,
        )

    # --------------------------------------------------- REQ-043 templates

    def create_template(
        self,
        tenant_id: str,
        request: CodeTemplateCreateRequest,
        *,
        created_by: str = "system",
    ) -> CodeTemplateRecord:
        record = CodeTemplateRecord(
            template_id=_make_template_id(),
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            language=normalize_language(request.language),
            category=request.category,
            code=request.code,
            tags=list(request.tags),
            created_by=created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        self._templates.insert(record)
        return record

    def list_templates(
        self,
        tenant_id: str,
        *,
        language: Optional[str] = None,
        category: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[CodeTemplateRecord]:
        return self._templates.list(
            tenant_id,
            language=normalize_language(language) if language else None,
            category=category,
            keyword=keyword,
        )

    def get_template(self, tenant_id: str, template_id: str) -> CodeTemplateRecord:
        record = self._templates.get(template_id)
        if record is None or record.tenant_id != tenant_id:
            raise InvalidParamError(
                f"代码模板不存在: templateId={template_id}",
                data={"templateId": template_id},
            )
        return record

    def update_template(
        self,
        tenant_id: str,
        template_id: str,
        request: CodeTemplateUpdateRequest,
    ) -> CodeTemplateRecord:
        current = self.get_template(tenant_id, template_id)
        updated = CodeTemplateRecord(
            **{
                **current.model_dump(),
                "name": request.name if request.name is not None else current.name,
                "description": request.description
                if request.description is not None
                else current.description,
                "category": request.category
                if request.category is not None
                else current.category,
                "code": request.code if request.code is not None else current.code,
                "tags": list(request.tags) if request.tags is not None else list(current.tags),
                "updated_at": _now(),
            }
        )
        self._templates.update(updated)
        return updated

    def delete_template(self, tenant_id: str, template_id: str) -> Dict[str, Any]:
        record = self.get_template(tenant_id, template_id)
        self._templates.remove(record.template_id)
        return {"templateId": template_id, "deleted": True}

    # ------------------------------------- REQ-040 / REQ-044 snippet CRUD

    def create_snippet(
        self,
        tenant_id: str,
        request: CodeSnippetCreateRequest,
        *,
        created_by: str = "system",
    ) -> CodeSnippetRecord:
        record = CodeSnippetRecord(
            snippet_id=_make_snippet_id(),
            tenant_id=tenant_id,
            title=request.title,
            description=request.description,
            language=normalize_language(request.language),
            code=request.code,
            tags=list(request.tags),
            version=1,
            change_log="初始版本",
            created_by=created_by,
            updated_by=created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        version = CodeSnippetVersionRecord(**record.model_dump())
        self._snippets.insert(record, [version])
        return record

    def list_snippets(
        self,
        tenant_id: str,
        *,
        language: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[CodeSnippetRecord]:
        return self._snippets.list(
            tenant_id,
            language=normalize_language(language) if language else None,
            keyword=keyword,
        )

    def get_snippet(self, tenant_id: str, snippet_id: str) -> CodeSnippetRecord:
        record = self._snippets.get(snippet_id)
        if record is None or record.tenant_id != tenant_id:
            raise InvalidParamError(
                f"代码片段不存在: snippetId={snippet_id}",
                data={"snippetId": snippet_id},
            )
        return record

    def update_snippet(
        self,
        tenant_id: str,
        snippet_id: str,
        request: CodeSnippetUpdateRequest,
        *,
        updated_by: str = "system",
    ) -> CodeSnippetRecord:
        current = self.get_snippet(tenant_id, snippet_id)
        next_version = current.version + 1
        updated = CodeSnippetRecord(
            snippet_id=current.snippet_id,
            tenant_id=current.tenant_id,
            title=request.title if request.title is not None else current.title,
            description=request.description
            if request.description is not None
            else current.description,
            language=current.language,
            code=request.code if request.code is not None else current.code,
            tags=list(request.tags) if request.tags is not None else list(current.tags),
            version=next_version,
            change_log=request.changeLog or f"更新到 v{next_version}",
            created_by=current.created_by,
            updated_by=updated_by,
            created_at=current.created_at,
            updated_at=_now(),
        )
        self._snippets.update(updated)
        version = CodeSnippetVersionRecord(
            **updated.model_dump(),
            previous_version=current.version,
        )
        self._snippets.save_version(version)
        return updated

    def delete_snippet(self, tenant_id: str, snippet_id: str) -> Dict[str, Any]:
        record = self.get_snippet(tenant_id, snippet_id)
        versions = self._snippets.list_versions(record.snippet_id)
        self._snippets.remove(record.snippet_id)
        return {
            "snippetId": snippet_id,
            "deleted": True,
            "deletedVersions": len(versions),
        }

    def list_snippet_versions(
        self,
        tenant_id: str,
        snippet_id: str,
    ) -> List[CodeSnippetVersionRecord]:
        self.get_snippet(tenant_id, snippet_id)
        return self._snippets.list_versions(snippet_id)

    def get_snippet_version(
        self,
        tenant_id: str,
        snippet_id: str,
        version: int,
    ) -> CodeSnippetVersionRecord:
        self.get_snippet(tenant_id, snippet_id)
        record = self._snippets.get_version(snippet_id, version)
        if record is None:
            raise InvalidParamError(
                f"代码片段版本不存在: snippetId={snippet_id}, version={version}",
                data={"snippetId": snippet_id, "version": version},
            )
        return record

    def diff_snippet_versions(
        self,
        tenant_id: str,
        snippet_id: str,
        version_a: int,
        version_b: int,
    ) -> CodeSnippetDiffResult:
        record_a = self.get_snippet_version(tenant_id, snippet_id, version_a)
        record_b = self.get_snippet_version(tenant_id, snippet_id, version_b)
        lines_a = record_a.code.splitlines()
        lines_b = record_b.code.splitlines()
        diff = list(
            difflib.unified_diff(
                lines_a,
                lines_b,
                fromfile=f"v{version_a}",
                tofile=f"v{version_b}",
                lineterm="",
            )
        )
        added: List[str] = []
        removed: List[str] = []
        for line in diff:
            if line.startswith("+") and not line.startswith("+++"):
                added.append(line[1:])
            elif line.startswith("-") and not line.startswith("---"):
                removed.append(line[1:])
        return CodeSnippetDiffResult(
            snippetId=snippet_id,
            versionA=version_a,
            versionB=version_b,
            addedLines=added,
            removedLines=removed,
            unifiedDiff="\n".join(diff),
        )

    # ----------------------------------------------------- REQ-045 share

    def create_share(
        self,
        tenant_id: str,
        request: CodeShareRequest,
        *,
        created_by: str = "system",
        base_url: str = "/api/v1/llmgw/code/share",
    ) -> CodeShareRecord:
        normalized = normalize_language(request.language)
        share_id = _make_share_id()
        export_content = self._build_export_content(
            request.code,
            normalized,
            request.title,
            request.description,
        )
        record = CodeShareRecord(
            share_id=share_id,
            tenant_id=tenant_id,
            title=request.title,
            description=request.description,
            language=normalized,
            code=request.code,
            share_url=f"{base_url}/{share_id}",
            export_content=export_content,
            created_by=created_by,
            created_at=_now(),
            expires_at=_now() + timedelta(days=30),
        )
        self._shares.insert(record)
        return record

    def get_share(self, share_id: str) -> CodeShareRecord:
        record = self._shares.get(share_id)
        if record is None:
            raise InvalidParamError(
                f"分享链接不存在: shareId={share_id}",
                data={"shareId": share_id},
            )
        return record

    def list_shares(self, tenant_id: str) -> List[CodeShareRecord]:
        return self._shares.list(tenant_id)

    def delete_share(self, tenant_id: str, share_id: str) -> Dict[str, Any]:
        record = self.get_share(share_id)
        if record.tenant_id != tenant_id:
            raise InvalidParamError(
                f"分享链接不存在: shareId={share_id}",
                data={"shareId": share_id},
            )
        self._shares.remove(share_id)
        return {"shareId": share_id, "deleted": True}

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _build_export_content(
        code: str,
        language: str,
        title: Optional[str],
        description: Optional[str],
    ) -> str:
        """Build a Markdown-flavoured export file for the snippet."""

        header_lines: List[str] = []
        if title:
            header_lines.append(f"# {title}")
            header_lines.append("")
        if description:
            header_lines.append(description)
            header_lines.append("")
        header_lines.append(
            f"Language: {language} · Exported by TECH-LLMGW at "
            f"{datetime.now(timezone.utc).isoformat()}"
        )
        header_lines.append("")
        header_lines.append(f"```{language}")
        header_lines.append(code)
        header_lines.append("```")
        return "\n".join(header_lines)

    # ----------------------------------------------- serialization helpers

    def template_to_dict(self, record: CodeTemplateRecord) -> Dict[str, Any]:
        return {
            "templateId": record.template_id,
            "name": record.name,
            "description": record.description,
            "language": record.language,
            "category": record.category,
            "code": record.code,
            "tags": list(record.tags),
            "createdBy": record.created_by,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def snippet_to_dict(self, record: CodeSnippetRecord) -> Dict[str, Any]:
        return {
            "snippetId": record.snippet_id,
            "title": record.title,
            "description": record.description,
            "language": record.language,
            "code": record.code,
            "tags": list(record.tags),
            "version": record.version,
            "changeLog": record.change_log,
            "createdBy": record.created_by,
            "updatedBy": record.updated_by,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def version_to_dict(self, version: CodeSnippetVersionRecord) -> Dict[str, Any]:
        data = self.snippet_to_dict(version)
        data["previousVersion"] = version.previous_version
        return data

    def share_to_dict(self, record: CodeShareRecord) -> Dict[str, Any]:
        return {
            "shareId": record.share_id,
            "title": record.title,
            "description": record.description,
            "language": record.language,
            "code": record.code,
            "shareUrl": record.share_url,
            "exportContent": record.export_content,
            "createdBy": record.created_by,
            "createdAt": record.created_at,
            "expiresAt": record.expires_at,
        }

    def execution_to_dict(self, result: ExecutionResult) -> Dict[str, Any]:
        return result.model_dump()

    def gen_result_to_dict(self, result: CodeGenResult) -> Dict[str, Any]:
        return result.model_dump()


__all__ = ["CodeService"]
