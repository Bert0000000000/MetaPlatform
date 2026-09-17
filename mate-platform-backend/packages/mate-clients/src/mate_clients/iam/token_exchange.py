"""IAM 的**令牌交换**通道（RFC 8693）—— 运行期委托身份的出站边界。

**它自己发 HTTP 是有意的，不是漏了**（与 :mod:`.identity` / ``jwks.py`` 同一条理由）：
换令牌这一步**必须**直接对 IdP 说话——它要用一枚**服务令牌**去换一枚**用户令牌**，
不存在"用内部 Bearer 就能换"的替代路径。硬规则 #4 要的是"外部系统有 ACL 客户端"，
本模块**就是**那个客户端：协议细节（``grant_type`` / ``subject_token`` / 响应形状）
收在这一处，业务侧只调 :meth:`KeycloakTokenExchangeClient.exchange`。

**subject 是服务身份**：Keycloak 侧按该 client 的 token-exchange 权限判授权，
再用 ``requested_subject`` 指名"换成谁"。所以本模块拿的是一个**取值回调**
（生产是 :class:`mate_clients.security.BearerAuth` 的 ``.token``），
而不是调用方的用户令牌——用户令牌在续跑那条路上根本不存在（ADR-0067）。

**如实失败**：换不到就抛 :class:`TokenExchangeError`，并把 IdP 的错误码
（``invalid_grant`` / ``access_denied`` …）带出来。回一个空令牌让上层猜，
正是这一类集成最贵的故障。
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

#: RFC 8693。
TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange"
ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token"


class TokenExchangeError(RuntimeError):
    """换令牌失败（含 IdP 的错误码）。"""


@dataclass(frozen=True, slots=True)
class ExchangedToken:
    access_token: str
    expires_in: float = 0.0


class HttpPoster(Protocol):
    """只用到 ``post`` 这一面——测试注入替身时不必造一个完整 httpx 客户端。"""

    async def post(self, url: str, data: Mapping[str, str]) -> Any: ...


def default_token_uri(keycloak_url: str, realm: str = "metaplatform") -> str:
    return f"{keycloak_url.rstrip('/')}/realms/{realm}/protocol/openid-connect/token"


class KeycloakTokenExchangeClient:
    """``POST /protocol/openid-connect/token`` 上的一次 RFC 8693 交换。"""

    def __init__(
        self,
        *,
        token_uri: str,
        client_id: str,
        client_secret: str,
        timeout: float = 10.0,
        service_token: Callable[[], str] | None = None,
        http: HttpPoster | None = None,
    ) -> None:
        self._token_uri = token_uri
        self._client_id = client_id
        self._client_secret = client_secret
        self._timeout = timeout
        self._http = http
        #: 服务身份令牌的取值回调。默认用既有的 ``BearerAuth``（client_credentials）。
        self._service_token = service_token
        if service_token is None:
            from ..security import BearerAuth

            self._service_token = BearerAuth(
                token_uri=token_uri,
                client_id=client_id,
                client_secret=client_secret,
                scope="openid",
            ).token

    async def _request_subject_token(self) -> str:
        """取服务身份令牌（``BearerAuth`` 是同步的，丢线程跑）。"""
        return await asyncio.to_thread(self._service_token)  # type: ignore[misc]

    async def exchange(self, *, subject: str, audience: str = "") -> ExchangedToken:
        """换一枚**代表 ``subject``** 的短期令牌。失败抛 :class:`TokenExchangeError`。"""
        body: dict[str, str] = {
            "grant_type": TOKEN_EXCHANGE_GRANT,
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "subject_token": await self._request_subject_token(),
            "subject_token_type": ACCESS_TOKEN_TYPE,
            "requested_subject": subject,
        }
        if audience:
            body["audience"] = audience
        try:
            if self._http is not None:
                resp = await self._http.post(self._token_uri, data=body)
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(self._token_uri, data=body)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise TokenExchangeError(f"token exchange transport error: {exc}") from exc
        try:
            payload = resp.json()
        except ValueError as exc:
            raise TokenExchangeError(f"token exchange body is not JSON: {exc}") from exc
        if not isinstance(payload, Mapping):
            raise TokenExchangeError("token exchange body is not an object")
        token = str(payload.get("access_token") or "")
        if not token:
            error = str(payload.get("error") or "")
            detail = str(payload.get("error_description") or "")
            raise TokenExchangeError(
                f"token exchange returned no access_token（error={error or 'n/a'} {detail}）"
            )
        try:
            expires_in = float(payload.get("expires_in") or 0.0)
        except (TypeError, ValueError):
            expires_in = 0.0
        return ExchangedToken(access_token=token, expires_in=max(0.0, expires_in))


__all__ = [
    "ACCESS_TOKEN_TYPE",
    "TOKEN_EXCHANGE_GRANT",
    "ExchangedToken",
    "HttpPoster",
    "KeycloakTokenExchangeClient",
    "TokenExchangeError",
    "default_token_uri",
]
