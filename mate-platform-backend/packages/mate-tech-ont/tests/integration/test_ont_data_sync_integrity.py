"""DATA-SYNC-INTEGRITY —— 源→本体同步不丢行、不丢更新、不静默成功的验收套件。

≥12,000 行源数据；逐主键、逐字段对账。覆盖：
1. **分页**：单批 LIMIT 之后必须继续读，直到源穷尽（keyset，不是 OFFSET）。
2. **水位**：只能推进到「已可靠处理的源端边界」，不得写成目标端 ``now()``；
   同时间戳靠 pk 决胜；同步期间新增取「源端 ts > 边界」。
3. **失败**：单行失败可追踪、不静默放行；重跑（水位未越过失败点）可重试补齐。
4. **多源优先级跨批次**：低优先级源的增量不得覆盖高优先级源已写的字段值。
5. **字段语义**：字段缺失（列不在/无值）→ 保持；显式 NULL → 清空；
   用户编辑覆盖层 → 管道不覆盖。

真库门控：源表建在独立测试库（``metaplatform_ont_test``）的专用租户下。
"""

from __future__ import annotations

import os
import sys
from typing import Any

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_tech_ont.v2_kernel.backing_datasources import (
    BackingDatasource,
    sync_backing_datasource,
)

PG_DSN = os.getenv("SYNC_IT_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "syncint"
OBJ = f"ont.{T}.obj.crm.customer.v1"
P_ID = f"ont.{T}.prop.cid.v1"
P_NAME = f"ont.{T}.prop.cname.v1"
P_CITY = f"ont.{T}.prop.ccity.v1"
P_SCORE = f"ont.{T}.prop.cscore.v1"
SRC_CRM = "src_syncint_crm"
SRC_ERP = "src_syncint_erp"

TOTAL = 12300  # ≥ 12,000
BASE_TS = "2026-09-01 00:00:00+00"


def _pg() -> Any:
    import psycopg2

    return psycopg2.connect(PG_DSN)


def _available() -> bool:
    try:
        c = _pg()
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _available(), reason=f"PG not reachable at {PG_DSN!r}")


def _prop(rid: str, fmt: PropertyFormat, *, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id=fmt.value,
        nullable=not pk,
        primary_key=pk,
        title=rid.split(".")[-2],
        format=fmt,
    )


def _object_type() -> ObjectType:
    return ObjectType(
        rid=ClassRef(OBJ),
        primary_key=(ClassRef(P_ID),),
        properties=(
            _prop(P_ID, PropertyFormat.STRING, pk=True),
            _prop(P_NAME, PropertyFormat.STRING),
            _prop(P_CITY, PropertyFormat.STRING),
            _prop(P_SCORE, PropertyFormat.INTEGER),
        ),
        display_name="customer",
    )


@pytest.fixture(scope="module")
def repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    os.environ["ONT_SOURCE_DSN"] = PG_DSN
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {SRC_CRM}")
            cur.execute(f"DROP TABLE IF EXISTS {SRC_ERP}")
            # CRM(priority 10)：12,300 行，**同一 updated_at**（同时间戳压力）
            cur.execute(
                f"CREATE TABLE {SRC_CRM} ("
                "cid TEXT PRIMARY KEY, cname TEXT, ccity TEXT, cscore INT, updated_at TIMESTAMPTZ)"
            )
            cur.execute(
                f"INSERT INTO {SRC_CRM} SELECT 'k'||lpad(i::text,6,'0'), "
                f"'crm-name-'||i, 'crm-city-'||i, i, TIMESTAMPTZ '{BASE_TS}' "
                f"FROM generate_series(1,{TOTAL}) i"
            )
            # ERP(priority 20)：前 500 行同名/同城冲突 + 冲突 score（不得覆盖 CRM）
            cur.execute(
                f"CREATE TABLE {SRC_ERP} (cid TEXT PRIMARY KEY, cname TEXT, ccity TEXT, "
                "cscore INT, updated_at TIMESTAMPTZ)"
            )
            cur.execute(
                f"INSERT INTO {SRC_ERP} SELECT 'k'||lpad(i::text,6,'0'), "
                f"'erp-name-'||i, 'erp-city-'||i, 9999, TIMESTAMPTZ '{BASE_TS}' "
                f"FROM generate_series(1,500) i"
            )
        conn.commit()
    finally:
        conn.close()
    with r.tenant_scope(T):
        r.upsert_object_type(_object_type())
        r.upsert_backing_datasource(
            {
                "class_rid": OBJ,
                "name": "crm",
                "table": SRC_CRM,
                "pk_column": "cid",
                "field_mapping": {P_ID: "cid", P_NAME: "cname", P_CITY: "ccity", P_SCORE: "cscore"},
                "priority": 10,
                "tenant_id": T,
                "ts_column": "updated_at",
            }
        )
        r.upsert_backing_datasource(
            {
                "class_rid": OBJ,
                "name": "erp",
                "table": SRC_ERP,
                "pk_column": "cid",
                "field_mapping": {P_ID: "cid", P_NAME: "cname", P_CITY: "ccity", P_SCORE: "cscore"},
                "priority": 20,
                "tenant_id": T,
                "ts_column": "updated_at",
            }
        )
    yield r
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {SRC_CRM}")
            cur.execute(f"DROP TABLE IF EXISTS {SRC_ERP}")
            for tbl in (
                "ont_individual",
                "ont_object_type",
                "ont_backing_datasource",
                "ont_edit_overlay",
                "ont_proposal",
                "ont_axiom",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


def _reset_source_dirty() -> None:
    """把 CRM 的 updated_at 复位到基准（每个用例起点一致）。"""
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {SRC_CRM} SET updated_at = TIMESTAMPTZ '{BASE_TS}'")
            cur.execute(f"UPDATE {SRC_ERP} SET updated_at = TIMESTAMPTZ '{BASE_TS}'")
        conn.commit()
    finally:
        conn.close()


def _wipe_individuals(repo) -> None:
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_individual WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


def _reconcile(repo) -> dict[str, dict[str, Any]]:
    """本体当前状态：{pk: {prop_rid: value}}（逐字段对账用）。"""
    with repo.tenant_scope(T):
        inds = repo.list_individuals(ClassRef(OBJ), tenant_id=T)
    out: dict[str, dict[str, Any]] = {}
    for i in inds:
        row: dict[str, Any] = {}
        for k, v in i.props:
            rid = getattr(k, "rid", k)
            row[str(getattr(rid, "rid", rid))] = v
        out[i.primary_key] = row
    return out


def _pk(i: int) -> str:
    return f"k{i:06d}"


class _FlakyRepo:
    """委托给真实 repo；按需注入「单行失败」或「进程中断」两种写失败。"""

    def __init__(self, inner, *, fail_pk: str | None = None, fail_after_batches: int | None = None):
        self._inner = inner
        self._fail_pk = fail_pk
        self._fail_after = fail_after_batches
        self._batches = 0

    def __getattr__(self, name):  # 只对未定义属性触发
        return getattr(self._inner, name)

    def _is_interrupted(self) -> bool:
        return self._fail_after is not None and self._batches > self._fail_after

    def upsert_sourced_props_batch(self, items, **kw):
        self._batches += 1
        if self._is_interrupted():
            raise RuntimeError("simulated interruption")
        if self._fail_pk is not None and any(i["primary_key"] == self._fail_pk for i in items):
            raise RuntimeError(f"simulated row failure: {self._fail_pk}")
        return self._inner.upsert_sourced_props_batch(items, **kw)

    def upsert_sourced_props(self, **kw):
        if self._is_interrupted():
            raise RuntimeError("simulated interruption")
        if self._fail_pk is not None and kw.get("primary_key") == self._fail_pk:
            raise RuntimeError(f"simulated row failure: {self._fail_pk}")
        return self._inner.upsert_sourced_props(**kw)


def _declared_sources(repo) -> list[BackingDatasource]:
    with repo.tenant_scope(T):
        decls = repo.list_backing_datasources(OBJ)
    return [
        BackingDatasource(
            name=d["name"],
            kind=d["kind"],
            dsn_env=d["dsn_env"],
            table=d["table_name"],
            pk_column=d["pk_column"],
            field_mapping=dict(d["field_mapping"]),
            priority=int(d["priority"]),
        )
        for d in decls
    ]


class TestSyncIntegrity:
    """逐主键、逐字段对账；每例自行清场，互不影响。"""

    def test_full_sync_paginates_beyond_single_batch(self, repo) -> None:
        """单批 LIMIT 后必须继续读：12,300 行 / batch 1000 全部落库且逐字段一致。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            res = repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=1000)
        assert res["total_failed"] == 0, res
        rows = _reconcile(repo)
        assert len(rows) == TOTAL, f"漏行：{len(rows)} != {TOTAL}"
        for i in (1, 999, 1000, 1001, TOTAL):
            assert rows[_pk(i)][P_NAME] == f"crm-name-{i}"
            assert rows[_pk(i)][P_CITY] == f"crm-city-{i}"
            assert int(rows[_pk(i)][P_SCORE]) == i
        # 多源优先级：erp 的 9999 不得覆盖 crm 的 i
        assert int(rows[_pk(1)][P_SCORE]) == 1

    def test_same_timestamp_rows_are_not_skipped(self, repo) -> None:
        """同时间戳：水位落在 BASE_TS 且 pk 已过半时，其余同 ts 行仍能被增量读到。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            repo.upsert_backing_datasource(
                {
                    "class_rid": OBJ,
                    "name": "crm",
                    "table": SRC_CRM,
                    "pk_column": "cid",
                    "field_mapping": {
                        P_ID: "cid",
                        P_NAME: "cname",
                        P_CITY: "ccity",
                        P_SCORE: "cscore",
                    },
                    "priority": 10,
                    "tenant_id": T,
                    "ts_column": "updated_at",
                    # 人为把水位钉在「同 ts、pk 过半」的位置
                    "last_synced_at": BASE_TS,
                    "last_synced_pk": _pk(600),
                }
            )
            res = repo.sync_backing_datasources(OBJ, incremental=True, batch_limit=1000)
        assert res["total_failed"] == 0, res
        rows = _reconcile(repo)
        # pk > _pk(600) 的同 ts 行必须全部补上（不得因 ts 相等被 ">" 漏掉）
        assert _pk(601) in rows and _pk(TOTAL) in rows, "同时间戳行被跳过"
        assert len(rows) == TOTAL - 600, f"应为 {TOTAL - 600}，实得 {len(rows)}"

    def test_incremental_rerun_picks_up_changes_only(self, repo) -> None:
        """增量重跑：只读到本次变更行；未变行不被重写（updated_at 不变）。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=2000)
            before = {k: dict(v) for k, v in _reconcile(repo).items()}
            # 只改 3 行（含同 ts 的两行）
            conn = _pg()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE {SRC_CRM} SET cname='crm-changed-7', "
                        f"updated_at=TIMESTAMPTZ '2026-09-02 00:00:00+00' WHERE cid=%s",
                        (_pk(7),),
                    )
                    cur.execute(
                        f"UPDATE {SRC_CRM} SET cname='crm-changed-8', "
                        f"updated_at=TIMESTAMPTZ '2026-09-02 00:00:00+00' WHERE cid=%s",
                        (_pk(8),),
                    )
                conn.commit()
            finally:
                conn.close()
            res = repo.sync_backing_datasources(OBJ, incremental=True, batch_limit=1000)
            assert res["total_failed"] == 0, res
            after = _reconcile(repo)
        assert after[_pk(7)][P_NAME] == "crm-changed-7"
        assert after[_pk(8)][P_NAME] == "crm-changed-8"
        # 其余行未被触碰
        assert after[_pk(9)][P_NAME] == before[_pk(9)][P_NAME]

    def test_multisource_priority_holds_across_batches(self, repo) -> None:
        """跨批次优先级：erp 低优先级增量**不得**覆盖 crm 已写字段。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=2000)
            first = _reconcile(repo)
            assert first[_pk(3)][P_NAME] == "crm-name-3"
            # 只有 ERP（priority 20）有更新；CRM（priority 10）本次无行
            conn = _pg()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE {SRC_ERP} SET cname='erp-newer-3', cscore=7777, "
                        f"updated_at=TIMESTAMPTZ '2026-09-03 00:00:00+00' WHERE cid=%s",
                        (_pk(3),),
                    )
                conn.commit()
            finally:
                conn.close()
            repo.sync_backing_datasources(OBJ, incremental=True, batch_limit=1000)
            after = _reconcile(repo)
        assert after[_pk(3)][P_NAME] == "crm-name-3", "低优先级增量覆盖了高优先级值"
        assert int(after[_pk(3)][P_SCORE]) == 3, "低优先级增量覆盖了高优先级值"

    def test_explicit_null_clears_but_missing_column_keeps(self, repo) -> None:
        """字段语义：显式 NULL 清空；列缺失/无值保持原值。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=2000)
            assert _reconcile(repo)[_pk(5)][P_CITY] == "crm-city-5"
            conn = _pg()
            try:
                with conn.cursor() as cur:
                    # 显式置 NULL（清空意图）+ 提升 ts 使其进入增量
                    cur.execute(
                        f"UPDATE {SRC_CRM} SET ccity=NULL, "
                        f"updated_at=TIMESTAMPTZ '2026-09-04 00:00:00+00' WHERE cid=%s",
                        (_pk(5),),
                    )
                conn.commit()
            finally:
                conn.close()
            repo.sync_backing_datasources(OBJ, incremental=True, batch_limit=1000)
            after = _reconcile(repo)
        assert after[_pk(5)][P_CITY] is None, "显式 NULL 未清空字段"
        assert after[_pk(6)][P_CITY] == "crm-city-6", "缺失列不应清空"

    def test_user_edit_overlay_is_not_overwritten(self, repo) -> None:
        """双流合并：用户编辑过的属性，管道增量不得覆盖。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        conn = _pg()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO ont_edit_overlay (individual_rid, property_rid, tenant_id) "
                    "VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                    (f"ont.{T}.ind.customer.{_pk(11)}", P_NAME, T),
                )
            conn.commit()
        finally:
            conn.close()
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=2000)
            after = _reconcile(repo)
        assert P_NAME not in after[_pk(11)], "用户编辑覆盖层被管道覆盖"
        assert after[_pk(11)][P_CITY] == "crm-city-11"

    def test_single_row_failure_is_recorded_not_silently_successful(self, repo) -> None:
        """单行失败：登记 failures、不报整体成功、游标停在失败点前；重跑补齐。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        target = _pk(1000)
        with repo.tenant_scope(T):
            ot = repo.get_object_type(ClassRef(OBJ))
            sources = _declared_sources(repo)[:1]  # 仅 crm(priority 10)
            res = sync_backing_datasource(
                _FlakyRepo(repo, fail_pk=target),
                ot,
                sources,
                batch_limit=1000,
                incremental=False,
            )
            r = res["crm"]
            assert r["failed"] == 1, r
            assert r["failures"][0]["pk"] == target
            # 失败点之前 999 行已落库；游标**不得越过**失败点
            assert r["synced"] == 999, r
            assert r["cursor"]["pk"] == _pk(999), r["cursor"]
            assert target not in _reconcile(repo), "失败行不得静默落库"
            # 重跑：传回游标即从失败点续（真实 repo，不再注入失败）
            res2 = sync_backing_datasource(
                repo,
                ot,
                sources,
                incremental=True,
                cursors={"crm": r["cursor"]},
                batch_limit=1000,
            )
            assert res2["crm"]["failed"] == 0, res2
        rows = _reconcile(repo)
        assert len(rows) == TOTAL, f"重跑后仍漏行：{len(rows)}"
        assert rows[target][P_NAME] == "crm-name-1000"

    def test_interrupted_run_resumes_without_loss(self, repo) -> None:
        """进程中断：已提交部分 + 游标停在中断点；续跑补齐，无漏行。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            ot = repo.get_object_type(ClassRef(OBJ))
            sources = _declared_sources(repo)[:1]
            res = sync_backing_datasource(
                _FlakyRepo(repo, fail_after_batches=1),  # 第 2 个 chunk 起中断
                ot,
                sources,
                batch_limit=2000,
                incremental=False,
            )
            r = res["crm"]
            assert r["failed"] >= 1 and r["synced"] == 250, r
            assert r["cursor"]["pk"] == _pk(250), r["cursor"]
            res2 = sync_backing_datasource(
                repo,
                ot,
                sources,
                incremental=True,
                cursors={"crm": r["cursor"]},
                batch_limit=2000,
            )
            assert res2["crm"]["failed"] == 0, res2
        rows = _reconcile(repo)
        assert len(rows) == TOTAL, f"续跑后漏行：{len(rows)}"
        assert rows[_pk(1)][P_NAME] == "crm-name-1"
        assert rows[_pk(TOTAL)][P_NAME] == f"crm-name-{TOTAL}"

    def test_delete_event_and_full_tombstone(self, repo) -> None:
        """删除语义：CDC op=delete 删实例；全量 tombstone 删源端已消失行。"""
        _wipe_individuals(repo)
        _reset_source_dirty()
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ, incremental=False, batch_limit=2000)
            out = repo.apply_cdc_changes(OBJ, [{"op": "delete", "pk": _pk(7)}])
            assert out["deleted"] == 1 and out["failed"] == 0, out
            with pytest.raises(KeyError):
                repo.get_individual(f"ont.{T}.ind.customer.{_pk(7)}")
            # 源端删行 → 全量 tombstone
            conn = _pg()
            try:
                with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM {SRC_CRM} WHERE cid=%s", (_pk(8),))
                    cur.execute(f"DELETE FROM {SRC_ERP} WHERE cid=%s", (_pk(8),))
                conn.commit()
            finally:
                conn.close()
            res = repo.sync_backing_datasources(
                OBJ, incremental=False, batch_limit=2000, delete_missing=True
            )
            assert res["total_deleted"] >= 1, res
            with pytest.raises(KeyError):
                repo.get_individual(f"ont.{T}.ind.customer.{_pk(8)}")
        # 还原被删的源行（避免影响后续/重复运行）
        conn = _pg()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SRC_CRM} (cid, cname, ccity, cscore, updated_at) "
                    f"VALUES (%s,%s,%s,%s,TIMESTAMPTZ '{BASE_TS}') ON CONFLICT DO NOTHING",
                    (_pk(8), "crm-name-8", "crm-city-8", 8),
                )
                cur.execute(
                    f"INSERT INTO {SRC_ERP} (cid, cname, ccity, cscore, updated_at) "
                    f"VALUES (%s,%s,%s,%s,TIMESTAMPTZ '{BASE_TS}') ON CONFLICT DO NOTHING",
                    (_pk(8), "erp-name-8", "erp-city-8", 9999),
                )
            conn.commit()
        finally:
            conn.close()
