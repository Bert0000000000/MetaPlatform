"""agent-team HTTP surface（contracts/openapi/services/agent-team.yaml）。

  - POST /api/v1/agent-team/runs                      — 一句话启动
  - GET  /api/v1/agent-team/runs?conversation=…       — 一个会话里的各轮 run（C-1）
  - GET  /api/v1/agent-team/runs/{run_id}             — 任务图/员工状态/结果
  - POST /api/v1/agent-team/runs/{run_id}/approve     — 人工确认闸门
  - POST /api/v1/agent-team/runs/{run_id}/cancel      — 取消（落终态）
  - GET  /api/v1/agent-team/runs/{run_id}/events      — 步骤级事件流（SSE）
  - GET/POST/PUT /api/v1/agent-team/profiles…         — 数字员工读写

每个 handler 先过 ``require_tenant``（硬规则 #3）再碰服务层；服务层再把它落到
thread_id 前缀与连接的 ``app.tenant_id`` 上，由 RLS 强制。

**读 run 一律走 RunControl.refresh**（而不是直接 ``service.get``）：超时是
"到点落终态"，裁决必须发生在读路径上，否则到期的 run 会一直显示成
``awaiting_approval``。
"""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from mate_platform.tenancy.guards import (
    ApprovalRoleError,
    require_approver,
    require_tenant,
)

from ..artifact_store import ArtifactStore
from ..authority import Envelope, resolve_initiator_envelope
from ..brain import AWAITING, BrainService, RunNotAwaitingApproval, RunNotFound
from ..profile_store import ProfileStore
from ..profiles import DEFAULT_MODEL, EmployeeProfile, ProfileNotFound, ProfileRegistry
from ..skills import SkillCatalog, SkillNotFound
from ..state import BrainState
from ..team_bus import TaskNotFound, TaskTerminal, TeamBus
from .run_control import RunControl
from .schemas import (
    ApproveRequest,
    ArtifactContentModel,
    ArtifactListModel,
    ArtifactModel,
    AuditListModel,
    AuditRecordModel,
    ChannelMessageModel,
    ConversationRunModel,
    EmployeeProfileModel,
    ProfileListModel,
    ProfileWriteRequest,
    RunAcceptedModel,
    RunCancelAcceptedModel,
    RunListModel,
    RunStateModel,
    SendMessageRequest,
    SkillContentModel,
    SkillManifestEntryModel,
    SkillManifestModel,
    StartRunRequest,
)

router = APIRouter(prefix="/api/v1/agent-team", tags=["agent-team"])

_service: BrainService | None = None
_registry: ProfileRegistry | None = None
_catalog: SkillCatalog | None = None
_bus: TeamBus | None = None
_control: RunControl | None = None
_store: ProfileStore | None = None
_artifacts: ArtifactStore | None = None


def set_brain_service(service: BrainService | None) -> None:
    """装配/重置服务层（测试 DI 缝）。运行控制面跟着服务层走，一并重置。"""
    global _service, _control
    _service = service
    _control = None


def get_brain_service() -> BrainService:
    if _service is None:
        raise RuntimeError("BrainService 未装配：请先 set_brain_service(...)")
    return _service


def set_profile_registry(registry: ProfileRegistry | None) -> None:
    """装配/重置员工名册（测试 DI 缝）。"""
    global _registry
    _registry = registry


def get_profile_registry() -> ProfileRegistry:
    if _registry is None:
        raise RuntimeError("ProfileRegistry 未装配：请先 set_profile_registry(...)")
    return _registry


def set_skill_catalog(catalog: SkillCatalog | None) -> None:
    """装配/重置技能目录（测试 DI 缝）。"""
    global _catalog
    _catalog = catalog


def get_skill_catalog() -> SkillCatalog:
    if _catalog is None:
        raise RuntimeError("SkillCatalog 未装配：请先 set_skill_catalog(...)")
    return _catalog


def set_team_bus(bus: TeamBus | None) -> None:
    """装配/重置派活闸门 + 消息通道（测试 DI 缝）。"""
    global _bus
    _bus = bus


def get_team_bus() -> TeamBus:
    if _bus is None:
        raise RuntimeError("TeamBus 未装配：请先 set_team_bus(...)")
    return _bus


def set_run_control(control: RunControl | None) -> None:
    """装配/重置运行控制面（取消 / 超时 / 事件流）。"""
    global _control
    _control = control


def get_run_control() -> RunControl:
    """运行控制面；没装配就**现按当前服务层建一个**。

    它没有独立状态需要注入（run 状态在检查点里，只有截止时间记在进程内），
    所以默认构造是安全的——测试与生产都不必记得多装配一样东西。
    """
    global _control
    if _control is None:
        # 生产装配在 wiring（租约 / 心跳 / 接管要 DSN 与账本）；没配 DSN 时
        # 它自己退回单副本形态，与本函数原来直接调 from_env 的行为一致。
        from ..wiring import build_run_control

        _control = build_run_control(get_brain_service())
    return _control


def set_profile_store(store: ProfileStore | None) -> None:
    """装配/重置员工落库面（建/改数字员工用）。"""
    global _store
    _store = store


def get_profile_store() -> ProfileStore:
    if _store is None:
        raise RuntimeError("ProfileStore 未装配：请先 set_profile_store(...)")
    return _store


def set_artifact_store(store: ArtifactStore | None) -> None:
    """装配/重置产出物存储（1.6 任务 2）。"""
    global _artifacts
    _artifacts = store


def get_artifact_store() -> ArtifactStore:
    if _artifacts is None:
        raise RuntimeError("ArtifactStore 未装配：请先 set_artifact_store(...)")
    return _artifacts


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _actor(request: Request) -> str:
    """发起者的 **subject**（写进会话关系的 ``created_by``）。

    取自**令牌解析出来的** ``RequestContext``，不是请求体里的字段——"这轮是谁
    发起的"是可以被审计追问的事实，不接受调用方自称。
    """
    return str(getattr(request.state.ctx, "user_id", "") or "")


def _user_token(request: Request) -> str:
    """发起用户的原始 Bearer。

    本体面按 token 的 tenant claim 解析租户，服务身份 token 不带该 claim 会被拒；
    而 ADR-0066 §3.3 要求权限包络的链根是**发起用户**，所以这里透传用户令牌。
    """
    ctx_token = str(getattr(request.state.ctx, "authorization", "") or "")
    if ctx_token:
        return ctx_token
    header = request.headers.get("authorization", "")
    return header[7:].strip() if header.lower().startswith("bearer ") else ""


def _approver_roles(request: Request) -> tuple[str, ...]:
    """审批人**实际持有的**角色（来自令牌的 ``RequestContext.roles``）。

    刻意**不是**请求体里让调用方填的角色：多级审批靠角色归级，而"我自称是什么
    角色"是可以随便写的。闸门拿到的必须是签出来的那一个。
    """
    roles = getattr(request.state.ctx, "roles", None) or ()
    return tuple(str(role) for role in roles)


def _to_model(state: BrainState) -> RunStateModel:
    return RunStateModel.model_validate({**state, "status": state.get("status", "")})


@router.post("/runs", response_model=RunAcceptedModel, status_code=202)
async def agentTeamPostRuns(request: Request, body: StartRunRequest) -> RunAcceptedModel:
    """**受理**一轮运行（1.7 任务 1）：立刻回 202 + run_id，图在后台跑。

    改受理制是为了根治 1.6 抓出的那个坑：同步返回时拆图 + 派活要跑分钟级，网关
    60s 读超时会回 504，**而这一轮其实已经建好了**——客户端拿不到 run_id，重试
    一次就多跑一轮。现在提交立刻拿到地址，终态从 ``GET /runs/{run_id}`` 或事件流取。

    重复提交怎么办：带 ``Idempotency-Key`` 时同一个键（**同租户内**）永远映射到
    同一轮；重复提交原样回同一个 run_id 并置 ``deduplicated``。

    带 ``conversation_id`` 时**同一件事顺带落库**（C-1）：这一轮属于哪次会话由
    后端记，前端那份 localStorage 只是缓存。于是换机器 / 清浏览器之后，"这次
    对话里跑过哪几轮"仍查得到（`GET /runs?conversation=`）。
    """
    tenant_id = _tid(request)
    accepted = await get_run_control().submit(
        tenant_id=tenant_id,
        goal=body.goal,
        user_token=_user_token(request),
        max_parallel=body.max_parallel,
        timeout_seconds=body.timeout_seconds,
        idempotency_key=request.headers.get("idempotency-key", "").strip(),
        conversation_id=body.conversation_id.strip(),
        turn_id=body.turn_id.strip(),
        created_by=_actor(request),
    )
    return RunAcceptedModel.model_validate(accepted)


@router.get("/runs", response_model=RunListModel)
async def agentTeamGetRuns(
    request: Request, conversation: str = Query(min_length=1)
) -> RunListModel:
    """列一个会话里的各轮 run（C-1，**新→旧**）。

    **后端是唯一关系源**：这份关系以前只写在浏览器 localStorage 里，换个机器
    就没了。``conversation`` 必填——没有它就变成"列出全租户的 run"，
    那既不是本端点的用途，也会把这个读路径的代价放大到不可控。

    租户取自令牌（``_tid``），**不是查询参数**：拿别人的 conversation_id 来查
    只会查到空（那是另一个租户的命名空间），不泄露"这个 id 存在过"。
    """
    rows = await get_run_control().runs_in_conversation(
        tenant_id=_tid(request), conversation_id=conversation
    )
    return RunListModel(
        conversation_id=conversation,
        items=[ConversationRunModel.model_validate(row) for row in rows],
    )


@router.get("/runs/{run_id}", response_model=RunStateModel)
async def agentTeamGetRun(request: Request, run_id: str) -> RunStateModel:
    try:
        state = await get_run_control().refresh(tenant_id=_tid(request), run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return _to_model(state)


@router.post("/runs/{run_id}/cancel", response_model=RunCancelAcceptedModel, status_code=202)
async def agentTeamPostRunCancel(request: Request, run_id: str) -> RunCancelAcceptedModel:
    """**受理**取消一轮运行（B-3：202 ``cancel_requested``，幂等）。

    不再承诺"回话那一刻图已经停了"——那个保证只在单副本下成立。客户端拿到
    ``cancelling`` 就接着看 ``GET /runs/{run_id}``，直到它变成 ``cancelled``。

    取消后 ``approve`` 一律 409：闸门已经不在，确认一个已作废的计划不该有任何
    效果。跨租户与不存在同码 404（不泄露存在性）。
    """
    try:
        receipt = await get_run_control().cancel(tenant_id=_tid(request), run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return RunCancelAcceptedModel.model_validate(receipt)


@router.get("/runs/{run_id}/events")
async def agentTeamGetRunEvents(request: Request, run_id: str) -> StreamingResponse:
    """步骤级事件流（SSE）：按 ``Last-Event-ID`` 补发，最后一条 ``end`` 收流。

    ``Last-Event-ID`` 是 SSE 规范里的**断线重连游标**：浏览器自己带回来，服务端
    从"它看过的最后一条"之后接着发。B-2 之前 ``seq`` 是每流内存计数，流一断归零
    ——重连必然丢事件。非法值当 0 处理（从头补发），不报错：一个坏游标不该让
    订阅彻底失败。
    """
    tenant_id = _tid(request)
    control = get_run_control()
    try:
        await control.refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return StreamingResponse(
        control.events(
            tenant_id=tenant_id,
            run_id=run_id,
            last_event_id=_last_event_id(request),
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _last_event_id(request: Request) -> int:
    """SSE 的续传游标。缺省 / 非法一律 0（从头补发）。"""
    raw = request.headers.get("last-event-id", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


@router.get("/runs/{run_id}/artifacts", response_model=ArtifactListModel)
async def agentTeamGetRunArtifacts(request: Request, run_id: str) -> ArtifactListModel:
    """列出一轮运行产出的交付物（1.6 任务 2，**只出元数据**）。

    先按 run 的存在性判 404（跨租户与不存在同码），再只回**本租户**的行——
    产出物不能成为一条绕过 run 隔离的读路径。
    """
    tenant_id = _tid(request)
    try:
        await get_run_control().refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    rows = await get_artifact_store().list(tenant_id, run_id)
    return ArtifactListModel(items=[ArtifactModel.model_validate(row.to_dict()) for row in rows])


@router.get("/artifacts/{artifact_id}", response_model=ArtifactContentModel)
async def agentTeamGetArtifact(request: Request, artifact_id: str) -> ArtifactContentModel:
    """按 id 取回一件产出物的**正文**（1.6 任务 2）。

    跨租户与不存在同码 404：产出物的地址是**租户内**的地址，拿别人的 id
    来取读不到，也不该读出"这个 id 存在过"。
    """
    artifact = await get_artifact_store().get(_tid(request), artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return ArtifactContentModel.model_validate(artifact.to_content_dict())


@router.get("/runs/{run_id}/audit", response_model=AuditListModel)
async def agentTeamGetRunAudit(request: Request, run_id: str) -> AuditListModel:
    """一轮运行的审计行（硬规则 #9）：派活 / 越权转 proposal / 审批。

    "落了吗"要能看见，否则等于没落。先按 run 的存在性判 404（跨租户同码），
    再只回**本租户**的行——审计行不能成为一条绕过 run 隔离的读路径。

    A-1 起这批行来自**持久账本**（带哈希链）而不是进程内列表：重启后再查同一轮，
    拿到的是同一批行。租户取自令牌（``_tid``），不是查询参数——所以这里没有
    "换一个 tenant_id 就能读别人"的入口。
    """
    tenant_id = _tid(request)
    try:
        await get_run_control().refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    rows = await get_brain_service().audit.records(tenant_id=tenant_id, run_id=run_id)
    return AuditListModel(items=[AuditRecordModel(**row.to_dict()) for row in rows])


@router.post("/runs/{run_id}/approve", response_model=RunStateModel)
async def agentTeamPostRunApprove(
    request: Request, run_id: str, body: ApproveRequest
) -> RunStateModel:
    """人工确认闸门（需要**审批角色**，不是任意登录用户）。

    审批角色复用平台既有的 ``require_*`` 守卫做法（``RequestContext.roles``）：
    ``agent_admin`` 或平台管理员。没有角色 → 403 且**不落审计行**——没发生的
    动作不记账，否则账本上会混进一堆"被拒的尝试"把真事件淹掉。
    """
    try:
        require_approver(request.state.ctx)
    except ApprovalRoleError as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "E_NOT_APPROVER",
                "message": "approve 需要审批角色（agent_admin / platform_admin）",
                "roles": sorted(exc.roles),
            },
        ) from exc

    tenant_id = _tid(request)
    # 先让控制面裁决超时：到期的计划不该还能被确认续跑。
    try:
        await get_run_control().refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    try:
        # 续跑也走控制面：它同样"有请求在等它"，执行中同样可被取消（1.5 任务 1）。
        # B-6：把**审批人实际持有的角色**（来自令牌，不是他自称的）一起交给闸门
        # ——多级审批靠它归级；``comment`` 进闸门的 decisions 与审计。
        state = await get_run_control().resume(
            tenant_id=tenant_id,
            run_id=run_id,
            approved=body.approved,
            user_token=_user_token(request),
            approver_roles=_approver_roles(request),
            comment=body.comment,
        )
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    except RunNotAwaitingApproval as exc:
        raise HTTPException(
            status_code=409, detail={"code": "E_RUN_NOT_AWAITING_APPROVAL", "runId": run_id}
        ) from exc
    return _to_model(state)


@router.post("/tasks/{task_id}/messages", response_model=ChannelMessageModel, status_code=202)
async def agentTeamPostTaskMessage(
    request: Request, task_id: str, body: SendMessageRequest
) -> ChannelMessageModel:
    """给运行中的子 agent 投递一条消息（ADR-0066 §5.5）。

    投递只写 inbox，**不做唤醒**——子 agent 在下一轮迭代边界自己取。
    终态任务返回 409：想继续就新开一个任务，不靠一条消息"续命"。
    """
    try:
        entry = await get_team_bus().send(
            task_id=task_id,
            tenant_id=_tid(request),
            message=body.message,
            sender=body.sender,
        )
    except TaskNotFound as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc
    except TaskTerminal as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "E_TASK_TERMINAL", "taskId": task_id, "status": exc.status},
        ) from exc
    return ChannelMessageModel(sender=entry.sender, text=entry.text, at=entry.at)


def _profile_model(profile: EmployeeProfile) -> EmployeeProfileModel:
    return EmployeeProfileModel(
        profile_id=profile.profile_id,
        name=profile.name,
        base_role=profile.base_role,
        system_prompt=profile.system_prompt,
        skills=list(profile.skills),
        tools=list(profile.tools),
        action_rids=list(profile.action_rids),
        kb_ids=list(profile.kb_ids),
        markings=list(profile.markings),
        model=profile.model,
        origin=profile.origin,
    )


def _write_request_to_profile(body: ProfileWriteRequest, profile_id: str) -> EmployeeProfile:
    return EmployeeProfile(
        profile_id=profile_id,
        name=body.name,
        base_role=body.base_role,
        system_prompt=body.system_prompt,
        skills=tuple(body.skills),
        tools=tuple(body.tools),
        model=body.model or DEFAULT_MODEL,
        action_rids=tuple(body.action_rids),
        kb_ids=tuple(body.kb_ids),
        markings=tuple(body.markings),
        origin="instantiated",
    )


def _reject_escalating_definition(profile: EmployeeProfile, request: Request) -> None:
    """ADR-0066 §3.7：定义出来的包络必须 ⊆ **创建者**包络，否则 403。

    没有这道门，定义一个"带平台没发布的能力"的员工就等于把包络闸门绕开一半
    ——派活时仍会转 proposal，但那是一次本该在定义期就被拒绝的越权。
    """
    initiator = resolve_initiator_envelope(_user_token(request))
    escalations = Envelope.of(profile).escalations_over(initiator)
    if escalations:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "E_AUTHORITY_ESCALATION",
                "message": "员工定义的权限包络超出创建者包络（ADR-0066 §3.7）",
                "escalations": list(escalations),
            },
        )


@router.get("/profiles", response_model=ProfileListModel)
async def agentTeamGetProfiles(request: Request) -> ProfileListModel:
    """列数字员工（身份 = 提示词 + 技能清单 + 工具白名单 + 权限包络）。"""
    tenant_id = str(require_tenant(request.state.ctx))  # 硬规则 #3
    return ProfileListModel(
        profiles=[_profile_model(p) for p in await get_profile_registry().list(tenant_id)]
    )


@router.get("/profiles/{profile_id}", response_model=EmployeeProfileModel)
async def agentTeamGetProfile(request: Request, profile_id: str) -> EmployeeProfileModel:
    tenant_id = str(require_tenant(request.state.ctx))
    try:
        profile = await get_profile_registry().get(profile_id, tenant_id)
    except ProfileNotFound as exc:
        raise HTTPException(status_code=404, detail="profile not found") from exc
    return _profile_model(profile)


@router.post("/profiles", response_model=EmployeeProfileModel, status_code=201)
async def agentTeamPostProfile(request: Request, body: ProfileWriteRequest) -> EmployeeProfileModel:
    """**实例化**一个数字员工（ADR-0066 §3.1）：定义落库，重启/多副本一致。

    落库走 ``profile_store.upsert``（PG + RLS 强制租户隔离），因此"建出来就
    只属于本租户"是数据库说的，不是应用层记得过滤。
    """
    tenant_id = str(require_tenant(request.state.ctx))
    profile_id = body.profile_id.strip() or f"EMP-{uuid4().hex[:8].upper()}"
    profile = _write_request_to_profile(body, profile_id)
    _reject_escalating_definition(profile, request)
    await get_profile_store().upsert(tenant_id, profile)
    return _profile_model(profile)


@router.put("/profiles/{profile_id}", response_model=EmployeeProfileModel)
async def agentTeamPutProfile(
    request: Request, profile_id: str, body: ProfileWriteRequest
) -> EmployeeProfileModel:
    """改一个数字员工（同一个 upsert 语义：提交即覆盖）。

    只能改**本租户**的员工——跨租户拿别人的 id 来改，读不到就是 404，
    与"不存在"同码（不泄露存在性）。
    """
    tenant_id = str(require_tenant(request.state.ctx))
    try:
        await get_profile_registry().get(profile_id, tenant_id)
    except ProfileNotFound as exc:
        raise HTTPException(status_code=404, detail="profile not found") from exc
    profile = _write_request_to_profile(body, profile_id)
    _reject_escalating_definition(profile, request)
    await get_profile_store().upsert(tenant_id, profile)
    return _profile_model(profile)


@router.get("/profiles/{profile_id}/skills", response_model=SkillManifestModel)
async def agentTeamGetProfileSkills(request: Request, profile_id: str) -> SkillManifestModel:
    """技能清单（渐进加载第 1 层：只出名字与一句话描述，**不含正文**）。"""
    tenant_id = str(require_tenant(request.state.ctx))
    try:
        profile = await get_profile_registry().get(profile_id, tenant_id)
    except ProfileNotFound as exc:
        raise HTTPException(status_code=404, detail="profile not found") from exc
    catalog = get_skill_catalog()
    entries = catalog.manifest(profile.skills)
    return SkillManifestModel(
        profile_id=profile.profile_id,
        entries=[
            SkillManifestEntryModel(skill_id=e.skill_id, name=e.name, description=e.description)
            for e in entries
        ],
        manifest_chars=catalog.manifest_size(profile.skills),
        budget_chars=catalog.budget_chars,
    )


@router.get("/profiles/{profile_id}/skills/{skill_id}", response_model=SkillContentModel)
async def agentTeamGetProfileSkillContent(
    request: Request, profile_id: str, skill_id: str
) -> SkillContentModel:
    """技能正文（渐进加载第 2 层：**选中之后**才读）。"""
    tenant_id = str(require_tenant(request.state.ctx))
    try:
        profile = await get_profile_registry().get(profile_id, tenant_id)
    except ProfileNotFound as exc:
        raise HTTPException(status_code=404, detail="profile not found") from exc
    if skill_id not in profile.skills:
        # 没挂在这个员工身上就不给读——清单是闭集，不是"全仓库随便读"
        raise HTTPException(status_code=404, detail="skill not bound to this profile")
    try:
        content = get_skill_catalog().read(skill_id)
    except SkillNotFound as exc:
        raise HTTPException(status_code=404, detail="skill not found") from exc
    return SkillContentModel(skill_id=skill_id, content=content)


__all__ = [
    "AWAITING",
    "get_artifact_store",
    "get_brain_service",
    "get_profile_registry",
    "get_profile_store",
    "get_run_control",
    "get_skill_catalog",
    "get_team_bus",
    "router",
    "set_artifact_store",
    "set_brain_service",
    "set_profile_registry",
    "set_profile_store",
    "set_run_control",
    "set_skill_catalog",
    "set_team_bus",
]
