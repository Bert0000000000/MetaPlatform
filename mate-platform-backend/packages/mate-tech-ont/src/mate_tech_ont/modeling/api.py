"""Data-assisted modeling API; candidates are inert until explicit gated publication."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..v2_kernel import api as native
from . import (
    assistant_client,
    assurance,
    data_treatment,
    generation_quality,
    ingestion,
    publication,
    review_completion,
)
from .core import (
    Draft,
    ModelingQuestion,
    compile_graph,
    digest,
    profile_rows,
    read_workbook,
    validate_draft,
    validate_ontology,
)
from .store import ModelingStore, RevisionConflict, now

router = APIRouter(prefix="/api/v1/ont/v2/modeling", tags=["data-modeling"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Revision(Strict):
    revision: int = Field(ge=1)


class ValidationRequest(Revision):
    preparePublication: bool = False


class SyncRequest(Revision):
    background: bool = False
    allowPartial: bool = False
    checkHash: str | None = Field(default=None, min_length=64, max_length=64)


class RepairConfirmation(Revision):
    proposalId: str = Field(min_length=1, max_length=80)
    keys: list[str] = Field(min_length=1, max_length=30)


class CompletionRequest(Revision):
    deferClasses: list[str] = Field(default_factory=list, max_length=40)


class CompletionConfirmation(CompletionRequest):
    planHash: str = Field(min_length=64, max_length=64)


class Resolution(Strict):
    mode: Literal["new", "reuse", "extend"] = Field(
        default="new",
        description="候选处理决策；高相似候选新增前须显式保存 new，复用/扩展需人工核对目标和属性映射。",
    )
    targetRid: str = ""
    propertyMap: dict[str, str] = Field(default_factory=dict)


class Save(Revision):
    draft: Draft | None
    context: str = Field(default="", max_length=2000)
    questions: list[ModelingQuestion] = Field(default_factory=list, max_length=20)
    resolutions: dict[str, Resolution] = Field(default_factory=dict)


class Generate(Revision):
    context: str = Field(default="", max_length=2000)
    questions: list[ModelingQuestion] = Field(default_factory=list, max_length=20)


class Publish(Revision):
    configHash: str = Field(min_length=64, max_length=64)
    acknowledgeWarnings: bool = False


def context(request, mutate=False):
    ctx = native._ctx(request)
    if mutate and not {
        "admin",
        "platform_admin",
        "PLATFORM_ADMIN",
        "PLATFORM_SUPER_ADMIN",
        "TENANT_ADMIN",
    }.intersection(ctx.roles):
        raise HTTPException(403, "数据建模修改需要管理员权限")
    return ctx


def store_for(request, mutate=False):
    ctx = context(request, mutate)
    try:
        store = ModelingStore(native._repo(request), ctx.tenant_id)
        # Initialization is per process and tenant. Existing running jobs are explicitly
        # interrupted once after restart; never silently represented as still running.
        initialized = getattr(request.app.state, "modeling_initialized", None)
        if initialized is None:
            initialized = request.app.state.modeling_initialized = set()
        if str(ctx.tenant_id) not in initialized:
            store.ensure_schema()
            store.interrupt_jobs()
            initialized.add(str(ctx.tenant_id))
        return store
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(503, str(exc)) from exc


def read(store, ident, revision=None, private=False):
    try:
        result = store.get(ident, private=private)
    except KeyError as exc:
        raise HTTPException(404, "数据来源不存在") from exc
    source = result[0] if private else result
    if revision is not None and source["revision"] != revision:
        raise HTTPException(409, "候选已变化，请刷新后重试")
    return result


@contextmanager
def source_lock(store, ident):
    # Session-level lock serializes save, validation, publishing and sync across workers.
    with store.repo.tenant_scope(store.tenant):
        conn, _ = store.repo._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT pg_try_advisory_lock(hashtextextended(%s,0))",
                    (store.tenant + ":modeling:" + ident,),
                )
                if not cur.fetchone()[0]:
                    raise HTTPException(409, "该来源正在处理，请稍后重试")
            yield
        finally:
            conn.close()


def ensure_idle(source):
    if (source.get("dataRepair") or {}).get("status") == "running":
        raise HTTPException(409, "AI 数据分析正在运行，请等待结果")
    if (source.get("job") or {}).get("status") == "running":
        raise HTTPException(409, "生成或审查任务正在运行")
    if (source.get("sync") or {}).get("status") == "running":
        raise HTTPException(409, "数据同步正在运行，请等待结果")


def failure(exc):
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, RevisionConflict):
        raise HTTPException(409, str(exc)) from exc
    raise HTTPException(422, str(exc)) from exc


@router.get("/sources", operation_id="ontListModelingSources")
async def list_sources(request: Request):
    return {"sources": store_for(request).list()}


@router.post("/sources", status_code=201, operation_id="ontCreateModelingSource")
async def upload_source(request: Request, file: UploadFile = File(...)):
    store = store_for(request, True)
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "请上传 .xlsx 工作簿")
    content = await file.read(12 * 1024 * 1024 + 1)
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(413, "文件不能超过 12 MB")
    try:
        rows, headers = await asyncio.to_thread(read_workbook, content)
        profile = await asyncio.to_thread(profile_rows, rows, headers)
        return store.create(
            file.filename, context(request).user_id, profile, rows, headers, content
        )
    except ValueError as exc:
        failure(exc)


@router.get("/sources/{ident}", operation_id="ontGetModelingSource")
async def get_source(ident: str, request: Request):
    return read(store_for(request), ident)


@router.put("/sources/{ident}", operation_id="ontSaveModelingSource")
async def save_source(ident: str, payload: Save, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source = read(store, ident, payload.revision)
        ensure_idle(source)
        try:
            changes = payload.model_dump(exclude={"revision"})
            if (source.get("publication") or {}).get("completed"):

                def selected(value):
                    return {
                        key: sorted(
                            item["id"]
                            for item in (value or {}).get(key, [])
                            if item.get("included", True)
                        )
                        for key in ("classes", "relationships")
                    }

                if selected(source.get("draft")) != selected(changes["draft"]):
                    raise HTTPException(
                        409, "已有发布结果，本次发布范围已锁定；请保留当前范围完成重试"
                    )
            if changes["draft"]:
                changes["draft"]["semantics"].update(
                    context=changes["context"], questions=changes["questions"]
                )
            changes.update(
                validation=None,
                review=None,
                preview=None,
                plan=None,
                sync=None,
                syncCheck=None,
                dataRepair=None,
            )
            if source.get("generation"):
                changes["generation"] = {**source["generation"], "stale": True}
            # Keep publication history for conflict-safe idempotent retries, but an
            # edited candidate can never sync until a matching fresh publication.
            return store.update(ident, payload.revision, changes)
        except ValueError as exc:
            failure(exc)


async def begin_job(ident, payload, request, kind):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if kind == "generate" and (source.get("publication") or {}).get("completed"):
            raise HTTPException(
                409, "已有发布结果，不能重新生成覆盖；请另建来源候选并复用已发布类型"
            )
        if kind == "review" and not source.get("draft"):
            raise HTTPException(422, "请先生成候选模型")
        job = {"id": str(uuid4()), "kind": kind, "status": "running", "startedAt": now()}
        if kind == "generate":
            job["progress"] = {"stage": "preparing"}
        changes = {"job": job}
        if kind == "generate":
            changes.update(
                context=payload.context,
                questions=[q.model_dump() for q in payload.questions],
                validation=None,
                review=None,
                preview=None,
                plan=None,
                sync=None,
                syncCheck=None,
                dataRepair=None,
            )
        job_connection = store.acquire_job(ident)
        try:
            source = store.update(ident, source["revision"], changes)
        except BaseException:
            job_connection.close()
            raise
        revision = source["revision"]
    authorization = request.headers.get("authorization", "")
    tenant = str(context(request).tenant_id)

    async def work():
        async def progress(value):
            job["progress"] = value
            await asyncio.to_thread(
                store.update, ident, revision, {"job": dict(job)}, increment=False
            )

        progress_token = assistant_client.generation_progress.set(progress)
        try:
            if kind == "generate":
                existing = await native.list_object_types(request)
                existing = [t.model_dump() for t in existing]
                native_links = [t.model_dump() for t in await native.list_link_types(request)]
                fingerprint = await asyncio.to_thread(
                    generation_quality.input_fingerprint,
                    rows,
                    source["context"],
                    source["questions"],
                    existing,
                    native_links,
                )
                await asyncio.to_thread(store.ensure_generation_cache)
                cached = await asyncio.to_thread(store.generation_baseline, fingerprint)
                reused = cached is not None
                if cached is None:
                    profile = {
                        **source["profile"],
                        "platformCapabilities": generation_quality.CAPABILITIES,
                    }
                    draft = await assistant_client.generate(
                        profile,
                        source["context"],
                        source["questions"],
                        existing,
                        authorization,
                        tenant,
                    )
                    draft = Draft.model_validate(draft).model_dump()
                    fixes, notices, rounds = [], [], 0
                    for attempt in range(2):
                        await progress({"stage": "checking", "round": attempt + 1})
                        quality = await asyncio.to_thread(generation_quality.analyze, draft, rows)
                        if (
                            not any(item["candidates"] for item in quality["identities"])
                            and not quality["relationshipCandidates"]
                        ):
                            break
                        rounds += 1
                        try:
                            # Full records stay local; only bounded diagnostics go to AI.
                            response = await assistant_client._post(
                                "refine",
                                {
                                    "profile": profile,
                                    "draft": draft,
                                    "validation": quality,
                                    "outputSchema": generation_quality.Repairs.model_json_schema(),
                                },
                                authorization,
                                tenant,
                            )
                            refined, applied = await asyncio.to_thread(
                                generation_quality.apply_repairs, draft, rows, response
                            )
                        except (HTTPException, ValueError, TypeError, KeyError):
                            notices.append(
                                "自动修正未完成，保留已生成候选和全量预检结果，请审核待处理项。"
                            )
                            break
                        if not applied:
                            break
                        draft = refined
                        fixes.extend(applied)
                    await progress({"stage": "checking"})
                    quality = await asyncio.to_thread(generation_quality.analyze, draft, rows)
                    report = {
                        **quality,
                        "policyVersion": generation_quality.POLICY_VERSION,
                        "fingerprint": fingerprint,
                        "rounds": rounds,
                        "changes": fixes,
                        "notices": notices,
                        "capabilities": generation_quality.CAPABILITIES,
                        "draftHash": digest(draft),
                        "stale": False,
                    }
                    cached = await asyncio.to_thread(
                        store.generation_baseline,
                        fingerprint,
                        {"draft": draft, "generation": report},
                    )
                else:
                    await progress({"stage": "checking", "reused": True})
                changes = {
                    "draft": cached["draft"],
                    "resolutions": {},
                    "generation": {
                        **cached["generation"],
                        "origin": "reused" if reused else "generated",
                    },
                }
            else:
                validation = validate_draft(source["draft"], rows, require_review=False)
                report = await assistant_client.review(
                    source["profile"], source["draft"], validation, authorization, tenant
                )
                changes = {"review": report}
            changes["job"] = {**job, "status": "succeeded", "finishedAt": now()}
            store.update(ident, revision, changes)
        except asyncio.CancelledError:
            store.update(
                ident,
                revision,
                {"job": {**job, "status": "interrupted", "error": "任务中断，请重试"}},
                increment=False,
            )
            raise
        except Exception as exc:
            store.update(
                ident,
                revision,
                {
                    "job": {
                        **job,
                        "status": "failed",
                        "error": str(getattr(exc, "detail", exc))[:1500],
                    }
                },
                increment=False,
            )
        finally:
            assistant_client.generation_progress.reset(progress_token)
            job_connection.close()

    tasks = getattr(request.app.state, "modeling_tasks", None)
    if tasks is None:
        tasks = request.app.state.modeling_tasks = set()
    task = asyncio.create_task(work())
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    return source


@router.post(
    "/sources/{ident}/generate", status_code=202, operation_id="ontGenerateModelingCandidate"
)
async def generate(ident: str, payload: Generate, request: Request):
    return await begin_job(ident, payload, request, "generate")


@router.post("/sources/{ident}/review", status_code=202, operation_id="ontReviewModelingCandidate")
async def review(ident: str, payload: Revision, request: Request):
    return await begin_job(ident, payload, request, "review")


async def completion_result(request, source, rows, defer_classes):
    plan = await asyncio.to_thread(review_completion.propose, source, rows, defer_classes)
    trial = {**source, 'draft': plan['draft'], 'revision': source['revision'] + 1}
    # Approval is about candidate definitions, never native publication routing.
    checked = await validation_result(request, trial, rows, prepare_publication=False)
    return plan, checked


@router.post("/sources/{ident}/completion-plan", operation_id="ontPrepareModelingCompletion")
async def completion_plan(ident: str, payload: CompletionRequest, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if not source.get("draft"):
            raise HTTPException(422, "请先建立候选模型")
        try:
            plan, _ = await completion_result(request, source, rows, payload.deferClasses)
            return {k: v for k, v in plan.items() if k != "draft"}
        except ValueError as exc:
            failure(exc)


@router.post("/sources/{ident}/completion-confirm", operation_id="ontConfirmModelingCompletion")
async def completion_confirm(ident: str, payload: CompletionConfirmation, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if not source.get("draft"):
            raise HTTPException(422, "请先建立候选模型")
        try:
            plan, checked = await completion_result(request, source, rows, payload.deferClasses)
            if payload.planHash != plan["hash"]:
                raise HTTPException(409, "完整处理方案已变化，请重新查看方案")
            if not plan["canApply"]:
                raise HTTPException(422, "仍有无法处理的结构问题，草稿未修改")
            audit = {
                "actor": str(context(request).user_id),
                "at": now(),
                "planHash": plan["hash"],
                "beforeHash": digest(source["draft"]),
                "afterHash": digest(plan["draft"]),
                "changes": plan["changes"],
            }
            changes = {
                "draft": plan["draft"],
                "validation": None,
                "review": None,
                "preview": None,
                "plan": None,
                "sync": None,
                "syncCheck": None,
                "dataRepair": None,
                "completionAudit": [*(source.get("completionAudit") or []), audit],
            }
            if source.get("generation"):
                changes["generation"] = {**source["generation"], "stale": True}
            changes.update(checked)
            return store.update(ident, source["revision"], changes)
        except ValueError as exc:
            failure(exc)


async def validation_result(request, source, rows, *, prepare_publication=False):
    report = validate_ontology(source["draft"])
    from .rules import validate_evidence

    evidence_issues = validate_evidence(source["draft"], source["profile"])
    report["issues"].extend(evidence_issues)
    report["errors"] += sum(i["severity"] == "error" for i in evidence_issues)
    report["canPublish"] = report["canPublish"] and not report["errors"]
    data_report = validate_draft(source["draft"], rows)
    data_report.update(scope="data", canSync=data_report.pop("canPublish"))
    report["dataValidation"] = data_report
    if data_report["errors"]:
        report["warnings"] += 1
        report["issues"].append(
            {
                "severity": "warning",
                "item": "data",
                "message": f"数据检查发现 {data_report['errors']} 项问题；不阻断本体发布。可在数据同步中隔离问题记录，仅同步合格数据。",
            }
        )
    preview = {"nodes": [], "edges": [], "totalNodes": 0, "totalEdges": 0, "limit": 100}
    plan = None
    if not data_report["errors"]:
        nodes, edges = compile_graph(source["draft"], rows, require_review=False)
        selected = {n["key"] for n in nodes[:100]}
        preview.update(
            nodes=nodes[:100],
            edges=[e for e in edges if e["source"] in selected and e["target"] in selected][:200],
            totalNodes=len(nodes),
            totalEdges=len(edges),
        )
    if prepare_publication and not report["errors"]:
        conflicts = await publication.new_type_conflicts(request, source)
        if conflicts:
            report["errors"] += len(conflicts)
            report["canPublish"] = False
            report["issues"].extend(conflicts)
    if prepare_publication and not report["errors"]:
        try:
            plan = await publication.prepare(request, source)
        except ValueError as exc:
            report["errors"] += 1
            report["canPublish"] = False
            report["issues"].append({"severity": "error", "item": "native", "message": str(exc)})
    return {"validation": report, "preview": preview, "plan": plan}


@router.post("/sources/{ident}/validate", operation_id="ontValidateModelingCandidate")
async def validate(ident: str, payload: ValidationRequest, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if not source.get("draft"):
            raise HTTPException(422, "请先生成或保存候选")
        try:
            changes = await validation_result(request, source, rows, prepare_publication=payload.preparePublication)
            return store.update(ident, source["revision"], changes, increment=False)
        except ValueError as exc:
            failure(exc)


@router.post("/sources/{ident}/publish", operation_id="ontPublishModelingCandidate")
async def publish(ident: str, payload: Publish, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source = read(store, ident, payload.revision)
        ensure_idle(source)
        if not source.get("plan") or source["plan"]["configHash"] != payload.configHash:
            raise HTTPException(409, "请重新验证候选与发布配置")
        report = source.get("validation") or {}
        if report.get("scope") != "ontology":
            raise HTTPException(409, "请重新执行本体校验，旧版数据报告不能作为结构发布许可")
        if not report.get("canPublish") or not validate_ontology(source["draft"])["canPublish"]:
            raise HTTPException(422, "请确认对象与关系定义，并通过本体结构校验")
        if not payload.acknowledgeWarnings:
            raise HTTPException(422, "请确认警告及分步发布范围")
        if source["plan"]["inputHash"] != digest(
            {k: source.get(k) for k in ("draft", "context", "questions", "resolutions")}
        ):
            raise HTTPException(409, "候选已变化，请重新验证")
        try:
            return await publication.publish(request, source, store)
        except ValueError as exc:
            failure(exc)


@router.get("/sources/{ident}/comparison", operation_id="ontCompareModelingNativeType")
async def comparison(
    ident: str,
    request: Request,
    classId: str = Query(max_length=40),
    targetRid: str = Query(max_length=240),
):
    store = store_for(request)
    source = read(store, ident)
    cls = next(
        (c for c in (source.get("draft") or {}).get("classes", []) if c["id"] == classId), None
    )
    if not cls:
        raise HTTPException(404, "候选对象不存在")
    if not targetRid.startswith(f"ont.{store.tenant}."):
        raise HTTPException(422, "只能对比当前租户的类型")
    target = await publication.current_type(request, targetRid)
    if not target:
        raise HTTPException(404, "原生类型不存在")
    result = assurance.compare_type(cls, target, source.get("resolutions", {}).get(classId) or {})
    return {**result, "sourceRevision": source["revision"]}


@router.get("/sources/{ident}/acceptance", operation_id="ontVerifyModelingPublication")
async def acceptance(ident: str, request: Request):
    store = store_for(request)
    return await assurance.verify_plan(request, read(store, ident))


@router.post(
    "/sources/{ident}/data-repair", status_code=202, operation_id="ontProposeModelingDataRepair"
)
async def propose_data_repair(ident: str, payload: Revision, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if not source.get("draft"):
            raise HTTPException(422, "请先建立候选模型")
        connection = store.acquire_job(ident)
        state = {"status": "running", "startedAt": now()}
        try:
            result = store.update(ident, source["revision"], {"dataRepair": state}, increment=False)
        except BaseException:
            connection.close()
            raise

    async def work():
        try:
            candidates = await asyncio.to_thread(data_treatment.candidates, source, rows)
            raw = {"repairs": []}
            if candidates:
                raw = await assistant_client._post(
                    "data-repair",
                    {
                        "profile": {"sheets": []},
                        "context": source["context"],
                        "validation": {"candidates": candidates},
                        "outputSchema": data_treatment.Repairs.model_json_schema(),
                    },
                    request.headers.get("authorization", ""),
                    str(context(request).tenant_id),
                )
            proposed = await asyncio.to_thread(data_treatment.proposal, source, rows, raw)
            state.update(
                status="succeeded",
                proposal=proposed,
                finishedAt=now(),
                notice="仅提出有来源依据的非身份属性修复；缺失身份或不明确的冲突保留暂缓，不自动猜测。",
            )
        except asyncio.CancelledError:
            state.update(status="interrupted", error="服务任务中断，请重新分析", finishedAt=now())
            raise
        except Exception as exc:
            state.update(
                status="failed", error=str(getattr(exc, "detail", exc))[:1200], finishedAt=now()
            )
        finally:
            try:
                store.update(ident, source["revision"], {"dataRepair": state}, increment=False)
            finally:
                connection.close()

    tasks = getattr(request.app.state, "modeling_tasks", None)
    if tasks is None:
        tasks = request.app.state.modeling_tasks = set()
    task = asyncio.create_task(work())
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    return result


@router.post("/sources/{ident}/data-repair-confirm", operation_id="ontConfirmModelingDataRepair")
async def confirm_data_repair(ident: str, payload: RepairConfirmation, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        proposed = (source.get("dataRepair") or {}).get("proposal")
        if not proposed or proposed["id"] != payload.proposalId:
            raise HTTPException(409, "修复方案已变化，请重新分析")
        try:
            confirmed = data_treatment.confirm(
                source, rows, proposed, payload.keys, str(context(request).user_id)
            )
            return store.update(
                ident,
                source["revision"],
                {
                    "dataTreatment": confirmed,
                    "syncCheck": None,
                    "dataRepair": {
                        **source["dataRepair"],
                        "status": "confirmed",
                        "confirmedAt": now(),
                    },
                },
            )
        except ValueError as exc:
            failure(exc)


@router.get("/sources/{ident}/quarantine", operation_id="ontExportModelingQuarantine")
async def export_quarantine(
    ident: str, request: Request, checkHash: str = Query(min_length=64, max_length=64)
):
    import csv
    from io import StringIO

    from fastapi.responses import Response

    source, rows = read(store_for(request), ident, private=True)
    check = source.get("syncCheck") or {}
    report, _, _, manifest = await asyncio.to_thread(data_treatment.prepare, source, rows, True)
    if (
        check.get("sourceRevision") != source["revision"]
        or checkHash != (check.get("partial") or {}).get("checkHash")
        or checkHash != report["checkHash"]
    ):
        raise HTTPException(409, "检查结果已过期，请重新检查")
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["类别", "对象/关系标识", "工作表", "来源行", "原因", "数量"])

    def safe(value):
        text = str(value)
        return (
            "'" + text
            if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n"))
            else text
        )

    for entry in manifest:
        for ref in entry["sources"] or [{"sheet": "", "row": ""}]:
            writer.writerow(
                [
                    safe(v)
                    for v in [
                        entry["kind"],
                        entry.get("classId", entry["item"]),
                        ref["sheet"],
                        ref["row"],
                        entry["reason"],
                        entry.get("count", 1),
                    ]
                ]
            )
    return Response(
        "\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="deferred-records.csv"'},
    )


@router.post("/sources/{ident}/sync-check", operation_id="ontCheckModelingDataSync")
async def check_sync(ident: str, payload: Revision, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if not source.get("draft"):
            raise HTTPException(422, "请先生成或保存候选")
        report, nodes, edges, _ = data_treatment.prepare(source, rows)
        partial_report, partial_nodes, partial_edges, _ = data_treatment.prepare(source, rows, True)
        baseline_error = None
        try:
            await ingestion.verify_baseline(request, source)
        except ValueError as exc:
            baseline_error = str(exc)
        preview = None
        if report["canSync"]:
            try:
                preview = {"nodes": len(nodes), "edges": len(edges)}
            except ValueError as exc:
                issue = {"severity": "error", "item": "draft", "message": str(exc)}
                report["canSync"] = False
                report["errors"] += 1
                report["issues"].append(issue)
                report.setdefault("issueGroups", []).append({**issue, "count": 1})
        import os

        if not os.environ.get("ONT_MODELING_SOURCE_DSN"):
            baseline_error = baseline_error or "Excel 同步来源尚未配置，请联系管理员配置后重新检查"
        check = {
            "sourceRevision": source["revision"],
            "checkedAt": now(),
            "report": report,
            "preview": preview,
            "baselineError": baseline_error,
            "canSync": report["canSync"] and not baseline_error,
            "partial": {
                "report": partial_report,
                "preview": {"nodes": len(partial_nodes), "edges": len(partial_edges)},
                "checkHash": partial_report["checkHash"],
                "quarantine": partial_report["quarantine"],
                "canSync": partial_report["canSync"] and not baseline_error,
            },
        }
        return store.update(ident, source["revision"], {"syncCheck": check}, increment=False)


@router.post("/sources/{ident}/sync", operation_id="ontSyncModelingSource")
async def sync(ident: str, payload: SyncRequest, request: Request):
    store = store_for(request, True)
    with source_lock(store, ident):
        source, rows = read(store, ident, payload.revision, private=True)
        ensure_idle(source)
        if (
            not source.get("plan")
            or (source.get("publication") or {}).get("configHash") != source["plan"]["configHash"]
        ):
            raise HTTPException(409, "候选变化后请重新验证发布")
        try:
            data_report, _, _, _ = data_treatment.prepare(source, rows, payload.allowPartial)
            if payload.allowPartial:
                check = source.get("syncCheck") or {}
                if (
                    check.get("sourceRevision") != source["revision"]
                    or not (check.get("partial") or {}).get("canSync")
                    or payload.checkHash != (check.get("partial") or {}).get("checkHash")
                    or payload.checkHash != data_report["checkHash"]
                ):
                    raise HTTPException(409, "合格数据范围已变化，请重新检查并确认暂缓范围")
            if not data_report["canSync"]:
                raise HTTPException(
                    422,
                    f"数据校验尚未通过（{data_report['errors']} 项阻断），请修正数据或映射后重新校验；已发布本体不受影响",
                )

            async def perform_sync():
                if payload.allowPartial:
                    return await ingestion.sync(
                        request,
                        source,
                        rows,
                        store,
                        allow_partial=True,
                        check_hash=payload.checkHash,
                    )
                return await ingestion.sync(request, source, rows, store)

            if not payload.background:
                return await perform_sync()
            await ingestion.verify_baseline(request, source)
            state = {
                "status": "running",
                "stage": "preparing",
                "types": [],
                "links": 0,
                "sourceRevision": source["revision"],
                "startedAt": now(),
                "mode": "append-upsert",
                "deleteMissing": False,
            }
            result = store.update(ident, source["revision"], {"sync": state}, increment=False)

            async def work():
                try:
                    with source_lock(store, ident):
                        # Native ingestion does synchronous PostgreSQL work; keep reads/polling responsive.
                        await asyncio.to_thread(lambda: asyncio.run(perform_sync()))
                except Exception as exc:
                    current = store.get(ident)
                    failed = {
                        **(current.get("sync") or state),
                        "status": "failed",
                        "error": str(getattr(exc, "detail", exc)),
                        "finishedAt": now(),
                    }
                    store.update(ident, source["revision"], {"sync": failed}, increment=False)

            tasks = getattr(request.app.state, "modeling_tasks", None)
            if tasks is None:
                tasks = request.app.state.modeling_tasks = set()
            task = asyncio.create_task(work())
            tasks.add(task)
            task.add_done_callback(tasks.discard)
            from fastapi.responses import JSONResponse

            return JSONResponse(result, status_code=202)
        except ValueError as exc:
            failure(exc)
