"""ONT-VERSION-MECHANISM —— 草稿确认 + 不可变版本快照 + 冲突 + 回滚范围。

验收（目标 §1~§6）：
1. **破坏性草稿正确确认后可发布；未确认仍拒绝**（此前 `del confirm_name` 把合法确认丢弃）；
2. **发布 v2 后仍能读取 v1 完整定义**（快照携带完整 definition，不是同族 RID 列表）；
3. **Diff 可重现**（两侧都可以是版本快照 rid，重复调用结果一致）；
4. **并发编辑有明确冲突**（`expected_checksum` 不一致 → VersionConflict / 409）；
5. **回滚范围与结果一致**（只回滚模型定义；**不动数据**）；
6. **唯一权威版本来源** = `ont_type_version` 的不可变快照（`list_versions` 不再返回空）。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.getenv("VER_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "verm"
OBJ = f"ont.{T}.obj.crm.deal.v1"
OBJ_V2 = f"ont.{T}.obj.crm.deal.v2"
P_ID = f"ont.{T}.prop.did.v1"
P_STAGE = f"ont.{T}.prop.stage.v1"
P_NOTE = f"ont.{T}.prop.note.v1"


def _available() -> bool:
    try:
        import psycopg2

        c = psycopg2.connect(PG_DSN, connect_timeout=3)
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _available(), reason=f"PG not reachable at {PG_DSN!r}")


def _prop(rid: str, *, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="string",
        nullable=not pk,
        primary_key=pk,
        title=rid.split(".")[-2],
        format=PropertyFormat.STRING,
    )


def _ot(rid: str, props: tuple[str, ...] = (P_ID, P_STAGE), name: str = "deal") -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(P_ID),),
        properties=tuple(_prop(p, pk=(p == P_ID)) for p in props),
        display_name=name,
    )


def _clean() -> None:
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            for tbl in ("ont_individual", "ont_type_version", "ont_object_type", "ont_axiom"):
                cur.execute(
                    f"DELETE FROM {tbl} WHERE tenant_id=%s OR rid LIKE %s", (T, f"ont.{T}.%")
                )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    _clean()
    yield r
    _clean()


@pytest.fixture()
def client(repo, monkeypatch):
    """绕过 AuthMiddleware 的 TestClient：注入固定租户/用户上下文（不碰真 JWT）。"""
    from fastapi.testclient import TestClient

    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="ver-req",
            trace_id="ver-trace",
            tenant_id=TenantId(T),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)
    from mate_tech_ont.main import app as _app

    _app.state.kernel_repo = repo
    saved = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app)
    finally:
        _app.middleware_stack = saved


class TestVersionSnapshots:
    def test_list_versions_was_empty_now_returns_snapshots(self, repo) -> None:
        """§6：权威版本来源 —— list_versions 返回真实快照（此前恒 []）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            v = repo.snapshot_version(ClassRef(OBJ), "alice", None, ())
            versions = repo.list_versions(ClassRef(OBJ))
        assert v.version_no == 1 and v.checksum
        assert len(versions) == 1
        assert versions[0].definition is not None
        # 快照必须携带**完整定义**（不是同族 RID 列表）
        assert {p["rid"] for p in versions[0].definition["properties"]} == {P_ID, P_STAGE}

    def test_publishing_v2_keeps_v1_definition_readable(self, repo) -> None:
        """§2/§3：覆盖同 rid 发布新定义后，旧版定义仍可完整回读。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))  # v1: id + stage
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_NOTE)))  # 覆盖发布：id + note
            versions = repo.list_versions(ClassRef(OBJ))
        assert len(versions) == 2, "每次发布都留下该定义自身的不可变快照"
        v1, v2 = versions
        assert (v1.version_no, v2.version_no) == (1, 2)
        assert v1.definition is not None
        assert {p["rid"] for p in v1.definition["properties"]} == {P_ID, P_STAGE}  # v1 完整可读
        # 当前生效是 v2 定义
        with repo.tenant_scope(T):
            live = repo.get_object_type(ClassRef(OBJ))
            live_ck = repo.definition_checksum(ClassRef(OBJ))
        assert {p.rid.rid for p in live.properties} == {P_ID, P_NOTE}
        # 「当前生效版本」= checksum 与 live 一致的那一条快照（此处 v2）
        assert v2.checksum == live_ck and v1.checksum != live_ck

    def test_snapshot_is_idempotent_for_same_content(self, repo) -> None:
        """同内容重复快照 → 复用同一版本（不制造重复历史）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            a = repo.snapshot_version(ClassRef(OBJ), "alice", None, ())
            b = repo.snapshot_version(ClassRef(OBJ), "bob", None, ())
        assert a.rid == b.rid
        with repo.tenant_scope(T):
            assert len(repo.list_versions(ClassRef(OBJ))) == 1


class TestPublishNewVersion:
    """§4：草稿 → 已发布版本 → 当前生效 的关系。

    同族发布新版本（`deal.v1` → `deal.v2`）时，家族在**生效集合**里保持唯一，
    旧版下线但定义仍可完整回读（快照 + live 行都还在）。
    """

    def test_publish_v2_supersedes_v1_and_keeps_both_readable(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_STAGE), name="deal v1"))
            repo.branch_object_type(ClassRef(OBJ), ClassRef(OBJ_V2), note="publish v2")
            repo.upsert_object_type(_ot(OBJ_V2, (P_ID, P_NOTE), name="deal v2"))
            live = repo.list_object_types(limit=100, offset=0, tenant_id=T)
            versions = repo.list_versions(ClassRef(OBJ))
            v1_read = repo.get_object_type(ClassRef(OBJ))
        assert [t.rid.rid for t in live] == [OBJ_V2], "生效集合里家族唯一"
        # v1 定义完整可回读（live 行保留 + 快照保留）
        assert v1_read.display_name == "deal v1"
        assert {p.rid.rid for p in v1_read.properties} == {P_ID, P_STAGE}
        # 家族版本史：v1 原定义 → 分叉副本 → 分叉改动版（version_no 单调）
        assert [v.version_no for v in versions] == [1, 2, 3]
        assert versions[0].definition["rid"] == OBJ
        assert {p["rid"] for p in versions[0].definition["properties"]} == {P_ID, P_STAGE}
        # 「当前生效版本」= 家族史末条（与 live 定义一致）
        assert versions[-1].definition["rid"] == OBJ_V2
        assert {p["rid"] for p in versions[-1].definition["properties"]} == {P_ID, P_NOTE}


class TestVersionConflict:
    def test_stale_expected_checksum_raises_conflict(self, repo) -> None:
        """§5：乐观并发 —— 声明值与当前生效不一致 → VersionConflict（不静默覆盖）。"""
        from mate_tech_ont.v2_kernel.pg_repo import VersionConflict

        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            stale = repo.definition_checksum(ClassRef(OBJ))
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_NOTE)))  # 他人已改
            with pytest.raises(VersionConflict):
                repo.snapshot_version(ClassRef(OBJ), "bob", None, (), expected_checksum=stale)

    def test_current_expected_checksum_succeeds(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            cur = repo.definition_checksum(ClassRef(OBJ))
            v = repo.snapshot_version(ClassRef(OBJ), "bob", None, (), expected_checksum=cur)
        assert v.checksum == cur


class TestDiffReproducible:
    def test_diff_between_snapshot_and_live_is_reproducible(self, repo) -> None:
        """§3：Diff 可重现 —— 旧版来自**快照**，不是（可能已被覆盖的）live 行。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            snap = repo.snapshot_version(ClassRef(OBJ), "alice", None, ())
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_NOTE)))
            d1 = repo.diff_object_types(ClassRef(snap.rid), ClassRef(OBJ))
            d2 = repo.diff_object_types(ClassRef(snap.rid), ClassRef(OBJ))
        assert d1 == d2  # 可重现
        assert d1, "v1 → v2 应有差异（stage 消失 / note 出现）"
        # 同族另一版本 rid（branch 出来的 v2 类型）也能 diff —— 内容是同一份定义
        with repo.tenant_scope(T):
            v2 = repo.branch_object_type(ClassRef(OBJ), ClassRef(OBJ_V2), note="v2")
            d3 = repo.diff_object_types(ClassRef(OBJ), ClassRef(OBJ_V2))
        assert v2.rid.rid == OBJ_V2 and d3["has_changes"] is False
        assert d3["old_rid"] == OBJ and d3["new_rid"] == OBJ_V2


class TestRollbackScope:
    def test_rollback_restores_model_only(self, repo) -> None:
        """§4/§5：回滚只恢复**模型定义**；数据（实例）不受影响。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            snap = repo.snapshot_version(ClassRef(OBJ), "alice", None, ())
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_NOTE)))  # 破坏性：stage → note
            repo.create_individual(
                Individual(
                    rid=f"ont.{T}.ind.deal.d1",
                    class_rid=ClassRef(OBJ),
                    props=((ClassRef(P_ID), "d1"), (ClassRef(P_NOTE), "n")),
                    primary_key="d1",
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                    tenant_id=T,
                )
            )
            repo.rollback_object_type(ClassRef(OBJ), ClassRef(snap.rid))  # 按**快照**回滚
            live = repo.get_object_type(ClassRef(OBJ))
            inds = repo.list_individuals(ClassRef(OBJ), tenant_id=T)
        assert {p.rid.rid for p in live.properties} == {P_ID, P_STAGE}  # 模型已回滚
        assert len(inds) == 1 and inds[0].primary_key == "d1"  # **数据未动**（范围一致）


class TestDraftConfirmPassthrough:
    """§1：草稿应用时，调用方的显式确认必须抵达最终校验。"""

    def test_destructive_wip_applies_with_confirm_and_rejects_without(self, repo, client) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, name="deal"))
            # 破坏性草稿：删掉 stage 属性（payload 为 ObjectTypeDTO 形态）
            repo.save_schema_wip(
                OBJ,
                {
                    "rid": OBJ,
                    "display_name": "deal",
                    "primary_key": [P_ID],
                    "properties": [
                        {
                            "rid": P_ID,
                            "type_id": "string",
                            "nullable": False,
                            "primary_key": True,
                            "title": "did",
                            "format": "string",
                        }
                    ],
                    "interfaces": [],
                },
                "alice",
            )
        base = f"/api/v1/ont/v2/object-types/wip/{OBJ}/apply"
        # 未确认 → 仍必须拒绝（409 destructive_confirm_required）
        r_no = client.post(base)
        assert r_no.status_code == 409, r_no.text
        # 显式确认 → 抵达最终校验 → 发布成功
        r_ok = client.post(f"{base}?confirm_name=deal")
        assert r_ok.status_code == 200, r_ok.text


_P_JSON = {
    "rid": P_ID,
    "type_id": "string",
    "nullable": False,
    "primary_key": True,
    "title": "did",
    "format": "string",
}


def _wip_payload(props: tuple[str, ...]) -> dict:
    """草稿载荷（ObjectTypeDTO 形态；confirm_name 由保存端剔除）。"""
    return {
        "rid": OBJ,
        "display_name": "deal",
        "primary_key": [P_ID],
        "properties": [
            {
                "rid": p,
                "type_id": "string",
                "nullable": p != P_ID,
                "primary_key": p == P_ID,
                "title": p.split(".")[-2],
                "format": "string",
            }
            for p in props
        ],
        "interfaces": [],
    }


class TestStaleDraftConflict:
    """§5：多人编辑不静默覆盖 —— 草稿基线（保存时的 live 指纹）过期即 409。"""

    def test_draft_baselined_before_concurrent_edit_is_rejected(self, repo, client) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, name="deal"))  # v1：id + stage
            repo.save_schema_wip(OBJ, _wip_payload((P_ID, P_STAGE)), "alice")
            # 他人并发发布：加了 note（草稿本身没有删除任何属性 → 非破坏性）
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_STAGE, P_NOTE), name="deal"))
        r = client.post(f"/api/v1/ont/v2/object-types/wip/{OBJ}/apply")
        assert r.status_code == 409, r.text
        assert r.json()["detail"]["code"] == "E409_VERSION_CONFLICT"

    def test_explicit_expected_checksum_overrides_stale_baseline(self, repo, client) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, name="deal"))
            repo.save_schema_wip(OBJ, _wip_payload((P_ID, P_STAGE)), "alice")
            repo.upsert_object_type(_ot(OBJ, (P_ID, P_STAGE, P_NOTE), name="deal"))
            cur = repo.definition_checksum(ClassRef(OBJ))
        # 声明"我已看过新状态"（expected_checksum）+ 破坏性确认（草稿删掉了 note）
        r = client.post(
            f"/api/v1/ont/v2/object-types/wip/{OBJ}/apply?expected_checksum={cur}&confirm_name=deal"
        )
        assert r.status_code == 200, r.text


class TestPublishPreflight:
    """§4：发布前验证引用与兼容性 —— 坏模型不进"已发布版本"。"""

    def test_duplicate_property_slug_is_rejected_on_publish(self, repo, client) -> None:
        """静态校验：构造器管不到的属性 slug 重复必须在发布口拦下。"""
        with repo.tenant_scope(T):
            repo.save_schema_wip(
                OBJ,
                {
                    "rid": OBJ,
                    "display_name": "deal",
                    "primary_key": [P_ID],
                    "properties": [_P_JSON, {**_P_JSON, "title": "did-dup"}],
                    "interfaces": [],
                },
                "alice",
            )
        r = client.post(f"/api/v1/ont/v2/object-types/wip/{OBJ}/apply")
        assert r.status_code == 422, r.text
        assert r.json()["detail"]["error"] == "invalid_model"

    def test_validate_reports_destructive_and_unresolved_references(self, repo, client) -> None:
        ghost_if = f"ont.{T}.if.ghost.v1"
        ghost_parent = f"ont.{T}.obj.crm.ghost.v1"
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))  # 当前生效：id + stage
        r = client.post(
            "/api/v1/ont/v2/object-types/validate",
            json={
                "rid": OBJ,
                "display_name": "deal",
                "primary_key": [P_ID],
                "properties": [_P_JSON],  # 删掉 stage → 破坏性
                "interfaces": [ghost_if],
                "parent_class": ghost_parent,
            },
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["valid"] is True and out["destructive"], out
        assert out["references"]["unresolved"] == [ghost_if, ghost_parent]
        assert P_ID in out["references"]["dependencies"]


class TestVersionDependencies:
    """§3：版本快照自带必要依赖（不是只有同族 RID 列表）。"""

    def test_snapshot_records_dependency_rids(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ))
            v = repo.snapshot_version(ClassRef(OBJ), "alice", None, ())
        assert v.dependencies == tuple(sorted({P_ID, P_STAGE}))

    def test_resolve_references_flags_only_missing_external_refs(self, repo) -> None:
        from dataclasses import replace as _replace

        ghost_parent = f"ont.{T}.obj.crm.ghost.v1"
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, name="deal"))
            clean = repo.resolve_references(_ot(OBJ, name="deal"))
            dangling = repo.resolve_references(
                _replace(_ot(OBJ, name="deal"), parent_class=ClassRef(ghost_parent))
            )
        assert clean["unresolved"] == []
        assert dangling["unresolved"] == [ghost_parent]

    def test_live_checksum_pins_the_current_effective_version(self, repo, client) -> None:
        """§6：唯一权威版本来源 —— 前端凭 live checksum 认定"当前生效版本"。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ, name="deal"))
        live = client.get(f"/api/v1/ont/v2/object-types/{OBJ}")
        assert live.status_code == 200, live.text
        live_ck = live.json()["checksum"]
        assert live_ck
        versions = client.get(f"/api/v1/ont/v2/versions/{OBJ}")
        assert versions.status_code == 200, versions.text
        rows = versions.json()
        assert rows[-1]["checksum"] == live_ck and rows[-1]["version_no"] == 1
        assert rows[-1]["definition"]["rid"] == OBJ
        assert P_ID in rows[-1]["dependencies"]
