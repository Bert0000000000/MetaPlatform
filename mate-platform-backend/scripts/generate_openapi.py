"""Generate unified OpenAPI schema for MetaPlatform.

Merges all 7 app packages' FastAPI routers into a single OpenAPI 3.1 spec.
Writes ``docs/api/openapi.json`` and prints a human-readable summary.

Usage::

    python scripts/generate_openapi.py

Recommended env vars (the script also sets sensible defaults)::

    INSECURE_SKIP_SIGNATURE=1
    KEYCLOAK_URL=http://localhost:8080
    SERVICE_CLIENT_SECRET=test-secret
"""
from __future__ import annotations

import importlib
import json
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

# ---------------------------------------------------------------------------
# sys.path bootstrap — ensure every workspace package is importable even
# when the script runs outside an installed-editable environment.
# ---------------------------------------------------------------------------
_ROOT = Path(__file__).resolve().parent.parent
_PACKAGES = _ROOT / "packages"
for _pkg in (
    "mate-kernel",
    "mate-common",
    "mate-tech-db",
    "mate-platform",
    "mate-clients",
    "mate-app-copilot",
    "mate-app-a2a",
    "mate-app-arch",
    "mate-app-hub",
    "mate-app-kb",
    "mate-tech-iam",
):
    _src = _PACKAGES / _pkg / "src"
    if _src.is_dir():
        sys.path.insert(0, str(_src))

# Default env vars so that ``install_auth`` (called transitively by some
# ``create_app`` factories) does not crash during schema generation.
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


def _safe_import(module_path: str, attr: str) -> Any | None:
    """Import *attr* from *module_path*, returning ``None`` on failure."""
    try:
        mod = importlib.import_module(module_path)
    except Exception as exc:
        print(f"  [WARN] skip {module_path}: {exc}")
        return None
    return getattr(mod, attr, None)


def _include_router_modules(app: FastAPI) -> None:
    """Include every package that exposes an ``APIRouter`` object."""
    router_specs: list[tuple[str, str]] = [
        ("mate_app_copilot.api", "router"),
        ("mate_app_a2a.api", "router"),
        ("mate_app_arch.api", "router"),
        ("mate_app_hub.api", "router"),
        ("mate_tech_iam.api", "auth_router"),
        ("mate_tech_iam.api", "configs_router"),
        ("mate_tech_iam.api", "dashboard_router"),
        ("mate_tech_iam.api", "logs_router"),
        ("mate_tech_iam.api", "orgs_router"),
        ("mate_tech_iam.api", "permissions_router"),
        ("mate_tech_iam.api", "users_router"),
    ]
    for module_path, attr in router_specs:
        router = _safe_import(module_path, attr)
        if router is not None:
            app.include_router(router)
            print(f"  [OK]   {module_path}.{attr}")


def _merge_inline_routes(app: FastAPI) -> None:
    """Copy routes from packages that define them inline (mate-app-kb)."""
    create_app_fn = _safe_import("mate_app_kb.api.app", "create_app")
    if create_app_fn is None:
        return
    source_app = create_app_fn()
    for route in source_app.routes:
        if not isinstance(route, APIRoute):
            continue
        app.add_api_route(
            path=route.path,
            endpoint=route.endpoint,
            methods=list(route.methods),
            response_model=route.response_model,
            response_model_exclude_unset=route.response_model_exclude_unset,
            tags=list(route.tags) if route.tags else None,
            deprecated=route.deprecated,
            name=route.name,
            description=route.description,
            summary=route.summary,
        )
    print("  [OK]   mate_app_kb.api.app (inline routes)")


def build_unified_app() -> FastAPI:
    """Build a single FastAPI app mounting all app packages' routers."""
    app = FastAPI(
        title="MetaPlatform API",
        version="3.2.0",
        description=(
            "Unified OpenAPI spec merging all MetaPlatform app packages: "
            "copilot, a2a, arch, apphub, kb, and iam (dashboard / admin)."
        ),
    )
    _include_router_modules(app)
    _merge_inline_routes(app)
    return app


def _print_summary(schema: dict[str, Any]) -> None:
    """Print a human-readable summary of the generated schema."""
    paths: dict[str, Any] = schema.get("paths", {})
    total_paths = len(paths)

    method_counts: dict[str, int] = {}
    tag_counts: dict[str, int] = {}

    for _path, methods in paths.items():
        for method, detail in methods.items():
            if method.startswith("x-"):
                continue
            upper = method.upper()
            method_counts[upper] = method_counts.get(upper, 0) + 1
            for tag in detail.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    total_operations = sum(method_counts.values())

    lines = [
        "",
        "=" * 60,
        "MetaPlatform Unified OpenAPI Summary",
        "=" * 60,
        f"Title:       {schema.get('info', {}).get('title', '?')}",
        f"Version:     {schema.get('info', {}).get('version', '?')}",
        f"Total paths:      {total_paths}",
        f"Total operations: {total_operations}",
        "",
        "Operations by HTTP method:",
    ]
    for method in sorted(method_counts):
        lines.append(f"  {method:<8} {method_counts[method]}")

    lines.append("")
    lines.append("Operations by tag:")
    for tag in sorted(tag_counts):
        lines.append(f"  {tag:<25} {tag_counts[tag]}")

    lines.append("")
    print("\n".join(lines))


def main() -> None:
    """Generate ``docs/api/openapi.json`` and print a summary."""
    print("Building unified OpenAPI schema ...")
    app = build_unified_app()
    schema = app.openapi()

    out_dir = _ROOT / "docs" / "api"
    out_dir.mkdir(parents=True, exist_ok=True)

    openapi_path = out_dir / "openapi.json"
    openapi_path.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nWrote {openapi_path}")

    _print_summary(schema)


if __name__ == "__main__":
    main()
