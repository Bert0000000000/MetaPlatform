"""F2 回归：带 `provenance` 的 proposal 必须能 execute 成功。

背景：`pg_repo.propose_action` 会把 `provenance` **并入** `proposal.parameters`
（ONT-PROV-01：action 提案无实例可落，随 parameters 存档，审计可见）。
而 `execute_proposal` 用 action 声明的参数表逐键校验 `parameters` ——
`provenance` 不在表内，于是**恒报** `unknown parameter 'provenance'`
（实测：`POST /proposals/{id}/execute` → 404）。

修法：`execute_proposal` 跳过保留键（`_RESERVED_PARAM_KEYS`），
把它当作平台元数据而非 action 参数。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

PG_DSN = os.environ.get(
    "F2_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)
T = "f2-prov"


def _pg_available() -> bool:
    try:
        import psycopg2

        psycopg2.connect(PG_DSN, connect_timeout=2).close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")


@pytest.fixture()
def repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()

    from mate_kernel.ontology.identity import ClassRef
    from mate_kernel.ontology.types import (
        ActionType,
        ObjectType,
        Property,
        PropertyFormat,
    )

    obj = f"ont.{T}.obj.thing.v1"
    prop = f"ont.{T}.prop.thing-id.v1"
    act = f"ont.{T}.act.mark.v1"
    with r.tenant_scope(T):
        prop_def = Property(
            rid=ClassRef(prop),
            type_id="string",
            nullable=False,
            primary_key=True,
            title="thing id",
            format=PropertyFormat.STRING,
        )
        r.upsert_object_type(
            ObjectType(rid=ClassRef(obj), primary_key=(ClassRef(prop),), properties=(prop_def,))
        )
        r.upsert_action_type(
            ActionType(
                rid=ClassRef(act),
                parameters=(prop_def,),
                submission_criteria=(),
                side_effects=("audit_log",),
                function_ref=ClassRef(f"ont.{T}.fn.mark.v1"),
                on=(ClassRef(obj),),
            )
        )
        from mate_kernel.ontology.instances import Individual

        now = datetime.now(UTC)
        r.create_individual(
            Individual(
                rid=f"ont.{T}.ind.thing.t1",
                class_rid=ClassRef(obj),
                props=((ClassRef(prop), "t1"),),
                primary_key="t1",
                created_at=now,
                updated_at=now,
                tenant_id=T,
            )
        )
        # ADR-0063 S2：不再有"未注册即回显 parameters"的隐式兜底 —— 显式注册
        r._action_service.register_function(f"ont.{T}.fn.mark.v1", lambda _iid, params: params)
    yield r, act, obj

    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        for tbl in (
            "ont_proposal_execution",
            "ont_proposal_event",
            "ont_proposal_idempotency",
            "ont_proposal",
            "ont_individual",
            "ont_action_type",
            "ont_object_type",
        ):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (T,))
    conn.commit()
    conn.close()


class TestProposalProvenance:
    def test_execute_succeeds_when_proposal_carries_provenance(self, repo) -> None:
        """propose 带 provenance → confirm → execute 必须成功（F2 回归）。"""
        r, act, _obj = repo
        from mate_kernel.ontology.identity import ClassRef

        with r.tenant_scope(T):
            p = r.propose_action(
                ClassRef(act),
                parameters={"thing-id": "t1"},
                target_iid=f"ont.{T}.ind.thing.t1",
                impact_summary="带溯源提案",
                provenance={"source": "ai", "model": "test", "confidence": 0.9},
            )
            assert "provenance" in p.parameters, "propose 应把 provenance 并入 parameters（ONT-PROV-01）"
            r.confirm_proposal(p.proposal_id, confirmed_by="reviewer")
            # 修复前：KeyError("unknown parameter 'provenance'")
            out = r.execute_proposal(p.proposal_id, actor_id="executor", idempotency_key="f2-1")
            assert out["kind"] == "action"
            assert out["action_rid"] == act
