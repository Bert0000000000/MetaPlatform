from pathlib import Path
import importlib.util
ROOT=Path(__file__).parents[1]

def module():
 path=ROOT/"scripts/compare_runtime.py"; spec=importlib.util.spec_from_file_location("runtime_compare",path); assert spec and spec.loader; mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod

def test_comparison_reports_both_directions() -> None:
 mod=module(); contracts={("get","/api/v1/example/items"):"implemented"}; runtime={("post","/api/v1/example/items")}
 result=mod.compare_operations(contracts,runtime)
 assert result["missingInRuntime"]==["GET /api/v1/example/items"]
 assert result["undocumentedRuntimeOperation"]==["POST /api/v1/example/items"]

def test_planned_and_placeholder_may_be_absent() -> None:
 mod=module(); contracts={("get","/api/v1/future"):"planned",("post","/api/v1/mock"):"placeholder"}
 result=mod.compare_operations(contracts,set())
 assert result=={"missingInRuntime":[],"undocumentedRuntimeOperation":[]}

def test_runtime_aliases_are_normalized() -> None:
 mod=module()
 assert mod.normalize_path("/api/v1/app-kb/search")=="/api/v1/kb/search"
 assert mod.normalize_path("/api/v1/llm/chat")=="/api/v1/llmgw/chat"
