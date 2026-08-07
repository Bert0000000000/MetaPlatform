"""实例管理 (ST-5.4.7).

/instances + /relations CRUD（in-memory + Neo4j 适配点）。

GOVERN-03 (2026-08-07): 所有 store 操作强制 ``RequestContext``，namespace
拼接 ``f"ont.{ctx.tenant_id}.{namespace}"``。``tenant_id`` 不再允许 ``None``，
payload 字段禁止覆盖 tenant 前缀。
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

import structlog

logger = structlog.get_logger(__name__)


class TenantAccessError(Exception):
    """Raised when an InstanceStore call is made without a tenant context.

    Maps to HTTP 403 in the request layer.
    """


class RequestContextLike(Protocol):
    """Structural type for the auth middleware's RequestContext.

    We keep this Protocol-based so the instances store does not need to
    import the auth package (which would create a circular import).
    """

    tenant_id: str
    user_id: str


def _coerce_tenant_ns(ctx: RequestContextLike, namespace: str | None) -> str:
    """Compute the canonical ``ont.<tenant>.<namespace>`` key.

    GOVERN-03: ``namespace`` is the **logical** segment only — we never
    accept a caller-supplied ``ont.<other-tenant>.<...>`` value. The
    resulting string is ``ont.<ctx.tenant_id>.<namespace-or-default>``.
    """
    if ctx is None or not getattr(ctx, "tenant_id", None):
        raise TenantAccessError("no tenant context")
    tenant_id = ctx.tenant_id
    if not tenant_id or not isinstance(tenant_id, str):
        raise TenantAccessError("missing tenant_id")
    ns = namespace or "default"
    if "/" in ns or " " in ns:
        raise TenantAccessError(f"invalid namespace: {ns!r}")
    # GOVERN-03: refuse a caller-supplied ``ont.`` prefix in the logical
    # namespace segment — it would otherwise leak through unchanged and
    # produce ``ont.<ctx>.<ont.other.acme>``.
    if ns.startswith("ont.") or ns.startswith("ont:"):
        raise TenantAccessError(
            f"namespace must be logical segment only, not qualified: {ns!r}"
        )
    return f"ont.{tenant_id}.{ns}"


@dataclass(frozen=True, slots=True)
class Instance:
    """本体实例.

    The ``namespace`` field now stores the canonical
    ``ont.<tenant>.<namespace>`` key, *not* whatever the caller supplied.
    """

    id: str
    class_id: str
    properties: dict[str, Any] = field(default_factory=dict)
    namespace: str = "default"
    created_at: float = field(default_factory=time.time)


@dataclass(frozen=True, slots=True)
class Relation:
    """实例间关系."""

    id: str
    type: str
    src_id: str
    dst_id: str
    properties: dict[str, Any] = field(default_factory=dict)


class InstanceStore:
    """实例存储（in-memory + Neo4j 适配点）.

    GOVERN-03: ``create_instance`` / ``list_instances`` / ``get_instance``
    all require a :class:`RequestContextLike`. The module-level ``store``
    singleton is **removed**; callers must instantiate via DI (see
    ``sparql/api.py`` for the FastAPI dependency). Tests should construct
    a fresh ``InstanceStore()`` per case.
    """

    def __init__(self) -> None:
        self._instances: dict[str, Instance] = {}
        self._relations: dict[str, Relation] = {}

    def create_instance(
        self,
        ctx: RequestContextLike,
        class_id: str,
        properties: dict[str, Any],
        namespace: str | None = None,
    ) -> Instance:
        ns = _coerce_tenant_ns(ctx, namespace)
        iid = str(uuid.uuid4())[:12]
        inst = Instance(
            id=iid,
            class_id=class_id,
            properties=properties,
            namespace=ns,
        )
        self._instances[iid] = inst
        logger.info(
            "instance.created", id=iid, class_id=class_id, tenant_id=ctx.tenant_id, ns=ns,
        )
        return inst

    def get_instance(self, ctx: RequestContextLike, iid: str) -> Instance | None:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        inst = self._instances.get(iid)
        if inst is None:
            return None
        ns_prefix = f"ont.{ctx.tenant_id}."
        if not inst.namespace.startswith(ns_prefix):
            # GOVERN-03: cross-tenant access is forbidden; the resource
            # technically exists but is invisible to this caller.
            logger.warning(
                "instance.get.cross_tenant_blocked",
                caller_tenant=ctx.tenant_id,
                owner_ns=inst.namespace,
                iid=iid,
            )
            return None
        return inst

    def list_instances(
        self,
        ctx: RequestContextLike,
        class_id: str | None = None,
    ) -> list[Instance]:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        ns_prefix = f"ont.{ctx.tenant_id}."
        all_insts = [i for i in self._instances.values() if i.namespace.startswith(ns_prefix)]
        if class_id:
            all_insts = [i for i in all_insts if i.class_id == class_id]
        return all_insts

    def delete_instance(self, ctx: RequestContextLike, iid: str) -> bool:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        inst = self.get_instance(ctx, iid)
        if inst is None:
            return False
        del self._instances[iid]
        rels_to_del = [r for r in self._relations.values() if iid in (r.src_id, r.dst_id)]
        for r in rels_to_del:
            del self._relations[r.id]
        return True

    def create_relation(
        self,
        ctx: RequestContextLike,
        type_: str,
        src_id: str,
        dst_id: str,
        properties: dict[str, Any] | None = None,
    ) -> Relation:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        # GOVERN-03: refuse to create a relation whose endpoints the
        # caller does not own (defence in depth on top of the per-instance
        # tenant filter).
        if self.get_instance(ctx, src_id) is None:
            raise TenantAccessError(f"src instance '{src_id}' not visible to tenant {ctx.tenant_id}")
        if self.get_instance(ctx, dst_id) is None:
            raise TenantAccessError(f"dst instance '{dst_id}' not visible to tenant {ctx.tenant_id}")
        rid = str(uuid.uuid4())[:12]
        rel = Relation(
            id=rid, type=type_, src_id=src_id, dst_id=dst_id,
            properties=properties or {},
        )
        self._relations[rid] = rel
        return rel

    def get_relation(self, ctx: RequestContextLike, rid: str) -> Relation | None:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        rel = self._relations.get(rid)
        if rel is None:
            return None
        # Verify both endpoints still belong to the caller's tenant.
        if self.get_instance(ctx, rel.src_id) is None:
            return None
        if self.get_instance(ctx, rel.dst_id) is None:
            return None
        return rel

    def list_relations(self, ctx: RequestContextLike) -> list[Relation]:
        if ctx is None or not getattr(ctx, "tenant_id", None):
            raise TenantAccessError("no tenant context")
        visible = {i.id for i in self.list_instances(ctx)}
        return [r for r in self._relations.values() if r.src_id in visible and r.dst_id in visible]


# GOVERN-03: module-level ``store`` singleton removed. Callers must
# instantiate via DI. Re-exported for the (deprecated) v1 sparql path
# during the Sunset window; new code must use DI.
def _default_store() -> InstanceStore:
    """Build a fresh InstanceStore. Used only by tests / legacy SPARQL path."""
    return InstanceStore()


# Backwards-compat alias for the 2026-08-07 → 2026-12-31 Sunset window.
# Existing v1 callers continue to work but receive a fresh store per
# process; cross-process sharing is the caller's responsibility. The
# ``store`` name is preserved so unit tests that mock ``mate_tech_ont.
# instances.store.store`` keep working until T3.
store = _default_store()
