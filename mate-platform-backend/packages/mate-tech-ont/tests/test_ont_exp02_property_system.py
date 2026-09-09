"""EXP-02 —— Property 体系：struct / 派生 / 共享 / 值类型 / 数组（D4 拍板）。

覆盖：
1. 值类型注册表：内置清单、format 一致性校验（宽松：未注册放行）；
2. struct 属性：定义 + 序列化 round-trip（InMemory + PG）+ ai_metadata_struct 模板；
3. 派生属性：count / sum / avg over link —— InMemory 与 PG 同语义；
4. 共享属性：同一 Property rid 被 2 类型引用 → shared_properties_usage 标记；
5. 数组 + reducer 元数据校验（first/latest）；
6. derived + primary_key 互斥拒绝。
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

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: E402
from mate_kernel.ontology.instances.individual import Individual  # noqa: E402
from mate_kernel.ontology.types.link_type import (  # noqa: E402
    Cardinality, Directionality, LinkType,
)
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import (  # noqa: E402
    DerivedSpec, Property, PropertyFormat, ai_metadata_struct,
)
from mate_kernel.ontology.types.value_types import (  # noqa: E402
    get_value_type, list_value_types, validate_property,
)
from mate_kernel.objectset.ir import ObjectSetQuery  # noqa: E402

T = "exp02"
OBJ_DEPT = f"ont.{T}.obj.org.department.v1"
OBJ_EMP = f"ont.{T}.obj.org.employee.v1"
LINK = f"ont.{T}.link.org.dept-employees.v1"
P_NAME = f"ont.{T}.prop.shared-name.v1"        # 共享属性：两类型同 rid
P_SALARY = f"ont.{T}.prop.salary.v1"
P_HEADCOUNT = f"ont.{T}.prop.headcount.v1"  # derived count
P_PAYROLL = f"ont.{T}.prop.payroll.v1"      # derived sum


def _name_prop() -> Property:
    return Property(
        rid=ClassRef(P_NAME), type_id="string", nullable=False,
        primary_key=True, title="name", format=PropertyFormat.STRING,
        shared=True,
    )


def _emp_type() -> ObjectType:
    return ObjectType(
        rid=ClassRef(OBJ_EMP),
        primary_key=(ClassRef(P_NAME),),
        properties=(
            _name_prop(),
            Property(
                rid=ClassRef(P_SALARY), type_id="double", nullable=True,
                primary_key=False, title="salary", format=PropertyFormat.DOUBLE,
            ),
        ),
        display_name="employee",
    )


def _dept_type() -> ObjectType:
    return ObjectType(
        rid=ClassRef(OBJ_DEPT),
        primary_key=(ClassRef(P_NAME),),
        properties=(
            _name_prop(),
            Property(
                rid=ClassRef(P_HEADCOUNT), type_id="integer", nullable=True,
                primary_key=False, title="headcount", format=PropertyFormat.INTEGER,
                derived=DerivedSpec(fn="count", over_link=LINK),
            ),
            Property(
                rid=ClassRef(P_PAYROLL), type_id="double", nullable=True,
                primary_key=False, title="payroll", format=PropertyFormat.DOUBLE,
                derived=DerivedSpec(fn="sum", over_link=LINK, field=P_SALARY),
            ),
        ),
        display_name="department",
    )


def _link_type() -> LinkType:
    return LinkType(
        rid=ClassRef(LINK), src=ClassRef(OBJ_DEPT), dst=ClassRef(OBJ_EMP),
        cardinality=Cardinality.MANY_TO_MANY,
        directionality=Directionality.DIRECTED,
    )


def _ind(rid: str, class_rid: str, name: str, salary: float | None = None) -> Individual:
    props: list[tuple[ClassRef, object]] = [(ClassRef(P_NAME), name)]
    if salary is not None:
        props.append((ClassRef(P_SALARY), salary))
    return Individual(
        rid=rid, class_rid=ClassRef(class_rid), props=tuple(props),
        primary_key=name, tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )


@pytest.fixture()
def repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(_dept_type())
    r.upsert_object_type(_emp_type())
    r.upsert_link_type(_link_type())
    r.create_individual(_ind(f"ont.{T}.ind.department.eng", OBJ_DEPT, "eng"))
    r.create_individual(_ind(f"ont.{T}.ind.department.sales", OBJ_DEPT, "sales"))
    r.create_individual(_ind(f"ont.{T}.ind.employee.alice", OBJ_EMP, "alice", 100.0))
    r.create_individual(_ind(f"ont.{T}.ind.employee.bob", OBJ_EMP, "bob", 200.0))
    # sales 只挂 bob；eng 挂 alice+bob
    from mate_kernel.ontology.instances.link_instance import LinkInstance

    def _li(src: str, dst: str, pk: str) -> LinkInstance:
        return LinkInstance(
            rid=f"ont.{T}.lnk.{LINK.split('.')[-2]}.{pk}", link_type_rid=ClassRef(LINK),
            src=src, dst=dst, props=(),
            created_at=datetime.now(UTC), tenant_id=T,
        )

    r.create_link_instance(_li(f"ont.{T}.ind.department.eng", f"ont.{T}.ind.employee.alice", "l1"))
    r.create_link_instance(_li(f"ont.{T}.ind.department.eng", f"ont.{T}.ind.employee.bob", "l2"))
    r.create_link_instance(_li(f"ont.{T}.ind.department.sales", f"ont.{T}.ind.employee.bob", "l3"))
    return r


class TestValueTypes:
    def test_builtins_registered(self) -> None:
        ids = {vt.type_id for vt in list_value_types()}
        assert {"string", "integer", "vector", "struct", "geojson"} <= ids

    def test_format_mismatch_violation(self) -> None:
        p = Property(
            rid=ClassRef(f"ont.{T}.prop.test.bad.v1"), type_id="integer",
            nullable=True, primary_key=False, title="bad",
            format=PropertyFormat.STRING,  # type_id=integer 但 format=string
        )
        assert validate_property(p), "expected format mismatch violation"

    def test_unregistered_type_id_reported_by_lint(self) -> None:
        p = Property(
            rid=ClassRef(f"ont.{T}.prop.test.ghost.v1"), type_id="no-such-type",
            nullable=True, primary_key=False, title="ghost",
            format=PropertyFormat.STRING,
        )
        assert any("unregistered" in v for v in validate_property(p))

    def test_repo_rejects_registered_mismatch(self, repo) -> None:
        bad = ObjectType(
            rid=ClassRef(f"ont.{T}.obj.org.bad.v1"),
            primary_key=(ClassRef(P_NAME),),
            properties=(
                _name_prop(),
                Property(
                    rid=ClassRef(f"ont.{T}.prop.bad-amt.v1"), type_id="integer",
                    nullable=True, primary_key=False, title="bad",
                    format=PropertyFormat.STRING,
                ),
            ),
        )
        with pytest.raises(ValueError, match="declared format"):
            repo.upsert_object_type(bad)


class TestDerivedProperties:
    def test_count_and_sum_inmemory(self, repo) -> None:
        result = repo.execute_object_query(ObjectSetQuery(source=OBJ_DEPT))
        rows = {r["shared-name"]: r for r in result.rows}
        assert rows["eng"]["headcount"] == 2
        assert rows["eng"]["payroll"] == 300.0
        assert rows["sales"]["headcount"] == 1
        assert rows["sales"]["payroll"] == 200.0

    def test_avg(self, repo) -> None:
        P_AVG = f"ont.{T}.prop.avg-salary.v1"
        dept_avg = ObjectType(
            rid=ClassRef(OBJ_DEPT),
            primary_key=(ClassRef(P_NAME),),
            properties=(
                _name_prop(),
                Property(
                    rid=ClassRef(P_AVG), type_id="double", nullable=True,
                    primary_key=False, title="avgSalary",
                    format=PropertyFormat.DOUBLE,
                    derived=DerivedSpec(fn="avg", over_link=LINK, field=P_SALARY),
                ),
            ),
        )
        repo.upsert_object_type(dept_avg)
        result = repo.execute_object_query(ObjectSetQuery(source=OBJ_DEPT))
        rows = {r["shared-name"]: r for r in result.rows}
        assert rows["eng"]["avg-salary"] == 150.0

    def test_derived_cannot_be_pk(self) -> None:
        with pytest.raises(ValueError, match="primary key"):
            Property(
                rid=ClassRef(f"ont.{T}.prop.org.bad-pk.v1"), type_id="integer",
                nullable=True, primary_key=True, title="bad",
                format=PropertyFormat.INTEGER,
                derived=DerivedSpec(fn="count", over_link=LINK),
            )

    def test_sum_requires_field(self) -> None:
        with pytest.raises(ValueError, match="requires field"):
            DerivedSpec(fn="sum", over_link=LINK)


class TestSharedProperties:
    def test_usage_marks_shared(self, repo) -> None:
        usage = repo.shared_properties_usage()
        by_rid = {u["rid"]: u for u in usage}
        name_usage = by_rid[P_NAME]
        assert name_usage["shared"] is True
        assert set(name_usage["used_by"]) == {OBJ_DEPT, OBJ_EMP}
        salary_usage = by_rid[P_SALARY]
        assert salary_usage["shared"] is False


class TestStructAndArray:
    def test_struct_roundtrip(self, repo) -> None:
        p = ai_metadata_struct(ClassRef(f"ont.{T}.prop.doc.extract.v1"))
        repo.upsert_property(p)
        listed = {x.rid.rid: x for x in repo.list_properties()}
        got = listed[f"ont.{T}.prop.doc.extract.v1"]
        assert got.format is PropertyFormat.STRUCT
        field_titles = {sf.title for sf in got.struct_fields}
        assert {"llmConfidence", "llmReasoning", "source"} == field_titles

    def test_struct_requires_fields(self) -> None:
        with pytest.raises(ValueError, match="struct_fields"):
            Property(
                rid=ClassRef(f"ont.{T}.prop.test.empty-struct.v1"),
                type_id="struct", nullable=True, primary_key=False,
                title="empty", format=PropertyFormat.STRUCT,
            )

    def test_reducer_validation(self) -> None:
        with pytest.raises(ValueError, match="reducer"):
            Property(
                rid=ClassRef(f"ont.{T}.prop.test.tags.v1"), type_id="string",
                nullable=True, primary_key=False, title="tags",
                format=PropertyFormat.STRING, array=True, reducer="bogus",
            )


# ─────────────────── PG 真库同语义（可达时）───────────────────

PG_DSN = os.environ.get(
    "EXP02_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    @pytest.fixture()
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        with r.tenant_scope(T):
            r.upsert_object_type(_dept_type())
            r.upsert_object_type(_emp_type())
            r.upsert_link_type(_link_type())
            r.create_individual(_ind(f"ont.{T}.ind.department.p-eng", OBJ_DEPT, "p-eng"))
            r.create_individual(_ind(f"ont.{T}.ind.employee.p-alice", OBJ_EMP, "p-alice", 10.0))
            r.create_individual(_ind(f"ont.{T}.ind.employee.p-bob", OBJ_EMP, "p-bob", 20.0))
            from mate_kernel.ontology.instances.link_instance import LinkInstance

            for i, (s, d) in enumerate([
                (f"ont.{T}.ind.department.p-eng", f"ont.{T}.ind.employee.p-alice"),
                (f"ont.{T}.ind.department.p-eng", f"ont.{T}.ind.employee.p-bob"),
            ]):
                r.create_link_instance(LinkInstance(
                    rid=f"ont.{T}.lnk.{LINK.split('.')[-2]}.pl{i}",
                    link_type_rid=ClassRef(LINK),
                    src=s, dst=d, props=(),
                    created_at=datetime.now(UTC), tenant_id=T,
                ))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in ("ont_individual", "ont_link_instance", "ont_object_type",
                        "ont_link_type"):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_pg_derived_and_shared(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            result = pg_repo.execute_object_query(ObjectSetQuery(source=OBJ_DEPT))
            assert len(result.rows) == 1
            row = result.rows[0]
            assert row["headcount"] == 2
            assert row["payroll"] == 30.0
            usage = {u["rid"]: u for u in pg_repo.shared_properties_usage()}
            assert usage[P_NAME]["shared"] is True
            # struct round-trip（属性库）
            p = ai_metadata_struct(ClassRef(f"ont.{T}.prop.doc.p-extract.v1"))
            pg_repo.upsert_property(p)
            got = {x.rid.rid: x for x in pg_repo.list_properties()}[
                f"ont.{T}.prop.doc.p-extract.v1"]
            assert got.format is PropertyFormat.STRUCT
            assert len(got.struct_fields) == 3
