"""SHACL 推理引擎测试 (v3.2 W2)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.inference.shacl_engine import SHACLEngine


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def engine() -> SHACLEngine:
    return SHACLEngine()


@pytest.fixture
def client() -> TestClient:
    from mate_tech_ont.main import app
    return TestClient(app)


def _user_shape() -> list[dict]:
    return [
        {
            "shape_id": "UserShape",
            "target_class": "User",
            "constraints": [
                {"path": "name", "min_count": 1, "datatype": "string"},
                {"path": "email", "pattern": r".*@.*"},
            ],
        }
    ]


# ---------------------------------------------------------------------------
# Engine unit tests
# ---------------------------------------------------------------------------


def test_shacl_conforms_when_all_constraints_met(engine: SHACLEngine) -> None:
    """所有约束满足 → conforms=True,无违例。"""
    instances = [
        {"id": "u1", "type": "User", "name": "Alice", "email": "alice@acme.com"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is True
    assert result.violations == ()


def test_shacl_violates_missing_required_field(engine: SHACLEngine) -> None:
    """min_count=1 但属性缺失 → 违例。"""
    instances = [
        {"id": "u2", "type": "User", "email": "bob@acme.com"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is False
    assert len(result.violations) == 1
    v = result.violations[0]
    assert v.shape_id == "UserShape"
    assert v.focus_node == "u2"
    assert v.path == "name"
    assert "min_count" in v.message.lower() or "at least" in v.message


def test_shacl_violates_wrong_datatype(engine: SHACLEngine) -> None:
    """datatype=string 但值为整数 → 违例。"""
    instances = [
        {"id": "u3", "type": "User", "name": 12345, "email": "c@acme.com"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is False
    v = result.violations[0]
    assert v.path == "name"
    assert v.value == 12345
    assert "datatype" in v.message.lower() or "string" in v.message


def test_shacl_violates_pattern_mismatch(engine: SHACLEngine) -> None:
    """email 不匹配 .*@.* → 违例。"""
    instances = [
        {"id": "u4", "type": "User", "name": "Dan", "email": "not-an-email"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is False
    v = result.violations[0]
    assert v.path == "email"
    assert v.value == "not-an-email"
    assert "pattern" in v.message.lower()


def test_shacl_multiple_violations(engine: SHACLEngine) -> None:
    """单个实例同时违反多条约束 → 多条违例。"""
    instances = [
        {"id": "u5", "type": "User", "name": 99, "email": "bad"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is False
    paths = {v.path for v in result.violations}
    assert paths == {"name", "email"}


def test_shacl_no_matching_target_class(engine: SHACLEngine) -> None:
    """实例的 type 与 target_class 不匹配 → 不校验,conforms=True。"""
    instances = [
        {"id": "g1", "type": "Group", "name": "Admins"},
    ]
    result = engine.validate(instances, _user_shape())
    assert result.conforms is True
    assert result.violations == ()


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


def test_shacl_validate_endpoint_happy_path(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """POST /api/v1/ont/shacl/validate 全部通过 → conforms=True。"""
    resp = client.post(
        "/api/v1/ont/shacl/validate",
        json={
            "instances": [
                {"id": "u1", "type": "User", "name": "Alice",
                 "email": "alice@acme.com"},
            ],
            "shapes": _user_shape(),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["conforms"] is True
    assert body["violations"] == []


def test_shacl_validate_endpoint_with_violations(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """POST /api/v1/ont/shacl/validate 存在违例 → conforms=False + 违例列表。"""
    resp = client.post(
        "/api/v1/ont/shacl/validate",
        json={
            "instances": [
                {"id": "u2", "type": "User", "name": 42, "email": "bad"},
            ],
            "shapes": _user_shape(),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["conforms"] is False
    paths = {v["path"] for v in body["violations"]}
    assert paths == {"name", "email"}
