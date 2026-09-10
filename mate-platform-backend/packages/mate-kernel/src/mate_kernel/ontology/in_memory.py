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
        # MP-SAL-05: 流程编排定义持久化
        self._flow_definitions: dict[str, dict[str, Any]] = {}
        # SEC-12：行列级安全策略
        self._security_policies: dict[str, dict[str, Any]] = {}
        # GOV-16：使用量计数器
        self._usage_counters: dict[tuple[str, str], int] = {}
        # G33：schema WIP 暂存
        self._schema_wip: dict[str, dict[str, Any]] = {}
        # G23：Function 别名 + 版本快照
        self._function_aliases: dict[str, str] = {}
        self._function_versions: dict[str, list[dict[str, Any]]] = {}
        # G20：webhook 订阅/投递/outbox 事件镜像
        self._webhook_subs: dict[str, dict[str, Any]] = {}
        self._webhook_deliveries: list[dict[str, Any]] = []
        self._outbox_events: dict[str, dict[str, Any]] = {}
        # writeback 双流合并：用户编辑覆盖层（rid, prop_rid）
        self._edit_overlay: set[tuple[str, str]] = set()
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
        # EXP-02：值类型宽松校验（已注册 type_id 的 format 一致性）
        from .types.value_types import get_value_type

        for p in ot.properties:
            vt = get_value_type(p.type_id)
            if vt is not None and vt.format is not p.format:
                raise ValueError(
                    f"property {p.rid.rid} format {p.format.value!r} != "
                    f"value type {p.type_id!r} declared format {vt.format.value!r}"
                )
        # EXP-01：已注册 Interface 约束 fail-fast（属性签名维度）
        from .types.interface import validate_interface_constraints

        for ref in ot.interfaces:
            key = ClassRef(ref.rid) if hasattr(ref, "rid") else ClassRef(str(ref))
            ifc = self._interfaces.get(key)
            if ifc is None:
                continue  # 未注册 → 先声明后注册合法
            violations = validate_interface_constraints(ot, ifc)
            if violations:
                raise ValueError("; ".join(violations))
        # EXP-01：parent_class 环检测 + subclass 公理同步（单一事实源）
        if ot.parent_class is not None:
            parent_rid = ot.parent_class.rid
            seen = {ot.rid.rid}
            cursor: str | None = parent_rid
            while cursor is not None and cursor:
                if cursor in seen:
                    raise ValueError(
                        f"parent_class cycle detected at {cursor!r}"
                    )
                seen.add(cursor)
                parent_ot = self._object_types.get(ClassRef(cursor))
                cursor = (
                    parent_ot.parent_class.rid
                    if parent_ot is not None and parent_ot.parent_class is not None
                    else None
                )
        self._object_types[ot.rid] = ot
        # 公理 rid 由类型 rid 派生（obj → ax.parent 段替换，与 PG 侧同规则）；
        # 清空 parent → 禁用（保留记录，metadata 标记 enabled=false）
        try:
            _head, _t, _kind, _rest = ot.rid.rid.split(".", 3)
            ax_rid = f"{_head}.{_t}.ax.parent.{_rest}"
        except ValueError:
            return ot
        from .reasoning.axiom import AxiomKind

        existing_ax = self._axioms.get(ClassRef(ax_rid))
        new_kind = AxiomKind(AxiomKind.SUBCLASS)
        if ot.parent_class is not None:
            self._axioms[ClassRef(ax_rid)] = Axiom(
                rid=ClassRef(ax_rid),
                kind=new_kind,
                operands=(ot.rid, ot.parent_class),
                rule_ref="parent_class",
            )
        elif existing_ax is not None:
            # InMemory 无审计诉求 → 直接移除（PG 侧保留禁用行留痕）
            del self._axioms[ClassRef(ax_rid)]
        return ot

    def _subclass_pairs(self) -> list[tuple[str, str]]:
        """已启用 subclass 公理 → (sub, sup) 对（metadata enabled=false 视为禁用）。"""
        pairs: list[tuple[str, str]] = []
        for ax in self._axioms.values():
            if ax.kind.value != "subclass":
                continue
            meta = dict(ax.metadata)
            if meta.get("enabled") == "false":
                continue
            ops = [o.rid for o in ax.operands]
            if len(ops) >= 2 and ops[1]:
                pairs.append((ops[0], ops[1]))
        return pairs

    def _expand_source_classes(self, source_rid: str) -> frozenset[str]:
        """EXP-01：查询源类集合展开 —— Interface → 实现类型 + subclass 后代闭包。

        返回完整允许集（普通 source = 自身 + 后代；Interface source = 实现
        类型 + 各自后代）。IR 路径用它整体替换按源类精确过滤的条件。
        """
        from mate_kernel.ontology.reasoning.engine import descendant_closure
        from .types.interface import interface_source_rids

        is_interface = ClassRef(source_rid) in self._interfaces
        if is_interface:
            bases = interface_source_rids(source_rid, list(self._object_types.values()))
        else:
            bases = [source_rid]
        closure = descendant_closure(self._subclass_pairs())
        allowed: set[str] = set(bases)
        if not is_interface:
            allowed.add(source_rid)
        for b in bases:
            allowed |= closure.get(b, set())
        return frozenset(allowed)

    def get_type_hierarchy(self) -> list[dict[str, Any]]:
        """EXP-01：InMemory 层级树（与 PgOntologyRepository.get_type_hierarchy 同语义）。"""
        all_types = list(self._object_types.values())
        by_rid = {ot.rid.rid: ot for ot in all_types}
        children_of: dict[str, list[str]] = {}
        roots: list[str] = []
        for ot in all_types:
            parent = ot.parent_class.rid if ot.parent_class is not None else ""
            if parent and parent in by_rid:
                children_of.setdefault(parent, []).append(ot.rid.rid)
            else:
                roots.append(ot.rid.rid)

        def _node(rid: str) -> dict[str, Any]:
            ot = by_rid[rid]
            return {
                "rid": rid,
                "display_name": ot.display_name,
                "parent_class": (
                    ot.parent_class.rid if ot.parent_class is not None else ""
                ),
                "children": [_node(c) for c in children_of.get(rid, [])],
            }

        return [_node(r) for r in roots]

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

    def list_object_types(
        self, limit: int, offset: int, tenant_id: str | None = None,
    ) -> list[ObjectType]:
        items = list(self._object_types.values())
        if tenant_id:
            items = [t for t in items if str(t.rid).split(".")[1] == tenant_id]
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

    # ───── G33：schema WIP 暂存（InMemory 同语义）─────

    def save_schema_wip(self, rid: str, payload: dict[str, Any],
                        author: str = "") -> dict[str, Any]:
        self._schema_wip[rid] = {"rid": rid, "author": author,
                                 "payload": payload}
        return {"rid": rid, "status": "staged"}

    def list_schema_wip(self) -> list[dict[str, Any]]:
        return list(self._schema_wip.values())

    def get_schema_wip(self, rid: str) -> dict[str, Any]:
        if rid not in self._schema_wip:
            raise KeyError(f"wip not found: {rid}")
        return dict(self._schema_wip[rid])

    def delete_schema_wip(self, rid: str) -> bool:
        return self._schema_wip.pop(rid, None) is not None

    # ───── G20：webhook 订阅 + 投递（InMemory 同语义）─────

    def upsert_webhook_subscription(self, decl: dict[str, Any]) -> dict[str, Any]:
        rid = decl.get("rid") or f"wh-{len(self._webhook_subs) + 1}"
        self._webhook_subs[rid] = dict(decl)
        return {"rid": rid}

    def list_webhook_subscriptions(self) -> list[dict[str, Any]]:
        return [dict(v, rid=k) for k, v in self._webhook_subs.items()]

    def record_webhook_delivery(self, *, event_id: str, subscription_rid: str,
                                status: str, attempts: int, last_error: str,
                                tenant_id: str = "") -> None:
        self._webhook_deliveries.append({
            "event_id": event_id, "subscription_rid": subscription_rid,
            "status": status, "attempts": attempts, "last_error": last_error,
        })

    def webhook_delivery_exists(self, event_id: str, subscription_rid: str) -> bool:
        return any(
            d["event_id"] == event_id and d["subscription_rid"] == subscription_rid
            and d["status"] == "delivered"
            for d in self._webhook_deliveries)

    def list_outbox_events(self, since_id: str = "0", limit: int = 50) -> list[dict[str, Any]]:
        return list(self._outbox_events.values())[:limit]

    # ───── GOV-16：使用量（InMemory 计数器，与 PG 日聚合同语义）─────

    def record_usage(self, class_rid: str, op: str, count: int = 1) -> None:
        key = (class_rid, op)
        self._usage_counters[key] = self._usage_counters.get(key, 0) + count

    def usage_summary(self, days: int = 30) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for (cls, op), n in self._usage_counters.items():
            e = out.setdefault(cls, {"class_rid": cls, "reads": 0,
                                     "writes": 0, "active_days": 1})
            e["reads" if op == "read" else "writes"] += n
        return sorted(out.values(),
                      key=lambda x: -(x["reads"] + x["writes"]))

    def upsert_security_policy(self, policy: dict[str, Any]) -> dict[str, Any]:
        """SEC-12：row/column 策略 upsert（InMemory 同语义）。"""
        rid = policy.get("rid") or f"secpol-{len(self._security_policies) + 1}"
        self._security_policies[rid] = dict(policy)
        return {"rid": rid, "kind": policy.get("kind", "")}

    def list_security_policies(self) -> list[dict[str, Any]]:
        return [dict(v, rid=k) for k, v in self._security_policies.items()]

    def _policy_set(self) -> Any:
        from .security_policies import ColumnPolicy, RowPolicy, SecurityPolicySet

        rows_, cols_ = [], []
        for p in self._security_policies.values():
            markings = tuple(p.get("markings") or p.get("bypass_markings")
                             or p.get("required_markings") or ())
            if p.get("kind") == "row":
                rows_.append(RowPolicy(
                    class_rid=p.get("class_rid", ""), field=p.get("field", ""),
                    op=p.get("op", ""), value=p.get("value"),
                    bypass_markings=markings))
            else:
                cols_.append(ColumnPolicy(
                    property_rid=p.get("property_rid", ""),
                    required_markings=markings))
        return SecurityPolicySet(row_policies=tuple(rows_),
                                 column_policies=tuple(cols_))

    def _class_markings_of(self, class_rid: str) -> tuple[str, ...]:
        """G6：类型 marking（含祖先 —— schema 血缘传播）。"""
        from .reasoning.engine import descendant_closure

        closed = descendant_closure(self._subclass_pairs())
        anc = {class_rid}
        for y, descs in closed.items():
            if class_rid in descs:
                anc.add(y)
        out: set[str] = set()
        for r in anc:
            ot = self._object_types.get(ClassRef(r))
            if ot is not None:
                out.update(ot.marking)
        return tuple(out)

    def enforce_read_policies(
        self, individuals: list[Any], viewer_markings: list[str] | tuple[str, ...],
    ) -> list[Any]:
        """行策略 + G6 marking 门（实例 ∧ 类型[含祖先] marking ⊆ viewer）。"""
        from .security_policies import filter_by_markings, filter_visible_individuals

        ps = self._policy_set()
        if ps.row_policies:
            def _ancestors(class_rid: str) -> frozenset[str]:
                a = {class_rid}
                for y, descs in closed.items():
                    if class_rid in descs:
                        a.add(y)
                return frozenset(a)

            from .reasoning.engine import descendant_closure

            closed = descendant_closure(self._subclass_pairs())
            individuals = filter_visible_individuals(
                individuals, ps, viewer_markings, ancestor_classes_of=_ancestors)
        return filter_by_markings(
            individuals, viewer_markings, class_marking_of=self._class_markings_of)

    def mask_rows(
        self, rows: list[dict[str, Any]], viewer_markings: list[str] | tuple[str, ...],
    ) -> list[dict[str, Any]]:
        from .security_policies import mask_property_values

        ps = self._policy_set()
        if not ps.column_policies:
            return rows
        for r in rows:
            mask_property_values(r, ps, viewer_markings)
        return rows

    def _nearest_individuals(
        self, spec: Any, allowed_classes: set[str],
    ) -> list[Any]:
        """G13：embedding 余弦 top-k 实例（InMemory）。"""
        import math

        qvec = self._embedder.embed(spec.text)
        scored: list[tuple[float, Any]] = []
        for chunk in self._embeddings.values():
            if allowed_classes and chunk["class_rid"] not in allowed_classes:
                continue
            if spec.property_rid and chunk["property_rid"] != spec.property_rid:
                continue
            vec = chunk["embedding"]
            n1 = math.sqrt(sum(x * x for x in qvec)) or 1.0
            n2 = math.sqrt(sum(x * x for x in vec)) or 1.0
            score = sum(x * y for x, y in zip(qvec, vec, strict=True)) / (n1 * n2)
            scored.append((score, chunk))
        scored.sort(key=lambda t: t[0], reverse=True)
        top_rids: list[str] = []
        for _s, chunk in scored:
            irid = chunk["individual_rid"]
            if irid not in top_rids:
                top_rids.append(irid)
            if len(top_rids) >= spec.k:
                break
        return [self._individuals[r] for r in top_rids if r in self._individuals]

    def search_objects_hybrid(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
        tenant_id: str | None = None, k_rrf: int = 60,
    ) -> list[dict[str, Any]]:
        """AI-09：混合检索（InMemory 同语义：关键词子串 + cosine + RRF）。"""
        import re as _re

        if self._embedder is None:
            return []
        tokens = [t for t in _re.split(r"\s+", text.strip()) if len(t) >= 2][:8] or [text.strip()]
        # 关键词路
        kw_rank: dict[str, int] = {}
        kw_meta: dict[str, dict[str, Any]] = {}
        for chunk in sorted(
            self._embeddings.values(),
            key=lambda c: c.get("created_at", "") if isinstance(c, dict) else "",
        ):
            if class_rid and chunk["class_rid"] != class_rid:
                continue
            if any(t.lower() in str(chunk["value_text"]).lower() for t in tokens):
                irid = chunk["individual_rid"]
                if irid not in kw_rank:
                    kw_rank[irid] = len(kw_rank) + 1
                    kw_meta[irid] = chunk
        # 向量路
        vec_cards = self.search_objects(text, class_rid, top_k * 3)
        vec_rank = {c["individual_rid"]: i + 1 for i, c in enumerate(vec_cards)}
        class_of = {c["individual_rid"]: c["class_rid"] for c in vec_cards}
        for irid, meta in kw_meta.items():
            class_of.setdefault(irid, meta["class_rid"])

        def _rrf(irid: str) -> float:
            score = 0.0
            if irid in kw_rank:
                score += 1.0 / (k_rrf + kw_rank[irid])
            if irid in vec_rank:
                score += 1.0 / (k_rrf + vec_rank[irid])
            return score

        fused = sorted(set(kw_rank) | set(vec_rank), key=_rrf, reverse=True)[:top_k]
        return [
            {
                "individual_rid": irid,
                "class_rid": class_of.get(irid, ""),
                "score": _rrf(irid),
                "matched": [{
                    "property_rid": kw_meta[irid]["property_rid"] if irid in kw_meta else "",
                    "value_text": kw_meta[irid]["value_text"] if irid in kw_meta else "",
                    "score": _rrf(irid),
                }],
                "legs": {
                    "keyword_rank": kw_rank.get(irid),
                    "vector_rank": vec_rank.get(irid),
                },
            }
            for irid in fused
        ]

    def get_individual(self, rid: str) -> Individual:
        return self._individuals[rid]

    def list_individuals(self, class_rid: ClassRef | None) -> list[Individual]:
        items = self._individuals.values()
        if class_rid is not None:
            items = [i for i in items if i.class_rid == class_rid]
        return list(items)

    def create_link_instance(self, li: LinkInstance) -> LinkInstance:
        # EXP-03：注册 LinkType 的基数约束（未注册类型 legacy 宽松）
        from .types.link_type import check_cardinality

        lt = self._link_types.get(li.link_type_rid)
        if lt is not None:
            # 同 rid 的既有行不算（upsert 语义：重建同一条链接不违反基数）
            src_out = sum(
                1 for x in self._link_instances.values()
                if x.rid != li.rid
                and x.link_type_rid == li.link_type_rid and x.src == li.src
            )
            dst_in = sum(
                1 for x in self._link_instances.values()
                if x.rid != li.rid
                and x.link_type_rid == li.link_type_rid and x.dst == li.dst
            )
            violation = check_cardinality(lt.cardinality, src_out, dst_in)
            if violation:
                raise ValueError(
                    f"{violation} (link_type={li.link_type_rid.rid}, "
                    f"src={li.src}, dst={li.dst})"
                )
        self._link_instances[li.rid] = li
        return li

    def search_around(self, rid: str, limit: int = 100) -> list[dict[str, Any]]:
        """EXP-03：一跳关系遍历（与 PgOntologyRepository.search_around 同语义）。"""
        links = [l for l in self._link_instances.values() if l.src == rid or l.dst == rid][:limit]
        if not links:
            return []
        peers_needed = {(l.dst if l.src == rid else l.src) for l in links}
        grouped: dict[tuple[str, str], dict[str, Any]] = {}
        from mate_kernel.objectset.compiler import individual_to_row

        for l in links:
            outgoing = l.src == rid
            peer_rid = l.dst if outgoing else l.src
            lt = self._link_types.get(l.link_type_rid)
            lt_slug = l.link_type_rid.rid.split(".")
            display = (
                (lt.src_display_name if lt else "") or (lt_slug[3] if len(lt_slug) >= 5 else lt_slug[-1])
                if outgoing else
                (lt.dst_display_name if lt else "") or (lt_slug[3] if len(lt_slug) >= 5 else lt_slug[-1])
            )
            key = (l.link_type_rid.rid, "out" if outgoing else "in")
            entry = grouped.setdefault(key, {
                "link_type_rid": l.link_type_rid.rid,
                "link_display": display,
                "direction": key[1],
                "peers": [],
            })
            ind = self._individuals.get(peer_rid)
            if ind is not None:
                entry["peers"].append(individual_to_row(ind))
        return list(grouped.values())

    def _edit_overlay_for_class(self, tenant: str, cls_slug: str) -> dict[str, set[str]]:
        out: dict[str, set[str]] = {}
        prefix = f"ont.{tenant}.ind.{cls_slug}."
        for rid, prop in self._edit_overlay:
            if rid.startswith(prefix):
                out.setdefault(rid, set()).add(prop)
        return out

    def delete_individual(self, rid: str) -> bool:
        """删实例 + 级联链接 + 清覆盖层（与 PG 侧同语义）。"""
        if rid not in self._individuals:
            return False
        self._individuals.pop(rid)
        for lrid in [l.rid for l in self._link_instances.values()
                     if l.src == rid or l.dst == rid]:
            self._link_instances.pop(lrid)
        self._edit_overlay = {
            (r, p) for r, p in self._edit_overlay if r != rid}
        return True

    def list_link_instances(self) -> list[LinkInstance]:
        return list(self._link_instances.values())

    # ───── reasoning ─────

    def upsert_axiom(self, ax: Axiom) -> Axiom:
        self._axioms[ax.rid] = ax
        return ax

    def list_axioms(self) -> list[Axiom]:
        return list(self._axioms.values())

    def upsert_function(self, f: Function) -> Function:
        old = self._functions.get(f.rid)
        if old is not None:
            self._function_versions.setdefault(f.rid.rid, []).append({
                "function_rid": f.rid.rid, "version": old.version,
                "language": old.language, "source_ref": old.source_ref,
            })
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

    # ───── G23：Function 别名/版本/调用（InMemory 同语义）─────

    def register_function_alias(self, alias: str, function_rid: str) -> dict[str, Any]:
        self._function_aliases[alias] = function_rid
        return {"alias": alias, "function_rid": function_rid}

    def resolve_function_alias(self, alias: str) -> str:
        if alias not in self._function_aliases:
            raise KeyError(f"alias not found: {alias}")
        return self._function_aliases[alias]

    def list_function_versions(self, function_rid: str) -> list[dict[str, Any]]:
        return [dict(v) for v in self._function_versions.get(function_rid, [])]

    def invoke_function(self, function_rid: str,
                        parameters: dict[str, Any]) -> dict[str, Any]:
        invoker = self._action_service._invokers.get(function_rid)  # noqa: SLF001
        if invoker is None:
            raise KeyError(
                f"function {function_rid!r} has no registered invoker")
        result = invoker(None, parameters)
        return {"function_rid": function_rid, "result": result}

    # ───── query / apply ─────

    def evaluate_object_set(self, os_: ObjectSet) -> list[Individual]:
        # dev runtime: 委托给 InMemoryObjectSetExecutor，filter_expr / sort 真正生效
        # EXP-01：Interface 源展开 + subclass 后代闭包（G21 同语义进 InMemory 路径）
        from mate_kernel.objectset.compiler import InMemoryObjectSetExecutor
        items = list(self._individuals.values())
        extra = self._expand_source_classes(os_.class_rid.rid)
        return InMemoryObjectSetExecutor(items).execute(os_, extra_classes=extra)

    def execute_object_query(self, q: "ObjectSetQuery") -> "QueryResult":
        """MP-SAL-01: 结构化 IR 查询（ADR-0043），与 PG 侧同语义。"""
        from mate_kernel.objectset.ir import InMemoryQueryExecutor
        source_classes = self._expand_source_classes(q.source)
        individuals = tuple(self._individuals.values())
        # G13：nearestNeighbors —— 先 KNN 预选个体，再走 filters/sort/paging
        if q.nearest is not None and self._embedder is not None:
            selected = self._nearest_individuals(
                q.nearest, allowed_classes=set(source_classes))
            individuals = tuple(selected)
            source_classes = frozenset(
                {q.source} | {i.class_rid.rid for i in selected})
        executor = InMemoryQueryExecutor(
            individuals=individuals,
            links=tuple(self._link_instances.values()),
            object_types=tuple(self._object_types.values()),
        )
        result = executor.execute(q, source_classes=source_classes)
        # G12：数组属性按声明 reducer 折叠
        ot_arr = self._object_types.get(ClassRef(q.source))
        if result.kind == "objects" and ot_arr is not None:
            from .types.property_ import reduce_array_value

            rows0 = list(result.rows)
            for pr in ot_arr.properties:
                if not pr.array or not pr.reducer:
                    continue
                parts = pr.rid.rid.split(".")
                slug = parts[3] if len(parts) >= 5 else parts[-1]
                for row in rows0:
                    if slug in row:
                        row[slug] = reduce_array_value(row[slug], pr.reducer)
            from dataclasses import replace as _r0

            result = _r0(result, rows=tuple(rows0))
        # EXP-02：派生列追加（count/sum/avg over link）
        if result.kind == "objects":
            ot = self._object_types.get(ClassRef(q.source))
            if ot is not None:
                rows = list(result.rows)
                self._attach_derived_inmemory(ot, rows)
                from dataclasses import replace as _replace

                result = _replace(result, rows=tuple(rows))
        return result

    def _attach_derived_inmemory(self, ot: ObjectType, rows: list[Any]) -> None:
        from .types.derived import attach_derived_values

        link_meta = {
            lt.rid.rid: (lt.src.rid, lt.dst.rid)
            for lt in self._link_types.values()
        }
        link_pairs: dict[str, list[tuple[str, str]]] = {}
        for li in self._link_instances.values():
            link_pairs.setdefault(li.link_type_rid.rid, []).append((li.src, li.dst))

        def _value_of(peer_rid: str, field_rid: str | None) -> float | None:
            if field_rid is None:
                return None
            peer = self._individuals.get(peer_rid)
            if peer is None:
                return None
            raw = peer.get(ClassRef(field_rid))
            if raw is None:
                return None
            try:
                return float(raw)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                return None

        attach_derived_values(
            rows, ot.rid.rid, ot.properties, link_meta, link_pairs, _value_of,
        )

    def list_properties(self) -> list[Property]:
        """EXP-02：属性库全量（与 PgOntologyRepository 同语义）。"""
        return list(self._properties.values())

    def shared_properties_usage(self) -> list[dict[str, Any]]:
        """EXP-02：共享属性使用统计（与 PG 侧同语义）。"""
        usage: dict[str, list[str]] = {}
        for ot in self._object_types.values():
            for p in ot.properties:
                usage.setdefault(p.rid.rid, []).append(ot.rid.rid)
        return [
            {"rid": rid, "shared": len(users) > 1, "used_by": users}
            for rid, users in sorted(
                usage.items(), key=lambda kv: (-len(kv[1]), kv[0]),
            )
            if users
        ]

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
                eid = self._outbox_writer(se, "", {
                    "action_rid": action_rid, "target_iid": target_iid,
                    "proposal_id": proposal_id,
                })
                if eid is not None:
                    self._outbox_events[str(eid)] = {
                        "event_id": str(eid), "event_type": se,
                        "payload": {"action_rid": action_rid},
                        "tenant_id": "", "created_at": "",
                    }
                return eid
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

    def propose_merge(
        self,
        source_rid: str,
        target_rid: str,
        similarity: float,
        impact_summary: str,
        mapping: dict[str, str] | None = None,
    ) -> Any:
        """MP-DEDUP-01：AI 提议合并（subject=target rid，kind=merge_suggestion）。

        与 PgOntologyRepository.propose_merge 行为对齐 —— 不要求 target 已注册为
        ActionType，只用 target rid 作为 subject；后续 execute 时按 kind=merge_suggestion
        落库合并。
        """
        parameters = {
            "source_rid": source_rid,
            "target_rid": target_rid,
            "similarity": float(similarity),
            "mapping": dict(mapping or {}),
        }
        expected_diff = {
            "+merge": {"source": source_rid, "target": target_rid},
            "archived": [source_rid],
        }
        return self._action_service.propose(
            action_rid=str(target_rid),
            parameters=parameters,
            target_iid=None,
            impact_summary=impact_summary,
            expected_diff=expected_diff,
            kind="merge_suggestion",
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
        if p.kind == "edit_set":
            # ACT-05：声明式编辑集执行（confirmed 才到这；AI 流程 propose→confirm 前置）
            from mate_kernel.action.edit_set import (
                EDIT_BATCH_LIMIT, EditOp, resolve_edit_templates,
            )

            templates = p.parameters.get("edits") or []
            if len(templates) > EDIT_BATCH_LIMIT:
                raise ValueError(
                    f"edit-set exceeds batch limit {EDIT_BATCH_LIMIT}"
                )
            ops = resolve_edit_templates(
                templates, target_iid=p.target_iid,
                parameters=dict(p.parameters.get("parameters") or {}),
                now_iso=_dt.now(_UTC).isoformat(),
            )
            result = self._apply_edits(
                str(p.action_rid), ops, proposal_id=proposal_id,
                actor=str(p.confirmed_by or ""),
            )
            self._action_service.mark_executed(proposal_id)
            return result
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
            # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，parts[4] 是 slug。
            tenant, cls_slug = rid_parts[1], rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
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
            self._action_service.mark_executed(proposal_id)
            return ind
        if p.kind == "model_type":
            ot = self._type_def_to_object_type(p.parameters["type_def"])
            self.upsert_object_type(ot)
            self._action_service.mark_executed(proposal_id)
            return ot
        raise ValueError(f"unknown proposal kind: {p.kind!r}")

    # ───── ACT-05：声明式 edit-set（propose / apply-now / 原子执行）─────

    def propose_edit_set(
        self,
        action_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        edit_templates: list[dict[str, Any]] | tuple[dict[str, Any], ...],
        impact_summary: str,
    ) -> Any:
        """AI/HITL 流程的 edit-set 提案（pending → 用户 confirm → execute）。"""
        from mate_kernel.action.edit_set import resolve_edit_templates
        from mate_kernel.action.validation import validate_referenced_parameters

        # ACT-06：模板引用参数 fail-fast（自定义 edits 只约束引用到的参数）
        at = self._action_types.get(ClassRef(action_rid))
        if at is not None:
            violations = validate_referenced_parameters(
                at.parameters, parameters, edit_templates)
            if violations:
                raise ValueError("; ".join(violations))

        # dry-run 计算 expected_diff（预览即确认的数据基础）
        ops = resolve_edit_templates(
            edit_templates, target_iid=target_iid, parameters=parameters,
        )
        return self._action_service.propose(
            action_rid=action_rid,
            parameters={"edits": list(edit_templates), "parameters": dict(parameters)},
            target_iid=target_iid,
            impact_summary=impact_summary,
            expected_diff=self._dry_run_diff(ops),
            kind="edit_set",
        )

    def apply_edit_set_now(
        self,
        action_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        edit_templates: list[dict[str, Any]] | tuple[dict[str, Any], ...],
        actor: str,
        impact_summary: str = "",
    ) -> Any:
        """D7「预览即确认」：即时 proposal（confirmed）+ 执行，同一条审计管道。

        人工表单入口用；AI 流程必须走 propose_edit_set → 显式 confirm。
        """
        from mate_kernel.action.edit_set import resolve_edit_templates
        from mate_kernel.action.validation import validate_referenced_parameters

        at = self._action_types.get(ClassRef(action_rid))
        if at is not None:
            violations = validate_referenced_parameters(
                at.parameters, parameters, edit_templates)
            if violations:
                raise ValueError("; ".join(violations))

        ops = resolve_edit_templates(
            edit_templates, target_iid=target_iid, parameters=parameters,
        )
        prop = self._action_service.propose(
            action_rid=action_rid,
            parameters={"edits": list(edit_templates), "parameters": dict(parameters)},
            target_iid=target_iid,
            impact_summary=impact_summary or f"edit-set: {len(ops)} edits",
            expected_diff=self._dry_run_diff(ops),
            kind="edit_set",
        )
        self._action_service.confirm_proposal(prop.proposal_id, confirmed_by=actor)
        return self.execute_proposal(prop.proposal_id)

    def _dry_run_diff(self, ops: list[Any]) -> dict[str, Any]:
        """计算编辑集的预期 diff（不落库）。"""
        diff: dict[str, Any] = {}
        for e in ops:
            if e.op == "set_property":
                cur = self._individuals.get(e.target)
                old = cur.get(ClassRef(e.property_rid)) if cur else None
                diff.setdefault("~props", []).append(
                    {e.target: {e.property_rid: {"old": old, "new": e.value}}})
            elif e.op == "create_object":
                diff.setdefault("+objects", []).append(
                    {"class_rid": e.class_rid, "primary_key": e.primary_key})
            elif e.op == "delete_object":
                diff.setdefault("-objects", []).append(e.target)
            elif e.op == "add_link":
                diff.setdefault("+links", []).append(
                    {"link_type_rid": e.link_type_rid, "src": e.src, "dst": e.dst})
            elif e.op == "remove_link":
                diff.setdefault("-links", []).append(e.link_instance_rid)
        return diff

    def _apply_edits(
        self, action_rid: str, ops: list[Any], *, proposal_id: str, actor: str,
    ) -> Any:
        """顺序执行编辑集；任一步失败 → 整体回滚（补偿式，InMemory 语义）。

        回滚与 revert 共用 invert_edits 产出的逆序列（单一逆编辑代数）。
        """
        from dataclasses import replace as _replace
        from datetime import UTC as _UTC, datetime as _dt

        from mate_kernel.action.edit_set import (
            OP_ADD_LINK, OP_CREATE_OBJECT, OP_DELETE_OBJECT, OP_REMOVE_LINK,
            OP_SET_PROPERTY, EditOp, EditSetError, EditSetResult, invert_edits,
        )
        from mate_kernel.ontology.instances.link_instance import LinkInstance as _LI

        applied: list[EditOp] = []
        created_rids: list[str] = []
        old_values: dict[str, Any] = {}
        removed_links: list[dict[str, Any]] = []
        now = _dt.now(_UTC)

        def _exec_inverse(inv: list[EditOp]) -> None:
            for e in reversed(inv):
                try:
                    if e.op == OP_SET_PROPERTY:
                        cur = self._individuals.get(e.target)
                        if cur is not None:
                            merged = {k.rid: v for k, v in cur.props}
                            merged[e.property_rid] = e.value
                            self._individuals[cur.rid] = _replace(
                                cur, props=tuple(
                                    (ClassRef(k), v) for k, v in merged.items()),
                                updated_at=now)
                    elif e.op == OP_DELETE_OBJECT:
                        self._individuals.pop(e.target, None)
                        for lrid in [l.rid for l in self._link_instances.values()
                                     if l.src == e.target or l.dst == e.target]:
                            self._link_instances.pop(lrid)
                    elif e.op == OP_REMOVE_LINK:
                        self._link_instances.pop(e.link_instance_rid, None)
                    elif e.op == OP_ADD_LINK:
                        tenant = e.src.split(".")[1] if "." in e.src else ""
                        self._link_instances.pop(
                            f"{e.link_instance_rid}", None)
                        # 逆 add_link 用确定性 rid 重建
                        self._link_instances[f"rb-{e.link_instance_rid}"] = _LI(
                            rid=f"rb-{e.link_instance_rid}",
                            link_type_rid=ClassRef(e.link_type_rid),
                            src=e.src, dst=e.dst, props=(),
                            created_at=now, tenant_id=tenant,
                        )
                except Exception:
                    pass  # 回滚尽力而为（与 legacy rollback hook 语义一致）

        try:
            for e in ops:
                if e.op == OP_SET_PROPERTY:
                    cur = self._individuals.get(e.target)
                    if cur is None:
                        raise EditSetError(f"set_property target not found: {e.target}")
                    old_values[f"{e.target}#{e.property_rid}"] = cur.get(
                        ClassRef(e.property_rid))
                    merged = {k.rid: v for k, v in cur.props}
                    merged[e.property_rid] = e.value
                    self._edit_overlay.add((e.target, e.property_rid))
                    self._individuals[e.target] = _replace(
                        cur, props=tuple(
                            (ClassRef(k), v) for k, v in merged.items()),
                        updated_at=now)
                elif e.op == OP_CREATE_OBJECT:
                    ot = self._object_types.get(ClassRef(e.class_rid))
                    if ot is None:
                        raise EditSetError(f"create_object class not found: {e.class_rid}")
                    rid_parts = e.class_rid.split(".")
                    tenant = rid_parts[1]
                    cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
                    # G6：实例继承类型 marking（含祖先 —— 写时血缘传播）
                    inherited = self._class_markings_of(e.class_rid)
                    ind = Individual(
                        rid=f"ont.{tenant}.ind.{cls_slug}.{e.primary_key}",
                        class_rid=ot.rid,
                        props=tuple((ClassRef(k), v) for k, v in e.props.items()),
                        primary_key=str(e.primary_key),
                        created_at=now, updated_at=now, tenant_id=tenant,
                        marking=inherited,
                    )
                    self.create_individual(ind)
                    created_rids.append(ind.rid)
                elif e.op == OP_DELETE_OBJECT:
                    if e.target not in self._individuals:
                        raise EditSetError(f"delete_object target not found: {e.target}")
                    self._individuals.pop(e.target)
                    for lrid in [l.rid for l in self._link_instances.values()
                                 if l.src == e.target or l.dst == e.target]:
                        self._link_instances.pop(lrid)
                elif e.op == OP_ADD_LINK:
                    tenant = e.src.split(".")[1] if "." in e.src else "t"
                    lt_slug = e.link_type_rid.split(".")[-2]                         if e.link_type_rid.split(".")[-1].startswith("v")                         else e.link_type_rid.split(".")[-1]
                    li_rid = (f"ont.{tenant}.lnk.{lt_slug}."
                              f"{len(self._link_instances) + 1}-"
                              f"{e.src.split('.')[-1]}-{e.dst.split('.')[-1]}")
                    li = _LI(
                        rid=li_rid, link_type_rid=ClassRef(e.link_type_rid),
                        src=e.src, dst=e.dst, props=(),
                        created_at=now, tenant_id=tenant,
                    )
                    self.create_link_instance(li)  # 内含基数校验
                    e = _replace(e, link_instance_rid=li_rid)  # 回填供 invert
                elif e.op == OP_REMOVE_LINK:
                    li = self._link_instances.get(e.link_instance_rid)
                    if li is None:
                        raise EditSetError(f"remove_link not found: {e.link_instance_rid}")
                    removed_links.append({
                        "rid": li.rid, "link_type_rid": li.link_type_rid.rid,
                        "src": li.src, "dst": li.dst,
                        "props": {k.rid: v for k, v in li.props},
                    })
                    del self._link_instances[li.rid]
                applied.append(e)
        except Exception:
            inv_ops, _ni = invert_edits(
                applied, old_values=old_values, created_rids=created_rids,
                removed_links=removed_links,
            )
            _exec_inverse(list(inv_ops))
            raise

        inv_ops, non_invertible = invert_edits(
            applied, old_values=old_values, created_rids=created_rids,
            removed_links=removed_links,
        )
        result = EditSetResult(
            action_rid=action_rid,
            applied=tuple(applied),
            inverse=inv_ops,
            non_invertible=tuple(non_invertible),
            created_rids=tuple(created_rids),
        )
        self._record_edit_set_audit(action_rid, result, proposal_id, actor)
        # G20：声明副作用发射（outbox 事件镜像；dev 未接 writer 时静默）
        at_se = self._action_types.get(ClassRef(action_rid))
        if at_se is not None and at_se.side_effects:
            emitter = self._side_effect_emitter_hook(action_rid, "", proposal_id)
            if emitter is not None:
                for se in at_se.side_effects:
                    try:
                        emitter(se)
                    except Exception:
                        pass
        return result

    def _record_edit_set_audit(
        self, action_rid: str, result: Any, proposal_id: str, actor: str,
    ) -> None:
        """edit-set 执行结果落 ActionService 审计（13 硬规则 #9）。"""
        from dataclasses import dataclass as _dc

        @_dc(frozen=True)
        class _EditOutcome:
            action_rid: str
            proposal_id: str
            actor: str
            applied_count: int
            created_rids: tuple
            applied: tuple

        self._action_service._audit.append(  # noqa: SLF001
            _EditOutcome(
                action_rid=action_rid, proposal_id=proposal_id, actor=actor,
                applied_count=len(result.applied),
                created_rids=result.created_rids,
                applied=result.applied,
            )
        )

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
            parent_class=(
                ClassRef(type_def["parent_class"])
                if type_def.get("parent_class") else None
            ),
        )

    def get_proposal(self, proposal_id: str) -> Any:
        return self._action_service.get_proposal(proposal_id)

    def list_proposals(self) -> list[Any]:
        return list(self._action_service._proposals.values())  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]

    def confirm_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        return self._action_service.confirm_proposal(proposal_id, confirmed_by=confirmed_by)

    def reject_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        return self._action_service.reject_proposal(proposal_id, confirmed_by=confirmed_by)

    # ───── MP-SAL-05: 流程编排定义持久化（dev InMemory 同语义）─────

    def get_flow_definition(self, action_rid: ClassRef) -> dict[str, Any]:
        key = action_rid.rid
        if key not in self._flow_definitions:
            raise KeyError(f"flow definition not found: {key}")
        return dict(self._flow_definitions[key])

    def put_flow_definition(
        self, action_rid: ClassRef, flow_json: dict[str, Any],
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        from datetime import UTC as _UTC, datetime as _dt

        entry = {
            "action_rid": action_rid.rid,
            "flow_json": dict(flow_json),
            "config": dict(config or {}),
            "updated_at": _dt.now(_UTC).isoformat(),
        }
        self._flow_definitions[action_rid.rid] = entry
        return dict(entry)

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
