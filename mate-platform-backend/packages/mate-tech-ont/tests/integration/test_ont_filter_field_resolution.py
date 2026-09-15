"""F4 回归：ObjectSet filter_expr 的字段解析 —— 未知字段必须 fail-fast。

背景（2026-09-14 实测**修正后**的准确形态）：

- **普通 slug 本来是好的**：`slug_to_rid` 用 `_prop_slug`（rid 第 4 段）归一化，
  `simple == 'a'` 正常工作；完整 rid 也正常。
- **真正的问题**：字段名既非完整 rid、也不在已知 slug 中时，
  `_rewrite_filter_fields` 按注释「未命中原样保留」→ `props ->> '<未知键>'`
  恒 NULL → **静默返回空集**。调用方无法区分"没有匹配"与"字段名写错了"。
- DSL 的 FIELD 正则不允许 slug 含点，故 `type.sub` 这类写法不是合法字段名
  （整串落到 truthy 分支）——同样被 fail-fast 拦下，而不是静默空集。

修法：`evaluate_object_set` 在归一化前调用
`_assert_filter_fields_resolvable` → `ValueError`（API 映射 422）。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

PG_DSN = os.environ.get("F4_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")
T = "f4-filter"


def _pg_available() -> bool:
    try:
        import psycopg2

        psycopg2.connect(PG_DSN, connect_timeout=2).close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")

OBJ = f"ont.{T}.obj.x.v1"
P_SIMPLE = f"ont.{T}.prop.simple.v1"  # 普通 slug → 'simple'
P_DOTTED = f"ont.{T}.prop.type.sub.v1"  # 点状 slug → _prop_slug 得 'type'，_slug_of 得 'sub'


@pytest.fixture()
def repo():
    from mate_kernel.ontology.identity import ClassRef
    from mate_kernel.ontology.instances import Individual
    from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    with r.tenant_scope(T):
        props = tuple(
            Property(
                rid=ClassRef(p),
                type_id="string",
                nullable=False,
                primary_key=(p == P_SIMPLE),
                title=p,
                format=PropertyFormat.STRING,
            )
            for p in (P_SIMPLE, P_DOTTED)
        )
        r.upsert_object_type(
            ObjectType(rid=ClassRef(OBJ), primary_key=(ClassRef(P_SIMPLE),), properties=props)
        )
        now = datetime.now(UTC)
        r.create_individual(
            Individual(
                rid=f"ont.{T}.ind.x.1",
                class_rid=ClassRef(OBJ),
                props=((ClassRef(P_SIMPLE), "a"), (ClassRef(P_DOTTED), "b")),
                primary_key="a",
                created_at=now,
                updated_at=now,
                tenant_id=T,
            )
        )
    yield r
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        for tbl in ("ont_individual", "ont_object_type", "ont_axiom"):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (T,))
    conn.commit()
    conn.close()


def _query(r, expr: str) -> int:
    from mate_kernel.ontology.identity import ClassRef
    from mate_kernel.ontology.query import ObjectSet

    with r.tenant_scope(T):
        return len(
            r.evaluate_object_set(
                ObjectSet(class_rid=ClassRef(OBJ), filter_expr=expr, paging_limit=100)
            )
        )


class TestFilterFieldResolution:
    def test_simple_slug_still_works(self, repo) -> None:
        """普通 slug 归一化（既有行为，回归护栏）。"""
        assert _query(repo, "simple == 'a'") == 1

    def test_full_rid_still_works(self, repo) -> None:
        assert _query(repo, f"{P_SIMPLE} == 'a'") == 1

    def test_dotted_slug_resolves(self, repo) -> None:
        """6 段 rid 的 slug 约定是 parts[3]（`type`），不是 parts[4]（`sub`）。

        DSL 的 FIELD 正则不允许 slug 含点，故 `type.sub` 不是合法字段名
        （它会整串落到 truthy 分支 → 由 fail-fast 拦下）。
        """
        assert _query(repo, "type == 'b'") == 1

    def test_dotted_form_is_rejected_not_silently_empty(self, repo) -> None:
        """`type.sub` 这种含点写法不是合法 DSL 字段 → 必须报错，不得静默空集。"""
        with pytest.raises(ValueError, match="unknown filter field"):
            _query(repo, "type.sub == 'b'")

    def test_unknown_field_raises(self, repo) -> None:
        """F4：未知字段此前静默返回 0 行，现应 fail-fast。"""
        with pytest.raises(ValueError, match="unknown filter field"):
            _query(repo, "nosuchfield == 'x'")


def _sorted(r, sort: tuple[str, ...]) -> int:
    from mate_kernel.ontology.identity import ClassRef
    from mate_kernel.ontology.query import ObjectSet

    with r.tenant_scope(T):
        return len(
            r.evaluate_object_set(
                ObjectSet(class_rid=ClassRef(OBJ), filter_expr="", sort=sort, paging_limit=100)
            )
        )


class TestSortFieldResolution:
    """F4 同族：sort 字段无法解析时此前**静默回落** —— `props ->> '<未知键>'` 恒 NULL，
    表现为「排序无效果」而不是报错。与 filter 的静默空集同病。
    """

    def test_simple_slug_sort_works(self, repo) -> None:
        assert _sorted(repo, ("simple",)) == 1

    def test_full_rid_sort_works(self, repo) -> None:
        assert _sorted(repo, (P_SIMPLE,)) == 1

    def test_unknown_sort_field_raises(self, repo) -> None:
        with pytest.raises(ValueError, match="unknown sort field"):
            _sorted(repo, ("nosuchfield",))

    def test_unknown_sort_field_raises_even_with_desc_prefix(self, repo) -> None:
        with pytest.raises(ValueError, match="unknown sort field"):
            _sorted(repo, ("-nosuchfield",))
