"""Deterministic candidates -> native WIP and resumable gated publication."""

from __future__ import annotations

import re
from contextlib import contextmanager

from fastapi import HTTPException

from ..v2_kernel import api as native
from .core import digest
from .scope import publication_scope


def slug(value):
    result = re.sub(r"[^a-z0-9-]", "-", value.lower()).strip("-")
    return result[:40] or "concept-" + digest(value)[:12]


def property_rid(tenant, class_slug, prop):
    return f"ont.{tenant}.prop.{class_slug}-{slug(prop)}.v1"


async def current_type(request, rid):
    try:
        return (await native.get_object_type(rid, request)).model_dump()
    except (KeyError, HTTPException) as exc:
        if isinstance(exc, HTTPException) and exc.status_code != 404:
            raise
        return None


async def current_link(request, rid):
    try:
        return (await native.get_link_type(rid, request)).model_dump()
    except (KeyError, HTTPException) as exc:
        if isinstance(exc, HTTPException) and exc.status_code != 404:
            raise
        return None


def link_structure_matches(live, expected):
    """Compare fields that affect native link creation and data synchronization."""
    structural_fields = (
        "rid",
        "src",
        "dst",
        "cardinality",
        "directionality",
        "link_properties",
    )
    return bool(live) and all(live.get(field) == expected.get(field) for field in structural_fields)


def hierarchy_order(classes):
    """Validate explicit candidate inheritance and return parents before descendants."""
    by_id = {cls["id"]: cls for cls in classes}
    if len(by_id) != len(classes):
        raise ValueError("候选类标识重复")
    visited, visiting, ordered = set(), set(), []

    def visit(cid):
        if cid in visiting:
            raise ValueError("候选继承存在循环，不能发布")
        if cid in visited:
            return
        visiting.add(cid)
        if len(visiting) > 16:
            raise ValueError("候选继承最多支持 16 层，与原生平台限制一致")
        cls = by_id[cid]
        parent = cls.get("parentClassId", "")
        if parent:
            if parent == cid:
                raise ValueError("候选类不能继承自身")
            if parent not in by_id:
                raise ValueError(f"父类 {parent} 不存在于当前候选模型")
            if not cls.get("inheritanceReason", "").strip():
                raise ValueError(f"{cls['name']} 的继承关系缺少业务依据，请确认后再发布")
            visit(parent)
        visiting.remove(cid)
        visited.add(cid)
        ordered.append(cls)

    for cid in by_id:
        visit(cid)
    return ordered


async def new_type_conflicts(request, source):
    """Return all occupied new-type IDs so review does not stop at one conflict per retry."""
    tenant = str(native._ctx(request).tenant_id)
    previous = source.get("publication") or {}
    input_hash = digest(
        {k: source.get(k) for k in ("draft", "context", "questions", "resolutions")}
    )
    issues = []
    native_types = None
    for cls in publication_scope(source["draft"])["classes"]:
        if (source.get("resolutions", {}).get(cls["id"]) or {}).get("mode", "new") != "new":
            continue
        rid = f"ont.{tenant}.obj.data.{slug(cls['id'])}.v1"
        if rid in previous.get("completed", []) and previous.get("inputHash") == input_hash:
            continue
        existing = await current_type(request, rid)
        if not existing:
            if native_types is None:
                native_types = []
                offset = 0
                while True:
                    batch = await native.list_object_types(request, limit=100, offset=offset)
                    native_types.extend(item.model_dump() for item in batch)
                    if len(batch) < 100:
                        break
                    offset += 100
            existing = next(
                (item for item in native_types if item["rid"].split(".")[-2] == slug(cls["id"])),
                None,
            )
        if existing:
            occupied_rid = existing["rid"]
            issues.append(
                {
                    "severity": "error",
                    "item": cls["id"],
                    "message": f"{cls['name']} 的稳定标识已存在（{occupied_rid}），请在本行选择复用或增加属性；不同业务概念须修改稳定标识后新建。",
                }
            )
    return issues


async def prepare(request, source):
    tenant = str(native._ctx(request).tenant_id)
    draft, resolutions = publication_scope(source["draft"]), source.get("resolutions") or {}
    ordered_classes = hierarchy_order(draft["classes"])
    target_rids = {
        cls["id"]: (
            (resolutions.get(cls["id"]) or {}).get("targetRid")
            if (resolutions.get(cls["id"]) or {}).get("mode", "new") != "new"
            else f"ont.{tenant}.obj.data.{slug(cls['id'])}.v1"
        )
        for cls in ordered_classes
    }
    types, warnings = [], []
    candidate_classes = {cls["id"]: cls for cls in ordered_classes}
    prepared_by_class = {}
    seen_rids = set()
    for cls in ordered_classes:
        cid = cls["id"]
        resolution = resolutions.get(cid) or {"mode": "new"}
        mode = resolution.get("mode", "new")
        if mode not in ("new", "reuse", "extend"):
            raise ValueError("无效的新建/复用/扩展选择")
        class_slug = slug(cid)
        rid = (
            resolution.get("targetRid")
            if mode != "new"
            else f"ont.{tenant}.obj.data.{class_slug}.v1"
        )
        if not rid or not rid.startswith(f"ont.{tenant}."):
            raise ValueError("必须选择当前租户的原生类型")
        if rid in seen_rids:
            raise ValueError("多个候选类指向同一原生类型，请先在候选中统一概念")
        seen_rids.add(rid)
        existing = await current_type(request, rid)
        previous = source.get("publication") or {}
        input_hash = digest(
            {k: source.get(k) for k in ("draft", "context", "questions", "resolutions")}
        )
        own_completed = (
            rid in previous.get("completed", []) and previous.get("inputHash") == input_hash
        )
        if mode == "new" and existing and not own_completed:
            raise ValueError(f"{cls['name']} 的稳定标识已存在，请显式选择复用或扩展")
        if mode != "new" and not existing:
            raise ValueError(f"{cls['name']} 选择的原生类型不存在")
        prop_map = dict(resolution.get("propertyMap") or {})
        selected_properties = {prop["id"] for prop in cls["properties"]}
        prop_map = {key: value for key, value in prop_map.items() if key in selected_properties}
        parent_id = cls.get("parentClassId") or ""
        inherited_props = {}
        if parent_id:
            parent_cls = candidate_classes[parent_id]
            parent = prepared_by_class[parent_id]
            child_props = {prop["id"]: prop for prop in cls["properties"]}
            if not parent_cls["identity"] or cls["identity"] != parent_cls["identity"]:
                raise ValueError(
                    f"{cls['name']} 必须与父类保持相同业务身份；无业务主键的继承需人工建模"
                )
            parent_native_props = {prop["rid"]: prop for prop in parent["payload"]["properties"]}
            for parent_prop in parent_cls["properties"]:
                pid = parent_prop["id"]
                if (
                    pid not in child_props
                    or child_props[pid]["dataType"] != parent_prop["dataType"]
                ):
                    raise ValueError(
                        f"{cls['name']} 必须显式包含父类属性 {parent_prop['name']} 且类型一致"
                    )
                inherited_rid = parent["propertyMap"][pid]
                if prop_map.get(pid) and prop_map[pid] != inherited_rid:
                    raise ValueError(f"继承属性 {parent_prop['name']} 必须共享父类原生属性标识")
                prop_map[pid] = inherited_rid
                inherited_props[inherited_rid] = parent_native_props[inherited_rid]
        existing_props = {p["rid"]: p for p in (existing or {}).get("properties", [])}
        props = []
        for prop in cls["properties"]:
            pid = prop["id"]
            mapped = prop_map.get(pid)
            if mode == "reuse" and mapped not in existing_props:
                raise ValueError(f"复用类型必须为属性 {prop['name']} 选择已有属性")
            mapped = mapped or property_rid(tenant, class_slug, pid)
            if not mapped.startswith(f"ont.{tenant}.prop."):
                raise ValueError("属性映射必须属于当前租户")
            prop_map[pid] = mapped
            fmt = {"text": "string", "number": "double", "date": "date"}[prop["dataType"]]
            desired = {
                "rid": mapped,
                "type_id": fmt,
                "format": fmt,
                "title": prop["name"],
                "primary_key": pid in cls["identity"],
                "nullable": pid not in cls["identity"],
            }
            if mapped in existing_props:
                if existing_props[mapped]["type_id"] != fmt:
                    raise ValueError(f"属性 {prop['name']} 与已有原生属性类型不兼容")
                desired = existing_props[mapped]
            elif mapped in inherited_props:
                desired = inherited_props[mapped]
            props.append(desired)
        if len(set(prop_map.values())) != len(prop_map):
            raise ValueError("不同候选属性不能映射到同一原生属性")
        pk = [prop_map[pid] for pid in cls["identity"]]
        if not pk:
            record_prop = property_rid(tenant, class_slug, "source_record")
            pk = [record_prop]
            props.append(
                {
                    "rid": record_prop,
                    "type_id": "string",
                    "format": "string",
                    "title": "来源记录身份",
                    "primary_key": True,
                }
            )
            warnings.append(f"{cls['name']} 无业务主键，按文件来源记录识别，无法保证跨文件实体对齐")
        if existing and pk != list(existing["primary_key"]):
            raise ValueError(f"{cls['name']} 业务身份与原生主键不一致，需通过原生迁移流程处理")
        body = {
            "rid": rid,
            "primary_key": pk,
            "properties": props,
            "display_name": cls["name"],
            "description": cls.get("description", ""),
            "type_group": "数据建模",
            "status": "active",
        }
        if existing:
            body = {k: v for k, v in existing.items() if k != "checksum"}
            if mode == "extend":
                body["properties"] = list(existing_props.values()) + [
                    p for p in props if p["rid"] not in existing_props
                ]
        if parent_id:
            parent_rid = target_rids[parent_id]
            if parent_rid == rid:
                raise ValueError("候选父子类不能复用为同一原生类型")
            if mode == "reuse" and body.get("parent_class", "") != parent_rid:
                raise ValueError("复用不能改变原生类型继承关系，请在原生编辑器审核")
            body["parent_class"] = parent_rid
        precheck = await native.validate_model_endpoint(request, body)
        similar = (
            await native.precheck_object_type(
                native.ObjectTypePrecheckDTO(name=cls["name"], slug=class_slug), request
            )
        ).model_dump()
        if mode == "new" and not own_completed and cid not in resolutions:
            strong_matches = [
                item
                for item in similar.get("candidates", [])
                if item.get("similarity", 0) >= 0.9 and item.get("rid") != rid
            ]
            if strong_matches:
                names = "、".join(
                    item.get("display_name") or item["rid"] for item in strong_matches
                )
                raise ValueError(
                    f"{cls['name']} 与已有本体 {names} 高度相似，请在候选详情核对后显式选择复用、扩展属性或新增，不能默认新增。"
                )
        if not precheck.get("valid", not precheck.get("errors")) or precheck.get("destructive"):
            raise ValueError(f"{cls['name']} 原生预检未通过：{precheck}")
        types.append(
            {
                "classId": cid,
                "name": cls["name"],
                "rid": rid,
                "mode": mode,
                "propertyMap": prop_map,
                "baselineChecksum": (existing or {}).get("checksum", ""),
                "payload": body,
                "expectedChecksum": native.definition_checksum(
                    native._ot_to_row(native._dto_to_ot(native.ObjectTypeDTO(**body)))
                ),
                "precheck": precheck,
                "similar": similar,
                "identityPolicy": "business" if cls["identity"] else "source-record",
                "parentClassId": parent_id,
                "inheritanceReason": cls.get("inheritanceReason", ""),
                "changes": {
                    "addedProperties": [
                        p["rid"] for p in body["properties"] if p["rid"] not in existing_props
                    ],
                    "retainedProperties": [
                        p["rid"] for p in body["properties"] if p["rid"] in existing_props
                    ],
                    "identityChanged": bool(existing and pk != list(existing["primary_key"])),
                    "parentChanged": bool(
                        existing
                        and body.get("parent_class", "") != existing.get("parent_class", "")
                    ),
                },
            }
        )
        prepared_by_class[cid] = types[-1]
    by_class = {t["classId"]: t for t in types}
    relationships = []
    for rel in draft["relationships"]:
        src, dst = by_class[rel["source"]]["rid"], by_class[rel["target"]]["rid"]
        rid = f"ont.{tenant}.link.data-{digest([src, dst, rel['id']])[:24]}.v1"
        body = {
            "rid": rid,
            "src": src,
            "dst": dst,
            "cardinality": rel.get("cardinality", "N:N"),
            "directionality": "directed",
            "src_display_name": rel["name"],
            "dst_display_name": rel["name"],
            "description": rel.get("reason", ""),
        }
        body = native.LinkTypeDTO(**body).model_dump()
        existing_rel = await current_link(request, rid)
        if existing_rel and any(
            existing_rel[k] != body[k] for k in ("src", "dst", "cardinality", "directionality")
        ):
            raise ValueError("已有关系定义冲突，需在原生关系编辑器审核")
        relationships.append(
            {
                "relationId": rel["id"],
                "rid": rid,
                "payload": body,
                "baseline": existing_rel,
                "cardinalityStatus": rel.get("cardinalityStatus", "legacy"),
                "targetSelection": rel.get("targetSelection", "legacy"),
            }
        )
        if rel.get("cardinalityStatus", "legacy") == "legacy":
            warnings.append(
                f"{rel['name']} 为旧版候选，未记录基数业务审核；当前 {body['cardinality']} 不能视为规则已确认"
            )
    plan = {
        "types": types,
        "relationships": relationships,
        "warnings": warnings,
        "sourceRevision": source["revision"],
        "inputHash": digest(
            {k: source.get(k) for k in ("draft", "context", "questions", "resolutions")}
        ),
    }
    plan["configHash"] = digest(plan)
    return plan


@contextmanager
def target_locks(store, resources):
    with store.repo.tenant_scope(store.tenant):
        conn, _ = store.repo._connect()
    try:
        with conn.cursor() as cur:
            for rid in sorted(resources):
                cur.execute(
                    "SELECT pg_try_advisory_lock(hashtextextended(%s,0))",
                    ("modeling-native:" + rid,),
                )
                if not cur.fetchone()[0]:
                    raise ValueError("目标原生模型正在被另一建设方案发布，请稍后重试")
        yield
    finally:
        conn.close()


async def publish(request, source, store):
    resources = [item["rid"] for item in source["plan"]["types"] + source["plan"]["relationships"]]
    with target_locks(store, resources):
        return await _publish_locked(request, source, store)


async def _publish_locked(request, source, store):
    plan = source["plan"]
    previous = source.get("publication") or {}
    if previous.get("configHash") != plan["configHash"]:
        previous = {}
    state = {
        "status": "running",
        "configHash": plan["configHash"],
        "inputHash": plan["inputHash"],
        "completed": list(previous.get("completed", [])),
        "results": list(previous.get("results", [])),
        "inFlight": previous.get("inFlight"),
    }
    revision = source["revision"]
    # Check every untouched baseline before writing any resource.
    for item in plan["types"]:
        live = await current_type(request, item["rid"])
        if item["rid"] in state["completed"]:
            prior = next((r for r in state["results"] if r["rid"] == item["rid"]), {})
            if not live or live["checksum"] != prior.get("checksum"):
                raise ValueError("已发布类型被修改或删除，请重新预检")
            continue
        if (live or {}).get("checksum", "") != item["baselineChecksum"]:
            # Crash recovery: an acknowledged publication intent may have committed
            # before its progress write. Recover only an exact native definition.
            if (
                state["inFlight"] == item["rid"]
                and live
                and live["checksum"] == item["expectedChecksum"]
            ):
                state["completed"].append(item["rid"])
                state["results"].append(
                    {"rid": item["rid"], "status": "recovered", "checksum": live["checksum"]}
                )
            else:
                raise ValueError("原生类型已被修改，请重新预检候选")
    source = store.update(source["id"], revision, {"publication": state}, increment=False)
    try:
        for item in plan["types"]:
            if item["rid"] in state["completed"]:
                continue
            if item["mode"] != "reuse":
                try:
                    existing_wip = await native._call_scoped(request, "get_schema_wip", item["rid"])
                except KeyError:
                    existing_wip = None
                expected_wip = native.ObjectTypeDTO(**item["payload"]).model_dump(
                    exclude={"confirm_name"}
                )
                if existing_wip and (
                    native.ObjectTypeDTO(**existing_wip["payload"]).model_dump(
                        exclude={"confirm_name"}
                    )
                    != expected_wip
                    or existing_wip.get("author", "") != str(native._ctx(request).user_id)
                ):
                    raise ValueError(
                        "原生编辑器已有未发布草稿，已保留该草稿；请先完成或撤销原生编辑"
                    )
                state["inFlight"] = item["rid"]
                store.update(source["id"], revision, {"publication": state}, increment=False)
                await native.save_schema_wip(
                    native.SchemaWipDTO(
                        payload=native.ObjectTypeDTO(**item["payload"]),
                        author=str(native._ctx(request).user_id),
                    ),
                    request,
                    preserve_existing=True,
                )
                await native.apply_schema_wip(
                    item["rid"],
                    request,
                    expected_checksum=item["baselineChecksum"],
                    expected_payload_checksum=item["expectedChecksum"],
                )
            state["completed"].append(item["rid"])
            state["inFlight"] = None
            live = await current_type(request, item["rid"])
            if live["checksum"] != item["expectedChecksum"]:
                raise ValueError("发布后的原生定义与审核方案不一致，请检查并发编辑")
            state["results"].append(
                {"rid": item["rid"], "status": "succeeded", "checksum": live["checksum"]}
            )
            store.update(source["id"], revision, {"publication": state}, increment=False)
        for item in plan["relationships"]:
            live_link = await current_link(request, item["rid"])
            if item["rid"] in state["completed"] and live_link != item["payload"]:
                # Older repository versions did not update relationship descriptions on
                # conflict. Repair that exact metadata-only drift without overwriting
                # any structural or naming change made after publication.
                repairable = live_link is not None and {
                    key: value for key, value in live_link.items() if key != "description"
                } == {key: value for key, value in item["payload"].items() if key != "description"}
                if not repairable:
                    raise ValueError("已发布关系被修改，请重新预检")
                await native.upsert_link_type(native.LinkTypeDTO(**item["payload"]), request)
                state["results"] = [
                    result for result in state["results"] if result["rid"] != item["rid"]
                ] + [{"rid": item["rid"], "status": "repaired"}]
                store.update(source["id"], revision, {"publication": state}, increment=False)
            if item["rid"] not in state["completed"]:
                if live_link != item["baseline"] and live_link != item["payload"]:
                    raise ValueError("原生关系已变化，请重新预检")
                await native.upsert_link_type(native.LinkTypeDTO(**item["payload"]), request)
                state["completed"].append(item["rid"])
                state["results"].append({"rid": item["rid"], "status": "succeeded"})
                store.update(source["id"], revision, {"publication": state}, increment=False)
        from .assurance import verify_plan

        state["status"] = "succeeded"
        state["acceptance"] = await verify_plan(request, {**source, "publication": state})
        if state["acceptance"]["status"] != "passed":
            mismatches = [
                f"对象 {item['name']}（{'缺失' if item['status'] == 'missing' else '已变化'}）"
                for item in state["acceptance"]["types"]
                if item["status"] != "matched"
            ] + [
                f"关系 {item['rid']}（{'缺失' if item['status'] == 'missing' else '已变化'}）"
                for item in state["acceptance"]["relationships"]
                if item["status"] != "matched"
            ]
            detail = "、".join(mismatches[:8])
            if len(mismatches) > 8:
                detail += f"等 {len(mismatches)} 项"
            raise ValueError(f"发布后核验未通过：{detail or '原生定义与审核方案不一致'}")
    except Exception as exc:
        state.update(status="failed", error=str(getattr(exc, "detail", exc)))
    return store.update(source["id"], revision, {"publication": state}, increment=False)
