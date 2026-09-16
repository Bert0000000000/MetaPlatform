"""agent-team HTTP surface（contracts/openapi/services/agent-team.yaml）。

  - POST /api/v1/agent-team/runs                      — 一句话启动
  - GET  /api/v1/agent-team/runs/{run_id}             — 任务图/员工状态/结果
  - POST /api/v1/agent-team/runs/{run_id}/approve     — 人工确认闸门

每个 handler 先过 ``require_tenant``（硬规则 #3）再碰服务层；服务层再把它落到
thread_id 前缀与连接的 ``app.tenant_id`` 上，由 RLS 强制。
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from mate_platform.tenancy.guards import require_tenant

from ..brain import AWAITING, BrainService, RunNotAwaitingApproval, RunNotFound
from ..profiles import ProfileRegistry
from ..state import BrainState
from .schemas import (
    ApproveRequest,
    EmployeeProfileModel,
    ProfileListModel,
    RunStateModel,
    StartRunRequest,
)

router = APIRouter(prefix="/api/v1/agent-team", tags=["agent-team"])

_service: BrainService | None = None
_registry: ProfileRegistry | None = None


def set_brain_service(service: BrainService | None) -> None:
    """装配/重置服务层（测试 DI 缝）。"""
    global _service
    _service = service


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
    tenant_id = _tid(request)
    try:
        state = await get_brain_service().start(
            tenant_id=tenant_id,
            goal=body.goal,
            user_token=_user_token(request),
            max_parallel=body.max_parallel,
        )
    except ValueError as exc:  # 拆不出 ≥2 个可并行子任务
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_model(state)


@router.get("/runs/{run_id}", response_model=RunStateModel)
async def agentTeamGetRun(request: Request, run_id: str) -> RunStateModel:
    try:
        state = await get_brain_service().get(tenant_id=_tid(request), run_id=run_id)
    except RunNotFound as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    return _to_model(state)


@router.post("/runs/{run_id}/approve", response_model=RunStateModel)
async def agentTeamPostRunApprove(
    request: Request, run_id: str, body: ApproveRequest
) -> RunStateModel:
    tenant_id = _tid(request)
    try:
        state = await get_brain_service().resume(
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


@router.get("/profiles", response_model=ProfileListModel)
async def agentTeamGetProfiles(request: Request) -> ProfileListModel:
    """列数字员工（身份 = 提示词 + 技能清单 + 工具白名单）。"""
    require_tenant(request.state.ctx)  # 硬规则 #3：先过租户守门再碰数据
    return ProfileListModel(
        profiles=[
            EmployeeProfileModel(
                profile_id=p.profile_id,
                name=p.name,
                base_role=p.base_role,
                system_prompt=p.system_prompt,
                skills=list(p.skills),
                tools=list(p.tools),
            )
            for p in get_profile_registry().list()
        ]
    )


__all__ = [
    "AWAITING",
    "get_brain_service",
    "get_profile_registry",
    "router",
    "set_brain_service",
    "set_profile_registry",
]
