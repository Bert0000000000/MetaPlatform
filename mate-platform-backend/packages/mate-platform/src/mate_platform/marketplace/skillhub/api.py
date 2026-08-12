"""SkillHub API — public skill upload / browse / download / install.

Endpoints (mounted under ``/api/v1/marketplace`` in mate-app-hub):

  - POST   /skills            — upload a skill (public or private)
  - GET    /skills            — browse public + own skills
  - GET    /skills/{id}       — skill detail
  - GET    /skills/{id}/download — skill content
  - POST   /skills/{id}/install  — install a public skill
  - DELETE /skills/{id}       — delete own skill
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .store import Skill, get_skillhub_store

router = APIRouter(tags=["marketplace"])


def _store(request: Request) -> Any:
    return getattr(request.app.state, "skillhub_store", None) or get_skillhub_store()


def _require_scope(user: Any, scope: str) -> None:
    if user is None or scope not in getattr(user, "scopes", frozenset()):
        raise HTTPException(
            status_code=403,
            detail={"code": "MP_INSUFFICIENT_SCOPE", "message": f"missing {scope}"},
        )


def _tenant(request: Request) -> str:
    user = getattr(request.state, "user", None)
    return str(getattr(user, "tenant_id", "") or "")


def _skill_dict(skill: Skill, tenant: str = "") -> dict[str, Any]:
    d = asdict(skill)
    d["id"] = skill.id
    d["is_owner"] = bool(tenant) and skill.author_tenant == tenant
    return d


class UploadSkillRequest(BaseModel):
    """Body for POST /skills."""

    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="")
    version: str = Field(default="v1")
    visibility: str = Field(default="public", pattern="^(public|private)$")
    content: str = Field(min_length=1, description="the skill payload (SKILL.md / yaml)")


@router.post("/skills", status_code=201)
async def upload_skill(request: Request, body: UploadSkillRequest) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    tenant = _tenant(request)
    if not tenant:
        raise HTTPException(status_code=400, detail={"code": "E_TENANT_REQUIRED", "message": "tenant required"})
    import uuid

    skill = _store(request).create(
        Skill(
            id=f"skill-{uuid.uuid4().hex[:10]}",
            name=body.name,
            description=body.description,
            version=body.version,
            author_tenant=tenant,
            visibility=body.visibility,
            content=body.content,
        )
    )
    return _skill_dict(skill, tenant)


@router.get("/skills")
async def list_skills(
    request: Request,
    q: str | None = None,
    visibility: str | None = None,
) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.read")
    tenant = _tenant(request)
    items = _store(request).list(tenant)
    if q:
        ql = q.lower()
        items = [s for s in items if ql in s.name.lower() or ql in s.description.lower()]
    if visibility:
        items = [s for s in items if s.visibility == visibility]
    items.sort(key=lambda s: (-s.installs, s.name))
    return {"items": [_skill_dict(s, tenant) for s in items], "total": len(items)}


@router.get("/skills/installed")
async def list_installed_skills(request: Request) -> dict[str, Any]:
    """已安装 SKILL（当前租户安装过的技能清单）。"""
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.read")
    tenant = _tenant(request)
    store = _store(request)
    ids = store.installed_skill_ids(tenant)
    items = [store.get(sid) for sid in ids]
    items = [s for s in items if s is not None]
    items.sort(key=lambda s: s.name)
    return {"items": [_skill_dict(s, tenant) for s in items], "total": len(items)}


@router.get("/skills/{skill_id}")
async def get_skill(skill_id: str, request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.read")
    tenant = _tenant(request)
    skill = _store(request).get(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return _skill_dict(skill, tenant)


@router.get("/skills/{skill_id}/download")
async def download_skill(skill_id: str, request: Request) -> dict[str, str]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.read")
    skill = _store(request).get(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return {"id": skill.id, "name": skill.name, "version": skill.version, "content": skill.content}


@router.post("/skills/{skill_id}/install")
async def install_skill(skill_id: str, request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    count = _store(request).install(_tenant(request), skill_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="skill not found")
    return {"id": skill_id, "installs": count, "status": "installed"}


@router.put("/skills/{skill_id}")
async def update_skill(skill_id: str, request: Request, body: UploadSkillRequest) -> dict[str, Any]:
    """更新自有 SKILL（仅作者）。"""
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    tenant = _tenant(request)
    skill = _store(request).get(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="skill not found")
    if skill.author_tenant != tenant:
        raise HTTPException(status_code=403, detail="not the skill owner")
    updated = _store(request).update(
        skill_id,
        name=body.name,
        description=body.description,
        version=body.version,
        visibility=body.visibility,
        content=body.content,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return _skill_dict(updated, tenant)


@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str, request: Request) -> dict[str, str]:
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    skill = _store(request).get(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="skill not found")
    if skill.author_tenant != _tenant(request):
        raise HTTPException(status_code=403, detail="not the skill owner")
    _store(request).delete(skill_id)
    return {"deleted": skill_id}
