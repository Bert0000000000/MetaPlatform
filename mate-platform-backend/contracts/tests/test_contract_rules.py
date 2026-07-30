import importlib.util
from pathlib import Path

import yaml

ROOT = Path(__file__).parents[1]
EXPECTED = {"iam", "dashboard", "msg", "obs", "mcp", "llmgw", "ont", "rag", "agent", "data", "kb", "copilot", "dw", "apphub", "arch", "wfe", "a2a"}

def test_manifest_contains_every_approved_domain() -> None:
    manifest = yaml.safe_load((ROOT / "openapi/manifest.yaml").read_text(encoding="utf-8"))
    assert set(manifest["domains"]) == EXPECTED
    for domain, item in manifest["domains"].items():
        assert item["contract"] == f"services/{domain}.yaml"
        assert item["owner"]
        assert item["visibility"] in {"external", "internal"}

def test_validator_rejects_missing_governance() -> None:
    temp = ROOT / ".testtmp"
    temp.mkdir(exist_ok=True)
    spec = temp / "bad.yaml"
    spec.write_text("openapi: 3.1.0\ninfo: {title: bad, version: 1.0.0}\nservers: [{url: /api}]\npaths: {'/api/v1/x': {get: {responses: {'200': {description: ok}}}}}\n", encoding="utf-8")
    module_path = ROOT / "scripts/validate_contracts.py"
    spec_obj = importlib.util.spec_from_file_location("validate_contracts", module_path)
    assert spec_obj and spec_obj.loader
    module = importlib.util.module_from_spec(spec_obj)
    spec_obj.loader.exec_module(module)
    errors = module.validate_document(spec, yaml.safe_load(spec.read_text(encoding="utf-8")))
    assert any("operationId" in error for error in errors)
    assert any("x-mate-owner" in error for error in errors)
    spec.unlink()
    temp.rmdir()
