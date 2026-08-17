"""In-memory OntologyRepository —— KERNEL-01 测试 + dev runtime 默认实现。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet

if TYPE_CHECKING:
    from mate_kernel.objectset.ir import ObjectSetQuery, QueryResult
from mate_kernel.ontology.reasoning import Axiom, Function
from mate_kernel.action.engine import ActionService, SubmissionContext
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
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
        # MP-SAL-02: 对象语义检索（embedder + 属性级 embedding 缓存）
        self._embedder: Any = None
        self._embeddings: dict[str, dict[str, Any]] = {}
        # MP-SAL-04: side_effect outbox 写回（None = dev 未接）
        self._outbox_writer: Any = None
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
        if self._embedder is not None:
            self._index_embeddings(ind)
        return ind

    def set_embedder(self, embedder: Any) -> None:
        """MP-SAL-02: 注入 embedder（embed(text)->list[float]）；None = 跳过索引。"""
        self._embedder = embedder

    def _index_embeddings(self, ind: Individual) -> None:
        assert self._embedder is not None
        for prop_ref, value in ind.props:
            parts = prop_ref.rid.split(".")
            slug = parts[3] if len(parts) >= 5 else parts[-1]
            self._embeddings[f"{ind.rid}#{prop_ref.rid}"] = {
                "individual_rid": ind.rid,
                "class_rid": ind.class_rid.rid,
                "property_rid": prop_ref.rid,
                "value_text": str(value),
                "embedding": self._embedder.embed(f"{slug} {value}"),
            }

    def search_objects(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """MP-SAL-02: 对象语义检索 → 对象卡片（与 PG 侧同语义，dev/test 用）。"""
        if self._embedder is None:
            return []
        import math  # noqa: PLC0415

        qvec = self._embedder.embed(text)
        qnorm = math.sqrt(sum(x * x for x in qvec)) or 1.0
        per_individual: dict[str, list[dict[str, Any]]] = {}
        class_of: dict[str, str] = {}
        for chunk in self._embeddings.values():
            if class_rid and chunk["class_rid"] != class_rid:
                continue
            vec = chunk["embedding"]
            norm = math.sqrt(sum(x * x for x in vec)) or 1.0
            score = sum(x * y for x, y in zip(qvec, vec, strict=True)) / (qnorm * norm)
            if score <= 0.0:
                continue
            class_of[chunk["individual_rid"]] = chunk["class_rid"]
            per_individual.setdefault(chunk["individual_rid"], []).append({
                "property_rid": chunk["property_rid"],
                "value_text": chunk["value_text"],
                "score": score,
            })
        cards: list[dict[str, Any]] = []
        for rid_key, matched in per_individual.items():
            matched.sort(key=lambda m: m["score"], reverse=True)
            top = matched[0]
            card_text = f"{rid_key}:\n- {top['value_text']}"
            cards.append({
                "individual_rid": rid_key,
                "class_rid": class_of[rid_key],
                "score": top["score"],
                "matched": matched[:3],
                "card_text": card_text,
            })
        cards.sort(key=lambda c: c["score"], reverse=True)
        return cards[:top_k]

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

    def execute_object_query(self, q: "ObjectSetQuery") -> "QueryResult":
        """MP-SAL-01: 结构化 IR 查询（ADR-0043），与 PG 侧同语义。"""
        from mate_kernel.objectset.ir import InMemoryQueryExecutor
        executor = InMemoryQueryExecutor(
            individuals=tuple(self._individuals.values()),
            links=tuple(self._link_instances.values()),
            object_types=tuple(self._object_types.values()),
        )
        return executor.execute(q)

    # ───── MP-SAL-04: proposal 状态机 + outbox（ADR-0044 §2.2-2.3）─────

    def set_outbox_writer(self, writer: Any) -> None:
        """注入 outbox 写回：writer(event_type, tenant_id, payload) -> event_id | None。"""
        self._outbox_writer = writer

    def _side_effect_emitter_hook(
        self, action_rid: str, target_iid: str, proposal_id: Any,
    ) -> Any:
        if self._outbox_writer is None:
            return None

        def _emit(se: str) -> str | None:
            try:
                return str(self._outbox_writer(se, "", {
                    "action_rid": action_rid, "target_iid": target_iid,
                    "proposal_id": proposal_id,
                }))
            except Exception:  # noqa: BLE001
                return None

        return _emit

    def propose_action(
        self, action_rid: ClassRef, parameters: dict[str, Any],
        target_iid: str | None, impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
    ) -> Any:
        if action_rid not in self._action_types:
            raise KeyError(f"action not found: {action_rid}")
        at = self._action_types[action_rid]
        return self._action_service.propose(
            action_rid=at.rid.rid, parameters=parameters, target_iid=target_iid,
            impact_summary=impact_summary, expected_diff=expected_diff,
        )

    # ───── MP-SAL-04b: 文本→本体 ingest（kind=create_instance / model_type）─────

    def propose_create_instance(
        self, class_rid: str, props: dict[str, Any],
        impact_summary: str, expected_diff: dict[str, Any] | None = None,
    ) -> Any:
        """文本抽取字段 → 新建实例提议（subject=class rid，payload=props）。"""
        self.get_object_type(ClassRef(class_rid))  # 类不存在 → KeyError
        return self._action_service.propose(
            action_rid=class_rid, parameters={"props": dict(props)},
            target_iid=None, impact_summary=impact_summary,
            expected_diff=expected_diff, kind="create_instance",
        )

    def propose_model_type(
        self, type_def: dict[str, Any], impact_summary: str,
    ) -> Any:
        """文本→新类型定义提议（subject=新类型 rid，payload=type_def）。"""
        if "rid" not in type_def:
            raise ValueError("type_def must carry 'rid'")
        return self._action_service.propose(
            action_rid=str(type_def["rid"]), parameters={"type_def": type_def},
            target_iid=None, impact_summary=impact_summary,
            expected_diff={"+type": type_def["rid"]}, kind="model_type",
        )

    def execute_proposal(self, proposal_id: str) -> Any:
        """confirmed proposal 的落库执行（按 kind 分派）。

        create_instance → 新建 Individual（rid = ont.<t>.ind.<cls>.<pk>）
        model_type      → upsert ObjectType
        action          → 拒绝（走 /action-types/{rid}/apply 唯一写入口）
        """
        from datetime import UTC as _UTC, datetime as _dt

        from mate_kernel.action.engine import ProposalNotConfirmed, ProposalStatus

        p = self._action_service.get_proposal(proposal_id)
        if p.status is not ProposalStatus.CONFIRMED:
            raise ProposalNotConfirmed(
                f"proposal {proposal_id} is {p.status.value}; execute requires a confirmed proposal"
            )
        if p.kind == "action":
            raise ValueError(
                "action-kind proposals execute via /action-types/{rid}/apply, not /execute"
            )
        if p.kind == "create_instance":
            ot = self.get_object_type(ClassRef(p.action_rid))
            props_in: dict[str, Any] = dict(p.parameters.get("props") or {})
            slug_to_ref: dict[str, ClassRef] = {
                q.rid.rid.split(".")[3]: q.rid for q in ot.properties
            }
            pk_slug = ot.primary_key[0].rid.split(".")[3]
            pk_value = props_in.get(pk_slug)
            if pk_value is None:
                raise ValueError(f"primary key '{pk_slug}' required to create {p.action_rid}")
            rid_parts = ot.rid.rid.split(".")
            tenant, cls_slug = rid_parts[1], rid_parts[3]
            resolved: list[tuple[ClassRef, Any]] = []
            for key, value in props_in.items():
                ref = slug_to_ref.get(key) or (
                    ClassRef(key) if key.startswith("ont.") else None
                )
                if ref is None:
                    raise KeyError(f"unknown property {key!r} for {p.action_rid}")
                resolved.append((ref, value))
            ind = Individual(
                rid=f"ont.{tenant}.ind.{cls_slug}.{pk_value}",
                class_rid=ot.rid,
                props=tuple(resolved),
                primary_key=str(pk_value),
                created_at=_dt.now(_UTC),
                updated_at=_dt.now(_UTC),
                tenant_id=tenant,
            )
            self.create_individual(ind)
            self._action_service.mark_applied(proposal_id)
            return ind
        if p.kind == "model_type":
            ot = self._type_def_to_object_type(p.parameters["type_def"])
            self.upsert_object_type(ot)
            self._action_service.mark_applied(proposal_id)
            return ot
        raise ValueError(f"unknown proposal kind: {p.kind!r}")

    @staticmethod
    def _type_def_to_object_type(type_def: dict[str, Any]) -> ObjectType:
        return ObjectType(
            rid=ClassRef(str(type_def["rid"])),
            primary_key=tuple(ClassRef(pk) for pk in type_def["primary_key"]),
            properties=tuple(
                Property(
                    rid=ClassRef(pd["rid"]), type_id=pd.get("type_id", "string"),
                    nullable=pd.get("nullable", True),
                    primary_key=pd.get("primary_key", False),
                    title=pd.get("title", ""), format=PropertyFormat(pd.get("format", "string")),
                )
                for pd in type_def.get("properties", ())
            ),
            interfaces=tuple(ClassRef(i) for i in type_def.get("interfaces", ())),
            display_name=type_def.get("display_name", ""),
            marking=tuple(type_def.get("marking", ())),
        )

    def get_proposal(self, proposal_id: str) -> Any:
        return self._action_service.get_proposal(proposal_id)

    def list_proposals(self) -> list[Any]:
        return list(self._action_service._proposals.values())  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]

    def confirm_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        return self._action_service.confirm_proposal(proposal_id, confirmed_by=confirmed_by)

    def reject_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        return self._action_service.reject_proposal(proposal_id, confirmed_by=confirmed_by)

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
            side_effect_emitter=self._side_effect_emitter_hook(
                at.rid.rid, target_iid, provenance.get("proposal_id"),
            ),
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