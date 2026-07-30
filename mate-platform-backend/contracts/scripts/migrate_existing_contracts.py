from __future__ import annotations
from copy import deepcopy
from pathlib import Path
import re
import yaml
from openapi_normalize import sanitize_document

ROOT=Path(__file__).parents[2]
OUT=Path(__file__).parents[1]/"openapi/services"
SOURCES={
 "iam": ROOT/"packages/mate-tech-iam/openapi/iam.yaml",
 "msg": ROOT/"packages/mate-tech-msg/openapi/msg.yaml",
 "obs": ROOT/"packages/mate-tech-obs/openapi/obs.yaml",
 "mcp": ROOT/"packages/mate-tech-mcp/openapi/mcp.yaml",
 "llmgw": ROOT/"packages/mate-tech-llmgw/openapi/llmgw.yaml",
 "ont": ROOT/"packages/mate-tech-ont/openapi/ont.yaml",
 "rag": ROOT/"packages/mate-tech-rag/openapi/rag.yaml",
 "agent": ROOT/"packages/mate-tech-agent/openapi/agent.yaml",
 "kb": ROOT/"packages/mate-app-kb/openapi/app-kb.yaml",
}
OWNERS={"iam":"security-iam","dashboard":"business-workbench","msg":"platform-messaging","obs":"platform-observability","mcp":"ai-protocols","llmgw":"ai-runtime","ont":"ontology-platform","rag":"knowledge-platform","agent":"agent-platform","kb":"knowledge-platform"}
METHODS={"get","post","put","patch","delete","options","head"}
PLACEHOLDER={"dashboard":True,"rag":True,"agent":True,"mcp":True,"obs":True}

def camel(domain:str,method:str,path:str)->str:
    words=[domain,method]+[p.strip("{}:").replace("-","_") for p in path.split("/") if p and p not in {"api","v1"}]
    parts=[x for word in words for x in re.split(r"[^A-Za-z0-9]+",word) if x]
    return parts[0].lower()+"".join(p[:1].upper()+p[1:] for p in parts[1:])

def target(domain:str,path:str)->tuple[str,str]:
    if domain=="iam" and path.startswith("/api/v1/dashboard"): return "dashboard",path
    if domain=="kb": return domain,path.replace("/api/v1/app-kb","/api/v1/kb")
    if domain=="llmgw": return domain,path.replace("/api/v1/llm","/api/v1/llmgw")
    return domain,path

def status(domain:str,path:str)->str:
    if domain in PLACEHOLDER: return "placeholder"
    if domain=="llmgw" and (path.endswith("/stream") or path.endswith("/embeddings")): return "placeholder"
    if domain=="ont" and ("/instances" in path or path.endswith("/sparql")): return "placeholder"
    if domain=="msg" and path.endswith("/topics"): return "placeholder"
    if domain=="iam" and ("/auth/" in path or path.endswith("/sso-providers")): return "placeholder"
    return "implemented"

def blank(domain:str)->dict:
    return {"openapi":"3.1.0","info":{"title":f"Mate Platform {domain} API","version":"1.0.0","x-mate-owner":OWNERS[domain]},"servers":[{"url":"/"}],"tags":[],"security":[{"bearerAuth":[]}],"paths":{},"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}}}

def migrate()->None:
    docs={d:blank(d) for d in OWNERS}
    for source_domain,source in SOURCES.items():
        src=yaml.safe_load(source.read_text(encoding="utf-8"))
        component_targets=[source_domain,"dashboard"] if source_domain=="iam" else [source_domain]
        for component_domain in component_targets:
            for name,value in (src.get("components") or {}).items():
                if name=="securitySchemes": continue
                docs[component_domain].setdefault("components",{}).setdefault(name,{}).update(deepcopy(value or {}))
        for path,item in (src.get("paths") or {}).items():
            domain,new_path=target(source_domain,path)
            new_item=deepcopy(item)
            for method,op in new_item.items():
                if method not in METHODS or not isinstance(op,dict): continue
                op["operationId"]=camel(domain,method,new_path)
                op.setdefault("summary",f"{method.upper()} {new_path}")
                op.setdefault("description",op["summary"])
                op["tags"]=[domain]
                op["x-mate-owner"]=OWNERS[domain]
                op["x-mate-permission"]=f"{domain}.{method}"
                op["x-mate-requirements"]=[f"FR-{domain.upper()}-{op['operationId'].upper()}"]
                op["x-mate-implementation-status"]=status(domain,new_path)
                op.pop("parameters",None) if any(isinstance(x,dict) and str(x.get("name","")).lower() in {"x-tenant-id","x-mate-tenant-id"} for x in op.get("parameters",[])) else None
            docs[domain]["paths"][new_path]=new_item
    for domain,doc in docs.items():
        doc["tags"]=[{"name":domain,"description":f"{domain} domain operations"}]
        OUT.mkdir(parents=True,exist_ok=True)
        doc=sanitize_document(doc)
        (OUT/f"{domain}.yaml").write_text(yaml.safe_dump(doc,sort_keys=False,allow_unicode=True),encoding="utf-8")

if __name__=="__main__": migrate()
