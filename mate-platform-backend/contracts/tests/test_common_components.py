from pathlib import Path

import yaml

COMMON = Path(__file__).parents[1] / "openapi" / "common"

def load(name: str) -> dict:
    return yaml.safe_load((COMMON / name).read_text(encoding="utf-8"))

def test_error_contract_is_complete() -> None:
    schema = load("errors.yaml")["components"]["schemas"]["ErrorResponse"]
    assert set(schema["required"]) == {"code", "message", "requestId"}
    assert schema["properties"]["details"]["type"] == "object"
    assert len(load("errors.yaml")["components"]["responses"]) == 12

def test_security_defines_keycloak_bearer() -> None:
    scheme = load("security.yaml")["components"]["securitySchemes"]["bearerAuth"]
    assert scheme == {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}

def test_tenant_header_is_response_only() -> None:
    doc = load("tenancy.yaml")
    assert "TenantId" in doc["components"]["headers"]
    assert "parameters" not in doc.get("components", {})

def test_pagination_and_tracing_components_exist() -> None:
    assert {"PageMeta", "CursorMeta"} <= set(load("pagination.yaml")["components"]["schemas"])
    assert {"XRequestId", "Traceparent"} <= set(load("tracing.yaml")["components"]["parameters"])
