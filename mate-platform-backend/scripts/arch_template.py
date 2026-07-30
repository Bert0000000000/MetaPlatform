from __future__ import annotations

from pathlib import Path

LAYER_TEMPLATES = {
    "domain": """{name} domain entities, value objects, events, and policies.\n""",
    "application": """{name} use cases and command/query handlers.\n""",
    "infrastructure": """{name} repositories, external clients, and messaging adapters.\n""",
    "api": """{name} HTTP routes, schemas, and dependencies.\n""",
    "bootstrap": """{name} dependency wiring entry point.\n""",
}


def render(*, name: str, root: Path) -> Path:
    src = root / "src"
    package_src = src / name
    package = package_src.parent if package_src.exists() else root / name
    for layer, body in LAYER_TEMPLATES.items():
        if layer == "bootstrap":
            target = package / (layer + ".py")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body.format(name=name), encoding="utf-8")
        else:
            sub = package / layer
            sub.mkdir(parents=True, exist_ok=True)
            (sub / "__init__.py").write_text(body.format(name=name), encoding="utf-8")
    return package
