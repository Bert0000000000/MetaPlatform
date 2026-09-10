"""CDC 腿 + writeback 双流合并 —— 用户编辑覆盖层 / 增量水位 / CDC 事件入口。

真库门控场景（DATA 后续批核心语义，Palantir「管道数据 + 用户编辑合并」）：
1. 用户经 edit-set 改属性 → 重同步**不覆盖**（用户编辑赢）；
2. 未编辑属性随源表更新（管道流照常）；
3. 增量：水位推进，无变化 → 0；变化 → 命中变化行；
4. CDC 入口：upsert 尊重覆盖层 / insert / delete（级联清理）。
"""
from __future__ import annotations

import os
import sys

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.action_type import ActionType  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402

T = "cdctest"
PG_DSN = os.environ.get(
    "CDC_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)
OBJ = f"ont.{T}.obj.crm.account.v1"
P_ID = f"ont.{T}.prop.aid.v1"
P_NAME = f"ont.{T}.prop.aname.v1"
P_TIER = f"ont.{T}.prop.atier.v1"
ACT = f"ont.{T}.act.crm.rename-account.v1"
SRC = f"src_{T}_accounts"


@pytest.fixture(scope="module")
def repo():
    pytest.importorskip("psycopg2")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    try:
        r._ensure_schema()
    except Exception as e:
        pytest.skip(f"PG unavailable: {e}")
    os.environ["ONT_SOURCE_DSN"] = PG_DSN
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {SRC}")
        cur.execute(
            f"CREATE TABLE {SRC} ("
            f" aid TEXT PRIMARY KEY, aname TEXT, atier TEXT,"
            f" updated_at TIMESTAMPTZ NOT NULL DEFAULT now())")
        cur.execute(
            f"INSERT INTO {SRC} (aid, aname, atier) VALUES "
            f"('a1', 'pipeline-name-1', 'gold'), ('a2', 'pipeline-name-2', 'silver')")
    conn.commit()
    conn.close()
    with r.tenant_scope(T):
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(ClassRef(P_ID),),
            properties=(
                Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                         primary_key=True, title="id", format=PropertyFormat.STRING),
                Property(rid=ClassRef(P_NAME), type_id="string", nullable=True,
                         primary_key=False, title="name", format=PropertyFormat.STRING),
                Property(rid=ClassRef(P_TIER), type_id="string", nullable=True,
                         primary_key=False, title="tier", format=PropertyFormat.STRING),
            ),
            display_name="account",
        ))
        r.upsert_action_type(ActionType(
            rid=ClassRef(ACT), parameters=(), submission_criteria=(),
            side_effects=(), function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
            on=(ClassRef(OBJ),), title="Rename Account",
        ))
        r.upsert_backing_datasource({
            "class_rid": OBJ, "name": "crm", "table": SRC, "pk_column": "aid",
            "field_mapping": {P_ID: "aid", P_NAME: "aname", P_TIER: "atier"},
            "priority": 10, "tenant_id": T,
        })
    yield r
    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {SRC}")
        for tbl in ("ont_individual", "ont_object_type", "ont_axiom",
                    "ont_action_type", "ont_backing_datasource",
                    "ont_edit_overlay", "ont_proposal", "ont_proposal_event",
                    "ont_proposal_execution", "ont_proposal_idempotency",
                    "ont_action_audit", "ont_outbox_event"):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
    conn.commit()
    conn.close()


class TestDualStreamMerge:
    def test_user_edit_surveys_resync(self, repo) -> None:
        with repo.tenant_scope(T):
            # 首次全量
            stats = repo.sync_backing_datasources(OBJ)
            assert stats == {"crm": 2}
            # 用户编辑 a1 的 aname
            repo.apply_edit_set_now(
                ACT, f"ont.{T}.ind.account.a1", {},
                [{"op": "set_property", "target": f"ont.{T}.ind.account.a1",
                  "property_rid": P_NAME, "value": "user-edited-name"}],
                actor="sales-1",
            )
            # 源表变化（aname + atier 都改）
            import psycopg2

            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SRC} SET aname='pipeline-new-name', atier='bronze', "
                    f"updated_at=now() WHERE aid='a1'")
            conn.commit()
            conn.close()
            # 重同步
            repo.sync_backing_datasources(OBJ)
            ind = repo.get_individual(f"ont.{T}.ind.account.a1")
            # 用户编辑赢（覆盖层保护）；未编辑属性随管道更新
            assert ind.get(ClassRef(P_NAME)) == "user-edited-name"
            assert ind.get(ClassRef(P_TIER)) == "bronze"

    def test_incremental_watermark(self, repo) -> None:
        import psycopg2

        with repo.tenant_scope(T):
            # 第一次增量：建立水位
            repo.sync_backing_datasources(OBJ, incremental=True)
            # 无变化 → 第二次增量同步 0 行
            stats = repo.sync_backing_datasources(OBJ, incremental=True)
            assert stats == {"crm": 0}
            # 新增一行（fresh ts）→ 只命中它
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SRC} (aid, aname, atier) "
                    f"VALUES ('a3', 'pipeline-name-3', 'gold')")
            conn.commit()
            conn.close()
            stats2 = repo.sync_backing_datasources(OBJ, incremental=True)
            assert stats2 == {"crm": 1}
            assert repo.get_individual(f"ont.{T}.ind.account.a3").get(
                ClassRef(P_NAME)) == "pipeline-name-3"

    def test_cdc_entry_upsert_delete(self, repo) -> None:
        with repo.tenant_scope(T):
            # upsert：新 pk 创建
            out = repo.apply_cdc_changes(OBJ, [
                {"op": "upsert", "pk": "a9",
                 "data": {"aid": "a9", "aname": "cdc-name", "atier": "gold"}},
            ])
            assert out == {"upserted": 1, "deleted": 0}
            assert repo.get_individual(f"ont.{T}.ind.account.a9").get(
                ClassRef(P_NAME)) == "cdc-name"
            # upsert 已被用户编辑的实例：覆盖层保护
            repo.apply_edit_set_now(
                ACT, f"ont.{T}.ind.account.a9", {},
                [{"op": "set_property", "target": f"ont.{T}.ind.account.a9",
                  "property_rid": P_NAME, "value": "keep-mine"}],
                actor="sales-2",
            )
            repo.apply_cdc_changes(OBJ, [
                {"op": "upsert", "pk": "a9",
                 "data": {"aid": "a9", "aname": "cdc-clobber-attempt"}},
            ])
            ind = repo.get_individual(f"ont.{T}.ind.account.a9")
            assert ind.get(ClassRef(P_NAME)) == "keep-mine"
            # delete：级联清理
            out2 = repo.apply_cdc_changes(OBJ, [
                {"op": "delete", "pk": "a9"},
            ])
            assert out2 == {"upserted": 0, "deleted": 1}
            with pytest.raises(KeyError):
                repo.get_individual(f"ont.{T}.ind.account.a9")
