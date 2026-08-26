"""marketplace OpenAPI 增量合同测试。

MP-CONS-001..008(8 个 requirement id)。
"""
from pathlib import Path
import yaml

ROOT = Path(__file__).parents[1] / "openapi" / "services"

EXPECTED_PATHS = {
    "/api/v1/marketplace/browse": "get",
    "/api/v1/marketplace/artifacts/{kind}/{id}": "get",
    "/api/v1/marketplace/installed": "get",
    "/api/v1/marketplace/install": "post",
    "/api/v1/marketplace/install/{install_id}": ["get", "delete"],
    "/api/v1/marketplace/install/{install_id}/retry": "post",
    "/api/v1/marketplace/install/{install_id}/events": "get",
    "/api/v1/marketplace/license/activate": "post",
    "/api/v1/marketplace/subscriptions": "get",
}


def _load_spec() -> dict:
    return yaml.safe_load((ROOT / "marketplace.yaml").read_text(encoding="utf-8"))


def test_marketplace_paths_present() -> None:
    spec = _load_spec()
    paths = spec["paths"]
    for path, method in EXPECTED_PATHS.items():
        assert path in paths, f"missing path {path}"
        methods = method if isinstance(method, list) else [method]
        for m in methods:
            assert m in paths[path], f"missing method {m} for {path}"


def test_all_endpoints_have_requirement_id() -> None:
    """硬规则 #2:每个 operation 必须有 x-requirement-id,且以 MP-CONS- 开头。"""
    spec = _load_spec()
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            assert "x-requirement-id" in op, (
                f"{method.upper()} {path} 缺少 x-requirement-id (硬规则 #2)"
            )
            assert op["x-requirement-id"].startswith("MP-CONS-"), (
                f"{method.upper()} {path} x-requirement-id 必须以 MP-CONS- 开头, "
                f"got {op['x-requirement-id']}"
            )


def test_install_and_license_activate_require_write_scope() -> None:
    """硬规则补强:写操作必须要求 platform.marketplace.write scope。"""
    spec = _load_spec()
    for path in ("/api/v1/marketplace/install",
                 "/api/v1/marketplace/license/activate",
                 "/api/v1/marketplace/install/{install_id}",
                 "/api/v1/marketplace/install/{install_id}/retry"):
        methods = spec["paths"][path]
        # install 是 POST;install/{id} 有 POST retry + DELETE uninstall
        for method_name, op in methods.items():
            if method_name == "get":
                continue
            scopes = []
            for sec in op.get("security", []):
                for scheme, sc_list in sec.items():
                    if scheme == "oidcScopes":
                        scopes.extend(sc_list or [])
            assert "platform.marketplace.write" in scopes, (
                f"{method_name.upper()} {path} 必须要求 platform.marketplace.write scope"
            )


def test_installed_uses_oauth_scopes() -> None:
    """/installed 是平台级 route,scope 决定可见范围。"""
    spec = _load_spec()
    op = spec["paths"]["/api/v1/marketplace/installed"]["get"]
    scopes = []
    for sec in op.get("security", []):
        for scheme, sc_list in sec.items():
            if scheme == "oidcScopes":
                scopes.extend(sc_list or [])
    assert "platform.marketplace.read" in scopes
    assert "platform.marketplace.read.tenant" in scopes


def test_manifest_schema_includes_kind_and_digest() -> None:
    """Artifact manifest 必须有 kind + digest.sha256(SPEC §3.2)。"""
    spec = _load_spec()
    manifest_schema = spec["components"]["schemas"]["ArtifactManifest"]
    assert "kind" in manifest_schema["required"]
    assert "digest" in manifest_schema["required"]
    assert manifest_schema["properties"]["kind"]["enum"] == ["mcp", "agent", "ontology", "skill"]
    digest = manifest_schema["properties"]["digest"]
    assert digest["properties"]["sha256"]["pattern"].startswith("^[a-f0-9]{64}$")


def test_error_codes_enumerated() -> None:
    """统一错误响应 schema 含 MP_* 错误码(SPEC §4.1)。"""
    spec = _load_spec()
    codes = set(spec["components"]["schemas"]["Error"]["properties"]["code"]["enum"])
    for expected in ("MP_DIGEST_MISMATCH", "MP_LICENSE_INVALID", "MP_LICENSE_EXPIRED",
                     "MP_KIND_NOT_ALLOWED", "MP_INCOMPATIBLE_PLATFORM", "MP_SAAS_UNREACHABLE"):
        assert expected in codes, f"缺少错误码 {expected}"
