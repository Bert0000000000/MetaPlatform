"""Property input contracts cover the runtime formats without weakening response titles."""

import ast
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parents[1]
BACKEND = ROOT.parent
LEGACY_FORMATS = {"string", "integer", "double", "boolean", "date", "timestamp", "marking"}


def _runtime_formats() -> set[str]:
    source = BACKEND / "packages/mate-kernel/src/mate_kernel/ontology/types/property_.py"
    module = ast.parse(source.read_text(encoding="utf-8"))
    enum = next(
        node
        for node in module.body
        if isinstance(node, ast.ClassDef) and node.name == "PropertyFormat"
    )
    return {
        node.value.value
        for node in enum.body
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant)
    }


def _schema_references(node, schemas, seen=None) -> set[str]:
    seen = set() if seen is None else seen
    result = set()
    if isinstance(node, dict):
        reference = node.get("$ref", "")
        if reference.startswith("#/components/schemas/"):
            name = reference.rsplit("/", 1)[-1]
            result.add(name)
            if name not in seen:
                seen.add(name)
                result.update(_schema_references(schemas[name], schemas, seen))
        for child in node.values():
            result.update(_schema_references(child, schemas, seen))
    elif isinstance(node, list):
        for child in node:
            result.update(_schema_references(child, schemas, seen))
    return result


@pytest.mark.parametrize(
    "document", ["openapi/services/ont.yaml", "openapi/generated/bundled.yaml"]
)
def test_property_input_covers_runtime_formats_and_empty_titles(document):
    contract = yaml.safe_load((ROOT / document).read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]
    input_schema = schemas["PropertyCreateV2"]
    format_schema = schemas[input_schema["properties"]["format"]["$ref"].rsplit("/", 1)[-1]]

    assert set(format_schema["enum"]) == _runtime_formats()
    assert set(format_schema["enum"]) >= LEGACY_FORMATS
    assert "title" not in input_schema["required"]
    assert input_schema["properties"]["title"].get("minLength", 0) == 0
    assert input_schema["properties"]["title"]["default"] == ""
    assert schemas["PropertyV2"]["properties"]["title"]["minLength"] == 1
    assert "enum" not in schemas["PropertyFormatV2"]


@pytest.mark.parametrize(
    "document", ["openapi/services/ont.yaml", "openapi/generated/bundled.yaml"]
)
def test_property_requests_use_input_schema_including_nested_fields(document):
    contract = yaml.safe_load((ROOT / document).read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]
    checked = 0
    for path in contract["paths"].values():
        for operation in path.values():
            if not isinstance(operation, dict) or "requestBody" not in operation:
                continue
            references = _schema_references(operation["requestBody"], schemas)
            assert "PropertyV2" not in references
            if "PropertyCreateV2" in references:
                checked += 1
                assert "PropertyFormatInputV2" in references
    assert checked > 0
