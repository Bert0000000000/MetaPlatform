from pathlib import Path
import json
import yaml

ROOT = Path(__file__).parents[1]

def test_contract_tool_versions_are_pinned() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert package["devDependencies"] == {
        "@redocly/cli": "1.27.2",
        "@stoplight/prism-cli": "5.12.0",
        "@stoplight/spectral-cli": "6.14.2",
    }

def test_redocly_has_single_platform_entry() -> None:
    config = yaml.safe_load((ROOT / "redocly.yaml").read_text(encoding="utf-8"))
    assert config["apis"]["platform@v1"]["root"] == "openapi/platform.yaml"
