from pathlib import Path

import yaml

ROOT=Path(__file__).parents[2]
WORKSPACE=ROOT.parent
CONTRACTS=Path(__file__).parents[1]/"openapi"
METHODS={"get","post","put","patch","delete","options","head"}
PRD_DIR={"dashboard":"APP-DASHBOARD","kb":"APP-KB","ont":"APP-ONTSTUDIO","mcp":"APP-MCPHUB","copilot":"APP-COPILOT","agent":"APP-COPILOT","llmgw":"APP-COPILOT","dw":"APP-DW","apphub":"APP-APPHUB","arch":"APP-ARCH"}

def prd_for(domain:str)->str:
 if domain in PRD_DIR:
  files=sorted((WORKSPACE/"docs/active/prd"/PRD_DIR[domain]).glob("PRD-*.md"))
  if files: return files[-1].relative_to(WORKSPACE).as_posix()
 top=sorted((WORKSPACE/"docs/active/prd/_top").glob("API-CONTRACT-*.md"))
 return top[-1].relative_to(WORKSPACE).as_posix()

def build()->None:
 manifest=yaml.safe_load((CONTRACTS/"manifest.yaml").read_text(encoding="utf-8"))
 requirements={}
 for domain,item in manifest["domains"].items():
  doc=yaml.safe_load((CONTRACTS/item["contract"]).read_text(encoding="utf-8"))
  for route,path_item in doc.get("paths",{}).items():
   if route in {"/healthz","/readyz","/metrics"}: continue
   for method,op in path_item.items():
    if method not in METHODS: continue
    status=op["x-mate-implementation-status"]
    for req in op["x-mate-requirements"]:
     requirements[req]={"prd":prd_for(domain),"service":domain,"operationIds":[op["operationId"]],"handler":f'{item["runtimeModule"]}#{op["operationId"]}' if status=="implemented" and item.get("runtimeModule") else None,"tests":["mate-platform-backend/contracts/tests/test_runtime_comparison.py"] if status=="implemented" else [],"implementationStatus":status,"acceptanceStatus":"notAccepted"}
 out={"version":1,"requirements":dict(sorted(requirements.items()))}
 target=WORKSPACE/"docs/active/delivery/REQUIREMENT-MATRIX.yaml"; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(yaml.safe_dump(out,sort_keys=False,allow_unicode=True),encoding="utf-8")
if __name__=="__main__":build()
