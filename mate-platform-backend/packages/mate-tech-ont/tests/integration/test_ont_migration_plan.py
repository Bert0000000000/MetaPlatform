"""ONT-MIGRATION-PLAN —— 模型发布的存量数据迁移（ADR-0082）。

验收（ADR-0082 §4 / 目标 §1~§11）：
1. **家族发布自动携带实例**：branch v1→v2 后 `list_individuals(v2)` 返回全部存量实例，
   reattach 计数入迁移记录（同事务，修"新 rid 下查实例 0 行"缺陷）；
2. **sync 不再回退 class_rid**：`upsert_sourced_props` 命中同 rid 时更新 class_rid；
3. **assess 分类与计数**：rename 按 slug 配对 / 无后继归 preserve / coerce 可转换与
   不可转换分开计数 / PK 冲突与缺失检出 / 旧版本 rid 残留实例计为 reattach_pending；
   评估**只读**（不产生迁移记录、不改数据）；
4. **run rename 四处重映射**：props / props_src / ont_edit_overlay / field_mapping；
5. **drop 默认 preserve**（不丢数据）；显式 drop 才删；
6. **coerce 仅无损**（"123"→123 过；"abc" 保留原值 + 计数）；
7. **PK 重派生**：实例 rid 重写 + link src/dst 同步；冲突/缺失默认 fail-closed
   （无部分写）；skip 选项跳过并逐条报告；
8. **幂等键回放**：同 Idempotency-Key 重放回放原结果；缺键 400；
9. **expected_checksum 漂移 409**（E409_VERSION_CONFLICT，同 ADR-0080 口径）；
10. **跨租户 403**；runs 列表租户隔离；
11. **迁移后模型回滚仍只动模型**（数据保持迁移后形态，边界如实）。
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

PG_DSN = os.getenv("VER_PG_DSN") or os.getenv(
    "PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test"
)
T = "mig"
SLUG = "deal"
OBJ_V1 = f"ont.{T}.obj.crm.{SLUG}.v1"
OBJ_V2 = f"ont.{T}.obj.crm.{SLUG}.v2"
P_ID = f"ont.{T}.prop.did.v1"  # 主键（不变）
P_STAGE_V1 = f"ont.{T}.prop.stage.v1"  # 将 rename → stage.v2
P_STAGE_V2 = f"ont.{T}.prop.stage.v2"  # 同 slug 后继
P_LEGACY = f"ont.{T}.prop.legacy.v1"  # 真删除（无后继）
P_AMT = f"ont.{T}.prop.amount.v1"  # format 变更 string → integer
P_CODE = f"ont.{T}.prop.code.v1"  # 新主键候选


def _available() -> bool:
    try:
        import psycopg2

        c = psycopg2.connect(PG_DSN, connect_timeout=3)
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _available(), reason=f"PG not reachable at {PG_DSN!r}")


def _prop(rid: str, *, pk: bool = False, fmt: str = "string") -> Property:
    # type_id 必须与 format 同源（EXP-02：已注册值类型与 format 不符即拒）
    return Property(
        rid=ClassRef(rid),
        type_id=fmt,
        nullable=not pk,
        primary_key=pk,
        title=rid.split(".")[-2],
        format=PropertyFormat(fmt),
    )


def _ot(
    rid: str,
    props: tuple[str, ...],
    *,
    pk: tuple[str, ...] = (P_ID,),
    fmts: dict[str, str] | None = None,
    name: str = "deal",
) -> ObjectType:
    fmts = fmts or {}
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=tuple(ClassRef(p) for p in pk),
        properties=tuple(_prop(p, pk=(p in pk), fmt=fmts.get(p, "string")) for p in props),
        display_name=name,
    )


def _ind(pk_value: str, cls: str, props: dict[str, object]) -> Individual:
    now = datetime.now(UTC)
    return Individual(
        rid=f"ont.{T}.ind.{SLUG}.{pk_value}",
        class_rid=ClassRef(cls),
        props=tuple((ClassRef(k), v) for k, v in props.items()),
        primary_key=str(pk_value),
        created_at=now,
        updated_at=now,
        tenant_id=T,
    )


def _sql(query: str, params: tuple = ()) -> list[tuple]:
    """直接读写测试库（种子 overlay/props_src/link 行与断言 class_rid 用）。"""
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall() if cur.description else []
        conn.commit()
        return rows
    finally:
        conn.close()


def _clean() -> None:
    for tbl in (
        "ont_individual",
        "ont_link_instance",
        "ont_edit_overlay",
        "ont_backing_datasource",
        "ont_migration_run",
        "ont_type_version",
        "ont_object_type",
        "ont_axiom",
    ):
        _sql(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))


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
            request_id="mig-req",
            trace_id="mig-trace",
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


# ────────────────────────────────────────────────────────────────────
# §1/§2 家族发布自动携带实例（修"新 rid 下查实例 0 行"缺陷）
# ────────────────────────────────────────────────────────────────────


class TestReattachOnFamilyPublish:
    def test_family_publish_carries_instances_and_records_run(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ_V1, (P_ID, P_STAGE_V1), name="deal v1"))
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_STAGE_V1: "s1"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_STAGE_V1: "s2"}))
            repo.branch_object_type(ClassRef(OBJ_V1), ClassRef(OBJ_V2), note="publish v2")
            repo.upsert_object_type(_ot(OBJ_V2, (P_ID, P_STAGE_V1), name="deal v2"))
            after = repo.list_individuals(ClassRef(OBJ_V2))
            runs = repo.list_migration_runs(ClassRef(OBJ_V2))
        assert {i.rid for i in after} == {
            f"ont.{T}.ind.{SLUG}.d1",
            f"ont.{T}.ind.{SLUG}.d2",
        }, "家族发布后存量实例必须在新 rid 下可见（此前 0 行）"
        reattaches = [r for r in runs if r["kind"] == "reattach"]
        assert reattaches, "同族发布要留下 reattach 迁移记录"
        assert reattaches[-1]["counts"].get("reattached") == 2

    def test_assess_reports_and_heals_legacy_orphans(self, repo) -> None:
        """本修复之前已悬空的存量：assess 计为 reattach_pending，run 治愈。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ_V1, (P_ID, P_STAGE_V1)))
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_STAGE_V1: "s1"}))
            repo.branch_object_type(ClassRef(OBJ_V1), ClassRef(OBJ_V2), note="publish v2")
            repo.upsert_object_type(_ot(OBJ_V2, (P_ID, P_STAGE_V1), name="deal v2"))
        # 模拟修复前遗留：把一条实例的 class_rid 拨回旧 rid
        _sql(
            "UPDATE ont_individual SET class_rid=%s WHERE rid=%s",
            (OBJ_V1, f"ont.{T}.ind.{SLUG}.d1"),
        )
        with repo.tenant_scope(T):
            assessment = repo.assess_migration(ClassRef(OBJ_V2))
            assert assessment["counts"].get("reattach_pending") == 1
            assert assessment["plan"].get("reattach")
            out = repo.run_migration(
                ClassRef(OBJ_V2),
                assessment["plan"],
                author="alice",
                idempotency_key="mig-heal-1",
                expected_checksum=assessment["to_checksum"],
            )
            visible = repo.list_individuals(ClassRef(OBJ_V2))
        assert out["counts"].get("reattached") == 1
        assert {i.rid for i in visible} == {f"ont.{T}.ind.{SLUG}.d1"}

    def test_sourced_upsert_updates_class_rid_on_conflict(self, repo) -> None:
        """sync 的 ON CONFLICT (rid) DO UPDATE 必须更新 class_rid（防御性修复）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ_V1, (P_ID, P_STAGE_V1)))
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_STAGE_V1: "s1"}))
            repo.branch_object_type(ClassRef(OBJ_V1), ClassRef(OBJ_V2), note="publish v2")
            repo.upsert_object_type(_ot(OBJ_V2, (P_ID, P_STAGE_V1), name="deal v2"))
        # 模拟旧状态（class_rid 停在 v1）后走管道同步写入路径
        _sql(
            "UPDATE ont_individual SET class_rid=%s WHERE rid=%s",
            (OBJ_V1, f"ont.{T}.ind.{SLUG}.d1"),
        )
        with repo.tenant_scope(T):
            repo.upsert_sourced_props(
                rid=f"ont.{T}.ind.{SLUG}.d1",
                tenant_id=T,
                class_rid=ClassRef(OBJ_V2),
                primary_key="d1",
                values={P_STAGE_V1: "s1x"},
                source="pipe",
                priority=50,
                ts=datetime.now(UTC),
            )
        rows = _sql(
            "SELECT class_rid FROM ont_individual WHERE rid=%s", (f"ont.{T}.ind.{SLUG}.d1",)
        )
        assert rows and rows[0][0] == OBJ_V2, "同 rid 命中 upsert 时 class_rid 不得停留在旧版本"


# ────────────────────────────────────────────────────────────────────
# §3 assess：分类 + SQL 级真实计数（只读）
# ────────────────────────────────────────────────────────────────────


def _publish_v1_then_v2(repo, v1_props, v2_props, *, v2_fmts=None, v2_pk=(P_ID,)):
    """发布 v1 定义 →（自动快照）→ 同 rid 覆盖发布 v2 定义（破坏性变更面）。"""
    with repo.tenant_scope(T):
        repo.upsert_object_type(_ot(OBJ_V1, v1_props, name="deal v1"))
        repo.upsert_object_type(_ot(OBJ_V1, v2_props, pk=v2_pk, fmts=v2_fmts, name="deal v2"))


class TestAssessClassification:
    def test_rename_paired_by_slug_and_true_removal_preserved(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_STAGE_V1, P_LEGACY),
            (P_ID, P_STAGE_V2),
        )
        with repo.tenant_scope(T):
            a = repo.assess_migration(ClassRef(OBJ_V1))
        plan = a["plan"]
        assert plan["renames"] == {P_STAGE_V1: P_STAGE_V2}, "同 slug 后继自动配对为 rename"
        assert P_LEGACY in plan["drops"]["props"], "无后继的真删除归入 drops"
        assert plan["drops"]["policy"] == "preserve", "默认不丢数据"

    def test_counts_match_seeded_data(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_STAGE_V1, P_LEGACY),
            (P_ID, P_STAGE_V2),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_LEGACY: "y", P_STAGE_V1: "s"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
        assert a["counts"]["dangling"].get(P_LEGACY) == 2
        assert a["counts"]["dangling"].get(P_STAGE_V1) == 1
        assert a["counts"]["instances_affected"] == 2

    def test_format_counts_split_coercible_and_kept(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_AMT),
            (P_ID, P_AMT),
            v2_fmts={P_AMT: "integer"},
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_AMT: "123"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_AMT: "abc"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
        assert a["counts"]["format_coercible"].get(P_AMT) == 1
        assert a["counts"]["format_kept"].get(P_AMT) == 1

    def test_pk_conflicts_and_missing_detected(self, repo) -> None:
        # v1 主键 did；v2 主键换成 code，两条实例 code 相同 → 冲突；一条缺 code → 缺失
        _publish_v1_then_v2(
            repo,
            (P_ID, P_CODE),
            (P_CODE, P_ID),
            v2_pk=(P_CODE,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_CODE: "c1"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_CODE: "c1"}))
            repo.create_individual(_ind("d3", OBJ_V1, {P_ID: "d3"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
        assert a["counts"]["pk_conflicts"] >= 1
        assert a["counts"]["pk_missing"] == 1
        assert a["plan"]["pk_rederive"]["new_pk"] == [P_CODE]

    def test_assess_with_target_payload_previews_draft(self, repo) -> None:
        """草稿预演：live 不动，评估按草稿目标定义给存量影响（发布前可见）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ_V1, (P_ID, P_LEGACY), name="deal v1"))
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))
            draft = _ot(OBJ_V1, (P_ID,), name="deal draft")  # 草稿：删 legacy
            a = repo.assess_migration(ClassRef(OBJ_V1), target=draft)
            live = repo.get_object_type(ClassRef(OBJ_V1))
        assert a["counts"]["dangling"].get(P_LEGACY) == 1, "草稿目标的影响发布前可见"
        assert a["changes"], "破坏性差异按草稿目标判定"
        assert {p.rid.rid for p in live.properties} == {P_ID, P_LEGACY}, "live 未动（评估只读）"

    def test_assess_is_read_only(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_LEGACY),
            (P_ID,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))
            before = _sql(
                "SELECT props FROM ont_individual WHERE rid=%s", (f"ont.{T}.ind.{SLUG}.d1",)
            )
            a = repo.assess_migration(ClassRef(OBJ_V1))
            runs = repo.list_migration_runs(ClassRef(OBJ_V1))
        assert a["counts"]["dangling"].get(P_LEGACY) == 1
        assert runs == [], "评估只读，不产生迁移记录"
        after = _sql("SELECT props FROM ont_individual WHERE rid=%s", (f"ont.{T}.ind.{SLUG}.d1",))
        assert before == after, "评估不得改动数据"


# ────────────────────────────────────────────────────────────────────
# §4 run rename：四处重映射
# ────────────────────────────────────────────────────────────────────


class TestRunRename:
    def test_rename_remaps_props_props_src_overlay_and_field_mapping(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_STAGE_V1),
            (P_ID, P_STAGE_V2),
        )
        rid = f"ont.{T}.ind.{SLUG}.d1"
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_STAGE_V1: "s1"}))
            repo.upsert_backing_datasource(
                {
                    "tenant_id": T,
                    "class_rid": OBJ_V1,
                    "name": "src",
                    "table": "t_src",
                    "pk_column": "id",
                    "field_mapping": {P_STAGE_V1: "stage"},
                }
            )
            a = repo.assess_migration(ClassRef(OBJ_V1))
        # 种子 props_src / overlay（管道与回写覆盖层的旧键）
        _sql(
            "UPDATE ont_individual SET props_src=%s::jsonb WHERE rid=%s",
            (f'{{"{P_STAGE_V1}": {{"prio": 50, "src": "pipe"}}}}', rid),
        )
        _sql(
            "INSERT INTO ont_edit_overlay (individual_rid, property_rid, tenant_id) "
            "VALUES (%s, %s, %s)",
            (rid, P_STAGE_V1, T),
        )
        with repo.tenant_scope(T):
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-ren-1",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["renamed"][P_STAGE_V1]["props"] >= 1
        props, props_src = _sql("SELECT props, props_src FROM ont_individual WHERE rid=%s", (rid,))[
            0
        ]
        assert P_STAGE_V1 not in props and props.get(P_STAGE_V2) == "s1"
        assert P_STAGE_V1 not in props_src and P_STAGE_V2 in props_src
        overlay = _sql("SELECT property_rid FROM ont_edit_overlay WHERE individual_rid=%s", (rid,))
        assert [r[0] for r in overlay] == [P_STAGE_V2]
        fm = _sql("SELECT field_mapping FROM ont_backing_datasource WHERE tenant_id=%s", (T,))
        keys = set(fm[0][0].keys()) if fm else set()
        assert P_STAGE_V1 not in keys and P_STAGE_V2 in keys


# ────────────────────────────────────────────────────────────────────
# §5/§6 run drop / coerce
# ────────────────────────────────────────────────────────────────────


class TestRunDropAndCoerce:
    def test_drop_preserves_by_default(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_LEGACY),
            (P_ID,),
        )
        rid = f"ont.{T}.ind.{SLUG}.d1"
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-drop-1",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["preserved"].get(P_LEGACY) == 1
        props = _sql("SELECT props FROM ont_individual WHERE rid=%s", (rid,))[0][0]
        assert props.get(P_LEGACY) == "x", "默认 preserve：键保留"

    def test_explicit_drop_removes_keys(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_LEGACY),
            (P_ID,),
        )
        rid = f"ont.{T}.ind.{SLUG}.d1"
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
            plan = {**a["plan"], "drops": {"policy": "drop", "props": [P_LEGACY]}}
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                plan,
                author="alice",
                idempotency_key="mig-drop-2",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["dropped"].get(P_LEGACY) == 1
        props = _sql("SELECT props FROM ont_individual WHERE rid=%s", (rid,))[0][0]
        assert P_LEGACY not in props

    def test_coerce_lossless_only(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_AMT),
            (P_ID, P_AMT),
            v2_fmts={P_AMT: "integer"},
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_AMT: "123"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_AMT: "abc"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-coe-1",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["coerced"].get(P_AMT) == 1
        assert out["counts"]["coerce_kept"].get(P_AMT) == 1
        v1 = _sql(
            "SELECT props->%s FROM ont_individual WHERE rid=%s",
            (P_AMT, f"ont.{T}.ind.{SLUG}.d1"),
        )[0][0]
        v2 = _sql(
            "SELECT props->%s FROM ont_individual WHERE rid=%s",
            (P_AMT, f"ont.{T}.ind.{SLUG}.d2"),
        )[0][0]
        assert v1 == 123, "可无损转换的值必须被转换（JSON number）"
        assert v2 == "abc", "不可无损转换的值保留原样"


# ────────────────────────────────────────────────────────────────────
# §7 run PK 重派生
# ────────────────────────────────────────────────────────────────────


class TestRunPkRederive:
    def _seed(self, repo) -> dict:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_CODE),
            (P_CODE, P_ID),
            v2_pk=(P_CODE,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_CODE: "c1"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_CODE: "c2"}))
            # 关系实例挂在 d1 的旧 rid 上
            _lnk_rid = f"ont.{T}.lnk.rel.1"
            _sql(
                "INSERT INTO ont_link_instance (rid, tenant_id, link_type_rid, src, dst, "
                "props, marking, created_at) VALUES (%s,%s,%s,%s,%s,'{}'::jsonb,'{}',now())",
                (
                    _lnk_rid,
                    T,
                    f"ont.{T}.lnk.rel.v1",
                    f"ont.{T}.ind.{SLUG}.d1",
                    f"ont.{T}.ind.{SLUG}.d2",
                ),
            )
            a = repo.assess_migration(ClassRef(OBJ_V1))
        return a

    def test_rederive_rewrites_rids_and_links(self, repo) -> None:
        a = self._seed(repo)
        with repo.tenant_scope(T):
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-pk-1",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["pk_rederived"] == 2
        assert out["counts"]["links_rewritten"] == 2, "src/dst 各改写一次（端点计数）"
        rids = {r[0] for r in _sql("SELECT rid FROM ont_individual WHERE tenant_id=%s", (T,))}
        assert rids == {f"ont.{T}.ind.{SLUG}.c1", f"ont.{T}.ind.{SLUG}.c2"}, "rid 按新主键重派生"
        links = _sql("SELECT src, dst FROM ont_link_instance WHERE tenant_id=%s", (T,))
        assert links and links[0][0] == f"ont.{T}.ind.{SLUG}.c1", "link src 同步改写"
        pks = {
            r[0] for r in _sql("SELECT primary_key FROM ont_individual WHERE tenant_id=%s", (T,))
        }
        assert pks == {"c1", "c2"}

    def test_conflict_aborts_without_partial_writes(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_CODE),
            (P_CODE, P_ID),
            v2_pk=(P_CODE,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_CODE: "c1"}))
            repo.create_individual(_ind("d2", OBJ_V1, {P_ID: "d2", P_CODE: "c1"}))  # 撞
            a = repo.assess_migration(ClassRef(OBJ_V1))
            with pytest.raises(Exception) as ei:
                repo.run_migration(
                    ClassRef(OBJ_V1),
                    a["plan"],
                    author="alice",
                    idempotency_key="mig-pk-conflict",
                    expected_checksum=a["to_checksum"],
                )
        assert "conflict" in str(ei.value).lower()
        rids = {r[0] for r in _sql("SELECT rid FROM ont_individual WHERE tenant_id=%s", (T,))}
        assert rids == {f"ont.{T}.ind.{SLUG}.d1", f"ont.{T}.ind.{SLUG}.d2"}, (
            "fail-closed：冲突时一条都不改（无部分写）"
        )

    def test_missing_pk_skip_option_reports(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_CODE),
            (P_CODE, P_ID),
            v2_pk=(P_CODE,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_CODE: "c1"}))
            repo.create_individual(_ind("d3", OBJ_V1, {P_ID: "d3"}))  # 缺 code
            a = repo.assess_migration(ClassRef(OBJ_V1), options={"pk_missing": "skip"})
            out = repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-pk-skip",
                expected_checksum=a["to_checksum"],
            )
        assert out["counts"]["pk_rederived"] == 1
        assert out["counts"].get("pk_skipped") and len(out["counts"]["pk_skipped"]) == 1
        rids = {r[0] for r in _sql("SELECT rid FROM ont_individual WHERE tenant_id=%s", (T,))}
        assert f"ont.{T}.ind.{SLUG}.d3" in rids, "skip 的实例保持原 rid 不动"


# ────────────────────────────────────────────────────────────────────
# §8~§10 幂等 / 守卫 / 租户（API 面）
# ────────────────────────────────────────────────────────────────────


class TestIdempotencyAndGuards:
    def _api_base(self) -> str:
        return f"/api/v1/ont/v2/object-types/{OBJ_V1}/migration"

    def _seed_destructive(self, repo) -> None:
        _publish_v1_then_v2(
            repo,
            (P_ID, P_LEGACY),
            (P_ID,),
        )
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_LEGACY: "x"}))

    def test_same_idempotency_key_replays_original_result(self, repo, client) -> None:
        self._seed_destructive(repo)
        a = client.post(f"{self._api_base()}/assess").json()
        body = {"plan": a["plan"], "expected_checksum": a["to_checksum"]}
        r1 = client.post(
            f"{self._api_base()}/run",
            json=body,
            headers={"Idempotency-Key": "api-mig-1"},
        )
        assert r1.status_code == 200, r1.text
        r2 = client.post(
            f"{self._api_base()}/run",
            json=body,
            headers={"Idempotency-Key": "api-mig-1"},
        )
        assert r2.status_code == 200, r2.text
        assert r1.json()["run_id"] == r2.json()["run_id"], "同键回放原 run"
        assert r2.json().get("replayed") is True
        runs = client.get(f"{self._api_base()}/runs").json()
        replay_runs = [r for r in runs if r["idempotency_key"] == "api-mig-1"]
        assert len(replay_runs) == 1, "同键不重复执行"

    def test_missing_idempotency_key_rejected(self, repo, client) -> None:
        self._seed_destructive(repo)
        a = client.post(f"{self._api_base()}/assess").json()
        r = client.post(
            f"{self._api_base()}/run",
            json={"plan": a["plan"], "expected_checksum": a["to_checksum"]},
        )
        assert r.status_code == 400

    def test_checksum_drift_rejected_409(self, repo, client) -> None:
        self._seed_destructive(repo)
        a = client.post(f"{self._api_base()}/assess").json()
        # 评估后模型又变了（live 漂移）
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(OBJ_V1, (P_ID,), name="deal v3"))
        r = client.post(
            f"{self._api_base()}/run",
            json={"plan": a["plan"], "expected_checksum": a["to_checksum"]},
            headers={"Idempotency-Key": "api-mig-drift"},
        )
        assert r.status_code == 409
        assert "E409_VERSION_CONFLICT" in r.text

    def test_cross_tenant_denied(self, repo, client) -> None:
        other = f"ont.other.obj.crm.{SLUG}.v1"
        r1 = client.post(f"/api/v1/ont/v2/object-types/{other}/migration/assess")
        r2 = client.post(
            f"/api/v1/ont/v2/object-types/{other}/migration/run",
            json={"plan": {}, "expected_checksum": ""},
            headers={"Idempotency-Key": "api-mig-x"},
        )
        assert r1.status_code == 403
        assert r2.status_code == 403

    def test_runs_list_is_tenant_scoped(self, repo) -> None:
        self._seed_destructive(repo)
        with repo.tenant_scope(T):
            a = repo.assess_migration(ClassRef(OBJ_V1))
            repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-scope-1",
                expected_checksum=a["to_checksum"],
            )
            runs = repo.list_migration_runs(ClassRef(OBJ_V1))
        assert len(runs) == 1 and runs[0]["tenant_id"] == T
        other_rows = _sql("SELECT count(*) FROM ont_migration_run WHERE tenant_id=%s", ("other",))
        assert other_rows[0][0] == 0


# ────────────────────────────────────────────────────────────────────
# §11 迁移后回滚边界
# ────────────────────────────────────────────────────────────────────


class TestRollbackBoundary:
    def test_rollback_after_migration_keeps_migrated_data(self, repo) -> None:
        """模型回滚仍只动模型；数据保持迁移后形态（ADR-0080 §2.6 口径不变）。"""
        _publish_v1_then_v2(
            repo,
            (P_ID, P_STAGE_V1),
            (P_ID, P_STAGE_V2),
        )
        rid = f"ont.{T}.ind.{SLUG}.d1"
        with repo.tenant_scope(T):
            repo.create_individual(_ind("d1", OBJ_V1, {P_ID: "d1", P_STAGE_V1: "s1"}))
            a = repo.assess_migration(ClassRef(OBJ_V1))
            repo.run_migration(
                ClassRef(OBJ_V1),
                a["plan"],
                author="alice",
                idempotency_key="mig-rb-1",
                expected_checksum=a["to_checksum"],
            )
            # 回滚到上一版快照（v1 定义）
            versions = repo.list_versions(ClassRef(OBJ_V1))
            prev = [v for v in versions if v.checksum == a["from_checksum"]][0]
            repo.rollback_object_type(ClassRef(OBJ_V1), ClassRef(prev.rid))
            live = repo.get_object_type(ClassRef(OBJ_V1))
        assert {p.rid.rid for p in live.properties} == {P_ID, P_STAGE_V1}, "模型回到 v1"
        props = _sql("SELECT props FROM ont_individual WHERE rid=%s", (rid,))[0][0]
        assert P_STAGE_V2 in props and P_STAGE_V1 not in props, (
            "数据保持迁移后形态（回滚不回滚数据，边界如实）"
        )
        with repo.tenant_scope(T):
            runs = repo.list_migration_runs(ClassRef(OBJ_V1))
        assert len(runs) == 1, "迁移记录跨回滚保留（链条可追溯）"
