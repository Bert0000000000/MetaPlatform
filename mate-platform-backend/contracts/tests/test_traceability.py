import importlib.util
from pathlib import Path

import yaml

ROOT=Path(__file__).parents[1]
WORKSPACE=ROOT.parents[1]

def load_validator():
 path=ROOT/"scripts/validate_traceability.py"; spec=importlib.util.spec_from_file_location("trace",path); assert spec and spec.loader; module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

def test_traceability_is_bidirectional() -> None:
 module=load_validator(); assert module.validate()==[]

def test_status_combinations_are_truthful() -> None:
 matrix=yaml.safe_load((WORKSPACE/"docs/active/delivery/REQUIREMENT-MATRIX.yaml").read_text(encoding="utf-8"))
 for req,item in matrix["requirements"].items():
  assert Path(WORKSPACE/item["prd"]).exists(), req
  if item["implementationStatus"]=="implemented":
   assert item["handler"] and item["tests"]
  else:
   assert item["handler"] is None
   assert item["acceptanceStatus"]=="notAccepted"
