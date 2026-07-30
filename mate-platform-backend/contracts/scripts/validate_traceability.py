from pathlib import Path
import yaml
ROOT=Path(__file__).parents[2]
WORKSPACE=ROOT.parent
CONTRACTS=Path(__file__).parents[1]/"openapi"
METHODS={"get","post","put","patch","delete","options","head"}

def validate()->list[str]:
 errors=[]; matrix_path=WORKSPACE/"docs/active/delivery/REQUIREMENT-MATRIX.yaml"
 if not matrix_path.exists(): return ["requirement matrix is missing"]
 matrix=yaml.safe_load(matrix_path.read_text(encoding="utf-8")); reqs=matrix.get("requirements",{})
 manifest=yaml.safe_load((CONTRACTS/"manifest.yaml").read_text(encoding="utf-8")); contract_ops=set()
 for item in manifest["domains"].values():
  doc=yaml.safe_load((CONTRACTS/item["contract"]).read_text(encoding="utf-8"))
  for route,path_item in doc.get("paths",{}).items():
   if route in {"/healthz","/readyz","/metrics"}: continue
   for method,op in path_item.items():
    if method in METHODS: contract_ops.add(op["operationId"])
 matrix_ops={op for item in reqs.values() for op in item.get("operationIds",[])}
 for op in sorted(contract_ops-matrix_ops): errors.append(f"contract operation missing matrix: {op}")
 for op in sorted(matrix_ops-contract_ops): errors.append(f"matrix operation missing contract: {op}")
 for req,item in reqs.items():
  if not (WORKSPACE/item.get("prd","")).exists(): errors.append(f"{req}: PRD missing")
  status=item.get("implementationStatus")
  if status=="implemented" and (not item.get("handler") or not item.get("tests")): errors.append(f"{req}: implemented requires handler and tests")
  if status!="implemented" and item.get("handler") is not None: errors.append(f"{req}: non-implemented must not claim handler")
  if item.get("acceptanceStatus")!="notAccepted": errors.append(f"{req}: API-GOV-01 cannot accept business implementation")
 return errors

def main()->int:
 errors=validate()
 for error in errors: print(error)
 return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
