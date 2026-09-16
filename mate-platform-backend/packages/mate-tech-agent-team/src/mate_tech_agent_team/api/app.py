"""agent-team HTTP surface（contracts/openapi/services/agent-team.yaml）。

  - POST /api/v1/agent-team/runs                      — 一句话启动
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

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from mate_platform.tenancy.guards import (
    ApprovalRoleError,
    require_approver,
    require_tenant,
)

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
    AuditListModel,
    AuditRecordModel,
    ChannelMessageModel,
    EmployeeProfileModel,
    ProfileListModel,
    ProfileWriteRequest,
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
        _control = RunControl.from_env(get_brain_service())
    return _control


def set_profile_store(store: ProfileStore | None) -> None:
    """装配/重置员工落库面（建/改数字员工用）。"""
    global _store
    _store = store


def get_profile_store() -> ProfileStore:
    if _store is None:
        raise RuntimeError("ProfileStore 未装配：请先 set_profile_store(...)")
    return _store


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


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


def _to_model(state: BrainState) -> RunStateModel:
    return RunStateModel.model_validate({**state, "status": state.get("status", "")})


@router.post("/runs", response_model=RunStateModel)
async def agentTeamPostRuns(request: Request, body: StartRunRequest) -> RunStateModel:
    """起一轮运行。**由运行控制面起**（不是直接调服务层）：控制面要在开跑前
    认领这轮运行，执行中的它才在取消范围内（1.5 任务 1）；本轮的截止时间也
    在同一处登记。
    """
    tenant_id = _tid(request)
    try:
        state = await get_run_control().start(
            tenant_id=tenant_id,
            goal=body.goal,
            user_token=_user_token(request),
            max_parallel=body.max_parallel,
            timeout_seconds=body.timeout_seconds,
        )
    except ValueError as exc:  # 拆不出 ≥2 个可并行子任务
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_model(state)


@router.get("/runs/{run_id}", response_model=RunStateModel)
async def agentTeamGetRun(request: Request, run_id: str) -> RunStateModel:
    try:
        state = await get_run_control().refresh(tenant_id=_tid(request), run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return _to_model(state)


@router.post("/runs/{run_id}/cancel", response_model=RunStateModel)
async def agentTeamPostRunCancel(request: Request, run_id: str) -> RunStateModel:
    """取消一轮运行，**落终态**（幂等）。

    取消后 ``approve`` 一律 409：闸门已经不在，确认一个已作废的计划不该有任何
    效果。跨租户与不存在同码 404（不泄露存在性）。
    """
    try:
        state = await get_run_control().cancel(tenant_id=_tid(request), run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return _to_model(state)


@router.get("/runs/{run_id}/events")
async def agentTeamGetRunEvents(request: Request, run_id: str) -> StreamingResponse:
    """步骤级事件流（SSE）：回放检查点里的推进，最后一条 ``end`` 收流。"""
    tenant_id = _tid(request)
    control = get_run_control()
    try:
        await control.refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return StreamingResponse(
        control.events(tenant_id=tenant_id, run_id=run_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/runs/{run_id}/audit", response_model=AuditListModel)
async def agentTeamGetRunAudit(request: Request, run_id: str) -> AuditListModel:
    """一轮运行的审计行（硬规则 #9）：派活 / 越权转 proposal / 审批。

    "落了吗"要能看见，否则等于没落。先按 run 的存在性判 404（跨租户同码），
    再只回**本租户**的行——审计行不能成为一条绕过 run 隔离的读路径。
    """
    tenant_id = _tid(request)
    try:
        await get_run_control().refresh(tenant_id=tenant_id, run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    rows = get_brain_service().audit.records(tenant_id=tenant_id, run_id=run_id)
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
        state = await get_run_control().resume(
            tenant_id=tenant_id,
            run_id=run_id,
            approved=body.approved,
            user_token=_user_token(request),
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
    "get_brain_service",
    "get_profile_registry",
    "get_profile_store",
    "get_run_control",
    "get_skill_catalog",
    "get_team_bus",
    "router",
    "set_brain_service",
    "set_profile_registry",
    "set_profile_store",
    "set_run_control",
    "set_skill_catalog",
    "set_team_bus",
]
