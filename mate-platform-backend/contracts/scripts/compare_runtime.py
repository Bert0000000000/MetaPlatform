from __future__ import annotations
import json,re
from pathlib import Path
from typing import Iterable
import yaml
CONTRACTS=Path(__file__).parents[1]
METHODS={"get","post","put","patch","delete","options","head"}
META={"/healthz","/readyz","/metrics","/openapi.json","/docs","/docs/oauth2-redirect","/redoc"}

def normalize_path(path:str)->str:
 path=re.sub(r"^/api/v1/app-kb(?=/|$)","/api/v1/kb",path)
 path=re.sub(r"^/api/v1/llm(?=/|$)","/api/v1/llmgw",path)
 return re.sub(r"\{([^}:]+):path\}",r"{\1}",path)

def compare_operations(contracts:dict[tuple[str,str],str],runtime:set[tuple[str,str]])->dict[str,list[str]]:
 c={(m.lower(),normalize_path(p)):s for (m,p),s in contracts.items()}; r={(m.lower(),normalize_path(p)) for m,p in runtime if p not in META}
 required={op for op,status in c.items() if status=="implemented"}
 return {"missingInRuntime":[f"{m.upper()} {p}" for m,p in sorted(required-r)],"undocumentedRuntimeOperation":[f"{m.upper()} {p}" for m,p in sorted(r-set(c))]}

def load_contracts()->dict[tuple[str,str],str]:
 result={}
 for path in sorted((CONTRACTS/"openapi/services").glob("*.yaml")):
  doc=yaml.safe_load(path.read_text(encoding="utf-8"))
  for route,item in doc.get("paths",{}).items():
   if route in META: continue
   for method,op in item.items():
    if method in METHODS: result[(method,route)]=op["x-mate-implementation-status"]
 return result

def load_runtime()->set[tuple[str,str]]:
 result=set(); index_path=CONTRACTS/"runtime/index.json"
 if not index_path.exists(): raise FileNotFoundError("run runtime_openapi.py first")
 index=json.loads(index_path.read_text(encoding="utf-8"))
 for rel in sorted(set(index.values())):
  doc=json.loads((CONTRACTS/rel).read_text(encoding="utf-8"))
  for route,item in doc.get("paths",{}).items():
   for method in item:
    if method in METHODS: result.add((method,route))
 return result

def main()->int:
 result=compare_operations(load_contracts(),load_runtime())
 print(json.dumps(result,ensure_ascii=False,indent=2))
 return 1 if any(result.values()) else 0
if __name__=="__main__":raise SystemExit(main())
