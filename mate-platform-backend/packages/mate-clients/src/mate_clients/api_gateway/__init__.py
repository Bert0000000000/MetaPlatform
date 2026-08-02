"""API Gateway client stub (K3-4).

Concrete APIGatewayClient implementation lives in a separate package
(``mate-api-gateway``) that is not part of this workspace. Until that
package is added, the apphub executor relies on this stub which
returns a deterministic synthetic response so callers and integration
tests can assert on a stable shape without requiring a running API
gateway.
"""
from __future__ import annotations


class APIGatewayClient:
    """Stub API Gateway client.

    ``invoke`` returns a deterministic dict with a synthetic ``callId``.
    The method signature mirrors what the real client is expected to
    expose so the apphub executor can switch to it without changing
    the call site.
    """

    def __init__(self, base_url: str = "http://localhost:8080") -> None:
        self.base_url = base_url

    async def invoke(
        self,
        api_id: str,
        payload: dict,
        tenant_id: str,
    ) -> dict:
        """Invoke a downstream API. Returns ``{callId, api_id, echoed_payload}``."""
        return {
            "callId": f"call-{api_id}-{hash((api_id, tenant_id)) % 10000}",
            "api_id": api_id,
            "echoed_payload": payload,
        }