"""AGENT-APP-01: App 数字员工 —— 低代码应用生成。

7+1 中的「App 员工」—— 把 ObjectType 映射为前端可渲染的 UI manifest。
- PageManifest：每个页面（list / detail / form / dashboard）
- Slot：UI 块（字段 / 列表 / 链接 / 操作按钮）
- ActionButton：调用 ActionType.apply 的按钮（带 submission_criteria 显示）

rid 前缀 `app.<tenant>.app.<slug>.v<n>` / `app.<tenant>.page.<slug>.v<n>`。
M3 范围：内存版 manifest 编译，不接前端框架。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef


class PageKind(str, Enum):
    LIST = "list"
    DETAIL = "detail"
    FORM = "form"
    DASHBOARD = "dashboard"


class SlotKind(str, Enum):
    FIELD = "field"            # 单字段显示
    TABLE = "table"            # 列表
    LINK = "link"              # 跳转到详情
    ACTION_BUTTON = "action_button"  # 调用 ActionType
    CHART = "chart"


@dataclass(frozen=True, slots=True)
class Slot:
    slot_id: str
    kind: SlotKind
    target_rid: str | None = None  # 属性 rid / ActionType rid / LinkType rid
    label: str | None = None
    required: bool = False         # FORM 字段是否必填


@dataclass(frozen=True, slots=True)
class PageManifest:
    page_rid: str  # app.<tenant>.page.<slug>.v<n>
    kind: PageKind
    bound_class_rid: ClassRef
    slots: tuple[Slot, ...]
    title: str
    description: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True, slots=True)
class AppDefinition:
    app_rid: str  # app.<tenant>.app.<slug>.v<n>
    pages: tuple[PageManifest, ...]
    name: str
    description: str = ""

    def __post_init__(self) -> None:
        if not self.pages:
            raise ValueError("AppDefinition.pages must be non-empty")

    def page_by_kind(self, kind: PageKind) -> PageManifest | None:
        for p in self.pages:
            if p.kind == kind:
                return p
        return None


class AppAgent:
    """App 数字员工 = manifest 构造 + 校验 + 索引。"""

    def __init__(self) -> None:
        self._apps: dict[str, AppDefinition] = {}
        self._pages: dict[str, PageManifest] = {}

    def publish(self, app: AppDefinition, manager: Manager) -> None:
        for page in app.pages:
            if page.page_rid in self._pages:
                raise ValueError(f"page already published: {page.page_rid}")
            self._pages[page.page_rid] = page
        self._apps[app.app_rid] = app
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.REGISTER_CLASS,
            target_rid=app.app_rid,
            payload={"pages": [p.page_rid for p in app.pages]},
        )

    def get_app(self, app_rid: str) -> AppDefinition:
        a = self._apps.get(app_rid)
        if a is None:
            raise KeyError(f"app not found: {app_rid}")
        return a

    def list_pages(self, app_rid: str) -> tuple[PageManifest, ...]:
        return self.get_app(app_rid).pages

    def action_buttons(self, app_rid: str, page_rid: str) -> tuple[Slot, ...]:
        page = self._pages.get(page_rid)
        if page is None:
            raise KeyError(f"page not found: {page_rid}")
        return tuple(s for s in page.slots if s.kind == SlotKind.ACTION_BUTTON)


def build_crud_app(
    app_rid: str,
    bound_class: ClassRef,
    list_title: str,
    action_rids: tuple[str, ...] = (),
) -> AppDefinition:
    """开箱即用：把一个 ObjectType 生成 list / detail / form 三页。"""
    cls_slug = bound_class.rid.split(".")[3] if "." in bound_class.rid else "obj"
    base = app_rid.rsplit(".", 2)[0]  # 取前缀
    return AppDefinition(
        app_rid=app_rid,
        name=list_title,
        description=f"CRUD app for {bound_class.rid}",
        pages=(
            PageManifest(
                page_rid=f"{base}.page.{cls_slug}-list.v1",
                kind=PageKind.LIST,
                bound_class_rid=bound_class,
                title=list_title,
                slots=(
                    Slot(slot_id="table", kind=SlotKind.TABLE, target_rid=bound_class.rid),
                ),
            ),
            PageManifest(
                page_rid=f"{base}.page.{cls_slug}-detail.v1",
                kind=PageKind.DETAIL,
                bound_class_rid=bound_class,
                title=f"{list_title} · 详情",
                slots=(
                    Slot(slot_id="props", kind=SlotKind.FIELD, target_rid=bound_class.rid),
                )
                + tuple(
                    Slot(
                        slot_id=f"act-{i}",
                        kind=SlotKind.ACTION_BUTTON,
                        target_rid=rid,
                        label=rid.split(".")[-1],
                    )
                    for i, rid in enumerate(action_rids)
                ),
            ),
            PageManifest(
                page_rid=f"{base}.page.{cls_slug}-form.v1",
                kind=PageKind.FORM,
                bound_class_rid=bound_class,
                title=f"{list_title} · 表单",
                slots=(
                    Slot(slot_id="primary", kind=SlotKind.FIELD, target_rid=bound_class.rid, required=True),
                ),
            ),
        ),
    )


__all__ = [
    "AppAgent",
    "AppDefinition",
    "PageKind",
    "PageManifest",
    "Slot",
    "SlotKind",
    "build_crud_app",
]
