from pathlib import Path

import yaml

ROOT=Path(__file__).parents[1]
# Domains without an independent PRD directory under docs/active/prd/ AND
# without a running runtime keep their contracts as "planned". Every
# domain with a live runtime (a2a/apphub/arch/copilot/data/dw/wfe/kb/
# mcphub/ontstudio/dashboard) is implemented, so the planned-set is empty.
DOMAINS=set()
METHODS={"get","post","put","patch","delete","options","head"}

def test_missing_prd_domains_have_planned_contracts() -> None:
 for domain in DOMAINS:
  doc=yaml.safe_load((ROOT/f"openapi/services/{domain}.yaml").read_text(encoding="utf-8"))
  assert doc["paths"], domain
  for item in doc["paths"].values():
   for method,op in item.items():
    if method in METHODS:
     assert op["x-mate-implementation-status"]=="planned"
     assert op["x-mate-requirements"]

def test_breaking_aliases_are_explicit() -> None:
 exclusions=yaml.safe_load((ROOT/"openapi/migration_exclusions.yaml").read_text(encoding="utf-8"))
 removed={x["prefix"] for x in exclusions["breakingRemovals"]}
 assert {"/api/v1/superai","/api/v1/ea","/api/v1/app-kb"} <= removed
