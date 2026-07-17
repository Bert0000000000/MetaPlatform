"""Wrapper to start TECH-LLMGW without modifying business code.

Dynamically stubs the missing dependency getters in app.deps so the existing
``_build_default_registry`` (which references ``UsageRepository``,
``CostReportService``, ``AuditLogRepository``, ``AuditLogService``) can be
populated.  We monkey-patch ``app.deps`` *before* main imports it.

This file lives under docs/006-TMP/ (temporary scripts folder) per the
project naming convention; it is purely an acceptance scaffolding script and
not part of the TECH-LLMGW service code.
"""

from __future__ import annotations

import sys

sys.path.insert(0, r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW")

# Pre-create the registry by patching deps imports
import app.deps as deps  # noqa: E402

# Import the concrete repository / service classes used elsewhere
from app.audit.repository import AuditLogRepository  # noqa: E402
from app.audit.service import AuditLogService  # noqa: E402
from app.cost.repository import UsageRepository  # noqa: E402
from app.cost.service import CostReportService  # noqa: E402


def _patch_deps() -> None:
    """Inject missing FastAPI dependency getters and rebuild Registry."""

    # Build the missing repository/service objects by calling constructors.
    usage_repo = UsageRepository()
    cost_service = CostReportService(usage_repo)
    audit_repo = AuditLogRepository()
    audit_service = AuditLogService(audit_repo)

    # Replace the original _build_default_registry by monkey-patching it.
    orig_build = deps._build_default_registry

    def _patched_build() -> deps.Registry:
        r = orig_build()
        # Use object.__setattr__ to bypass frozen dataclass if needed.
        object.__setattr__(r, "usage_repo", usage_repo)
        object.__setattr__(r, "cost_service", cost_service)
        object.__setattr__(r, "audit_repo", audit_repo)
        object.__setattr__(r, "audit_service", audit_service)
        return r

    deps._build_default_registry = _patched_build  # type: ignore[assignment]

    # Add the missing FastAPI dependency getters.
    def get_audit_service(request):
        return request.app.state.registry.audit_service

    def get_cost_service(request):
        return request.app.state.registry.cost_service

    def get_usage_repo(request):
        return request.app.state.registry.usage_repo

    deps.get_audit_service = get_audit_service  # type: ignore[attr-defined]
    deps.get_cost_service = get_cost_service  # type: ignore[attr-defined]
    deps.get_usage_repo = get_usage_repo  # type: ignore[attr-defined]


_patch_deps()

# Now import and run main (uses patched deps)
import uvicorn  # noqa: E402
import main  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(main.app, host="0.0.0.0", port=8401)