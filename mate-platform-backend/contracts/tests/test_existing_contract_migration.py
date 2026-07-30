from pathlib import Path
import yaml

ROOT = Path(__file__).parents[1]
BACKEND = ROOT.parent
SOURCES = {
 "iam": BACKEND / "packages/mate-tech-iam/openapi/iam.yaml",
 "msg": BACKEND / "packages/mate-tech-msg/openapi/msg.yaml",
 "obs": BACKEND / "packages/mate-tech-obs/openapi/obs.yaml",
 "mcp": BACKEND / "packages/mate-tech-mcp/openapi/mcp.yaml",
 "llmgw": BACKEND / "packages/mate-tech-llmgw/openapi/llmgw.yaml",
 "ont": BACKEND / "packages/mate-tech-ont/openapi/ont.yaml",
 "rag": BACKEND / "packages/mate-tech-rag/openapi/rag.yaml",
 "agent": BACKEND / "packages/mate-tech-agent/openapi/agent.yaml",
 "kb": BACKEND / "packages/mate-app-kb/openapi/app-kb.yaml",
}
METHODS={"get","post","put","patch","delete","options","head"}

def ops(doc: dict) -> set[tuple[str,str]]:
 return {(method,path) for path,item in doc.get("paths",{}).items() for method in item if method in METHODS}

def normalize(domain: str, path: str) -> tuple[str,str]:
 if domain=="iam" and path.startswith("/api/v1/dashboard"): return "dashboard",path
 if domain=="kb": return "kb",path.replace("/api/v1/app-kb","/api/v1/kb")
 if domain=="llmgw": return "llmgw",path.replace("/api/v1/llm","/api/v1/llmgw")
 return domain,path

def test_existing_operations_are_conserved() -> None:
 targets={d: yaml.safe_load((ROOT/f"openapi/services/{d}.yaml").read_text(encoding="utf-8")) for d in ["iam","dashboard","msg","obs","mcp","llmgw","ont","rag","agent","kb"]}
 target_ops={d:ops(doc) for d,doc in targets.items()}
 for domain,source in SOURCES.items():
  doc=yaml.safe_load(source.read_text(encoding="utf-8"))
  for method,path in ops(doc):
   target_domain,target_path=normalize(domain,path)
   assert (method,target_path) in target_ops[target_domain], f"lost {method} {path}"

def test_every_migrated_operation_has_governance() -> None:
 for path in (ROOT/"openapi/services").glob("*.yaml"):
  doc=yaml.safe_load(path.read_text(encoding="utf-8"))
  for route,item in doc.get("paths",{}).items():
   for method,op in item.items():
    if method not in METHODS: continue
    assert op.get("operationId")
    assert op.get("x-mate-owner")
    assert op.get("x-mate-requirements")
    assert op.get("x-mate-implementation-status") in {"implemented","placeholder","planned"}
