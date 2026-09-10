"""ACT-08：Scenario 会话沙盒（最小版 —— Palantir Temporary Scenario 对位）。

Palantir 语义：对本体做隔离分叉，编辑全部留在沙盒内；最终经 merge
（单事务、受治理）落回主数据。Mate 取最小集：

- ``ScenarioOverlay`` —— 包裹任一 ``OntologyRepository``（或 duck-typed
  repo）的**会话内存 overlay**：读穿透主库，写（create/update/delete
  individual / link instance）留在 overlay；枚举读合并视图（overlay 优先）。
- ``pending_edits()`` —— 沙盒内暂存编辑导出为 EditOp 列表；
- ``merge_to_base()`` —— 把暂存编辑经 **apply_edit_set_now（即时 proposal
  + 单事务 + 审计）**落回主库 —— 治理不旁路（D3/D7 同管道）。

不做（v1 边界）：TTL（会话内存即销毁）、自动 rebase（merge 时以主库现状
为准，冲突 = 沙盒写覆盖）、schema 编辑、持久化情景（Persisted 等需求）。
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

from mate_kernel.action.edit_set import (
    OP_ADD_LINK,
    OP_CREATE_OBJECT,
    OP_DELETE_OBJECT,
    OP_REMOVE_LINK,
    OP_SET_PROPERTY,
    EditOp,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.instances.link_instance import LinkInstance

__all__ = ["ScenarioConflictError", "ScenarioOverlay"]


class _Absent:
    """哨兵：键不存在（保留 base）—— 与墓碑 None（隐藏）区分。"""


_ABSENT = _Absent()


class ScenarioConflictError(RuntimeError):
    """merge 时主库现状与沙盒假设冲突（v1：目标被主库删除/被并发修改）。"""


@dataclass
class ScenarioOverlay:
    """会话级本体状态分叉（读穿透 + 写留沙盒）。

    用法::

        base = PgOntologyRepository(dsn=...)
        with base.tenant_scope(t):
            sc = ScenarioOverlay(base)
            sc.set_property("ont.t.ind.ticket.t1", prop_rid, "critical")
            sc.list_individuals()  # 合并视图
            sc.pending_edits()  # 查看暂存
            sc.merge_to_base(action_rid="...", actor="planner-1")
    """

    base: Any  # OntologyRepository（duck-typed：用到的读/写方法）
    # 沙盒状态（None = 删除墓碑；Individual = 新建/修改）
    _individuals: dict[str, Individual | None] = field(default_factory=dict, init=False)
    _link_instances: dict[str, LinkInstance | None] = field(default_factory=dict, init=False)
    _pending: list[EditOp] = field(default_factory=list, init=False)

    # ───── 读（合并视图：overlay 优先，墓碑隐藏）─────

    def get_individual(self, rid: str) -> Individual:
        if rid in self._individuals:
            v = self._individuals[rid]
            if v is None:
                raise KeyError(f"Individual deleted in scenario: {rid}")
            return v
        return self.base.get_individual(rid)

    def list_individuals(self, class_rid: ClassRef | None = None) -> list[Individual]:
        # 合并视图：overlay 优先（修改/新建）；墓碑（None）隐藏；
        # absent（未在沙盒触碰）→ 保留 base 版本。
        out: list[Individual] = []
        seen: set[str] = set()
        for i in self.base.list_individuals(class_rid):
            ov = self._individuals.get(i.rid, _ABSENT)
            if ov is None:
                continue  # 墓碑
            item = i if ov is _ABSENT else ov
            if class_rid is None or item.class_rid == class_rid:
                out.append(item)
            seen.add(i.rid)
        for v in self._individuals.values():
            if (
                v is not None
                and v.rid not in seen
                and (class_rid is None or v.class_rid == class_rid)
            ):
                out.append(v)
        return out

    def list_link_instances(self) -> list[LinkInstance]:
        out: list[LinkInstance] = []
        seen: set[str] = set()
        for l in self.base.list_link_instances():
            ov = self._link_instances.get(l.rid, _ABSENT)
            if ov is None:
                continue
            out.append(l if ov is _ABSENT else ov)
            seen.add(l.rid)
        for v in self._link_instances.values():
            if v is not None and v.rid not in seen:
                out.append(v)
        return out

    def evaluate_object_set(self, os_: Any) -> list[Individual]:
        """ObjectSet 求值（合并视图快照 → InMemory 执行器）。"""
        from mate_kernel.objectset.compiler import InMemoryObjectSetExecutor

        return InMemoryObjectSetExecutor(self.list_individuals()).execute(os_)

    # ───── 写（留沙盒 + 暂存编辑）─────

    def set_property(self, rid: str, property_rid: str, value: Any) -> None:
        cur = self.get_individual(rid)
        merged = {k.rid: v for k, v in cur.props}
        old = merged.get(property_rid)
        merged[property_rid] = value
        self._individuals[rid] = replace(
            cur,
            props=tuple((ClassRef(k), v) for k, v in merged.items()),
            updated_at=datetime.now(UTC),
        )
        self._pending.append(
            EditOp(op=OP_SET_PROPERTY, target=rid, property_rid=property_rid, value=value)
        )

    def create_object(
        self,
        class_rid: str,
        primary_key: str,
        props: dict[str, Any],
    ) -> Individual:
        parts = class_rid.split(".")
        tenant = parts[1]
        cls_slug = parts[4] if len(parts) >= 6 else parts[3]
        rid = f"ont.{tenant}.ind.{cls_slug}.{primary_key}"
        now = datetime.now(UTC)
        ind = Individual(
            rid=rid,
            class_rid=ClassRef(class_rid),
            props=tuple((ClassRef(k), v) for k, v in props.items()),
            primary_key=str(primary_key),
            created_at=now,
            updated_at=now,
            tenant_id=tenant,
        )
        self._individuals[rid] = ind
        self._pending.append(
            EditOp(
                op=OP_CREATE_OBJECT,
                class_rid=class_rid,
                primary_key=str(primary_key),
                props=dict(props),
            )
        )
        return ind

    def delete_object(self, rid: str) -> None:
        self.get_individual(rid)  # 不存在（或已沙盒删除）→ KeyError
        self._individuals[rid] = None
        for lrid, li in list(self._link_instances.items()):
            if li is not None and (rid in (li.src, li.dst)):
                self._link_instances[lrid] = None
        for l in self.base.list_link_instances():
            if rid in (l.src, l.dst):
                self._link_instances.setdefault(l.rid, None)
        self._pending.append(EditOp(op=OP_DELETE_OBJECT, target=rid))

    def add_link(self, link_type_rid: str, src: str, dst: str) -> None:
        self.get_individual(src)
        self.get_individual(dst)
        tenant = src.split(".")[1] if "." in src else "t"
        lt_parts = link_type_rid.split(".")
        lt_slug = lt_parts[-2] if lt_parts[-1].startswith("v") else lt_parts[-1]
        li_rid = f"ont.{tenant}.lnk.{lt_slug}.sc-{len(self._link_instances) + 1}"
        self._link_instances[li_rid] = LinkInstance(
            rid=li_rid,
            link_type_rid=ClassRef(link_type_rid),
            src=src,
            dst=dst,
            props=(),
            created_at=datetime.now(UTC),
            tenant_id=tenant,
        )
        self._pending.append(EditOp(op=OP_ADD_LINK, link_type_rid=link_type_rid, src=src, dst=dst))

    def remove_link(self, link_instance_rid: str) -> None:
        li = self._link_instances.get(link_instance_rid)
        if li is None:
            li = next(
                (l for l in self.base.list_link_instances() if l.rid == link_instance_rid), None
            )
        if li is None:
            raise KeyError(f"LinkInstance not found: {link_instance_rid}")
        self._link_instances[link_instance_rid] = None
        self._pending.append(EditOp(op=OP_REMOVE_LINK, link_instance_rid=link_instance_rid))

    # ───── 暂存 / 合并 ─────

    def pending_edits(self) -> list[EditOp]:
        return list(self._pending)

    def discard(self) -> None:
        """丢弃沙盒（会话结束调用；Palantir Temporary 同语义）。"""
        self._individuals.clear()
        self._link_instances.clear()
        self._pending.clear()

    def merge_to_base(self, action_rid: str, actor: str) -> Any:
        """暂存编辑 → apply_edit_set_now（即时 proposal + 单事务 + 审计）。

        v1 冲突语义：以主库**现状**为基准执行（沙盒期间主库变化不检测，
        set_property 覆盖、create 走 upsert）；目标被主库删除 → 事务失败
        （ScenarioConflictError 由 KeyError/EditSetError 翻译）。
        """
        templates = [
            {
                "op": e.op,
                "target": e.target,
                "property_rid": e.property_rid,
                "value": e.value,
                "class_rid": e.class_rid,
                "primary_key": e.primary_key,
                "props": dict(e.props.items()) if e.props else {},
                "link_type_rid": e.link_type_rid,
                "src": e.src,
                "dst": e.dst,
                "link_instance_rid": e.link_instance_rid,
            }
            for e in self._pending
        ]
        try:
            result = self.base.apply_edit_set_now(
                action_rid,
                None,
                {},
                templates,
                actor=actor,
                impact_summary=f"scenario merge: {len(templates)} edits",
            )
        except KeyError as e:
            raise ScenarioConflictError(f"scenario conflict: base state changed ({e})") from e
        except ValueError as e:
            raise ScenarioConflictError(f"scenario conflict: {e}") from e
        self.discard()
        return result
