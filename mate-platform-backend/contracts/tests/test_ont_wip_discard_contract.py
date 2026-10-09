"""The published WIP discard contract keeps its supported compatibility route discoverable."""

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parents[1]
CANONICAL = "/api/v1/ont/v2/object-types/{rid}/wip"
COMPATIBILITY = "/api/v1/ont/v2/object-types/wip/{rid}"


@pytest.mark.parametrize(
    "document", ["openapi/services/ont.yaml", "openapi/generated/bundled.yaml"]
)
def test_discard_contract_retains_operation_identity_and_compatibility_route(document):
    contract = yaml.safe_load((ROOT / document).read_text(encoding="utf-8"))
    operation = contract["paths"][CANONICAL]["delete"]

    assert operation["operationId"] == "ontDiscardV2SchemaWip"
    assert "FR-ONT-BUILDER-PUBLICATION" in operation["x-mate-requirements"]
    assert COMPATIBILITY not in contract["paths"]
    assert f"DELETE {COMPATIBILITY}" in operation["description"]
    assert operation["x-mate-compatibility-aliases"] == [
        {
            "method": "DELETE",
            "path": COMPATIBILITY,
            "deprecated": True,
            "includeInSchema": False,
        }
    ]
