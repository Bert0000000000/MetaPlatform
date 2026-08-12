"""skill search/read tools — MCP 工具：检索 skillhub 已发布 skill。

让 agent（经 orchestrator dispatch）按能力检索已安装 skill 并读取其
SKILL.md 内容作为上下文，据此搭应用。

链路：
  orchestrator (CapabilityBinding worker_kind=mcp, ref=search_skill)
    → POST /api/v1/mcp/tools/search_skill
    → 本工具 handler → HTTP 调 apphub /api/v1/marketplace/skills
    → 返回匹配 skill 列表 / SKILL.md content

tenant_id 由调用方（orchestrator / MCP 客户端）在 arguments 中显式传入，
因为 MCP 桥 `call_tool` 只转发 arguments（不注入 tenant claim）。
"""
from __future__ import annotations

import os
import time
from typing import Any, ClassVar

import httpx
import jwt
import structlog

logger = structlog.get_logger(__name__)

# Legacy dev token (shared with mate-tech-iam `_make_token`). 后端以
# INSECURE_SKIP_SIGNATURE=true 运行时只查 aud/iss，本工具自铸同款
# HS256 token 作为服务身份调 apphub（生产 profile 用真实 Keycloak
# client_credentials 替换）。
_IAM_SECRET = os.getenv("IAM_DEV_JWT_SECRET", "mate-dev-secret-do-not-use-in-prod")
_IAM_ALG = os.getenv("IAM_DEV_JWT_ALG", "HS256")
_TOKEN_TTL_SEC = int(os.getenv("IAM_ACCESS_TOKEN_TTL", "3600"))

_service_token_cache: dict[str, str | int] = {}


def _service_token() -> str:
    """Mint/cache a legacy service token accepted by INSECURE_SKIP_SIGNATURE peers."""
    now = int(time.time())
    exp = _service_token_cache.get("exp")
    cached = _service_token_cache.get("token")
    if cached and isinstance(exp, int) and exp > now + 60:
        return cached
    payload = {
        "iss": os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
        + "/realms/"
        + os.getenv("KEYCLOAK_REALM", "metaplatform"),
        "aud": os.getenv("KEYCLOAK_AUDIENCE", "metaplatform-backend"),
        "azp": os.getenv("SERVICE_CLIENT_ID", "metaplatform-backend"),
        "realm_access": {"roles": ["platform-read"]},
        "scope": "platform.read platform.write",
        "attributes": {"tenant_id": ["tenant-default"]},
        "sub": "mate-tech-mcp",
        "preferred_username": "mate-tech-mcp",
        "tenant_id": "tenant-default",
        "iat": now,
        "exp": now + _TOKEN_TTL_SEC,
        "jti": f"mcp-skill-{now}",
        "token_kind": "access",
    }
    token = jwt.encode(payload, _IAM_SECRET, algorithm=_IAM_ALG)
    _service_token_cache["token"] = token
    _service_token_cache["exp"] = now + _TOKEN_TTL_SEC
    return token


class SearchSkillTool:
    """search_skill(query, tenant_id) -> 列出匹配的 skill 摘要。"""

    name = "search_skill"
    description = "在 skillhub 检索已发布的 skill（按名称/描述匹配），返回 name/description/version"
    category = "skill"
    handler: Any = None
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "skill 名称/描述关键词，如 platform-ui-components"},
            "tenant_id": {"type": "string", "description": "租户 ID（由调用方注入）"},
        },
        "required": ["query"],
    }

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv("APPHUB_URL", "http://localhost:8301")
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url, timeout=timeout
        )

    @staticmethod
    def _headers(tenant_id: str) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {_service_token()}"}
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id
        return headers

    async def __call__(
        self,
        *,
        query: str = "",
        tenant_id: str = "",
        visibility: str = "public",
    ) -> dict[str, Any]:
        params: dict[str, str] = {"visibility": visibility}
        if query:
            params["q"] = query
        try:
            resp = await self._client.get(
                "/api/v1/marketplace/skills",
                params=params,
                headers=self._headers(tenant_id),
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", data.get("data", {}).get("items", [])) or []
            summary = [
                {
                    "id": s.get("id"),
                    "name": s.get("name"),
                    "description": s.get("description"),
                    "version": s.get("version"),
                    "installs": s.get("installs", 0),
                }
                for s in items
            ]
            logger.info("skill_search.ok", query=query, tenant=tenant_id, hits=len(summary))
            return {"query": query, "hits": summary, "total": len(summary)}
        except httpx.HTTPError as e:
            logger.error("skill_search.http_error", error=str(e))
            return {"error": f"skillhub unreachable: {e}", "query": query, "hits": []}
        except Exception as e:
            logger.error("skill_search.error", error=str(e))
            return {"error": str(e), "query": query, "hits": []}

    async def aclose(self) -> None:
        await self._client.aclose()


class ReadSkillTool:
    """read_skill(skill_id, tenant_id) -> 返回 SKILL.md 全文。"""

    name = "read_skill"
    description = "读取指定 skill 的 SKILL.md 内容（组件清单 / 模板），作为 agent 搭应用上下文"
    category = "skill"
    handler: Any = None
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "skill_id": {"type": "string", "description": "skill 的 id（来自 search_skill）"},
            "tenant_id": {"type": "string", "description": "租户 ID（由调用方注入）"},
        },
        "required": ["skill_id"],
    }

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv("APPHUB_URL", "http://localhost:8301")
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url, timeout=timeout
        )

    async def __call__(
        self,
        *,
        skill_id: str,
        tenant_id: str = "",
    ) -> dict[str, Any]:
        try:
            resp = await self._client.get(
                f"/api/v1/marketplace/skills/{skill_id}/download",
                headers=SearchSkillTool._headers(tenant_id),
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("content", data.get("data", {}).get("content", ""))
            name = data.get("name", data.get("data", {}).get("name", skill_id))
            logger.info("skill_read.ok", skill_id=skill_id, chars=len(content))
            return {"skill_id": skill_id, "name": name, "content": content}
        except httpx.HTTPError as e:
            logger.error("skill_read.http_error", error=str(e))
            return {"error": f"skillhub unreachable: {e}", "skill_id": skill_id}
        except Exception as e:
            logger.error("skill_read.error", error=str(e))
            return {"error": str(e), "skill_id": skill_id}

    async def aclose(self) -> None:
        await self._client.aclose()


def build_search_skill_tool() -> SearchSkillTool:
    t = SearchSkillTool()
    t.handler = t
    return t


def build_read_skill_tool() -> ReadSkillTool:
    t = ReadSkillTool()
    t.handler = t
    return t
