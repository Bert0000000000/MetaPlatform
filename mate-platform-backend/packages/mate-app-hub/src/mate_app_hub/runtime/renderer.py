"""Runtime renderer — converts RuntimeContext modules into RenderNode trees.

APPHUB-RUNTIME-01 phase B.
"""
from __future__ import annotations

from .schema import RenderNode, RuntimeContext


def render_page(
    ctx: RuntimeContext, module_code: str | None = None,
) -> list[RenderNode]:
    """Render the page tree from the runtime context.

    Iterates over ``ctx.modules`` and produces a flat list of RenderNode
    objects, one per page. When ``module_code`` is specified, only pages
    belonging to that module are rendered.
    """
    nodes: list[RenderNode] = []
    for mod in ctx.modules:
        if module_code is not None and mod.get("code") != module_code:
            continue
        for page in mod.get("pages", []):
            node = RenderNode(
                node_type="page",
                title=page.get("name", ""),
                layout={"type": page.get("layout", "single")},
                children=[],
                config={
                    "page_code": page.get("code"),
                    "module_code": mod.get("code"),
                    "schema_version": page.get("schema_version", 1),
                },
            )
            nodes.append(node)
    return nodes
