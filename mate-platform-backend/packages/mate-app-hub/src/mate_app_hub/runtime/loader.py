"""Runtime loader — builds RuntimeContext from repositories.

APPHUB-RUNTIME-01 phase B.
"""

from __future__ import annotations

from ..repositories import (
    get_app,
    list_modules,
    list_pages,
    list_templates,
)
from ..telemetry import get_tracer
from .schema import RuntimeContext


def load_app_runtime(
    tenant_id: str,
    app_id: str,
    version: str = "latest",
    *, published_only: bool = False,
) -> RuntimeContext:
    """Load the full runtime context for an app.

    Pulls App + Modules + Pages + Templates from the repositories and
    constructs a RuntimeContext whose ``modules`` list embeds each
    module's page configurations.

    Raises ValueError if the app is not found (wrong code or wrong tenant).
    """
    with get_tracer().start_as_current_span("apphub.runtime.load") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.app_id", app_id)
        span.set_attribute("apphub.version", version)
        app = get_app(tenant_id, app_id)
        if app is None:
            raise ValueError(f"app '{app_id}' not found in tenant '{tenant_id}'")

        if published_only:
            snapshot = next((v for v in app.versions if v.get("versionId") == app.published_version_id
                             and (version == "latest" or v.get("version") == version)), None)
            if app.status != "PUBLISHED" or snapshot is None or snapshot.get("status") != "PUBLISHED":
                raise ValueError("App has no matching published snapshot")
            return RuntimeContext(app_id=app.id, tenant_id=tenant_id, version=snapshot["version"],
                                  modules=snapshot["modules"], published_version_id=snapshot["versionId"])

        all_modules = list_modules(tenant_id)
        app_modules = [m for m in all_modules if m.app_code == app.code]

        all_pages = list_pages(tenant_id)
        all_templates = list_templates(tenant_id)

        # Template lookups keyed by code for quick cross-reference.
        template_by_code = {t.code: t for t in all_templates}

        module_list: list[dict] = []
        for mod in app_modules:
            mod_pages = [p for p in all_pages if p.module_code == mod.code]
            pages_config = [
                {
                    "code": p.code,
                    "name": p.name,
                    "layout": p.layout,
                    "schema_version": p.schema_version,
                    "id": p.id,
                    "definition": p.definition,
                }
                for p in mod_pages
            ]
            # Attach matching template if one shares the module code.
            tpl = template_by_code.get(mod.code)
            template_config = {}
            if tpl is not None:
                template_config = {
                    "code": tpl.code,
                    "template_type": tpl.template_type,
                    "content": tpl.content,
                }
            module_list.append(
                {
                    "code": mod.code,
                    "name": mod.name,
                    "app_code": mod.app_code,
                    "entry_path": mod.entry_path,
                    "description": mod.description,
                    "pages": pages_config,
                    "template": template_config,
                }
            )

        resolved_version = version if version != "latest" else app.version

        return RuntimeContext(
            app_id=app_id,
            tenant_id=tenant_id,
            version=resolved_version,
            modules=module_list,
        )
