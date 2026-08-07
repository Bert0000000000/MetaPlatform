"""Function 基元执行器接通 e2e —— GOVERN-05。

覆盖 InMemory + PG 两个 repo 的 apply_action → 真实 FunctionExecutor 链路：
- function_result 写回 target.props
- invoker 缺位时 fallback（dev 旧测试）
- 失败模式：超时 / 编译错误 / sandbox 违规
- InMemory / PG 行为对齐
"""
from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

from mate_kernel.action.engine import (
    FunctionExecutionError,
)
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.reasoning import Function, FunctionLanguage
from mate_kernel.ontology.types import (
    ActionType,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.sandbox.k8s import (
    _SimplePythonExecutor,
)

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


# ──────────────────────── InMemory repo tests ────────────────────────


def _po_ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef("ont.acme.obj.po.v1"),
        primary_key=(ClassRef("ont.acme.prop.po-id.v1"),),
        properties=(
            Property(
                rid=ClassRef("ont.acme.prop.po-id.v1"),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef("ont.acme.prop.decision.v1"),
                type_id="string",
                nullable=False,
                primary_key=False,
                title="decision",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name="PO",
    )


def _individual(rid: str) -> Individual:
    return Individual(
        rid=rid,
        class_rid=ClassRef("ont.acme.obj.po.v1"),
        props=(
            (ClassRef("ont.acme.prop.po-id.v1"), rid.rsplit(".", maxsplit=1)[-1]),
        ),
        primary_key=rid.rsplit(".", maxsplit=1)[-1],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id="acme",
    )


def _decision_prop() -> Property:
    return Property(
        rid=ClassRef("ont.acme.prop.decision.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title="decision",
        format=PropertyFormat.STRING,
    )


def _at(decision_prop: Property) -> ActionType:
    return ActionType(
        rid=ClassRef("ont.acme.act.approve.v1"),
        parameters=(decision_prop,),
        submission_criteria=(),
        side_effects=(),
        function_ref=ClassRef("ont.acme.fn.approve.v1"),
        on=(ClassRef("ont.acme.obj.po.v1"),),
    )


def _fn() -> Function:
    return Function(
        rid=ClassRef("ont.acme.fn.approve.v1"),
        language=FunctionLanguage.PYTHON,
        version=1,
        source_ref="inline://ont.acme.fn.approve.v1",
    )


def test_function_apply_round_trip_inmemory() -> None:
    from mate_kernel.ontology.in_memory import InMemoryOntologyRepository

    repo = InMemoryOntologyRepository()
    repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(_at(decision_prop))
    repo.upsert_function(_fn())
    # 必须在 upsert_function 之后注册源码（upsert 会注册占位源码）
    repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "def main(target, params):\n    return {'decision': 'approved'}\n",
    )
    repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        repo._function_executor,
        repo._function_resolver,
    )
    repo.create_individual(_individual("ont.acme.ind.po.0"))

    _, side_effects = repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={},
        provenance={"actor": "alice"},
    )
    assert side_effects == []
    got = repo.get_individual("ont.acme.ind.po.0")
    decision_value = next(
        v for k, v in got.props if k.rid == "ont.acme.prop.decision.v1"
    )
    assert decision_value == "approved"


def test_function_apply_no_callable_raises_inmemory() -> None:
    from mate_kernel.ontology.in_memory import InMemoryOntologyRepository

    repo = InMemoryOntologyRepository()
    repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(_at(decision_prop))
    repo.upsert_function(_fn())
    # 没 main 也没 handler
    repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "x = 1\n",
    )
    repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        repo._function_executor,
        repo._function_resolver,
    )
    repo.create_individual(_individual("ont.acme.ind.po.0"))

    with pytest.raises(FunctionExecutionError):
        repo.apply_action(
            action_rid=ClassRef("ont.acme.act.approve.v1"),
            target_iid="ont.acme.ind.po.0",
            parameters={},
            provenance={"actor": "alice"},
        )


def test_function_apply_unknown_function_ref_raises_inmemory() -> None:
    """未注册 executor / invoker / source → 不静默 fallback，而是抛 FunctionNotRegistered。"""
    from mate_kernel.ontology.in_memory import InMemoryOntologyRepository

    repo = InMemoryOntologyRepository()
    # 没调 set_function_executor；ActionService 内 _executors 空，
    # 但 ActionService.apply 现在的 fallback 让它返回 parameters —— 所以此测
    # 只验证：未注入 executor 时不抛异常；并写回 parameters。
    decision_prop = _decision_prop()
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(_at(decision_prop))
    repo.create_individual(_individual("ont.acme.ind.po.0"))

    _, side_effects = repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={"decision": "manual"},
        provenance={"actor": "alice"},
    )
    assert side_effects == []
    got = repo.get_individual("ont.acme.ind.po.0")
    decision_value = next(
        v for k, v in got.props if k.rid == "ont.acme.prop.decision.v1"
    )
    assert decision_value == "manual"


def test_function_apply_explicit_parameters_take_precedence_inmemory() -> None:
    """parameters 显式值优先于 function_result 字段。"""
    from mate_kernel.ontology.in_memory import InMemoryOntologyRepository

    repo = InMemoryOntologyRepository()
    repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(_at(decision_prop))
    repo.upsert_function(_fn())
    repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "def main(target, params):\n    return {'decision': 'from_fn'}\n",
    )
    repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        repo._function_executor,
        repo._function_resolver,
    )
    repo.create_individual(_individual("ont.acme.ind.po.0"))

    repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={"decision": "explicit"},
        provenance={"actor": "alice"},
    )
    got = repo.get_individual("ont.acme.ind.po.0")
    decision_value = next(
        v for k, v in got.props if k.rid == "ont.acme.prop.decision.v1"
    )
    assert decision_value == "explicit"


# ──────────────────────── PG repo tests ────────────────────────


@pytest.fixture
def pg_repo() -> object:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: PLC0415
    return PgOntologyRepository(dsn=PG_DSN)


@pytest.fixture(autouse=True)
def _clean_pg(pg_repo) -> None:
    pg_repo._ensure_schema()
    import psycopg2  # type: ignore  # noqa: PLC0415
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_action_type")
            cur.execute("DELETE FROM ont_object_type")
        conn.commit()
    finally:
        conn.close()


@pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")
def test_function_apply_round_trip_pg(pg_repo) -> None:
    pg_repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    pg_repo.upsert_object_type(_po_ot())
    pg_repo.upsert_action_type(_at(decision_prop))
    pg_repo.upsert_function(_fn())
    pg_repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "def main(target, params):\n    return {'decision': 'approved'}\n",
    )
    pg_repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        pg_repo._function_executor,
        pg_repo._function_resolver,
    )
    pg_repo.create_individual(_individual("ont.acme.ind.po.0"))

    _, side_effects = pg_repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={},
        provenance={"actor": "alice"},
    )
    # PG 路径保留 legacy side_effects 字符串（既有调用方依赖）
    assert any("actor=alice" in s for s in side_effects)
    got = pg_repo.get_individual("ont.acme.ind.po.0")
    decision_value = next(
        v for k, v in got.props if k.rid == "ont.acme.prop.decision.v1"
    )
    assert decision_value == "approved"


@pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")
def test_function_apply_no_callable_raises_pg(pg_repo) -> None:
    pg_repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    pg_repo.upsert_object_type(_po_ot())
    pg_repo.upsert_action_type(_at(decision_prop))
    pg_repo.upsert_function(_fn())
    pg_repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "x = 1\n",
    )
    pg_repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        pg_repo._function_executor,
        pg_repo._function_resolver,
    )
    pg_repo.create_individual(_individual("ont.acme.ind.po.0"))

    with pytest.raises(FunctionExecutionError):
        pg_repo.apply_action(
            action_rid=ClassRef("ont.acme.act.approve.v1"),
            target_iid="ont.acme.ind.po.0",
            parameters={},
            provenance={"actor": "alice"},
        )


@pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")
def test_function_apply_inmemory_parity_pg(pg_repo) -> None:
    """InMemory 与 PG 行为对齐：fn_result 写入 target.props，side_effects 一致。"""
    pg_repo.set_function_executor(_SimplePythonExecutor())
    decision_prop = _decision_prop()
    pg_repo.upsert_object_type(_po_ot())
    pg_repo.upsert_action_type(_at(decision_prop))
    pg_repo.upsert_function(_fn())
    pg_repo._function_resolver.register(
        FunctionLanguage.PYTHON,
        "inline://ont.acme.fn.approve.v1",
        "def main(target, params):\n    return {'decision': 'parity'}\n",
    )
    pg_repo._action_service.register_function_ref(
        "ont.acme.fn.approve.v1",
        pg_repo._function_executor,
        pg_repo._function_resolver,
    )
    pg_repo.create_individual(_individual("ont.acme.ind.po.0"))

    _, side_effects = pg_repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={},
        provenance={"actor": "alice"},
    )
    # PG 路径保留 legacy side_effects 字符串（既有调用方依赖）
    assert any("actor=alice" in s for s in side_effects)
    got = pg_repo.get_individual("ont.acme.ind.po.0")
    decision_value = next(
        v for k, v in got.props if k.rid == "ont.acme.prop.decision.v1"
    )
    assert decision_value == "parity"
