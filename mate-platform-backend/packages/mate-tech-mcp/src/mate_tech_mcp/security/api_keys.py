"""Long-lived API keys for external MCP clients (ADR-0062).

Why
---
External MCP clients (Codex, Cursor, ...) authenticated with a Keycloak JWT
that lives exactly one hour, forcing a re-login and a client restart every
hour. This module supplies a long-lived, revocable, tenant-scoped alternative.

Only the sha256 of the plaintext is ever stored (hard rule 12); the plaintext
is shown once at creation and is unrecoverable afterwards.

How it plugs in
---------------
``mate_platform.auth.install_auth`` accepts an optional ``api_key_verifier``
hook that runs **only after** the JWT verifier rejects a token, so the JWT path
is completely unaffected. Non-``sk-mcp-`` tokens raise immediately.

RLS note
--------
``mcp_api_keys`` is deliberately excluded from the tenant RLS migration
(ADR-0062 §2.1): verification looks a row up by ``key_hash`` before any tenant
context exists, so a policy keyed on ``current_setting('app.tenant_id')`` would
reject every lookup. The hash is an unguessable 256-bit value and only reveals
the key's own tenant.

Storage is synchronous SQLAlchemy, so every store call from the async verifier
is dispatched to a worker thread — a blocking query on the event loop would
stall the whole service.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import anyio.to_thread
import structlog
from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId
from sqlalchemy import select

logger = structlog.get_logger(__name__)

KEY_PREFIX = "sk-mcp-"
_PREFIX_LEN = 11


class McpApiKeyRejected(Exception):
    """Key unknown/blocked/expired, or key auth unavailable.

    Maps to 401 at the middleware. Defined locally rather than imported from
    llmgw — depending on another service's package would be the wrong
    direction.
    """


@dataclass(frozen=True, slots=True)
class McpApiKeyRecord:
    key_id: str
    tenant_id: str
    key_name: str
    key_prefix: str
    blocked: bool
    expires_at: datetime | None
    last_active_at: datetime | None
    created_at: str
    created_by: str


def generate_api_key() -> tuple[str, str, str]:
    """Return ``(plaintext, sha256_hex, prefix)``."""
    plaintext = KEY_PREFIX + secrets.token_urlsafe(32)
    return plaintext, hash_key(plaintext), plaintext[:_PREFIX_LEN]


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalise a stored timestamp to aware UTC.

    PostgreSQL returns aware timestamptz values; SQLite (used by tests) returns
    naive ones. Without this, comparing against an aware ``now()`` would raise
    TypeError on SQLite.
    """
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _model() -> Any:
    """Lazily resolve the ORM class.

    Deliberately not a module-level import: ``mate_tech_mcp.main`` imports this
    module, and test fixtures re-import the package after evicting it from
    ``sys.modules``. A module-level ORM import would re-execute ``sql_models``
    on that re-import and re-register its tables on the shared ``Base``, which
    SQLAlchemy rejects with "Table already defined".
    """
    from ..repositories.sql_models import McpApiKeyORM

    return McpApiKeyORM


def _to_record(row: Any) -> McpApiKeyRecord:
    return McpApiKeyRecord(
        key_id=row.id,
        tenant_id=row.tenant_id,
        key_name=row.key_name or "",
        key_prefix=row.key_prefix or "",
        blocked=bool(row.blocked),
        expires_at=_as_utc(row.expires_at),
        last_active_at=_as_utc(row.last_active_at),
        created_at=row.created_at or "",
        created_by=row.created_by or "",
    )


class McpApiKeyStore:
    """SQLAlchemy-backed key CRUD over the shared platform database."""

    def create(
        self,
        *,
        tenant_id: str,
        key_name: str = "",
        expires_at: datetime | None = None,
        created_by: str = "",
    ) -> tuple[McpApiKeyRecord, str]:
        from mate_tech_db.base import get_session

        plaintext, key_hash, prefix = generate_api_key()
        row = _model()(
            id=f"key-{secrets.token_hex(8)}",
            tenant_id=tenant_id,
            key_name=key_name,
            key_hash=key_hash,
            key_prefix=prefix,
            blocked=False,
            expires_at=expires_at,
            created_at=datetime.now(UTC).isoformat(),
            created_by=created_by,
        )
        session = get_session()
        try:
            session.add(row)
            session.commit()
            record = _to_record(row)
        finally:
            session.close()
        return record, plaintext

    def get_by_hash(self, key_hash: str) -> McpApiKeyRecord | None:
        """Look a key up by hash. Intentionally not tenant-filtered — see the
        module docstring and ADR-0062 §2.1."""
        from mate_tech_db.base import get_session

        session = get_session()
        try:
            model = _model()
            row = session.execute(
                select(model).where(model.key_hash == key_hash)
            ).scalar_one_or_none()
            return _to_record(row) if row is not None else None
        finally:
            session.close()

    def list_keys(self, tenant_id: str) -> list[McpApiKeyRecord]:
        from mate_tech_db.base import get_session

        session = get_session()
        try:
            model = _model()
            rows = (
                session.execute(
                    select(model)
                    .where(model.tenant_id == tenant_id)
                    .order_by(model.created_at.desc())
                )
                .scalars()
                .all()
            )
            return [_to_record(row) for row in rows]
        finally:
            session.close()

    def revoke(self, tenant_id: str, key_id: str) -> bool:
        """Delete a key, scoped to its tenant. Returns False if not found."""
        from mate_tech_db.base import get_session

        session = get_session()
        try:
            model = _model()
            row = session.execute(
                select(model).where(
                    model.id == key_id,
                    model.tenant_id == tenant_id,
                )
            ).scalar_one_or_none()
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
        finally:
            session.close()


# ---------------------------------------------------------------------------
# Process-wide runtime (wired in main.py startup)
# ---------------------------------------------------------------------------
_store: McpApiKeyStore | None = None


def set_api_key_runtime(store: McpApiKeyStore | None) -> None:
    global _store
    _store = store


def get_api_key_store() -> McpApiKeyStore | None:
    return _store


async def mcp_api_key_verifier(request: object, token: str) -> RequestContext:
    """``install_auth`` hook: verify an ``sk-mcp-*`` bearer.

    Fail-closed by construction: anything that is not a known, unblocked,
    unexpired key raises, and a missing store raises too — keys can never
    silently bypass auth.
    """
    if not token.startswith(KEY_PREFIX):
        raise McpApiKeyRejected("not an mcp api key")

    store = _store
    if store is None:
        raise McpApiKeyRejected("api key auth disabled")

    digest = hash_key(token)
    record = await anyio.to_thread.run_sync(store.get_by_hash, digest)
    if record is None:
        raise McpApiKeyRejected("unknown api key")
    if record.blocked:
        raise McpApiKeyRejected("api key revoked")
    expires_at = record.expires_at
    if expires_at is not None and expires_at <= datetime.now(UTC):
        raise McpApiKeyRejected("api key expired")

    # Stash for handlers that want the key identity without a second lookup.
    state = getattr(request, "state", None)
    if state is not None:
        state.mcp_api_key = record

    headers = getattr(request, "headers", {})
    return RequestContext(
        request_id=headers.get("x-request-id", ""),
        trace_id=headers.get("x-trace-id", ""),
        tenant_id=TenantId(record.tenant_id),
        user_id=UserId(f"apikey:{record.key_id}"),
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        client_id="mate-tech-mcp-api-key",
        auth_method=AuthMethod.API_KEY,
    )
