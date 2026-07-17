"""Agent authentication service: API Key and JWT validation."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, Optional

import jwt

from app.common.errors import KeyNotFoundError, UnauthorizedError
from app.config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_key_id() -> str:
    return f"key-{uuid.uuid4().hex[:24]}"


class ApiKeyRecord:
    """An API key issued for an agent."""

    def __init__(
        self,
        key_id: str,
        agent_id: str,
        tenant_id: str,
        key_hash: str,
        permissions: list[str] | None = None,
        created_at: Optional[datetime] = None,
        revoked: bool = False,
    ) -> None:
        self.key_id = key_id
        self.agent_id = agent_id
        self.tenant_id = tenant_id
        self.key_hash = key_hash
        self.permissions = permissions or []
        self.created_at = created_at or _now()
        self.revoked = revoked


class AuthService:
    """Service for agent authentication via API Key or JWT."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._keys: dict[str, ApiKeyRecord] = {}
        self._key_by_hash: dict[str, str] = {}  # hash -> key_id

    async def generate_api_key(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        permissions: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Generate a new API key for an agent. Returns the raw key (shown once)."""

        raw_key = f"a2a-{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_id = _new_key_id()

        record = ApiKeyRecord(
            key_id=key_id,
            agent_id=agent_id,
            tenant_id=tenant_id,
            key_hash=key_hash,
            permissions=permissions or [],
        )
        with self._lock:
            self._keys[key_id] = record
            self._key_by_hash[key_hash] = key_id

        return {
            "keyId": key_id,
            "apiKey": raw_key,
            "agentId": agent_id,
            "tenantId": tenant_id,
            "permissions": list(permissions or []),
            "createdAt": record.created_at,
        }

    async def validate_api_key(self, key: str) -> Dict[str, Any]:
        """Validate an API key and return agent identity.

        Raises UnauthorizedError if the key is invalid or revoked.
        """

        key_hash = hashlib.sha256(key.encode()).hexdigest()
        with self._lock:
            key_id = self._key_by_hash.get(key_hash)
            if key_id is None:
                raise UnauthorizedError("API Key 无效")
            record = self._keys.get(key_id)
            if record is None or record.revoked:
                raise UnauthorizedError("API Key 已撤销或不存在")
            return {
                "agentId": record.agent_id,
                "tenantId": record.tenant_id,
                "keyId": record.key_id,
                "permissions": list(record.permissions),
            }

    async def validate_jwt(self, token: str) -> Dict[str, Any]:
        """Validate a JWT and return claims."""

        try:
            payload: Dict[str, Any] = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
        except jwt.ExpiredSignatureError as exc:
            raise UnauthorizedError("认证令牌已过期") from exc
        except jwt.InvalidTokenError as exc:
            raise UnauthorizedError("认证令牌无效") from exc
        return payload

    async def revoke_api_key(self, key_id: str) -> bool:
        """Revoke an API key by its key_id."""

        with self._lock:
            record = self._keys.get(key_id)
            if record is None:
                raise KeyNotFoundError(
                    f"API Key 不存在: keyId={key_id}",
                    data={"keyId": key_id},
                )
            record.revoked = True
            # Remove from hash index so it can no longer be used
            self._key_by_hash.pop(record.key_hash, None)
            return True

    async def list_api_keys(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """List all API keys for a tenant (optionally filtered by agent)."""

        with self._lock:
            results = []
            for record in self._keys.values():
                if record.tenant_id != tenant_id:
                    continue
                if agent_id is not None and record.agent_id != agent_id:
                    continue
                results.append({
                    "keyId": record.key_id,
                    "agentId": record.agent_id,
                    "tenantId": record.tenant_id,
                    "permissions": list(record.permissions),
                    "createdAt": record.created_at,
                    "revoked": record.revoked,
                })
        results.sort(key=lambda r: r["createdAt"])
        return results

    async def update_key_permissions(
        self,
        key_id: str,
        permissions: list[str],
    ) -> dict[str, Any]:
        """Update permissions for an API key."""

        with self._lock:
            record = self._keys.get(key_id)
            if record is None:
                raise KeyNotFoundError(
                    f"API Key 不存在: keyId={key_id}",
                    data={"keyId": key_id},
                )
            record.permissions = list(permissions)
            return {
                "keyId": record.key_id,
                "agentId": record.agent_id,
                "tenantId": record.tenant_id,
                "permissions": list(record.permissions),
                "revoked": record.revoked,
            }

    def clear(self) -> None:
        with self._lock:
            self._keys.clear()
            self._key_by_hash.clear()
