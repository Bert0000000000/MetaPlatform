"""KERNEL-01 v2 PG RLS tenant isolation — 8 attack vectors (GOVERN-06 / 2026-08-07).

Closes the gap left by Alembic 0008 (62 tenant tables RLS'd) for the 9
KERNEL-01 v2 tables added in GOVERN-04. Each test corresponds to one
attack surface listed in ``evidence/GOVERN-06-SUBSPEC.md §06-03``:

  T1. tenant_scope("acme") SELECT 全表 → 仅见 acme 行；其他租户 0
  T2. tenant_scope("acme") 构造 rid="ont.other.ind.po.0" → API 层字符串前缀兜底
  T3. tenant_scope("acme") apply_action(target_iid="ont.other.ind.po.0") → 拒绝
  T4. tenant_scope("acme") upsert_object_type(rid="ont.other.obj.evil.v1") → 拒绝
  T5. tenant_scope("acme") link_instance (src/dst 跨租户) → 拒绝
  T6. 绕过 API 层写 tenant_id="other" 的 row → RLS WITH CHECK 拦截
  T7. tenant_scope("acme") 内 SELECT 其他租户的 row → 0 行（USING 拦截）
  T8. tenant_scope("acme") 内 UPDATE 别人 row → 0 行受影响（WITH CHECK 拦截）

Skipped only if PostgreSQL is not reachable — the local and CI entrypoint
``scripts/ci/verify_ont_rls.sh`` provisions the dedicated non-superuser role
and database before collection. A privileged role is still rejected so a
passing run always proves PostgreSQL RLS rather than superuser bypass.
"""
from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://mate_ont_test:mate_ont_test@localhost:5432/metaplatform_ont_test",
)

KERNEL01_V2_TABLES_FOR_TESTS: tuple[str, ...] = (
    "ont_individual",
    "ont_object_type",
    "ont_action_type",
    "ont_link_type",
    "ont_link_instance",
    "ont_interface",
    "ont_property",
    "ont_axiom",
    "ont_function",
)


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


def _pg_role_is_privileged() -> bool:
    """Detect if the PG role bypasses RLS (superuser or BYPASSRLS).

    Per PG docs, ``FORCE ROW LEVEL SECURITY`` is overridden by
    ``BYPASSRLS`` privilege (any role with the attribute bypasses
    every RLS policy on tables they own or otherwise). Superusers
    also bypass.
    """
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT rolsuper OR rolbypassrls FROM pg_roles "
                    "WHERE rolname = current_user"
                )
                row = cur.fetchone()
                return bool(row and row[0])
        finally:
            conn.close()
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available() or _pg_role_is_privileged(),
    reason=(
        f"PG not reachable at {PG_DSN!r} or role bypasses RLS "
        "(superuser / BYPASSRLS). GOVERN-09 will provision a non-privileged "
        "app role; until then this suite is skipped on the privileged meta role."
    ),
)


# ─────────────────────────── helpers ───────────────────────────


@pytest.fixture
def pg_repo() -> object:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: PLC0415
    return PgOntologyRepository(dsn=PG_DSN)


@pytest.fixture(autouse=True)
def _clean_pg(pg_repo: object) -> None:
    """Wipe 9 tables before each test so RLS state is predictable."""
    pg_repo._ensure_schema()
    import psycopg2  # type: ignore  # noqa: PLC0415
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            tables = ", ".join(KERNEL01_V2_TABLES_FOR_TESTS)
            cur.execute(f"TRUNCATE TABLE {tables}")  # noqa: S608
        conn.commit()
    finally:
        conn.close()


def _now() -> datetime:
    return datetime.now(UTC)


def _seed_ind_raw(repo: object, iid: str, tenant: str) -> None:
    """Seed one Individual via raw SQL so rid/tenant can deliberately mismatch.

    Bypasses ``Individual.__post_init__`` rid/tenant consistency check —
    those tests need rows that would be invalid under normal API flow
    so the RLS layer has something to deny.
    """

    with repo.tenant_scope(tenant):
        conn, _ = repo._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO ont_individual "
                    "(rid, tenant_id, class_rid, props, primary_key, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s::jsonb, %s, now(), now()) "
                    "ON CONFLICT (rid) DO UPDATE SET tenant_id = EXCLUDED.tenant_id",
                    (
                        iid,
                        tenant,
                        f"ont.{tenant}.obj.po.v1",
                        "{}",
                        iid.rsplit(".", maxsplit=1)[-1],
                    ),
                )
            conn.commit()
        finally:
            conn.close()


# ─────────────────────────── tests ───────────────────────────


def test_t1_select_only_own_tenant_rows(pg_repo: object) -> None:
    """T1: acme 范围 SELECT 仅见 acme 行；其他租户 0 行。"""
    _seed_ind_raw(pg_repo, "ont.acme.ind.po.0", "acme")
    _seed_ind_raw(pg_repo, "ont.acme.ind.po.1", "acme")
    _seed_ind_raw(pg_repo, "ont.other.ind.po.0", "other")
    with pg_repo.tenant_scope("acme") as repo:
        items = repo.list_individuals(None)
    assert len(items) == 2
    for ind in items:
        assert ind.tenant_id == "acme"
    with pg_repo.tenant_scope("other") as repo:
        items_other = repo.list_individuals(None)
    assert len(items_other) == 1
    assert items_other[0].tenant_id == "other"


def test_t2_create_with_cross_tenant_rid_via_api_guard(pg_repo: object) -> None:
    """T2: 构造 rid 跨租户 — PG 层 WITH CHECK 拦截。

    pg_repo 不做字符串前缀兜底（那是 API 层的事），但 tenant_scope("acme")
    下写 row.tenant_id="other" 会被 WITH CHECK 拒绝。
    """
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415
    from mate_kernel.ontology.instances import Individual  # noqa: PLC0415

    ind = Individual(
        rid="ont.other.ind.po.0",
        class_rid=ClassRef("ont.other.obj.po.v1"),
        props=(),
        primary_key="0",
        created_at=_now(),
        updated_at=_now(),
        tenant_id="other",
    )
    with pg_repo.tenant_scope("acme") as repo:
        from psycopg2 import errors as pg_errors  # noqa: PLC0415

        with pytest.raises(pg_errors.InsufficientPrivilege):
            repo.create_individual(ind)


def test_t3_apply_action_cross_tenant_target_rejected(pg_repo: object) -> None:
    """T3: apply_action target_iid 跨租户 → 拒绝。

    ActionService 路由到 PG 层后，get_individual(target) 触发 USING 拦截，
    返回 KeyError（被 API 层翻成 404）。
    """
    _seed_ind_raw(pg_repo, "ont.other.ind.po.0", "other")
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415
    from mate_kernel.ontology.types import ActionType  # noqa: PLC0415
    from mate_kernel.ontology.types.property_ import (  # noqa: PLC0415
        Property,
        PropertyFormat,
    )

    at = ActionType(
        rid=ClassRef("ont.acme.act.approve.v1"),
        parameters=(
            Property(
                rid=ClassRef("ont.acme.prop.note.v1"),
                type_id="string",
                nullable=True,
                primary_key=False,
                title="note",
                format=PropertyFormat.STRING,
            ),
        ),
        submission_criteria=(),
        side_effects=(),
        function_ref=ClassRef("ont.acme.fn.approve.v1"),
        on=(ClassRef("ont.acme.obj.po.v1"),),
    )
    with pg_repo.tenant_scope("acme") as repo:
        repo.upsert_action_type(at)
        with pytest.raises(KeyError):
            repo.apply_action(
                action_rid=ClassRef("ont.acme.act.approve.v1"),
                target_iid="ont.other.ind.po.0",
                parameters={},
                provenance={"actor": "alice"},
            )


def test_t4_upsert_object_type_cross_tenant_rid_blocked(pg_repo: object) -> None:
    """T4: upsert_object_type 的 rid 跨租户 — pg_repo 派生 tenant_id
    从 rid，tenant_scope("acme") 下派生出的 tenant 不等于 row 的 tenant，
    WITH CHECK 拦截。
    """
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415
    from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat  # noqa: PLC0415

    ot = ObjectType(
        rid=ClassRef("ont.other.obj.evil.v1"),
        primary_key=(ClassRef("ont.other.prop.id.v1"),),
        properties=(
            Property(
                rid=ClassRef("ont.other.prop.id.v1"),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name="Evil",
    )
    with pg_repo.tenant_scope("acme") as repo:
        from psycopg2 import errors as pg_errors  # noqa: PLC0415

        with pytest.raises(pg_errors.InsufficientPrivilege):
            repo.upsert_object_type(ot)


def test_t5_link_instance_cross_tenant_blocked(pg_repo: object) -> None:
    """T5: link_instance 跨租户 → RLS WITH CHECK 拦截。"""
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415
    from mate_kernel.ontology.instances import LinkInstance  # noqa: PLC0415

    li = LinkInstance(
        rid="ont.other.lnk.rel.0",
        link_type_rid=ClassRef("ont.acme.link.rel.v1"),
        src="ont.other.ind.po.0",
        dst="ont.acme.ind.po.0",
        props={},
        created_at=_now(),
        tenant_id="other",
        marking=(),
    )
    with pg_repo.tenant_scope("acme") as repo:
        from psycopg2 import errors as pg_errors  # noqa: PLC0415

        with pytest.raises(pg_errors.InsufficientPrivilege):
            repo.create_link_instance(li)


def test_t6_write_with_wrong_tenant_id_blocked_by_with_check(pg_repo: object) -> None:
    """T6: 即便 tenant_scope 已绑 acme，row 的 tenant_id='other' 也被 WITH CHECK 拒绝。

    用 raw seed 写入一个 tenant_id="acme" 但 rid 属 "other" 的 row，然后
    通过正常 API 路径覆盖时 WITH CHECK 应该拒绝。
    """
    _seed_ind_raw(pg_repo, "ont.other.ind.po.0", "acme")
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415
    from mate_kernel.ontology.instances import Individual  # noqa: PLC0415

    # 构造一个新 individual，rid=acme 但 tenant_id=other → RLS 应拒绝写入。
    ind = Individual(
        rid="ont.acme.ind.po.0",
        class_rid=ClassRef("ont.acme.obj.po.v1"),
        props=(),
        primary_key="0",
        created_at=_now(),
        updated_at=_now(),
        tenant_id="acme",
    )
    # Domain validation correctly rejects this mismatch at construction time;
    # bypass it only after construction so the database WITH CHECK policy is
    # tested with a deliberately malformed row as intended by T6.
    object.__setattr__(ind, "tenant_id", "other")
    with pg_repo.tenant_scope("acme") as repo:
        from psycopg2 import errors as pg_errors  # noqa: PLC0415

        with pytest.raises(pg_errors.InsufficientPrivilege):
            repo.create_individual(ind)


def test_t7_select_other_tenant_rows_returns_empty(pg_repo: object) -> None:
    """T7: tenant_scope("acme") 内 SELECT 别人的 row — USING 拦截 → 404 语义。"""
    _seed_ind_raw(pg_repo, "ont.other.ind.po.0", "other")
    with pg_repo.tenant_scope("acme") as repo:
        with pytest.raises(KeyError, match="Individual not found"):
            repo.get_individual("ont.other.ind.po.0")


def test_t8_update_other_tenant_row_touches_zero(pg_repo: object) -> None:
    """T8: tenant_scope("acme") 内 UPDATE 别人的 row — WITH CHECK 拦截 → 0 行受影响。

    pg_repo 目前没有 update_individual 方法；直接走 SQL 验证。
    """
    _seed_ind_raw(pg_repo, "ont.other.ind.po.0", "other")
    with pg_repo.tenant_scope("acme") as repo:

        conn, _ = repo._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE ont_individual SET props = %s WHERE rid = %s",
                    ('{"k": "v"}', "ont.other.ind.po.0"),
                )
                rowcount = cur.rowcount
            conn.commit()
        finally:
            conn.close()
    assert rowcount == 0, f"expected 0 rows updated, got {rowcount}"
