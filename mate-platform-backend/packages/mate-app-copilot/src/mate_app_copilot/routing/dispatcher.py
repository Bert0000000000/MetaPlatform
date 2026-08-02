"""Copilot query dispatcher: llmgw for simple, A2A for deep research.

``dispatch()`` inspects the query complexity and routes accordingly:

* **Simple query** → ``llmgw_client.chat(query)`` (lightweight LLM).
* **Deep research query** → HTTP POST to the A2A delegate endpoint,
  which forwards to the DeerFlow ``deep-research`` agent.

The function is transport-agnostic: ``llmgw_client`` is any object
with a ``chat(query: str) -> str`` method, and ``http_client`` is any
object with an async ``post(url, *, json, headers, timeout)`` method
(duck-typed to ``httpx.AsyncClient``). Both are injectable so tests
can mock them without touching the network.

Error handling:
  * A2A timeout or HTTP error → fall back to llmgw so the user still
    gets a response.
  * Missing tenant context → ``TenantAccessError`` (hard rule 3).
"""
from __future__ import annotations

from typing import Any

import structlog

from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import require_tenant

from .complexity import is_deep_research_query

logger = structlog.get_logger(__name__)

#: Default A2A delegate endpoint (K8s service DNS).
DEFAULT_A2A_DELEGATE_URL = (
    "http://mate-app-a2a:8009/api/v1/a2a/delegate"
)


async def dispatch(
    query: str,
    llmgw_client: Any,
    ctx: RequestContext,
    *,
    bearer_token: str = "",
    a2a_endpoint: str = DEFAULT_A2A_DELEGATE_URL,
    http_client: Any | None = None,
    timeout: float = 300.0,
) -> dict[str, Any]:
    """Route *query* to llmgw or A2A DeerFlow based on complexity.

    Parameters
    ----------
    query:
        The user's natural-language query.
    llmgw_client:
        Any object with ``chat(query: str) -> str`` (mockable).
    ctx:
        The request context — ``require_tenant`` is enforced.
    bearer_token:
        Authorization token forwarded to the A2A service.
    a2a_endpoint:
        Override the A2A delegate URL (defaults to K8s DNS).
    http_client:
        Inject an async HTTP client (duck-typed to ``httpx.AsyncClient``).
        When ``None`` a throwaway ``httpx.AsyncClient`` is created.
    timeout:
        Per-request timeout in seconds for the A2A call.

    Returns
    -------
    dict
        ``{"source": "llmgw" | "a2a" | "fallback", "answer": str, ...}``
    """
    # Hard rule 3: no tenant context, no data access.
    tid = require_tenant(ctx)

    if not is_deep_research_query(query):
        # --- Simple query → llmgw -----------------------------------------
        answer = llmgw_client.chat(query)
        return {
            "source": "llmgw",
            "answer": answer,
            "tenant_id": str(tid),
        }

    # --- Deep research query → A2A → DeerFlow ------------------------------
    headers: dict[str, str] = {}
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"

    payload = {
        "target_agent_id": "deep-research",
        "message": query,
        "context": {
            "capability_id": "web-research",
            "depth": "deep",
            "max_sources": 10,
        },
    }

    own_client = False
    if http_client is None:
        import httpx

        http_client = httpx.AsyncClient()
        own_client = True

    try:
        resp = await http_client.post(
            a2a_endpoint,
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        result: dict[str, Any] = {
            "source": "a2a",
            "answer": "",
            "tenant_id": str(tid),
            "status_code": resp.status_code,
        }
        try:
            body = resp.json()
            result["answer"] = body.get("result", {}).get("report", "") or str(body)
            result["raw"] = body
        except Exception:
            result["answer"] = resp.text
        return result

    except Exception as exc:
        # Timeout, connection error, etc. → fall back to llmgw so the
        # user still gets an answer.
        logger.warning(
            "copilot.dispatch.a2a_fallback",
            error=str(exc),
            tenant_id=str(tid),
            endpoint=a2a_endpoint,
        )
        answer = llmgw_client.chat(query)
        return {
            "source": "fallback",
            "answer": answer,
            "tenant_id": str(tid),
            "error": str(exc),
        }
    finally:
        if own_client:
            await http_client.aclose()
