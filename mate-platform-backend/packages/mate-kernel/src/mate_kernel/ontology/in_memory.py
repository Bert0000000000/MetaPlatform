"""In-memory OntologyRepository —— KERNEL-01 测试 + dev runtime 默认实现。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, Function
from mate_kernel.action.engine import ActionService, SubmissionContext
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
)


# GOVERN-05: 默认 inline 源码 —— apply 没注册源码时 fallback，让 dev / 旧测试
# 仍可走通。最简 main(target, params) → params 原样返回。
_DEFAULT_INLINE_FN = "def main(target, params):\n    return params\n"

# 命名注册表：rid → source（seed_demo / 测试可用）
_INLINE_FUNCTIONS: dict[str, str] = {}


class InMemoryOntologyRepository(OntologyRepository):
    """线程不安全的 in-memory repo —— 单进程 dev / test 用。"""

    def __init__(self) -> None:
        self._properties: dict[ClassRef, Property] = {}
        self._object_types: dict[ClassRef, ObjectType] = {}
        self._link_types: dict[ClassRef, LinkType] = {}
        self._action_types: dict[ClassRef, ActionType] = {}
        self._interfaces: dict[ClassRef, Interface] = {}
        self._versions: dict[ClassRef, list[Version]] = {}
        self._individuals: dict[str, Individual] = {}
        self._link_instances: dict[str, LinkInstance] = {}
        self._axioms: dict[ClassRef, Axiom] = {}
        self._functions: dict[ClassRef, Function] = {}
        self._action_service = ActionService()
        # GOVERN-05: FunctionResolver 让 upsert_function / set_function_executor 注入。
        from .function_resolver import InMemoryFunctionResolver
        self._function_resolver: InMemoryFunctionResolver = InMemoryFunctionResolver()
        self._function_executor: Any = None  # FunctionExecutor | None

    def set_function_executor(self, executor: Any) -> None:
        """GOVERN-05: 注入 FunctionExecutor；同步注入 resolver 到 ActionService。

        executor 形如 ``_SimplePythonExecutor`` / ``SubprocessExecutor``。
        """
        self._function_executor = executor
        # 同步 ActionService 内 _executors + _resolver（每个 function_ref 注册相同 executor）
        for fn_rid in self._functions:
            self._action_service.register_function_ref(
                fn_rid.rid, executor, self._function_resolver,
            )
        self._action_service.set_resolver(self._function_resolver)

    # ───── identity ─────

    def resolve_class_ref(self, rid: str) -> ClassRef:
        return ClassRef(rid)

    def snapshot_version(self, class_rid: ClassRef, author: str, parent: str | None, change_set: tuple[str, ...]) -> Version:
        existing = self._versions.get(class_rid, [])
        n = len(existing) + 1
        rid = f"ont.{class_rid.rid.split('.')[1]}.ver.{class_rid.rid.split('.')[-1]}.v{n}"
        v = Version(
            rid=rid,
            class_ref=class_rid,
            parent_rid=parent or (existing[-1].rid if existing else None),
            created_at=datetime.now(timezone.utc),
            author=author,
            change_set=change_set,
        )
        self._versions.setdefault(class_rid, []).append(v)
        return v

    def list_versions(self, class_rid: ClassRef) -> list[Version]:
        return list(self._versions.get(class_rid, []))

    # ───── types ─────

    def upsert_property(self, p: Property) -> Property:
        self._properties[p.rid] = p
        return p

    def upsert_object_type(self, ot: ObjectType) -> ObjectType:
        for p in ot.properties:
            self._properties[p.rid] = p
        self._object_types[ot.rid] = ot
        return ot

    def upsert_link_type(self, lt: LinkType) -> LinkType:
        for p in lt.link_properties:
            self._properties[p.rid] = p
        self._link_types[lt.rid] = lt
        return lt

    def upsert_action_type(self, at: ActionType) -> ActionType:
        for p in at.parameters:
            self._properties[p.rid] = p
        self._action_types[at.rid] = at
        return at

    def upsert_interface(self, i: Interface) -> Interface:
        for p in i.properties:
            self._properties[p.rid] = p
        self._interfaces[i.rid] = i
        return i

    def list_object_types(self, limit: int, offset: int) -> list[ObjectType]:
        items = list(self._object_types.values())
        return items[offset : offset + limit]

    def list_link_types(self) -> list[LinkType]:
        return list(self._link_types.values())

    def list_action_types(self) -> list[ActionType]:
        return list(self._action_types.values())

    def list_interfaces(self) -> list[Interface]:
        return list(self._interfaces.values())

    def get_object_type(self, rid: ClassRef) -> ObjectType:
        return self._object_types[rid]

    def get_link_type(self, rid: ClassRef) -> LinkType:
        return self._link_types[rid]

    def get_action_type(self, rid: ClassRef) -> ActionType:
        return self._action_types[rid]

    # ───── instances ─────

    def create_individual(self, ind: Individual) -> Individual:
        self._individuals[ind.rid] = ind
        return ind

    def get_individual(self, rid: str) -> Individual:
        return self._individuals[rid]

    def list_individuals(self, class_rid: ClassRef | None) -> list[Individual]:
        items = self._individuals.values()
        if class_rid is not None:
            items = [i for i in items if i.class_rid == class_rid]
        return list(items)

    def create_link_instance(self, li: LinkInstance) -> LinkInstance:
        self._link_instances[li.rid] = li
        return li

    def list_link_instances(self) -> list[LinkInstance]:
        return list(self._link_instances.values())

    # ───── reasoning ─────

    def upsert_axiom(self, ax: Axiom) -> Axiom:
        self._axioms[ax.rid] = ax
        return ax

    def list_axioms(self) -> list[Axiom]:
        return list(self._axioms.values())

    def upsert_function(self, f: Function) -> Function:
        self._functions[f.rid] = f
        # GOVERN-05: source_ref 形如 ``inline://<rid>`` → source 来自 _inline_sources；
        # 默认占位 main（仅返回参数 dict），让 dev 没注册源码时也能 apply。
        # 真实源码走 seed_demo / register_function_source 注入。
        if f.source_ref.startswith("inline://"):
            self._function_resolver.register(
                f.language,
                f.source_ref,
                _INLINE_FUNCTIONS.get(f.rid.rid, _DEFAULT_INLINE_FN),
            )
        return f

    def list_functions(self) -> list[Function]:
        return list(self._functions.values())

    # ───── query / apply ─────

    def evaluate_object_set(self, os_: ObjectSet) -> list[Individual]:
        # dev runtime: 委托给 InMemoryObjectSetExecutor，filter_expr / sort 真正生效
        from mate_kernel.objectset.compiler import InMemoryObjectSetExecutor
        items = list(self._individuals.values())
        return InMemoryObjectSetExecutor(items).execute(os_)

    def apply_action(self, action_rid: ClassRef, target_iid: str, parameters: dict[str, Any], provenance: dict[str, Any]) -> tuple[datetime, list[str]]:
        # ACTION-03 协议：submission_criteria 求值 → Function 落库 → side_effects。
        # GOVERN-05: function_result 写回 target.props（按 at.parameters 短名）。
        if action_rid not in self._action_types:
            raise KeyError(f"action not found: {action_rid}")
        at = self._action_types[action_rid]
        target = self._individuals.get(target_iid)
        if target is None:
            raise KeyError(f"target not found: {target_iid}")
        target_props: dict[str, Any] = {
            k.rid: v for k, v in target.props
        }
        outcome = self._action_service.apply(
            action_rid=at.rid.rid,
            submission_criteria=at.submission_criteria,
            function_ref=at.function_ref.rid,
            on_rid=at.on[0].rid if at.on else "",
            target_iid=target_iid,
            parameters=parameters,
            side_effects=at.side_effects,
            ctx=SubmissionContext(
                actor=str(provenance.get("actor", "?")),
                tenant_id=str(provenance.get("tenant_id", "")),
                hitl_token=str(provenance.get("hitl_token", "")) or None,
            ),
            target_props=target_props,
            proposal_id=provenance.get("proposal_id"),
        )
        now = outcome.applied_at
        if parameters or outcome.function_result is not None:
            # 短名（decision / reason）→ 完整 Property rid（at.parameters 声明的参数表）。
            # rid 形如 ont.<tenant>.prop.<slug>.v1，slug 在版本后缀之前。
            param_rids: dict[str, ClassRef] = {}
            for p in at.parameters:
                parts = p.rid.rid.split(".")
                slug = parts[-2] if parts[-1].startswith("v") else parts[-1]
                param_rids[slug] = p.rid
            from dataclasses import replace
            merged = dict(target.props)
            for key, value in parameters.items():
                resolved = ClassRef(key) if key.startswith("ont.") else param_rids.get(key)
                if resolved is None:
                    raise KeyError(f"unknown parameter {key!r} for action={action_rid}")
                merged[resolved] = value
            # GOVERN-05: function_result (dict) 字段填到 at.parameters 短名对应 prop
            # parameters 显式值优先；缺位用 fn_result
            if isinstance(outcome.function_result, dict):
                for slug, value in outcome.function_result.items():
                    rid_for_slug = param_rids.get(slug)
                    if rid_for_slug is not None and slug not in parameters:
                        merged[rid_for_slug] = value
            self._individuals[target_iid] = replace(
                target, props=tuple(merged.items()), updated_at=now,
            )
        return now, outcome.side_effects_emitted