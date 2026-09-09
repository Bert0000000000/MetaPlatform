"""Virtual API key management endpoints (P5).

All management routes require an authenticated RequestContext (the
management tenant comes from ctx, never the URL). The plaintext key
appears exactly once, in the create/rotate response; everything else
exposes the prefix only. Revoke/rotate invalidate the Redis key cache
immediately (otherwise revocation latency is bounded by the 30s TTL).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..router import get_cost_recorder
from ..security.api_keys import get_api_key_cache, get_api_key_store
from .routes import _require_same_tenant_management_access

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/llmgw/keys", tags=["llmgw-keys"])


class KeyCreateRequest(BaseModel):
    key_name: str = Field(default="", max_length=128)
    models: list[str] = Field(default_factory=list)
    max_budget_usd: float | None = Field(default=None, gt=0)
    soft_budget_usd: float | None = Field(default=None, gt=0)
    budget_duration: str | None = Field(default=None, pattern="^(1d|7d|30d)$")
    tpm_limit: int | None = Field(default=None, gt=0)
    rpm_limit: int | None = Field(default=None, gt=0)
    expires_at: str | None = None  # ISO 8601


class KeyCreateResponse(BaseModel):
    key_id: str
    key: str  # one-time plaintext
    key_prefix: str
    tenant_id: str


def _record_payload(record: Any) -> dict[str, Any]:
    return {
        "key_id": record.key_id,
        "key_name": record.key_name,
        "key_prefix": record.key_prefix,
        "tenant_id": record.tenant_id,
        "models": list(record.models),
        "max_budget_usd": record.max_budget_usd,
        "soft_budget_usd": record.soft_budget_usd,
        "budget_duration": record.budget_duration,
        "budget_reset_at": record.budget_reset_at.isoformat()
        if record.budget_reset_at else None,
        "tpm_limit": record.tpm_limit,
        "rpm_limit": record.rpm_limit,
        "spend_usd": round(record.spend_usd, 6),
        "blocked": record.blocked,
        "expires_at": record.expires_at.isoformat() if record.expires_at else None,
        "last_active_at": record.last_active_at.isoformat()
        if record.last_active_at else None,
    }


def _store_or_503() -> Any:
    store = get_api_key_store()
    if store is None:
        raise HTTPException(
            status_code=503, detail="api key management requires PG (disabled)"
        )
    return store


async def _invalidate_key_cache(key_id: str) -> None:
    """Immediate revocation: drop the Redis entry for this key's hash."""
    store = get_api_key_store()
    cache = get_api_key_cache()
    if store is None or cache is None:
        return
    key_hash = await store.key_hash_for(key_id)
    if key_hash:
        await cache.invalidate(key_hash)


@router.post("", response_model=KeyCreateResponse)
async def create_key(req: KeyCreateRequest, request: Request) -> KeyCreateResponse:
    tenant_id = _require_same_tenant_management_access(request, _tenant_of(request))
    store = _store_or_503()
    expires_at = None
    if req.expires_at:
        try:
            expires_at = datetime.fromisoformat(req.expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid expires_at") from exc

    record, plaintext = await store.create(
        tenant_id=tenant_id,
        key_name=req.key_name,
        models=tuple(req.models),
        max_budget_usd=req.max_budget_usd,
        soft_budget_usd=req.soft_budget_usd,
        budget_duration=req.budget_duration,
        tpm_limit=req.tpm_limit,
        rpm_limit=req.rpm_limit,
        expires_at=expires_at,
        created_by=str(getattr(request.state.ctx, "user_id", "") or ""),
    )
    logger.info(
        "llmgw.apikey.created", key_id=record.key_id, tenant_id=tenant_id
    )
    return KeyCreateResponse(
        key_id=record.key_id,
        key=plaintext,
        key_prefix=record.key_prefix,
        tenant_id=tenant_id,
    )


@router.get("")
async def list_keys(request: Request) -> dict[str, Any]:
    tenant_id = _require_same_tenant_management_access(request, _tenant_of(request))
    store = _store_or_503()
    records = await store.list_keys(tenant_id)
    return {"keys": [_record_payload(r) for r in records]}


@router.delete("/{key_id}")
async def revoke_key(key_id: str, request: Request) -> dict[str, Any]:
    tenant_id = _require_same_tenant_management_access(request, _tenant_of(request))
    store = _store_or_503()
    revoked = await store.revoke(tenant_id, key_id)
    if not revoked:
        raise HTTPException(status_code=404, detail="key not found")
    await _invalidate_key_cache(key_id)
    logger.info("llmgw.apikey.revoked", key_id=key_id, tenant_id=tenant_id)
    return {"revoked": True, "key_id": key_id}


@router.post("/{key_id}/rotate", response_model=KeyCreateResponse)
async def rotate_key(key_id: str, request: Request) -> KeyCreateResponse:
    tenant_id = _require_same_tenant_management_access(request, _tenant_of(request))
    store = _store_or_503()
    result = await store.rotate(tenant_id, key_id)
    if result is None:
        raise HTTPException(status_code=404, detail="key not found")
    record, plaintext = result
    # Old hash cache entry dies now; the new hash was never cached.
    await _invalidate_key_cache(key_id)
    logger.info("llmgw.apikey.rotated", key_id=key_id, tenant_id=tenant_id)
    return KeyCreateResponse(
        key_id=record.key_id,
        key=plaintext,
        key_prefix=record.key_prefix,
        tenant_id=tenant_id,
    )


@router.get("/{key_id}/info")
async def key_info(key_id: str, request: Request) -> dict[str, Any]:
    tenant_id = _require_same_tenant_management_access(request, _tenant_of(request))
    store = _store_or_503()
    records = await store.list_keys(tenant_id)
    for record in records:
        if record.key_id == key_id:
            payload = _record_payload(record)
            # Window usage from the P1 daily rollup when available.
            recorder = get_cost_recorder()
            store_obj = getattr(recorder, "_store", None)
            if store_obj is not None:
                try:
                    payload["window_spend_usd"] = await store_obj.window_spend(
                        api_key_id=key_id,
                        since=datetime.now(UTC) - timedelta(days=30),
                    )
                except Exception:  # noqa: BLE001 — informational only
                    payload["window_spend_usd"] = None
            return payload
    raise HTTPException(status_code=404, detail="key not found")


def _tenant_of(request: Request) -> str:
    """Management tenant comes from the authenticated ctx (never the URL)."""
    ctx = getattr(request.state, "ctx", None)
    tenant = str(getattr(ctx, "tenant_id", "") or "")
    return tenant
