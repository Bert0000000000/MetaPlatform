"""SQL-backed repository for the apphub — SQLAlchemy 2.0 (P3-W3 TD-5).

Provides read + write for the 5 apphub entity types
(ApphubApp / ApphubGroup / ApphubModule / ApphubPage / ApphubTemplate).

Tuple fields (``tags``) are serialised as newline-separated TEXT.
Dict fields (``content``) are JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    ApphubApp,
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _split_lines(text: str) -> tuple[str, ...]:
    """Split a newline-separated TEXT column back into a tuple."""
    if not text:
        return ()
    return tuple(s for s in text.split("\n") if s.strip())


def _join_lines(items: tuple[str, ...]) -> str:
    """Join a tuple into a newline-separated TEXT value."""
    return "\n".join(items) if items else ""


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


# ---------------------------------------------------------------------------
# ORM -> dataclass converters
# ---------------------------------------------------------------------------
def _orm_to_app(row: models.ApphubAppORM) -> ApphubApp:
    return ApphubApp(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
        description=row.description or "",
        version=row.version or "1.0.0",
        owner=row.owner or "platform-team",
        tags=_split_lines(row.tags or ""),
    )


def _orm_to_group(row: models.ApphubGroupORM) -> ApphubGroup:
    return ApphubGroup(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        icon=row.icon or "",
        sort_order=row.sort_order,
    )


def _orm_to_module(row: models.ApphubModuleORM) -> ApphubModule:
    return ApphubModule(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        app_code=row.app_code or "",
        description=row.description or "",
        entry_path=row.entry_path or "",
    )


def _orm_to_page(row: models.ApphubPageORM) -> ApphubPage:
    return ApphubPage(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        module_code=row.module_code or "",
        layout=row.layout or "single",
        schema_version=row.schema_version,
    )


def _orm_to_template(row: models.ApphubTemplateORM) -> ApphubTemplate:
    return ApphubTemplate(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        template_type=row.template_type or "",
        description=row.description or "",
        content=_json_loads(row.content),
    )


# ---------------------------------------------------------------------------
# Read API — apps
# ---------------------------------------------------------------------------
def list_apps(tenant_id: str) -> list[ApphubApp]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubAppORM)
        .where(models.ApphubAppORM.tenant_id == tenant_id)
        .order_by(models.ApphubAppORM.category, models.ApphubAppORM.name)
    ).scalars().all()
    return [_orm_to_app(r) for r in rows]


def get_app(tenant_id: str, app_id: str) -> ApphubApp | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubAppORM).where(
            models.ApphubAppORM.tenant_id == tenant_id,
            models.ApphubAppORM.id == app_id,
        )
    ).scalar_one_or_none()
    return _orm_to_app(row) if row else None


# ---------------------------------------------------------------------------
# Read API — groups
# ---------------------------------------------------------------------------
def list_groups(tenant_id: str) -> list[ApphubGroup]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubGroupORM)
        .where(models.ApphubGroupORM.tenant_id == tenant_id)
        .order_by(models.ApphubGroupORM.sort_order)
    ).scalars().all()
    return [_orm_to_group(r) for r in rows]


def get_group(tenant_id: str, group_id: str) -> ApphubGroup | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubGroupORM).where(
            models.ApphubGroupORM.tenant_id == tenant_id,
            models.ApphubGroupORM.id == group_id,
        )
    ).scalar_one_or_none()
    return _orm_to_group(row) if row else None


# ---------------------------------------------------------------------------
# Read API — modules
# ---------------------------------------------------------------------------
def list_modules(tenant_id: str) -> list[ApphubModule]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubModuleORM)
        .where(models.ApphubModuleORM.tenant_id == tenant_id)
        .order_by(models.ApphubModuleORM.code)
    ).scalars().all()
    return [_orm_to_module(r) for r in rows]


def get_module(tenant_id: str, module_id: str) -> ApphubModule | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubModuleORM).where(
            models.ApphubModuleORM.tenant_id == tenant_id,
            models.ApphubModuleORM.id == module_id,
        )
    ).scalar_one_or_none()
    return _orm_to_module(row) if row else None


# ---------------------------------------------------------------------------
# Read API — pages
# ---------------------------------------------------------------------------
def list_pages(tenant_id: str) -> list[ApphubPage]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubPageORM)
        .where(models.ApphubPageORM.tenant_id == tenant_id)
        .order_by(models.ApphubPageORM.code)
    ).scalars().all()
    return [_orm_to_page(r) for r in rows]


def get_page(tenant_id: str, page_id: str) -> ApphubPage | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubPageORM).where(
            models.ApphubPageORM.tenant_id == tenant_id,
            models.ApphubPageORM.id == page_id,
        )
    ).scalar_one_or_none()
    return _orm_to_page(row) if row else None


# ---------------------------------------------------------------------------
# Read API — templates
# ---------------------------------------------------------------------------
def list_templates(tenant_id: str) -> list[ApphubTemplate]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubTemplateORM)
        .where(models.ApphubTemplateORM.tenant_id == tenant_id)
        .order_by(
            models.ApphubTemplateORM.template_type,
            models.ApphubTemplateORM.name,
        )
    ).scalars().all()
    return [_orm_to_template(r) for r in rows]


def get_template(tenant_id: str, template_id: str) -> ApphubTemplate | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubTemplateORM).where(
            models.ApphubTemplateORM.tenant_id == tenant_id,
            models.ApphubTemplateORM.id == template_id,
        )
    ).scalar_one_or_none()
    return _orm_to_template(row) if row else None


# ---------------------------------------------------------------------------
# Write API — apps
# ---------------------------------------------------------------------------
def put_app(tenant_id: str, app: ApphubApp) -> ApphubApp:
    if not tenant_id:
        return app
    s = _session()
    tags_str = _join_lines(app.tags)
    existing = s.get(models.ApphubAppORM, app.id)
    if existing:
        existing.name = app.name
        existing.category = app.category
        existing.description = app.description
        existing.version = app.version
        existing.owner = app.owner
        existing.tags = tags_str
    else:
        s.add(models.ApphubAppORM(
            id=app.id, tenant_id=tenant_id, name=app.name, code=app.code,
            category=app.category, description=app.description,
            version=app.version, owner=app.owner, tags=tags_str,
        ))
    s.commit()
    return app


# ---------------------------------------------------------------------------
# Write API — groups
# ---------------------------------------------------------------------------
def put_group(tenant_id: str, group: ApphubGroup) -> ApphubGroup:
    if not tenant_id:
        return group
    s = _session()
    existing = s.get(models.ApphubGroupORM, group.id)
    if existing:
        existing.name = group.name
        existing.icon = group.icon
        existing.sort_order = group.sort_order
    else:
        s.add(models.ApphubGroupORM(
            id=group.id, tenant_id=tenant_id, name=group.name, code=group.code,
            icon=group.icon, sort_order=group.sort_order,
        ))
    s.commit()
    return group


# ---------------------------------------------------------------------------
# Write API — modules
# ---------------------------------------------------------------------------
def put_module(tenant_id: str, module: ApphubModule) -> ApphubModule:
    if not tenant_id:
        return module
    s = _session()
    existing = s.get(models.ApphubModuleORM, module.id)
    if existing:
        existing.name = module.name
        existing.app_code = module.app_code
        existing.description = module.description
        existing.entry_path = module.entry_path
    else:
        s.add(models.ApphubModuleORM(
            id=module.id, tenant_id=tenant_id, name=module.name,
            code=module.code, app_code=module.app_code,
            description=module.description, entry_path=module.entry_path,
        ))
    s.commit()
    return module


# ---------------------------------------------------------------------------
# Write API — pages
# ---------------------------------------------------------------------------
def put_page(tenant_id: str, page: ApphubPage) -> ApphubPage:
    if not tenant_id:
        return page
    s = _session()
    existing = s.get(models.ApphubPageORM, page.id)
    if existing:
        existing.name = page.name
        existing.module_code = page.module_code
        existing.layout = page.layout
        existing.schema_version = page.schema_version
    else:
        s.add(models.ApphubPageORM(
            id=page.id, tenant_id=tenant_id, name=page.name, code=page.code,
            module_code=page.module_code, layout=page.layout,
            schema_version=page.schema_version,
        ))
    s.commit()
    return page


# ---------------------------------------------------------------------------
# Write API — templates
# ---------------------------------------------------------------------------
def put_template(tenant_id: str, template: ApphubTemplate) -> ApphubTemplate:
    if not tenant_id:
        return template
    s = _session()
    content_str = _json_dumps(template.content)
    existing = s.get(models.ApphubTemplateORM, template.id)
    if existing:
        existing.name = template.name
        existing.template_type = template.template_type
        existing.description = template.description
        existing.content = content_str
    else:
        s.add(models.ApphubTemplateORM(
            id=template.id, tenant_id=tenant_id, name=template.name,
            code=template.code, template_type=template.template_type,
            description=template.description, content=content_str,
        ))
    s.commit()
    return template


# ---------------------------------------------------------------------------
# Bootstrap — seed SQL store from in_memory seed data (one-time)
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data.

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["apps"] = len(
        [put_app(tenant_id, a) for a in mem.list_apps(tenant_id)]
    )
    counts["groups"] = len(
        [put_group(tenant_id, g) for g in mem.list_groups(tenant_id)]
    )
    counts["modules"] = len(
        [put_module(tenant_id, m) for m in mem.list_modules(tenant_id)]
    )
    counts["pages"] = len(
        [put_page(tenant_id, p) for p in mem.list_pages(tenant_id)]
    )
    counts["templates"] = len(
        [put_template(tenant_id, t) for t in mem.list_templates(tenant_id)]
    )
    return counts


# ---------------------------------------------------------------------------
# Shortlink persistence (APPHUB-RUNTIME-01 K3-1)
# ---------------------------------------------------------------------------
def _orm_to_shortlink(row: models.ApphubShortlinkORM):
    """Re-hydrate an ORM row into a shortlink.repository.ShortlinkEntry."""
    from ..shortlink.repository import ShortlinkEntry
    return ShortlinkEntry(
        id=row.id,
        tenant_id=row.tenant_id,
        app_id=row.app_id,
        code=row.code,
        role=row.role,
        expires_at=row.expires_at.isoformat() if row.expires_at else None,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


def put_shortlink(tenant_id: str, entry) -> object:
    """Insert or update a shortlink entry for the given tenant."""
    if not tenant_id:
        return entry
    s = _session()
    existing = s.get(models.ApphubShortlinkORM, entry.id)
    if existing:
        existing.app_id = entry.app_id
        existing.code = entry.code
        existing.role = entry.role
        existing.expires_at = (
            __import__("datetime").datetime.fromisoformat(entry.expires_at)
            if entry.expires_at
            else None
        )
    else:
        s.add(models.ApphubShortlinkORM(
            id=entry.id,
            tenant_id=tenant_id,
            app_id=entry.app_id,
            code=entry.code,
            role=entry.role,
            expires_at=(
                __import__("datetime").datetime.fromisoformat(entry.expires_at)
                if entry.expires_at
                else None
            ),
        ))
    s.commit()
    return entry


def get_shortlink_by_code(tenant_id: str, code: str):
    """Look up a shortlink by (tenant_id, code). Returns ShortlinkEntry or None."""
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.ApphubShortlinkORM).where(
            models.ApphubShortlinkORM.tenant_id == tenant_id,
            models.ApphubShortlinkORM.code == code,
        )
    ).scalar_one_or_none()
    return _orm_to_shortlink(row) if row else None


def list_shortlinks(tenant_id: str) -> list:
    """List all shortlinks for a tenant."""
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApphubShortlinkORM)
        .where(models.ApphubShortlinkORM.tenant_id == tenant_id)
        .order_by(models.ApphubShortlinkORM.created_at.desc())
    ).scalars().all()
    return [_orm_to_shortlink(r) for r in rows]


def delete_shortlink_by_code(tenant_id: str, code: str) -> bool:
    """Delete a shortlink by (tenant_id, code). Returns True if deleted."""
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.ApphubShortlinkORM).where(
            models.ApphubShortlinkORM.tenant_id == tenant_id,
            models.ApphubShortlinkORM.code == code,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


def shortlink_exists(tenant_id: str, code: str) -> bool:
    """Check if a shortlink exists for (tenant_id, code)."""
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.ApphubShortlinkORM.id).where(
            models.ApphubShortlinkORM.tenant_id == tenant_id,
            models.ApphubShortlinkORM.code == code,
        )
    ).scalar_one_or_none()
    return row is not None


def reset_shortlinks() -> None:
    """Truncate the apphub_shortlinks table (test helper)."""
    s = _session()
    s.execute(models.ApphubShortlinkORM.__table__.delete())
    s.commit()
