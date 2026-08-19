"""MP-DEDUP-01: ObjectType 去重 / precheck / merge / merge_suggestion proposal 测试。

需要 env: PG_DSN（默认 postgresql://meta:meta@localhost:5432/metaplatform_ont_test）。
跳过规则：连不上 PG 时 skip（CI 无 PG 时不阻塞）。

覆盖：
1. 同 slug 不同 rid → SlugConflictError（DB UNIQUE violation 翻译）
2. precheck 返回相似候选（中文 "客户" vs 英文 "Customer"，embedder=hash）
3. merge endpoint 把 source Individual / LinkInstance / Property 重映射到 target
4. merge_suggestion proposal 走 pending → confirmed → applied 全链路
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

from mate_kernel.action.engine import ProposalStatus
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

PG_DSN = os.getenv(
    "PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test"
)


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def repo() -> object:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: PLC0415
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder
    r = PgOntologyRepository(dsn=PG_DSN)
    # 注入确定性 embedder —— precheck 走 embedding 路径
    r.set_embedder(HashEmbedder())
    return r


@pytest.fixture(autouse=True)
def _clean_pg(repo) -> None:
    """每个测试前清表：先确保 schema 存在再 DELETE。"""
    repo._ensure_schema()
    import psycopg2  # type: ignore  # noqa: PLC0415
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance")
            cur.execute("DELETE FROM ont_link_type")
            cur.execute("DELETE FROM ont_interface")
            cur.execute("DELETE FROM ont_property")
            cur.execute("DELETE FROM ont_axiom")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_object_type")
            cur.execute("DELETE FROM ont_action_type")
            cur.execute("DELETE FROM ont_proposal")
        conn.commit()
    finally:
        conn.close()


# ─────────────────── helpers ───────────────────


def _tenant_id(rid: str) -> str:
    return rid.split(".")[1]


def _slug(rid: str) -> str:
    """ObjectType rid (``ont.<t>.obj.<domain>.<slug>.v1``) → slug = parts[4]。
    Property/Individual rid → slug = parts[3]。"""
    parts = rid.split(".")
    if len(parts) >= 6 and ".obj." in rid:
        return parts[4]
    return parts[3]


def _ot(rid: str, display_name: str = "", props: tuple[Property, ...] = ()) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=tuple(ClassRef(p.rid.rid) for p in props if p.primary_key) or (
            ClassRef(f"ont.{_tenant_id(rid)}.prop.{_slug(rid)}-id.v1"),
        ),
        properties=props or (
            Property(
                rid=ClassRef(f"ont.{_tenant_id(rid)}.prop.{_slug(rid)}-id.v1"),
                type_id="string", nullable=False, primary_key=True,
                title="id", format=PropertyFormat.STRING,
            ),
        ),
        display_name=display_name,
    )


def _ind(rid: str, class_rid: str, pk: str) -> Individual:
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{_tenant_id(rid)}.prop.{_slug(class_rid)}-id.v1"), pk),),
        primary_key=pk,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id=_tenant_id(rid),
    )


# ─────────────────── 1) UNIQUE 约束 ───────────────────


def test_same_slug_different_rid_raises_slug_conflict(repo) -> None:
    """同 slug（"customer"）不同 rid → SlugConflictError 带 existing_rid。"""
    from mate_tech_ont.v2_kernel.pg_repo import SlugConflictError

    rid_a = "ont.acme.obj.crm.customer.v1"
    rid_b = "ont.acme.obj.crm.customer.v2"  # 同 tenant + 同 slug → conflict
    repo.upsert_object_type(_ot(rid_a, "Customer"))

    with pytest.raises(SlugConflictError) as exc_info:
        repo.upsert_object_type(_ot(rid_b, "Customer (dup)"))

    err = exc_info.value
    assert err.tenant_id == "acme"
    assert err.slug == "customer"
    assert err.existing_rid == rid_a
    assert err.existing_display_name == "Customer"


def test_same_slug_same_rid_upserts_without_conflict(repo) -> None:
    """同 slug + 同 rid → upsert 走 ON CONFLICT (rid)，不报 conflict。"""
    rid = "ont.acme.obj.crm.customer.v1"
    repo.upsert_object_type(_ot(rid, "Customer"))
    # 再次 upsert 同 rid —— 应成功（覆盖 display_name）
    repo.upsert_object_type(_ot(rid, "Customer v2"))
    got = repo.get_object_type(ClassRef(rid))
    assert got.display_name == "Customer v2"


def test_different_slug_in_same_tenant_is_allowed(repo) -> None:
    """同 tenant + 不同 slug → 两条 ObjectType 共存。"""
    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
    repo.upsert_object_type(_ot("ont.acme.obj.crm.product.v1", "Product"))
    items = repo.list_object_types(limit=10, offset=0, tenant_id="acme")
    assert {x.rid.rid for x in items} >= {
        "ont.acme.obj.crm.customer.v1", "ont.acme.obj.crm.product.v1",
    }


def test_same_slug_in_different_tenant_is_allowed(repo) -> None:
    """不同 tenant + 同 slug → 共存（UNIQUE 是 (tenant_id, slug) 复合）。"""
    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
    repo.upsert_object_type(_ot("ont.beta.obj.crm.customer.v1", "Customer"))
    acme = repo.list_object_types(limit=10, offset=0, tenant_id="acme")
    beta = repo.list_object_types(limit=10, offset=0, tenant_id="beta")
    assert {x.rid.rid for x in acme} == {"ont.acme.obj.crm.customer.v1"}
    assert {x.rid.rid for x in beta} == {"ont.beta.obj.crm.customer.v1"}


# ─────────────────── 2) precheck 相似扫描 ───────────────────


def test_precheck_finds_chinese_vs_english_match_via_embedder(repo) -> None:
    """'客户' 与已有 'Customer' 在 HashEmbedder + cosine 下命中候选。"""
    from mate_tech_ont.v2_kernel.similarity import search_similar_object_types

    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
    repo.upsert_object_type(_ot("ont.acme.obj.crm.product.v1", "Product"))

    cands = search_similar_object_types(
        repo, "acme", "客户", "customer", top_k=5,
    )
    # "客户 customer" 与 "Customer customer" 字符级有重叠，cosine > 0
    customer_match = [c for c in cands if c["slug"] == "customer"]
    assert customer_match, f"expected 'customer' candidate in {cands}"
    top = customer_match[0]
    assert top["rid"] == "ont.acme.obj.crm.customer.v1"
    assert top["suggested_action"] in {"merge", "rename", "cancel"}
    # "Product" 不应排第一
    product_match = [c for c in cands if c["slug"] == "product"]
    if product_match:
        assert product_match[0]["similarity"] < top["similarity"]


def test_precheck_returns_empty_when_no_match(repo) -> None:
    """embedder 缺席 + slug 归一化无重叠 → 返回空 list。"""
    from mate_tech_ont.v2_kernel.similarity import search_similar_object_types

    repo.set_embedder(None)  # 强制 fallback（归一化 + 子串）
    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))

    cands = search_similar_object_types(
        repo, "acme", "完全无关的词", "totally-unrelated", top_k=5,
    )
    # 归一化 "totallyunrelated" 不在 "customer" 里，反之亦然
    assert cands == []


def test_precheck_fallback_normalizes_slug(repo) -> None:
    """embedder=None 时 fallback 走归一化：'customer_order' 命中 'customer-order'。"""
    from mate_tech_ont.v2_kernel.similarity import search_similar_object_types
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder

    repo.set_embedder(None)  # 强制 fallback
    _ = HashEmbedder  # avoid linter unused

    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer-order.v1", "Customer Order"))

    cands = search_similar_object_types(
        repo, "acme", "Customer Order", "customer_order", top_k=5,
    )
    assert cands, "expected fallback to normalize 'customer_order' vs 'customer-order'"
    top = cands[0]
    assert top["slug"] == "customer-order"
    assert top["similarity"] >= 0.8  # 子串完全相同 → 1.0


# ─────────────────── 3) merge endpoint ───────────────────


def test_merge_remaps_individuals_and_archives_source(repo) -> None:
    """merge 把 source Individual.class_rid 重映射到 target，软删 source。"""
    source_rid = "ont.acme.obj.crm.customer.v1"
    target_rid = "ont.acme.obj.crm.client.v1"

    repo.upsert_object_type(_ot(source_rid, "Customer"))
    repo.upsert_object_type(_ot(target_rid, "Client"))

    # 在 source class 下插入 2 个 Individual
    src_ind1 = _ind("ont.acme.ind.customer.1", source_rid, "1")
    src_ind2 = _ind("ont.acme.ind.customer.2", source_rid, "2")
    repo.create_individual(src_ind1)
    repo.create_individual(src_ind2)

    result = repo.merge_object_types(source_rid, target_rid)

    assert result["source_rid"] == source_rid
    assert result["target_rid"] == target_rid
    assert result["affected_individuals"] == 2
    assert result["source_archived"] is True

    # Individual.class_rid 现在是 target
    got1 = repo.get_individual("ont.acme.ind.client.1")
    assert got1.class_rid.rid == target_rid
    got2 = repo.get_individual("ont.acme.ind.client.2")
    assert got2.class_rid.rid == target_rid

    # source 已 archived → 同 slug 可重新创建
    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v3", "Customer Reborn"))


def test_merge_remaps_link_instances(repo) -> None:
    """merge 后 LinkInstance.src / dst 自动从 source class ind 改为 target class ind。"""
    source_rid = "ont.acme.obj.crm.customer.v1"
    target_rid = "ont.acme.obj.crm.client.v1"
    repo.upsert_object_type(_ot(source_rid, "Customer"))
    repo.upsert_object_type(_ot(target_rid, "Client"))

    src_ind = _ind("ont.acme.ind.customer.42", source_rid, "42")
    repo.create_individual(src_ind)
    # 建一条 LinkInstance，src 指 source class ind
    li = LinkInstance(
        rid="ont.acme.lnk.rel.test.v1",
        link_type_rid=ClassRef("ont.acme.lnk.order-customer.v1"),
        src="ont.acme.ind.customer.42",
        dst="ont.acme.ind.order.0",
        props=(),
        created_at=datetime.now(UTC),
        tenant_id="acme",
    )
    repo.create_link_instance(li)

    repo.merge_object_types(source_rid, target_rid)

    items = repo.list_link_instances()
    assert len(items) == 1
    assert items[0].src == "ont.acme.ind.client.42"  # 替换了 source slug


def test_merge_rejects_cross_tenant(repo) -> None:
    """跨 tenant merge → ValueError（403）。"""
    from mate_tech_ont.v2_kernel.pg_repo import SlugConflictError

    repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
    repo.upsert_object_type(_ot("ont.beta.obj.crm.client.v1", "Client"))

    with pytest.raises(ValueError, match="cross-tenant"):
        repo.merge_object_types(
            "ont.acme.obj.crm.customer.v1", "ont.beta.obj.crm.client.v1",
        )


def test_merge_rejects_same_source_target(repo) -> None:
    """source == target → ValueError。"""
    rid = "ont.acme.obj.crm.customer.v1"
    repo.upsert_object_type(_ot(rid, "Customer"))
    with pytest.raises(ValueError, match="must differ"):
        repo.merge_object_types(rid, rid)


def test_merge_missing_source_raises_keyerror(repo) -> None:
    rid = "ont.acme.obj.crm.customer.v1"
    with pytest.raises(KeyError, match="source"):
        repo.merge_object_types(rid, "ont.acme.obj.crm.client.v1")


# ─────────────────── 4) merge_suggestion proposal 状态机 ───────────────────


def test_merge_suggestion_proposal_lifecycle_pending_confirmed_applied(repo) -> None:
    """完整状态机：pending → confirmed → applied。

    apply 阶段触发 merge_object_types，把 source Individual 重映射到 target。
    """
    source_rid = "ont.acme.obj.crm.customer.v1"
    target_rid = "ont.acme.obj.crm.client.v1"

    repo.upsert_object_type(_ot(source_rid, "Customer"))
    repo.upsert_object_type(_ot(target_rid, "Client"))
    repo.create_individual(_ind("ont.acme.ind.customer.1", source_rid, "1"))
    repo.create_individual(_ind("ont.acme.ind.customer.2", source_rid, "2"))

    # propose
    prop = repo.propose_merge(
        source_rid=source_rid,
        target_rid=target_rid,
        similarity=0.93,
        impact_summary="AI 检测到 '客户' 与 'Client' 是同义本体",
    )
    assert prop.status == ProposalStatus.PENDING
    assert prop.kind == "merge_suggestion"
    assert prop.parameters["source_rid"] == source_rid
    assert prop.parameters["target_rid"] == target_rid
    assert prop.parameters["similarity"] == 0.93
    assert prop.expected_diff["+merge"]["source"] == source_rid

    # 直接 execute（未 confirm）→ 应报 ProposalNotConfirmed
    import mate_kernel.action.engine as engine_mod
    with pytest.raises(engine_mod.ProposalNotConfirmed):
        repo.execute_proposal(prop.proposal_id)

    # confirm
    confirmed = repo.confirm_proposal(prop.proposal_id, confirmed_by="alice")
    assert confirmed.status == ProposalStatus.CONFIRMED
    assert confirmed.confirmed_by == "alice"

    # execute
    out = repo.execute_proposal(prop.proposal_id)
    assert isinstance(out, dict)
    assert out["source_rid"] == source_rid
    assert out["target_rid"] == target_rid
    assert out["affected_individuals"] == 2
    assert out["source_archived"] is True

    # 最终：proposal 已 applied
    final = repo.get_proposal(prop.proposal_id)
    assert final.status == ProposalStatus.APPLIED

    # source Individual 已重映射
    got = repo.get_individual("ont.acme.ind.client.1")
    assert got.class_rid.rid == target_rid


def test_merge_suggestion_proposal_rejected_does_not_merge(repo) -> None:
    """user reject → 不触发 merge，Individual 仍属于 source class。"""
    source_rid = "ont.acme.obj.crm.customer.v1"
    target_rid = "ont.acme.obj.crm.client.v1"
    repo.upsert_object_type(_ot(source_rid, "Customer"))
    repo.upsert_object_type(_ot(target_rid, "Client"))
    repo.create_individual(_ind("ont.acme.ind.customer.1", source_rid, "1"))

    prop = repo.propose_merge(
        source_rid=source_rid, target_rid=target_rid,
        similarity=0.85, impact_summary="可能同义",
    )
    repo.reject_proposal(prop.proposal_id, confirmed_by="bob")

    final = repo.get_proposal(prop.proposal_id)
    assert final.status == ProposalStatus.REJECTED

    # Individual 未被重映射
    got = repo.get_individual("ont.acme.ind.customer.1")
    assert got.class_rid.rid == source_rid
