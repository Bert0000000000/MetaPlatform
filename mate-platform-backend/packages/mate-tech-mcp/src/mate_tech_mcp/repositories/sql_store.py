"""SQL-backed repository for the mcp domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``McpTool``, ``McpResource``, and ``McpPrompt``.
Dict fields (``McpTool.input_schema``) are JSON-serialised to TEXT.
Tuple fields (``McpPrompt.arguments``) are stored as newline-separated TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import McpPrompt, McpResource, McpTool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


def _join_lines(items: tuple[str, ...] | list[str]) -> str:
    return "\n".join(items)


def _split_lines(text: str) -> tuple[str, ...]:
    if not text:
        return ()
    return tuple(line for line in text.split("\n") if line)


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers
# ---------------------------------------------------------------------------
def _orm_to_tool(row: models.McpToolORM) -> McpTool:
    return McpTool(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        description=row.description or "",
        input_schema=_json_loads(row.input_schema),
        enabled=row.enabled if row.enabled is not None else True,
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_resource(row: models.McpResourceORM) -> McpResource:
    return McpResource(
        id=row.id,
        tenant_id=row.tenant_id,
        uri=row.uri or "",
        name=row.name or "",
        description=row.description or "",
        mime_type=row.mime_type or "",
        created_at=row.created_at or "",
    )


def _orm_to_prompt(row: models.McpPromptORM) -> McpPrompt:
    return McpPrompt(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        description=row.description or "",
        template=row.template or "",
        arguments=_split_lines(row.arguments),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — tools
# ---------------------------------------------------------------------------
def list_tools(tenant_id: str) -> list[McpTool]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.McpToolORM)
        .where(models.McpToolORM.tenant_id == tenant_id)
        .order_by(models.McpToolORM.id)
    ).scalars().all()
    return [_orm_to_tool(r) for r in rows]


def get_tool(tenant_id: str, tid: str) -> McpTool | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.McpToolORM).where(
            models.McpToolORM.tenant_id == tenant_id,
            models.McpToolORM.id == tid,
        )
    ).scalar_one_or_none()
    return _orm_to_tool(row) if row else None


# ---------------------------------------------------------------------------
# Read API — resources
# ---------------------------------------------------------------------------
def list_resources(tenant_id: str) -> list[McpResource]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.McpResourceORM)
        .where(models.McpResourceORM.tenant_id == tenant_id)
        .order_by(models.McpResourceORM.id)
    ).scalars().all()
    return [_orm_to_resource(r) for r in rows]


def get_resource(tenant_id: str, rid: str) -> McpResource | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.McpResourceORM).where(
            models.McpResourceORM.tenant_id == tenant_id,
            models.McpResourceORM.id == rid,
        )
    ).scalar_one_or_none()
    return _orm_to_resource(row) if row else None


# ---------------------------------------------------------------------------
# Read API — prompts
# ---------------------------------------------------------------------------
def list_prompts(tenant_id: str) -> list[McpPrompt]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.McpPromptORM)
        .where(models.McpPromptORM.tenant_id == tenant_id)
        .order_by(models.McpPromptORM.id)
    ).scalars().all()
    return [_orm_to_prompt(r) for r in rows]


def get_prompt(tenant_id: str, pid: str) -> McpPrompt | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.McpPromptORM).where(
            models.McpPromptORM.tenant_id == tenant_id,
            models.McpPromptORM.id == pid,
        )
    ).scalar_one_or_none()
    return _orm_to_prompt(row) if row else None


# ---------------------------------------------------------------------------
# Write API — tools
# ---------------------------------------------------------------------------
def put_tool(tenant_id: str, tool: McpTool) -> McpTool:
    if not tenant_id:
        return tool
    s = _session()
    schema_str = _json_dumps(tool.input_schema)
    existing = s.get(models.McpToolORM, tool.id)
    if existing:
        existing.name = tool.name
        existing.description = tool.description
        existing.input_schema = schema_str
        existing.enabled = tool.enabled
        existing.updated_at = tool.updated_at
    else:
        s.add(models.McpToolORM(
            id=tool.id, tenant_id=tenant_id, name=tool.name,
            description=tool.description, input_schema=schema_str,
            enabled=tool.enabled, created_at=tool.created_at,
            updated_at=tool.updated_at,
        ))
    s.commit()
    return tool


def delete_tool(tenant_id: str, tid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.McpToolORM).where(
            models.McpToolORM.tenant_id == tenant_id,
            models.McpToolORM.id == tid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — resources
# ---------------------------------------------------------------------------
def put_resource(tenant_id: str, res: McpResource) -> McpResource:
    if not tenant_id:
        return res
    s = _session()
    existing = s.get(models.McpResourceORM, res.id)
    if existing:
        existing.uri = res.uri
        existing.name = res.name
        existing.description = res.description
        existing.mime_type = res.mime_type
        existing.created_at = res.created_at
    else:
        s.add(models.McpResourceORM(
            id=res.id, tenant_id=tenant_id, uri=res.uri,
            name=res.name, description=res.description,
            mime_type=res.mime_type, created_at=res.created_at,
        ))
    s.commit()
    return res


def delete_resource(tenant_id: str, rid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.McpResourceORM).where(
            models.McpResourceORM.tenant_id == tenant_id,
            models.McpResourceORM.id == rid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — prompts
# ---------------------------------------------------------------------------
def put_prompt(tenant_id: str, prompt: McpPrompt) -> McpPrompt:
    if not tenant_id:
        return prompt
    s = _session()
    args_str = _join_lines(prompt.arguments)
    existing = s.get(models.McpPromptORM, prompt.id)
    if existing:
        existing.name = prompt.name
        existing.description = prompt.description
        existing.template = prompt.template
        existing.arguments = args_str
        existing.updated_at = prompt.updated_at
    else:
        s.add(models.McpPromptORM(
            id=prompt.id, tenant_id=tenant_id, name=prompt.name,
            description=prompt.description, template=prompt.template,
            arguments=args_str, created_at=prompt.created_at,
            updated_at=prompt.updated_at,
        ))
    s.commit()
    return prompt


def delete_prompt(tenant_id: str, pid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.McpPromptORM).where(
            models.McpPromptORM.tenant_id == tenant_id,
            models.McpPromptORM.id == pid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["tools"] = len(
        [put_tool(tenant_id, t) for t in mem.list_tools(tenant_id)]
    )
    counts["resources"] = len(
        [put_resource(tenant_id, r) for r in mem.list_resources(tenant_id)]
    )
    counts["prompts"] = len(
        [put_prompt(tenant_id, p) for p in mem.list_prompts(tenant_id)]
    )
    return counts
