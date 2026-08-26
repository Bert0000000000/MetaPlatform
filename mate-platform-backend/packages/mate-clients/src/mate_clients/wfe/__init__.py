"""WFE (Flowable) client stub (K3-4).

Concrete FlowableClient implementation lives in a separate package
(``mate-flowable``) that is not part of this workspace. Until that
package is added, the apphub executor relies on this stub which
returns a deterministic synthetic ``processInstanceId`` so callers
and integration tests can assert on a stable shape without
requiring a running BPMN engine.
"""
from __future__ import annotations

from mate_platform.runtime import is_production_profile


class FlowableClient:
    """Stub Flowable BPMN client.

    ``start_process`` returns a deterministic dict with a synthetic
    ``processInstanceId``. The method signature mirrors what the
    real client is expected to expose so the apphub executor can
    switch to it without changing the call site.
    """

    def __init__(self, base_url: str = "http://localhost:8081") -> None:
        self.base_url = base_url

    async def start_process(
        self,
        process_key: str,
        business_key: str,
        variables: dict,
        tenant_id: str,
    ) -> dict:
        """Start a Flowable process instance. Returns ``{processInstanceId}``."""
        if is_production_profile():
            raise RuntimeError(
                "synthetic Flowable client is disabled in production"
            )
        return {
            "processInstanceId": (
                f"proc-{business_key}-{hash((process_key, tenant_id)) % 10000}"
            ),
            "process_key": process_key,
            "business_key": business_key,
        }
