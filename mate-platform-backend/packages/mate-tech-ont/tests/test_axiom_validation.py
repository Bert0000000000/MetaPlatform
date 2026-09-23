"""ADR-0070：Axiom 运行时违规检查 —— Core 三条规则（disjoint / has_key / subclass）。

<p>失败测试先行（仓库纪律：docs/ADR → contract → failing tests → feature）。
本文件在 `mate_tech_ont.v2_kernel.axiom_validation` 落地前**应为红**。
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.reasoning.axiom import Axiom, AxiomKind
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.axiom_validation import validate_axioms

TENANT = "tenant-a"


def _slug(rid: str) -> str:
    parts = rid.split(".")
    return parts[4] if len(parts) >= 6 and ".obj." in rid else parts[3]


def _tenant(rid: str) -> str:
    return rid.split(".")[1]


def _prop(rid: str, *, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="string",
        nullable=not pk,
        primary_key=pk,
        title=_slug(rid),
        format=PropertyFormat.STRING,
    )


def _ot(rid: str, *, parent: str | None = None) -> ObjectType:
    pk = _prop(f"ont.{_tenant(rid)}.prop.{_slug(rid)}-id.v1", pk=True)
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=(pk,),
        display_name=_slug(rid),
        parent_class=ClassRef(parent) if parent else None,
    )


def _ind(rid: str, class_rid: str, pk: str) -> Individual:
    now = datetime.now(UTC)
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{_tenant(rid)}.prop.{_slug(class_rid)}-id.v1"), pk),),
        primary_key=pk,
        created_at=now,
        updated_at=now,
        tenant_id=_tenant(rid),
    )


def _ax(rid: str, kind: AxiomKind, operands: tuple[str, ...], rule_ref: str = "builtin") -> Axiom:
    return Axiom(
        rid=ClassRef(rid),
        kind=kind,
        operands=tuple(ClassRef(o) for o in operands),
        rule_ref=rule_ref,
    )


def _repo() -> InMemoryOntologyRepository:
    return InMemoryOntologyRepository()


# ─────────────────── 1) 无公理 → conforms ───────────────────


def test_no_axioms_conforms() -> None:
    repo = _repo()
    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is True
    assert report["violations"] == []
    assert report["stats"]["violated"] == 0


# ─────────────────── 2) disjoint ───────────────────


def test_disjoint_violation_when_individual_under_both_classes() -> None:
    """个体所属类链同时包含两个不相交类 → violation。"""
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    b = f"ont.{TENANT}.obj.crm.beta.v1"
    repo.upsert_object_type(_ot(a, parent=b))
    repo.upsert_object_type(_ot(b))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.1", a, "1"))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.disjoint-ab.v1", AxiomKind.DISJOINT, (a, b)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is False
    kinds = [v["kind"] for v in report["violations"]]
    assert "disjoint" in kinds
    assert report["stats"]["violated"] >= 1


def test_disjoint_clean_when_no_individual_under_both() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    b = f"ont.{TENANT}.obj.crm.beta.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_object_type(_ot(b))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.1", a, "1"))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.disjoint-ab.v1", AxiomKind.DISJOINT, (a, b)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is True


# ─────────────────── 3) has_key ───────────────────


def test_has_key_violation_on_duplicate_primary_key() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.1", a, "dup"))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.2", a, "dup"))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.key-alpha.v1", AxiomKind.HAS_KEY, (a,)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is False
    assert "has_key" in [v["kind"] for v in report["violations"]]


def test_has_key_clean_on_distinct_primary_keys() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.1", a, "1"))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.2", a, "2"))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.key-alpha.v1", AxiomKind.HAS_KEY, (a,)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is True


# ─────────────────── 4) subclass ───────────────────


def test_subclass_self_loop_is_violation() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.sub-alpha.v1", AxiomKind.SUBCLASS, (a, a)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is False
    assert "subclass" in [v["kind"] for v in report["violations"]]


def test_subclass_clean_for_wellformed_pair() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    b = f"ont.{TENANT}.obj.crm.beta.v1"
    repo.upsert_object_type(_ot(a, parent=b))
    repo.upsert_object_type(_ot(b))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.sub-alpha.v1", AxiomKind.SUBCLASS, (a, b)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is True


# ─────────────────── 5) 未覆盖 kind → skipped ───────────────────


def test_uncovered_kind_is_skipped_not_violated() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.trans-alpha.v1", AxiomKind.TRANSITIVITY, (a,)))

    report = validate_axioms(repo, TENANT)

    assert report["conforms"] is True
    assert report["stats"]["skipped"] == 1
    assert report["stats"]["checked"] == 0


# ─────────────────── 6) axiom_rid 过滤 ───────────────────


def test_axiom_rid_filter_limits_scope() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.sub-a.v1", AxiomKind.SUBCLASS, (a, a)))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.key-a.v1", AxiomKind.HAS_KEY, (a,)))

    report = validate_axioms(repo, TENANT, axiom_rid=f"ont.{TENANT}.ax.crm.key-a.v1")

    assert report["stats"]["checked"] == 1
    assert report["conforms"] is True  # has_key 无重复主键


# ─────────────────── 7) target_class 限定实例范围 ───────────────────


def test_target_class_limits_individual_scope() -> None:
    repo = _repo()
    a = f"ont.{TENANT}.obj.crm.alpha.v1"
    b = f"ont.{TENANT}.obj.crm.beta.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_object_type(_ot(b))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.1", a, "dup"))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.alpha.2", a, "dup"))
    repo.create_individual(_ind(f"ont.{TENANT}.ind.beta.1", b, "x"))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.key-a.v1", AxiomKind.HAS_KEY, (a,)))
    repo.upsert_axiom(_ax(f"ont.{TENANT}.ax.crm.key-b.v1", AxiomKind.HAS_KEY, (b,)))

    report = validate_axioms(repo, TENANT, target_class=b)

    # 只看 b 类 → a 的重复主键不触发
    assert report["conforms"] is True


# ─────────────────── 8) HTTP 端点（operationId ontValidateV2Axioms） ───────────
#
# 真实中间件栈 + InMemory 仓储（无 PG 依赖，不会 skip）。租户固定
# `tenant-acme`（与 conftest.make_keycloak_token 默认一致）。


@pytest.fixture
def client_with_ctx():
    """替换 AuthMiddleware.dispatch 注入 ctx，并把 kernel_repo 换成 InMemory。"""
    from fastapi.testclient import TestClient

    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId
    from mate_tech_ont.main import app

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="test-req",
            trace_id="test-trace",
            tenant_id=TenantId("tenant-acme"),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    saved_repo = getattr(app.state, "kernel_repo", None)
    saved_dispatch = auth_mw.AuthMiddleware.dispatch
    saved_stack = app.middleware_stack
    app.state.kernel_repo = InMemoryOntologyRepository()
    auth_mw.AuthMiddleware.dispatch = fake_dispatch
    app.middleware_stack = None
    try:
        yield TestClient(app), app.state.kernel_repo
    finally:
        app.state.kernel_repo = saved_repo
        auth_mw.AuthMiddleware.dispatch = saved_dispatch
        app.middleware_stack = saved_stack


AXIOMS_VALIDATE = "/api/v1/ont/v2/axioms/validate"


def test_endpoint_requires_auth_context() -> None:
    """无 auth 中间件注入 ctx → 401（硬规则 #3 租户守门）。"""
    from fastapi.testclient import TestClient

    from mate_tech_ont.main import app

    saved_stack = app.middleware_stack
    app.middleware_stack = None
    try:
        resp = TestClient(app).post(AXIOMS_VALIDATE, json={})
    finally:
        app.middleware_stack = saved_stack
    assert resp.status_code == 401


def test_endpoint_returns_report(client_with_ctx) -> None:
    client, _ = client_with_ctx
    resp = client.post(AXIOMS_VALIDATE, json={})

    assert resp.status_code == 200
    body = resp.json()
    assert body["conforms"] is True
    assert body["violations"] == []
    assert body["stats"] == {"checked": 0, "violated": 0, "skipped": 0}


def test_endpoint_reports_disjoint_violation(client_with_ctx) -> None:
    client, repo = client_with_ctx
    tenant = "tenant-acme"
    a = f"ont.{tenant}.obj.crm.alpha.v1"
    b = f"ont.{tenant}.obj.crm.beta.v1"
    repo.upsert_object_type(_ot(a, parent=b))
    repo.upsert_object_type(_ot(b))
    repo.create_individual(_ind(f"ont.{tenant}.ind.alpha.1", a, "1"))
    repo.upsert_axiom(_ax(f"ont.{tenant}.ax.crm.disjoint-ab.v1", AxiomKind.DISJOINT, (a, b)))

    resp = client.post(AXIOMS_VALIDATE, json={})

    assert resp.status_code == 200
    body = resp.json()
    assert body["conforms"] is False
    assert body["violations"][0]["focus_node"] == f"ont.{tenant}.ind.alpha.1"
    assert body["stats"]["violated"] == 1


def test_endpoint_axiom_rid_filter(client_with_ctx) -> None:
    client, repo = client_with_ctx
    tenant = "tenant-acme"
    a = f"ont.{tenant}.obj.crm.alpha.v1"
    repo.upsert_object_type(_ot(a))
    repo.upsert_axiom(_ax(f"ont.{tenant}.ax.crm.sub-a.v1", AxiomKind.SUBCLASS, (a, a)))
    repo.upsert_axiom(_ax(f"ont.{tenant}.ax.crm.key-a.v1", AxiomKind.HAS_KEY, (a,)))

    resp = client.post(AXIOMS_VALIDATE, json={"axiom_rid": f"ont.{tenant}.ax.crm.key-a.v1"})

    assert resp.status_code == 200
    assert resp.json()["conforms"] is True  # 只校验 has_key，subclass 自环不计入
    assert resp.json()["stats"]["checked"] == 1


def test_endpoint_rejects_cross_tenant_axiom(client_with_ctx) -> None:
    client, _ = client_with_ctx
    resp = client.post(AXIOMS_VALIDATE, json={"axiom_rid": "ont.other-tenant.ax.crm.x.v1"})
    assert resp.status_code == 403


def test_endpoint_rejects_cross_tenant_target_class(client_with_ctx) -> None:
    client, _ = client_with_ctx
    resp = client.post(AXIOMS_VALIDATE, json={"target_class": "ont.other-tenant.obj.crm.x.v1"})
    assert resp.status_code == 403
