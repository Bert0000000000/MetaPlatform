from pathlib import Path
import yaml
ROOT=Path(__file__).parents[1]
METHODS={"get","post","put","patch","delete","options","head"}

def bundle() -> dict:
 return yaml.safe_load((ROOT/"openapi/generated/bundled.yaml").read_text(encoding="utf-8"))

def test_bundle_is_openapi_31() -> None:
 doc=bundle(); assert doc["openapi"].startswith("3.1."); assert len(doc["paths"])>0

def test_bundle_operation_ids_are_unique() -> None:
 doc=bundle(); ids=[op["operationId"] for item in doc["paths"].values() for method,op in item.items() if method in METHODS]
 assert len(ids)==len(set(ids))

def test_bundle_contains_all_domains() -> None:
 tags={tag["name"] for tag in bundle()["tags"]}
 assert {"iam","dashboard","msg","obs","mcp","llmgw","ont","rag","agent","data","kb","copilot","dw","apphub","arch","wfe","a2a"} <= tags
