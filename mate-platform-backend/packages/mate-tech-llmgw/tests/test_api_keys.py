"""P5: virtual API keys (2026-09-09) — LiteLLM VerificationToken pattern.

Plaintext appears once; DB stores sha256 only; blocked/expires/models/
rpm+tpm/max_budget enforced; revoke invalidates the cache immediately;
the install_auth api_key_verifier hook is opt-in (other services
unchanged — covered by the mate-platform auth regression suite).
"""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

import mate_tech_llmgw.security.api_keys as api_keys_mod
from mate_tech_llmgw.security.api_keys import (
    ApiKeyCache,
    ApiKeyRecord,
    ApiKeyRejected,
    ApiKeyStore,
    generate_api_key,
    hash_key,
    key_id_from_ctx,
    llmgw_api_key_verifier,
    model_allowed,
    set_api_key_runtime,
)


# ---------------------------------------------------------------------------
# Store doubles
# ---------------------------------------------------------------------------
class _FakeAcquire:
    def __init__(self, conn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc) -> None:
        return None


class _KeyConn:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}  # key_hash → row

    def _row_for_hash(self, key_hash: str) -> dict | None:
        return self.rows.get(key_hash)

    async def execute(self, sql: str, *args: Any) -> str:
        if "INSERT INTO llmgw_api_keys" in sql:
            row = {
                "key_id": args[0], "tenant_id": args[1], "key_name": args[2],
                "key_hash": args[3], "key_prefix": args[4],
                "models": args[5],
                "max_budget_usd": args[6], "soft_budget_usd": args[7],
                "budget_duration": args[8], "budget_reset_at": args[9],
                "tpm_limit": args[10], "rpm_limit": args[11],
                "spend_usd": 0.0, "blocked": False,
                "expires_at": args[12], "last_active_at": None,
            }
            self.rows[row["key_hash"]] = row
            return "INSERT 1"
        if "SET blocked = TRUE" in sql:
            for row in self.rows.values():
                if row["key_id"] == args[0] and row["tenant_id"] == args[1]:
                    row["blocked"] = True
                    return "UPDATE 1"
            return "UPDATE 0"
        if "SET key_hash" in sql:
            for old_hash, row in list(self.rows.items()):
                if row["key_id"] == args[0] and row["tenant_id"] == args[1]:
                    del self.rows[old_hash]
                    row["key_hash"] = args[2]
                    row["key_prefix"] = args[3]
                    row["blocked"] = False
                    self.rows[args[2]] = row
                    return "UPDATE 1"
            return "UPDATE 0"
        if "SET budget_reset_at" in sql:
            for row in self.rows.values():
                if row["key_id"] == args[0]:
                    row["budget_reset_at"] = args[2]
                    row["spend_usd"] = 0.0
                    return "UPDATE 1"
            return "UPDATE 0"
        return "OK"

    async def fetchrow(self, sql: str, *args: Any) -> dict | None:
        if "key_hash = $1" in sql:
            return self._row_for_hash(args[0])
        if "SELECT key_hash" in sql:
            for row in self.rows.values():
                if row["key_id"] == args[0]:
                    return {"key_hash": row["key_hash"]}
            return None
        if "WHERE key_id = $1" in sql:
            for row in self.rows.values():
                if row["key_id"] == args[0]:
                    return row
            return None
        if "tenant_id = $1" in sql:
            return None  # list path uses fetch; not needed here
        return None

    async def fetch(self, sql: str, *args: Any) -> list[dict]:
        if "tenant_id = $1" in sql:
            return [r for r in self.rows.values() if r["tenant_id"] == args[0]]
        return []


class _KeyPool:
    def __init__(self) -> None:
        self.conn = _KeyConn()

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


@pytest.fixture
def key_pool() -> _KeyPool:
    return _KeyPool()


@pytest.fixture(autouse=True)
def _reset_key_runtime():
    set_api_key_runtime(None, None, None)
    yield
    set_api_key_runtime(None, None, None)


def test_generate_key_shape() -> None:
    plaintext, digest, prefix = generate_api_key()
    assert plaintext.startswith("sk-llmgw-")
    assert digest == hash_key(plaintext)
    assert plaintext.startswith(prefix)
    # Two generations never collide.
    assert generate_api_key()[0] != plaintext


@pytest.mark.asyncio
async def test_create_stores_only_hash_and_returns_plaintext_once(
    key_pool: _KeyPool,
) -> None:
    store = ApiKeyStore(key_pool)
    record, plaintext = await store.create(
        tenant_id="acme", key_name="ci", models=("gpt-4o*",),
        max_budget_usd=10.0, budget_duration="30d",
    )
    assert plaintext.startswith("sk-llmgw-")
    stored = key_pool.conn.rows[hash_key(plaintext)]
    assert stored["key_hash"] == hash_key(plaintext)
    assert plaintext not in str(stored)  # no recoverable secret
    assert record.key_prefix
    assert stored["budget_reset_at"] is not None


@pytest.mark.asyncio
async def test_verify_unknown_blocked_expired(key_pool: _KeyPool) -> None:
    store = ApiKeyStore(key_pool)
    _, plaintext = await store.create(tenant_id="acme")

    assert (await store.verify(plaintext)).tenant_id == "acme"

    await store.revoke("acme", (await store.verify(plaintext)).key_id)
    with pytest.raises(ApiKeyRejected, match="revoked"):
        await store.verify(plaintext)

    with pytest.raises(ApiKeyRejected, match="unknown"):
        await store.verify("sk-llmgw-does-not-exist")


@pytest.mark.asyncio
async def test_revoke_is_tenant_scoped(key_pool: _KeyPool) -> None:
    store = ApiKeyStore(key_pool)
    _, plaintext = await store.create(tenant_id="acme")
    key_id = (await store.verify(plaintext)).key_id
    assert await store.revoke("other-tenant", key_id) is False  # no row touched
    assert (await store.verify(plaintext)).blocked is False


@pytest.mark.asyncio
async def test_rotate_invalidates_old_plaintext(key_pool: _KeyPool) -> None:
    store = ApiKeyStore(key_pool)
    _, old_plaintext = await store.create(tenant_id="acme")
    key_id = (await store.verify(old_plaintext)).key_id

    result = await store.rotate("acme", key_id)
    assert result is not None
    _, new_plaintext = result
    assert new_plaintext != old_plaintext
    with pytest.raises(ApiKeyRejected, match="unknown"):
        await store.verify(old_plaintext)
    assert (await store.verify(new_plaintext)).key_id == key_id


@pytest.mark.asyncio
async def test_budget_window_lazy_advance(key_pool: _KeyPool) -> None:
    store = ApiKeyStore(key_pool)
    record, _ = await store.create(
        tenant_id="acme", max_budget_usd=5.0, budget_duration="1d"
    )
    # Force an expired window + spent budget.
    from dataclasses import replace

    expired = replace(
        record,
        budget_reset_at=datetime.now(UTC) - timedelta(hours=1),
        spend_usd=4.99,
    )
    advanced = await store.advance_budget_window(expired)
    assert advanced.spend_usd == 0.0
    assert advanced.budget_reset_at > datetime.now(UTC)


def test_model_allowed_whitelist() -> None:
    record = ApiKeyRecord(
        key_id="k", tenant_id="t", key_name="", key_prefix="sk-llmgw-",
        models=("gpt-4o*", "qwen-plus"), max_budget_usd=None,
        soft_budget_usd=None, budget_duration=None, budget_reset_at=None,
        tpm_limit=None, rpm_limit=None, spend_usd=0.0, blocked=False,
        expires_at=None, last_active_at=None,
    )
    assert model_allowed(record, "gpt-4o-mini")
    assert model_allowed(record, "qwen-plus")
    assert not model_allowed(record, "claude-3-opus")
    assert model_allowed(record, "")  # provider default resolved later
    from dataclasses import replace

    unrestricted = replace(record, models=())
    assert model_allowed(unrestricted, "anything")


# ---------------------------------------------------------------------------
# Auth flow (verifier + middleware hook + endpoint limits)
# ---------------------------------------------------------------------------
def _make_key_app(key_pool: _KeyPool, redis: Any | None = None) -> TestClient:
    """Full app: real AuthMiddleware with the llmgw verifier hook."""
    from mate_platform.auth.middleware import install_auth

    app = FastAPI()

    @app.post("/probe")
    async def probe(request: Request):
        ctx = getattr(request.state, "ctx", None)
        record = getattr(request.state, "llmgw_api_key", None)
        return {
            "tenant": str(getattr(ctx, "tenant_id", "")),
            "user": str(getattr(ctx, "user_id", "")),
            "method": str(getattr(getattr(ctx, "auth_method", None), "value", "")),
            "key_id": record.key_id if record else None,
        }

    install_auth(app, api_key_verifier=llmgw_api_key_verifier)
    set_api_key_runtime(ApiKeyStore(key_pool), ApiKeyCache(redis), redis)
    return TestClient(app)


def test_api_key_auth_flow_end_to_end(key_pool: _KeyPool) -> None:
    client = _make_key_app(key_pool)
    store = ApiKeyStore(key_pool)
    import asyncio

    record, key = asyncio.run(store.create(tenant_id="acme"))
    resp = client.post("/probe", headers={"Authorization": f"Bearer {key}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tenant"] == "acme"
    assert body["user"] == f"apikey:{record.key_id}"
    assert body["method"] == "api_key"
    assert body["key_id"] == record.key_id


def test_unknown_key_rejected_401(key_pool: _KeyPool) -> None:
    client = _make_key_app(key_pool)
    resp = client.post(
        "/probe", headers={"Authorization": "Bearer sk-llmgw-nope"}
    )
    assert resp.status_code == 401


def test_non_prefixed_garbage_token_rejected_401(key_pool: _KeyPool) -> None:
    client = _make_key_app(key_pool)
    resp = client.post("/probe", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_disabled_runtime_rejects_keys(key_pool: _KeyPool) -> None:
    """No PG pool → keys must NOT silently bypass auth."""
    from mate_platform.auth.middleware import install_auth

    app = FastAPI()

    @app.post("/probe")
    async def probe(request: Request):
        return {"ok": True}

    install_auth(app, api_key_verifier=llmgw_api_key_verifier)
    # runtime left unset (None store)
    resp = TestClient(app).post(
        "/probe", headers={"Authorization": "Bearer sk-llmgw-anything"}
    )
    assert resp.status_code == 401


def test_key_id_from_ctx_roundtrip() -> None:
    class _Ctx:
        user_id = "apikey:key-abc123"

    assert key_id_from_ctx(_Ctx()) == "key-abc123"
    assert key_id_from_ctx(type("C", (), {"user_id": "u1"})()) is None


@pytest.mark.asyncio
async def test_enforce_key_limits_budget_429(key_pool: _KeyPool) -> None:
    from fastapi import HTTPException

    from mate_tech_llmgw.security.api_keys import enforce_key_limits

    store = ApiKeyStore(key_pool)
    record, _ = await store.create(
        tenant_id="acme", max_budget_usd=1.0, budget_duration="30d",
        models=("gpt-4o*",),
    )
    from dataclasses import replace

    spent = replace(record, spend_usd=1.0)
    with pytest.raises(HTTPException) as exc_info:
        await enforce_key_limits(spent, model="gpt-4o", estimated_tokens=10,
                                 redis_client=None)
    assert exc_info.value.status_code == 429

    with pytest.raises(HTTPException) as exc_info:
        bad_model = replace(record, models=("qwen-*",))
        await enforce_key_limits(bad_model, model="gpt-4o",
                                 estimated_tokens=10, redis_client=None)
    assert exc_info.value.status_code == 403
