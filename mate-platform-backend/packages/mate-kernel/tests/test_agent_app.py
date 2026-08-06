"""AGENT-APP-01 App 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.app import (
    AppAgent,
    AppDefinition,
    PageKind,
    PageManifest,
    Slot,
    SlotKind,
    build_crud_app,
)
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _cls() -> ClassRef:
    return ClassRef(rid="ont.acme.cls.order.v1")


def _page(slug: str = "order-list", kind: PageKind = PageKind.LIST) -> PageManifest:
    return PageManifest(
        page_rid=f"app.acme.page.{slug}.v1",
        kind=kind,
        bound_class_rid=_cls(),
        title=slug,
        slots=(Slot(slot_id="t", kind=SlotKind.TABLE, target_rid=_cls().rid),),
    )


class TestAppDefinition:
    def test_pages_required(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            AppDefinition(app_rid="app.acme.app.x.v1", pages=(), name="x")

    def test_page_by_kind(self) -> None:
        app = AppDefinition(
            app_rid="app.acme.app.order.v1",
            name="Order",
            pages=(_page("order-list", PageKind.LIST), _page("order-detail", PageKind.DETAIL)),
        )
        assert app.page_by_kind(PageKind.LIST) is not None
        assert app.page_by_kind(PageKind.DASHBOARD) is None


class TestAppAgent:
    def _a(self) -> AppAgent:
        return AppAgent()

    def test_publish(self) -> None:
        a = self._a()
        app = AppDefinition(
            app_rid="app.acme.app.order.v1",
            name="Order",
            pages=(_page(),),
        )
        a.publish(app, Manager(_ctx()))
        assert a.get_app(app.app_rid) is app

    def test_publish_duplicate_page_raises(self) -> None:
        a = self._a()
        app1 = AppDefinition(app_rid="app.acme.app.a.v1", name="A", pages=(_page("x"),))
        app2 = AppDefinition(app_rid="app.acme.app.b.v1", name="B", pages=(_page("x"),))
        a.publish(app1, Manager(_ctx()))
        with pytest.raises(ValueError, match="page already published"):
            a.publish(app2, Manager(_ctx()))

    def test_publish_tracks_change(self) -> None:
        a = self._a()
        mgr = Manager(_ctx())
        app = AppDefinition(app_rid="app.acme.app.order.v1", name="Order", pages=(_page(),))
        a.publish(app, mgr)
        changes = mgr.drain_changes()
        assert len(changes) == 1
        assert changes[0].target_rid == app.app_rid

    def test_action_buttons(self) -> None:
        a = self._a()
        page = PageManifest(
            page_rid="app.acme.page.order.v1",
            kind=PageKind.DETAIL,
            bound_class_rid=_cls(),
            title="Order",
            slots=(
                Slot(slot_id="t", kind=SlotKind.TABLE, target_rid=_cls().rid),
                Slot(slot_id="approve", kind=SlotKind.ACTION_BUTTON, target_rid="ont.acme.act.approve", label="Approve"),
                Slot(slot_id="reject", kind=SlotKind.ACTION_BUTTON, target_rid="ont.acme.act.reject", label="Reject"),
            ),
        )
        app = AppDefinition(app_rid="app.acme.app.order.v1", name="Order", pages=(page,))
        a.publish(app, Manager(_ctx()))
        buttons = a.action_buttons(app.app_rid, page.page_rid)
        assert len(buttons) == 2
        assert {b.slot_id for b in buttons} == {"approve", "reject"}

    def test_get_unknown_raises(self) -> None:
        a = self._a()
        with pytest.raises(KeyError):
            a.get_app("app.acme.app.missing.v1")


class TestBuildCrudApp:
    def test_three_pages(self) -> None:
        app = build_crud_app(
            app_rid="app.acme.app.order.v1",
            bound_class=_cls(),
            list_title="Order",
        )
        assert len(app.pages) == 3
        kinds = {p.kind for p in app.pages}
        assert kinds == {PageKind.LIST, PageKind.DETAIL, PageKind.FORM}

    def test_with_actions(self) -> None:
        app = build_crud_app(
            app_rid="app.acme.app.order.v1",
            bound_class=_cls(),
            list_title="Order",
            action_rids=("ont.acme.act.approve", "ont.acme.act.cancel"),
        )
        detail = app.page_by_kind(PageKind.DETAIL)
        assert detail is not None
        buttons = [s for s in detail.slots if s.kind == SlotKind.ACTION_BUTTON]
        assert len(buttons) == 2

    def test_publish_crud_app(self) -> None:
        a = AppAgent()
        app = build_crud_app(
            app_rid="app.acme.app.order.v1",
            bound_class=_cls(),
            list_title="Order",
        )
        a.publish(app, Manager(_ctx()))
        assert a.list_pages(app.app_rid) == app.pages


class TestSelectorRoutedToApp:
    def test_app_rid_routes_to_app(self) -> None:
        from mate_kernel.agent.orchestrator import AgentRole, AgentSelector
        assert AgentSelector().select("app.acme.app.order.v1") == AgentRole.APP
