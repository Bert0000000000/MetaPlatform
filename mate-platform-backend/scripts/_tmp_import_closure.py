"""Static import-closure checker for ont test suites (throwaway CI prep tool).

Computes the module-level (import-time) dependency closure of the
mate-kernel + mate-tech-ont test suites, following first-party mate_* /
app_* packages into their src trees. Reports third-party top-level
packages required at collection/import time.

Run: python scripts/_tmp_import_closure.py  (delete after use)
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]  # mate-platform-backend
PKG_ROOT = BASE / "packages"

# src roots for first-party packages (mirrors conftest bootstrap + root pythonpath)
PKG_ALIASES: dict[str, Path] = {}
for p in PKG_ROOT.iterdir():
    src = p / "src"
    if not src.is_dir():
        continue
    for child in src.iterdir():
        if child.is_dir() and (child / "__init__.py").exists():
            PKG_ALIASES[child.name] = src
        elif child.suffix == ".py":
            PKG_ALIASES[child.stem] = src

TEST_DIRS = [
    PKG_ROOT / "mate-kernel" / "tests",
    PKG_ROOT / "mate-tech-ont" / "tests",
]

stdlib = set(sys.stdlib_module_names)
seen_files: set[Path] = set()
third_party: dict[str, list[tuple[Path, str]]] = {}  # pkg -> [(file, how)]
pending: list[Path] = [f for d in TEST_DIRS for f in sorted(d.rglob("*.py"))]


def resolve_abs(name: str) -> Path | None:
    parts = name.split(".")
    root = PKG_ALIASES.get(parts[0])
    if root is None:
        return None
    cur = root.joinpath(*parts)
    if (cur.with_suffix(".py")).exists():
        return cur.with_suffix(".py")
    if (cur / "__init__.py").exists():
        return cur / "__init__.py"
    return None


def resolve_rel(origin: Path, level: int, module: str | None) -> Path | None:
    # origin is a module file; its package = parent dir (+level-1 ups)
    pkg_dir = origin.parent
    for _ in range(level - 1):
        pkg_dir = pkg_dir.parent
    if module:
        cur = pkg_dir.joinpath(*module.split("."))
    else:
        cur = pkg_dir
    if (cur.with_suffix(".py")).exists():
        return cur.with_suffix(".py")
    if (cur / "__init__.py").exists():
        return cur / "__init__.py"
    return None


def handle_import(node: ast.Import | ast.ImportFrom, origin: Path, how: str) -> None:
    if isinstance(node, ast.Import):
        targets = [(a.name, 0, None) for a in node.names]
    else:
        targets = [(node.module, node.level, None)] if node.module else [("", node.level, None)]
    for name, level, _ in targets:
        if not name:
            continue
        top = name.split(".")[0]
        if level:
            top = "__relative__"
        if top == "__future__":
            continue
        if not level and top in stdlib:
            continue
        resolved = (
            resolve_rel(origin, level, name) if level else resolve_abs(name)
        ) if (level or top in PKG_ALIASES) else None
        if resolved is not None:
            pending.append(resolved)
            return  # first-party: no third-party record
        if level:
            print(f"WARN: unresolved relative import {name} in {origin}")
            continue
        third_party.setdefault(name.split(".")[0], []).append((origin, how))


def scan(origin: Path) -> None:
    tree = ast.parse(origin.read_text(encoding="utf-8"))

    def walk_body(body: list[ast.stmt], how: str, guarded: bool) -> None:
        for node in body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                handle_import(node, origin, how + ("/guarded" if guarded else ""))
            elif isinstance(node, ast.Try):
                walk_body(node.body, how, guarded=True)
                for h in node.handlers:
                    walk_body(h.body, how, guarded)
                walk_body(node.orelse, how, guarded)
                walk_body(node.finalbody, how, guarded)
            elif isinstance(node, ast.If):
                src = ast.unparse(node.test)
                if "TYPE_CHECKING" in src:
                    continue
                walk_body(node.body, how + "/if", guarded)
                walk_body(node.orelse, how + "/else", guarded)
            elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
                continue  # lazy: not import-time
            elif hasattr(ast, "TypeAlias") and isinstance(node, getattr(ast, "TypeAlias")):
                continue

    walk_body(tree.body, "top", guarded=False)


while pending:
    f = pending.pop().resolve()
    if f in seen_files:
        continue
    seen_files.add(f)
    try:
        scan(f)
    except (SyntaxError, UnicodeDecodeError) as e:
        print(f"WARN: cannot parse {f}: {e}")

print("=== third-party packages needed at IMPORT time ===")
for pkg in sorted(third_party):
    users = third_party[pkg]
    tops = [f for f, how in users if how.startswith("top")]
    guarded = [f for f, how in users if "guarded" in how]
    first = (tops or guarded or [f for f, _ in users])[0]
    print(
        f"{pkg}: {len(users)} import sites; first={first.relative_to(BASE)}"
        f" top-level={len(tops)} guarded={len(guarded)}"
    )
print(f"\nfirst-party files in closure: {len(seen_files)}")
