"""Forms client stub (K3-4).

Concrete FormsClient implementation lives in a separate package
(``mate-forms``) that is not part of this workspace. Until that
package is added, the apphub executor relies on this stub which
returns a deterministic synthetic ``form_submission_id`` so callers
and integration tests can assert on a stable shape without requiring
a running forms service.
"""
from __future__ import annotations


class FormsClient:
    """Stub Forms client.

    ``submit`` returns a deterministic dict with a synthetic
    ``form_submission_id``. The method signature mirrors what the
    real client is expected to expose so the apphub executor can
    switch to it without changing the call site.
    """

    def __init__(self, base_url: str = "http://localhost:8080") -> None:
        self.base_url = base_url

    async def submit(
        self,
        app_id: str,
        form_id: str,
        payload: dict,
        tenant_id: str,
    ) -> dict:
        """Submit a form. Returns ``{form_submission_id, app_id, form_id}``."""
        return {
            "form_submission_id": (
                f"fs-{app_id}-{form_id}-{hash((form_id, tenant_id)) % 10000}"
            ),
            "app_id": app_id,
            "form_id": form_id,
            "received_payload": payload,
        }