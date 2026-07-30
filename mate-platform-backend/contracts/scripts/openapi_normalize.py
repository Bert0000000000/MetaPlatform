from __future__ import annotations
from typing import Any
import re
METHODS={"get","post","put","patch","delete","options","head"}

def _schema(node: Any) -> Any:
    if isinstance(node,list): return [_schema(x) for x in node]
    if not isinstance(node,dict): return node
    out={k:_schema(v) for k,v in node.items() if k!="nullable"}
    if node.get("nullable") is True:
        if isinstance(out.get("type"),str): out["type"]=[out["type"],"null"]
        elif "$ref" in out:
            ref=out.pop("$ref"); out["oneOf"]=[{"$ref":ref},{"type":"null"}]
    return out

def sanitize_document(doc: dict[str,Any]) -> dict[str,Any]:
    doc=_schema(doc)
    new_paths={}
    for raw_path,item in doc.get("paths",{}).items():
        path=re.sub(r"\{([^}:]+):path\}",r"{\1}",raw_path)
        for method,op in (item or {}).items():
            if method not in METHODS or not isinstance(op,dict): continue
            body=op.get("requestBody")
            if isinstance(body,dict) and not body.get("content"): op.pop("requestBody",None)
            responses=op.setdefault("responses",{})
            if not any(str(code).startswith("4") for code in responses):
                responses["400"]={"$ref":"../common/errors.yaml#/components/responses/Error400"}
            placeholders=set(re.findall(r"\{([^}]+)\}",path))
            params=[]; defined=set()
            for parameter in op.get("parameters",[]):
                if isinstance(parameter,dict) and parameter.get("in")=="path":
                    name=str(parameter.get("name","")); defined.add(name)
                params.append(parameter)
            for name in sorted(placeholders-defined):
                params.append({"name":name,"in":"path","required":True,"schema":{"type":"string"}})
            if params: op["parameters"]=params
        new_paths[path]=item
    doc["paths"]=new_paths
    info=doc.setdefault("info",{})
    info.setdefault("description",f"Canonical contract for {info.get('title','Mate Platform service')}.")
    info.setdefault("contact",{"name":"Mate Platform API Governance","email":"api-governance@metaplatform.local"})
    return doc
