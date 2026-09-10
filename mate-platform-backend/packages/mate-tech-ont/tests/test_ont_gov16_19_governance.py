"""GOV-16~19 —— 治理四件套：使用量 / 生命周期删除保护 / 反模式 lint / 时序。

真库门控（PG 表）+ lint 纯函数单测。
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

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_tech_ont.v2_kernel.governance import lint_anti_patterns

T = "gov"
PG_DSN = os.environ.get("GOV_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")


def _p(slug: str) -> Property:
    return Property(
        rid=ClassRef(f"ont.{T}.prop.{slug}.v1"),
        type_id="string",
        nullable=True,
        primary_key=False,
        title=slug,
        format=PropertyFormat.STRING,
    )


def _ot(rid: str, props: list[Property]) -> ObjectType:
    pk = Property(
        rid=ClassRef(f"ont.{T}.prop.pk-{rid.split('.')[-2]}.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="pk",
        format=PropertyFormat.STRING,
    )
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=(pk, *props),
        display_name=rid.split(".")[-2],
    )


class TestLint:
    def test_kitchen_sink_and_misnomer(self) -> None:
        ots = [_ot(f"ont.{T}.obj.crm.order.v1", [_p("dt_last_load"), _p("value")])]
        findings = lint_anti_patterns(ots)
        patterns = {f["pattern"] for f in findings}
        assert "kitchen_sink" in patterns
        assert "misnomer" in patterns

    def test_god_object_and_action_sprawl(self) -> None:
        ot = _ot(f"ont.{T}.obj.crm.mega.v1", [_p(f"f{i}") for i in range(35)])
        ats = [
            ActionType(
                rid=ClassRef(f"ont.{T}.act.crm.a{i}.v1"),
                parameters=(),
                submission_criteria=(),
                side_effects=(),
                function_ref=ClassRef(f"ont.{T}.fn.f{i}.v1"),
                on=(ClassRef(ot.rid.rid),),
            )
            for i in range(12)
        ]
        findings = lint_anti_patterns([ot], ats)
        patterns = {f["pattern"] for f in findings}
        assert "god_object" in patterns
        assert "action_sprawl" in patterns

    def test_clean_model_no_findings(self) -> None:
        ot = _ot(f"ont.{T}.obj.crm.customer.v1", [_p("monetary-value")])
        assert lint_anti_patterns([ot], []) == []


class TestPgGovernance:
    @pytest.fixture()
    def repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        OBJ = f"ont.{T}.obj.crm.gdoc.v1"
        P_ID = f"ont.{T}.prop.gid.v1"
        with r.tenant_scope(T):
            r.upsert_object_type(
                ObjectType(
                    rid=ClassRef(OBJ),
                    primary_key=(ClassRef(P_ID),),
                    properties=(
                        Property(
                            rid=ClassRef(P_ID),
                            type_id="string",
                            nullable=False,
                            primary_key=True,
                            title="id",
                            format=PropertyFormat.STRING,
                        ),
                    ),
                    display_name="gdoc",
                )
            )
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in ("ont_usage_metric", "ont_timeseries_point", "ont_object_type", "ont_axiom"):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_usage_and_delete_protection(self, repo) -> None:
        OBJ = f"ont.{T}.obj.crm.gdoc.v1"
        with repo.tenant_scope(T):
            repo.record_usage(OBJ, "read", 5)
            summary = repo.usage_summary(30)
            row = next(u for u in summary if u["class_rid"] == OBJ)
            assert row["reads"] == 5
            # 删除保护：有读量 → delete 拒绝
            with pytest.raises(ValueError, match="delete protection"):
                repo.apply_lifecycle(OBJ, "delete", actor="op")
            # deprecate 成功 → 再 delete 仍被保护（读量仍在）
            out = repo.apply_lifecycle(OBJ, "deprecate", actor="op")
            assert out["status"] == "deprecated"

    def test_timeseries_roundtrip(self, repo) -> None:
        with repo.tenant_scope(T):
            series = f"ont.{T}.ts.metrics.cpu.v1"
            n = repo.append_timeseries(
                series,
                [
                    {"ts": "2026-09-01T00:00:00Z", "value": 1.5},
                    {"ts": "2026-09-02T00:00:00Z", "value": 2.5},
                    {"ts": "2026-09-03T00:00:00Z", "value": 3.5},
                ],
                tenant_id=T,
            )
            assert n == 3
            pts = repo.query_timeseries(
                series, start="2026-09-02T00:00:00Z", end="2026-09-03T00:00:00Z"
            )
            assert [p["value"] for p in pts] == [2.5, 3.5]
            # 幂等 upsert
            repo.append_timeseries(
                series, [{"ts": "2026-09-02T00:00:00Z", "value": 9.9}], tenant_id=T
            )
            pts2 = repo.query_timeseries(series)
            assert len(pts2) == 3
            assert any(p["value"] == 9.9 for p in pts2)
