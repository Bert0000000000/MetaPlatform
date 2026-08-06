"""MANAGER-05 Manager 协议测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.manager.protocol import (
    ChangeKind,
    Manager,
    ManagerContext,
    ManagerError,
    ManagerLimits,
    NullChangeSink,
    TenantMismatchError,
    TrackedChange,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.identity.version import Version


def _ctx(tenant: str = "acme", user: str = "alice") -> ManagerContext:
    return ManagerContext(user_id=user, tenant_id=tenant, session_id="s-1")


def _cls(slug: str = "order") -> ClassRef:
    return ClassRef(rid=f"ont.acme.cls.{slug}.v1")


def _ver(slug: str = "order", v: int = 1) -> Version:
    return Version(
        rid=f"ont.acme.ver.{slug}.v{v}",
        class_ref=_cls(slug),
        parent_rid=None,
        created_at=datetime.now(timezone.utc),
        author="alice",
    )


class TestManagerInit:
    def test_requires_user_tenant_session(self) -> None:
        with pytest.raises(ManagerError, match="required"):
            Manager(ManagerContext(user_id="", tenant_id="acme", session_id="s"))
        with pytest.raises(ManagerError, match="required"):
            Manager(ManagerContext(user_id="u", tenant_id="", session_id="s"))
        with pytest.raises(ManagerError, match="required"):
            Manager(ManagerContext(user_id="u", tenant_id="t", session_id=""))

    def test_default_sink(self) -> None:
        m = Manager(_ctx())
        assert isinstance(m.sink, NullChangeSink)


class TestCache:
    def test_cache_and_resolve_class(self) -> None:
        m = Manager(_ctx())
        ref = _cls("order")
        m.cache_class(ref)
        assert m.resolve_cached_class(ref.rid) is ref
        assert m.resolve_cached_class("missing") is None

    def test_cache_idempotent(self) -> None:
        m = Manager(_ctx())
        ref = _cls("order")
        m.cache_class(ref)
        m.cache_class(ref)
        # No error, same instance
        assert m.resolve_cached_class(ref.rid) is ref

    def test_cache_version(self) -> None:
        m = Manager(_ctx())
        v = _ver()
        m.cache_version(v)
        assert m.resolve_cached_version(v.rid) is v

    def test_cache_eviction_at_limit(self) -> None:
        limits = ManagerLimits(max_cached_versions=2)
        m = Manager(_ctx(), limits=limits)
        a = ClassRef(rid="ont.acme.cls.a.v1")
        b = ClassRef(rid="ont.acme.cls.b.v1")
        c = ClassRef(rid="ont.acme.cls.c.v1")
        m.cache_class(a)
        m.cache_class(b)
        m.cache_class(c)  # 触发"满则不写"
        # 不抛异常；a / b 仍能找到
        assert m.resolve_cached_class(a.rid) is a
        assert m.resolve_cached_class(b.rid) is b


class TestTrack:
    def _sink(self) -> tuple[list, list]:
        emitted: list = []

        class S:
            def emit(self, c):
                emitted.append(c)

        return S(), emitted

    def test_track_emits(self) -> None:
        s, emitted = self._sink()
        m = Manager(_ctx(), sink=s)
        change = m.track(ChangeKind.SNAPSHOT_VERSION, "ont.acme.ver.x.v1", payload={"a": 1})
        assert change.kind == ChangeKind.SNAPSHOT_VERSION
        assert change.actor == "alice"
        assert emitted == [change]

    def test_track_records_actor_override(self) -> None:
        m = Manager(_ctx())
        c = m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1", actor="bob")
        assert c.actor == "bob"

    def test_pending_count(self) -> None:
        m = Manager(_ctx())
        m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1")
        m.track(ChangeKind.APPLY_ACTION, "ont.acme.act.x.v1")
        assert m.pending_changes_count() == 2

    def test_drain_clears(self) -> None:
        m = Manager(_ctx())
        m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1")
        drained = m.drain_changes()
        assert len(drained) == 1
        assert m.pending_changes_count() == 0

    def test_track_limit_raises(self) -> None:
        limits = ManagerLimits(max_tracked_changes=1)
        m = Manager(_ctx(), limits=limits)
        m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.a.v1")
        with pytest.raises(ManagerError, match="exceeded limit"):
            m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.b.v1")

    def test_hash_distinguishes(self) -> None:
        m = Manager(_ctx())
        c1 = m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1", payload={"a": 1})
        c2 = m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1", payload={"a": 2})
        assert c1.payload_hash != c2.payload_hash

    def test_hash_none(self) -> None:
        m = Manager(_ctx())
        c = m.track(ChangeKind.REGISTER_CLASS, "ont.acme.cls.x.v1")
        assert c.payload_hash == "-" * 8


class TestTenantAssertion:
    def test_same_tenant_ok(self) -> None:
        m = Manager(_ctx(tenant="acme"))
        m.assert_same_tenant("acme")  # 不抛

    def test_different_tenant_raises(self) -> None:
        m = Manager(_ctx(tenant="acme"))
        with pytest.raises(TenantMismatchError, match="resource tenant"):
            m.assert_same_tenant("evil")


class TestTrackedChange:
    def test_frozen(self) -> None:
        c = TrackedChange(
            kind=ChangeKind.REGISTER_CLASS,
            target_rid="ont.acme.cls.x.v1",
            payload_hash="abcd1234",
            occurred_at=datetime.now(timezone.utc),
            actor="alice",
        )
        with pytest.raises(Exception):
            c.actor = "evil"  # type: ignore[misc]


class TestNullChangeSink:
    def test_silent_emit(self) -> None:
        # 不抛
        NullChangeSink().emit(
            TrackedChange(
                kind=ChangeKind.REGISTER_CLASS,
                target_rid="ont.acme.cls.x.v1",
                payload_hash="abcd1234",
                occurred_at=datetime.now(timezone.utc),
                actor="alice",
            )
        )
