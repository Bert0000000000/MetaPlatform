from __future__ import annotations
from pathlib import Path
from typing import Any
import yaml

HTTP_METHODS={"get","post","put","patch","delete","options","head","trace"}

def validate_document(path: Path, doc: dict[str, Any]) -> list[str]:
    errors: list[str]=[]
    if not str(doc.get("openapi", "")).startswith("3.1."):
        errors.append(f"{path}: OpenAPI must be 3.1")
    seen: set[str]=set()
    for route,item in (doc.get("paths") or {}).items():
        if route not in {"/healthz","/readyz","/metrics"} and not route.startswith("/api/v1/"):
            errors.append(f"{path}:{route}: path must start /api/v1/")
        for method,operation in (item or {}).items():
            if method.lower() not in HTTP_METHODS or not isinstance(operation,dict): continue
            label=f"{path}:{method.upper()} {route}"
            opid=operation.get("operationId")
            if not opid: errors.append(f"{label}: missing operationId")
            elif opid in seen: errors.append(f"{label}: duplicate operationId {opid}")
            else: seen.add(opid)
            for key in ("summary","tags","x-mate-owner","x-mate-permission","x-mate-requirements","x-mate-implementation-status"):
                if not operation.get(key): errors.append(f"{label}: missing {key}")
            for parameter in operation.get("parameters",[]):
                if isinstance(parameter,dict) and parameter.get("in")=="header" and str(parameter.get("name","")).lower() in {"x-tenant-id","x-mate-tenant-id"}:
                    errors.append(f"{label}: client tenant header is forbidden")
    return errors

def validate_all(root: Path) -> list[str]:
    errors: list[str]=[]
    for path in sorted((root/"services").glob("*.yaml")):
        errors.extend(validate_document(path,yaml.safe_load(path.read_text(encoding="utf-8")) or {}))
    return errors

def main() -> int:
    root=Path(__file__).parents[1]/"openapi"
    errors=validate_all(root)
    for error in errors: print(error)
    return 1 if errors else 0

if __name__=="__main__":
    raise SystemExit(main())
