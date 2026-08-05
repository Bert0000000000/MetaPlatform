from __future__ import annotations

import re
from copy import deepcopy
from pathlib import Path

import yaml
from openapi_normalize import sanitize_document

BACKEND=Path(__file__).parents[2]
WORKSPACE=BACKEND.parent
SOURCE=WORKSPACE/"docs/legacy/api/openapi-pre-api-gov-01.yaml"
OUT=Path(__file__).parents[1]/"openapi/services"
OWNERS={"data":"data-platform","copilot":"agent-experience","dw":"digital-workforce","apphub":"application-platform","arch":"enterprise-architecture","wfe":"workflow-platform","a2a":"ai-protocols"}
MAP={"data":"data","etl":"data","scheduler":"data","metrics":"data","copilot":"copilot","dw":"dw","apphub":"apphub","ea":"arch","wfe":"wfe","a2a":"a2a"}
METHODS={"get","post","put","patch","delete","options","head"}

def parts(path:str)->list[str]:
 p=path.strip("/").split("/")
 return p[2:] if p[:2]==["api","v1"] else p[1:] if p and p[0].startswith("v") else p

def camel(domain:str,method:str,path:str)->str:
 words=[domain,method]+[p.strip("{}:").replace("-","_") for p in path.split("/") if p and p not in {"api","v1"}]
 xs=[x for word in words for x in re.split(r"[^A-Za-z0-9]+",word) if x]
 return xs[0].lower()+"".join(x[:1].upper()+x[1:] for x in xs[1:])

def normalize(path:str,source_prefix:str,target_domain:str)->str:
 tail=parts(path)[1:]
 prefix=source_prefix
 if target_domain=="arch": prefix="arch"
 return "/api/v1/"+"/".join([prefix,*tail])

def generate()->None:
 src=yaml.safe_load(SOURCE.read_text(encoding="utf-8"))
 docs={d:{"openapi":"3.1.0","info":{"title":f"Mate Platform {d} API","version":"1.0.0","x-mate-owner":o},"servers":[{"url":"/"}],"tags":[{"name":d,"description":f"{d} domain operations"}],"security":[{"bearerAuth":[]}],"paths":{},"components":deepcopy(src.get("components") or {})} for d,o in OWNERS.items()}
 for old_path,item in (src.get("paths") or {}).items():
  ps=parts(old_path)
  if not ps or ps[0] not in MAP: continue
  source_prefix=ps[0]; domain=MAP[source_prefix]
  path=normalize(old_path,source_prefix,domain)
  new_item=deepcopy(item)
  for method,op in new_item.items():
   if method not in METHODS or not isinstance(op,dict): continue
   op["operationId"]=camel(domain,method,path)
   op.setdefault("summary",f"{method.upper()} {path}")
   op.setdefault("description",op["summary"])
   op["tags"]=[domain]
   op["x-mate-owner"]=OWNERS[domain]
   op["x-mate-permission"]=f"{domain}.{method}"
   op["x-mate-requirements"]=[f"FR-{domain.upper()}-{op['operationId'].upper()}"]
   op["x-mate-implementation-status"]="planned"
   normalized=[]
   for parameter in op.get("parameters",[]):
    if isinstance(parameter,dict) and parameter.get("$ref")=="#/components/parameters/TenantId":
     continue
    if isinstance(parameter,dict) and parameter.get("$ref")=="#/components/parameters/Id":
     normalized.append({"name":"id","in":"path","required":True,"schema":{"type":"string"}})
    else:
     normalized.append(parameter)
   if "parameters" in op: op["parameters"]=normalized
  docs[domain]["paths"][path]=new_item
 for domain,doc in docs.items():
  schemes=doc.setdefault("components",{}).setdefault("securitySchemes",{})
  schemes["bearerAuth"]={"type":"http","scheme":"bearer","bearerFormat":"JWT"}
  doc=sanitize_document(doc)
  (OUT/f"{domain}.yaml").write_text(yaml.safe_dump(doc,sort_keys=False,allow_unicode=True),encoding="utf-8")
 exclusions={"version":1,"breakingRemovals":[
  {"prefix":"/api/v1/superai","reason":"Superseded by /api/v1/copilot"},
  {"prefix":"/api/v1/ea","reason":"Renamed to /api/v1/arch"},
  {"prefix":"/api/v1/app-kb","reason":"Renamed to /api/v1/kb"},
  {"prefix":"/api/v1/llm","reason":"Renamed to /api/v1/llmgw"}]}
 (OUT.parent/"migration_exclusions.yaml").write_text(yaml.safe_dump(exclusions,sort_keys=False,allow_unicode=True),encoding="utf-8")
if __name__=="__main__":generate()
