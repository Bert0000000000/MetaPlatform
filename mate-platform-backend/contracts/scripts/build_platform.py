from pathlib import Path

import yaml

ROOT=Path(__file__).parents[1]/"openapi"
def build()->None:
 manifest=yaml.safe_load((ROOT/"manifest.yaml").read_text(encoding="utf-8")); paths={}; tags=[]
 for domain,item in manifest["domains"].items():
  doc=yaml.safe_load((ROOT/item["contract"]).read_text(encoding="utf-8")); tags.append({"name":domain,"description":f"{domain} domain operations"})
  for route in doc.get("paths",{}):
   if route in {"/healthz","/readyz","/metrics"}: continue
   if route in paths: raise ValueError(f"duplicate business path {route}")
   pointer=route.replace("~","~0").replace("/","~1")
   paths[route]={"$ref":f'./{item["contract"]}#/paths/{pointer}'}
 platform={"openapi":"3.1.0","info":{"title":"Mate Platform API","version":"1.0.0","description":"Canonical contract-first API for all Mate Platform domains.","contact":{"name":"Mate Platform API Governance","email":"api-governance@metaplatform.local"},"license":{"name":"Proprietary","identifier":"LicenseRef-Proprietary"},"x-mate-owner":"architecture-api-governance"},"servers":[{"url":"/","description":"Gateway-relative production endpoint"}],"tags":tags,"security":[{"bearerAuth":[]}],"paths":dict(sorted(paths.items())),"components":{"securitySchemes":{"bearerAuth":{"$ref":"./common/security.yaml#/components/securitySchemes/bearerAuth"}}}}
 (ROOT/"platform.yaml").write_text(yaml.safe_dump(platform,sort_keys=False,allow_unicode=True),encoding="utf-8")
if __name__=="__main__":build()
