"""mate_tech_orchestrator.scheduler.plan_runner — plan orchestration + HITL.

Wraps the kernel ``SuperAIOrchestrator`` (plan state machine) with a
real step runner: each ``call_agent`` step is dispatched to the right
digital-employee role via the Dispatcher. HITL steps (decision B3:
≥1 per plan) pause execution and wait for review to resume.

MP-SAL-05（ADR-0045）action 编排与本体联动：
- PROPOSE / APPLY_ACTION 步 → tech-ont propose（action|create_instance|model_type）
  → HITL_WAITING（携带 proposal_id）；**review approve = proposal confirm +
  execute/apply（两套 HITL 合一）**，reject = proposal reject + abort。
- EVALUATE_OBJECTSET 步 → object-query IR；RUN_FUNCTION 步 → 内联 sandbox。
- 数据流：payload 值中的 ``{{steps.<sid>.<path>}}`` 从历史输出解析替换。
- 流程实例本体化（通道③）：submit/状态变化同步 process-instance 对象，
  使 ``query_process_instance`` 自动上工具面（AI/前端可查）。
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from mate_kernel.agent.orchestrator import (
    PlanSpec,
    PlanState,
    PlanStep,
    StepKind,
    StepResult,
    StepStatus,
    SuperAIOrchestrator,
)

from .dispatcher import Dispatcher, NoRoleForTaskError, get_dispatcher
from .ontology_client import OntologyActionClient, OntologyClientError


class PlanRunnerError(Exception):
    """Base error for the plan runner."""


class NoHitlStepError(PlanRunnerError):
    """Raised when a plan has no HITL step (decision B3)."""


class PlanNotFoundError(PlanRunnerError):
    """Raised when a plan_id is unknown."""


_STEP_REF = re.compile(r"\{\{steps\.([A-Za-z0-9_\-]+)\.([A-Za-z0-9_.\-]+)\}\}")


def _dig(obj: Any, path: str) -> Any:
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, (list, tuple)):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return cur


class PlanRunner:
    """Submit / execute / review multi-role plans over the dispatcher."""

    def __init__(
        self,
        orchestrator: SuperAIOrchestrator | None = None,
        dispatcher: Dispatcher | None = None,
        ontology_client: OntologyActionClient | None = None,
    ) -> None:
        self._orch = orchestrator or SuperAIOrchestrator()
        self._dispatcher = dispatcher or get_dispatcher()
        self._ont = ontology_client  # None → action 类步骤不可用（降级纯调度）

    def submit(
        self,
        *,
        author_user_id: str,
        steps: list[PlanStep],
    ) -> PlanSpec:
        """Build + submit a PlanSpec (validates ≥1 HITL per decision B3).

        MP-SAL-05：PROPOSE / APPLY_ACTION 步本身即 HITL 闸（执行后等待
        proposal 确认），计入 B3 满足条件。
        """
        hitl = any(
            s.requires_hitl or s.kind in (StepKind.PROPOSE, StepKind.APPLY_ACTION)
            for s in steps
        )
        if not hitl:
            raise NoHitlStepError(
                "plan must include at least one HITL step (decision B3; "
                "PROPOSE/APPLY_ACTION steps count)"
            )
        # PROPOSE/APPLY_ACTION 步本质是 proposal 闸——自动置 requires_hitl
        # 以满足 kernel PlanSpec 的 B3 硬校验（执行时按 proposal 流程挂起）。
        steps = [
            s if (s.requires_hitl or s.kind not in (StepKind.PROPOSE, StepKind.APPLY_ACTION))
            else PlanStep(
                step_id=s.step_id, kind=s.kind, target=s.target,
                payload=s.payload, requires_hitl=True,
            )
            for s in steps
        ]
        spec = PlanSpec(
            plan_id=uuid.uuid4().hex,
            author_user_id=author_user_id,
            steps=tuple(steps),
        )
        self._orch.submit(spec)
        return spec

    def get(self, plan_id: str) -> PlanState:
        try:
            return self._orch.get(plan_id)
        except KeyError as e:
            raise PlanNotFoundError(f"plan not found: {plan_id}") from e

    def _resolve_payload(self, state: PlanState, step: PlanStep) -> dict[str, Any]:
        """payload 中 {{steps.<sid>.<path>}} 从历史输出解析替换。"""
        out: dict[str, Any] = {}
        outputs = {
            h.step_id: (h.output if isinstance(h.output, dict) else {"value": h.output})
            for h in state.history
        }
        for k, v in dict(step.payload).items():

            def _sub(match: re.Match[str]) -> str:
                sid, path = match.group(1), match.group(2)
                val = _dig(outputs.get(sid), path)
                return "" if val is None else str(val)

            if isinstance(v, str):
                out[k] = _STEP_REF.sub(_sub, v)
            else:
                out[k] = v
        return out

    async def _sync_pi(
        self, tenant_id: str, token: str, plan_id: str, status: str,
        current_step: str = "", proposal_id: str = "",
    ) -> None:
        """流程实例本体化（best-effort，失败不阻断编排）。"""
        if self._ont is None:
            return
        try:
            await self._ont.upsert_process_instance(
                tenant_id, plan_id, status=status,
                current_step=current_step, proposal_id=proposal_id, token=token,
            )
        except OntologyClientError as e:
            import structlog
            structlog.get_logger(__name__).warning(
                "plan.pi_sync_failed", plan_id=plan_id, error=str(e),
            )

    async def execute(self, *, plan_id: str, tenant_id: str, token: str = "") -> dict[str, Any]:
        """Run the plan step-by-step, dispatching non-HITL steps to workers.

        Stops at the first HITL step (records HITL_WAITING); the caller
        resumes via ``review``.
        """
        state = self.get(plan_id)
        results: list[dict[str, Any]] = []
        await self._ensure_pi_type(tenant_id, token)
        while True:
            step = state.current_step
            if step is None:
                await self._sync_pi(tenant_id, token, plan_id,
                                    "aborted" if state.aborted else "completed")
                return {
                    "plan_id": plan_id,
                    "status": "completed" if not state.aborted else "aborted",
                    "current_step_id": None,
                    "results": results,
                }
            if step.requires_hitl and step.kind not in (StepKind.PROPOSE, StepKind.APPLY_ACTION):
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.HITL_WAITING),
                )
                await self._sync_pi(tenant_id, token, plan_id, "hitl_waiting", step.step_id)
                return {
                    "plan_id": plan_id,
                    "status": "hitl_waiting",
                    "current_step_id": step.step_id,
                    "results": results,
                }
            try:
                out = await self._dispatch_step(tenant_id, step, state, plan_id, token)
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.COMPLETED, output=out),
                )
                await self._sync_pi(tenant_id, token, plan_id, "running", step.step_id)
                results.append({"step_id": step.step_id, "status": "completed", "output": out})
            except _ProposeWaiting:
                # PROPOSE/APPLY_ACTION 已产 proposal 并记录 HITL_WAITING（携带
                # proposal_id）——返回挂起态，等 review。
                await self._sync_pi(tenant_id, token, plan_id, "hitl_waiting", step.step_id)
                return {
                    "plan_id": plan_id,
                    "status": "hitl_waiting",
                    "current_step_id": step.step_id,
                    "results": results,
                }
            except NoRoleForTaskError as e:
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.FAILED, error=str(e)),
                )
                await self._sync_pi(tenant_id, token, plan_id, "failed", step.step_id)
                return {
                    "plan_id": plan_id,
                    "status": "failed",
                    "current_step_id": step.step_id,
                    "error": str(e),
                    "results": results,
                }
        # pragma: no cover - unreachable
        return {"plan_id": plan_id, "status": "unknown", "results": results}

    async def _ensure_pi_type(self, tenant_id: str, token: str = "") -> None:
        if self._ont is None:
            return
        if getattr(self, "_pi_ensured_for", None) == tenant_id:
            return
        try:
            await self._ont.ensure_process_type(tenant_id, token)
            self._pi_ensured_for = tenant_id
        except OntologyClientError:
            pass  # best-effort：类型已存在或暂不可达都不阻断

    async def review(
        self,
        *,
        plan_id: str,
        step_id: str,
        approved: bool,
        feedback: str = "",
        tenant_id: str,
        token: str = "",
    ) -> dict[str, Any]:
        """Resolve a HITL step and resume the plan.

        MP-SAL-05 HITL 合一：挂起步携带 proposal_id 时——
        approve = proposal confirm + execute/apply（真实落库后继续）；
        reject = proposal reject + plan abort。
        """
        state = self.get(plan_id)
        waiting = next(
            (h for h in reversed(state.history)
             if h.step_id == step_id and h.status is StepStatus.HITL_WAITING),
            None,
        )
        proposal_id = ""
        if waiting is not None and isinstance(waiting.output, dict):
            proposal_id = str(waiting.output.get("proposal_id") or "")
        if not approved:
            if proposal_id and self._ont is not None:
                try:
                    await self._ont.reject(tenant_id, proposal_id, confirmed_by="reviewer", token=token)
                except OntologyClientError:
                    pass
            self._orch.abort(plan_id, feedback or "rejected by reviewer")
            await self._sync_pi(tenant_id, token, plan_id, "aborted", step_id, proposal_id)
            return {
                "plan_id": plan_id,
                "status": "aborted",
                "current_step_id": None,
                "results": [],
            }
        executed: dict[str, Any] = {"feedback": feedback}
        if proposal_id and self._ont is not None:
            executed = await self._resolve_proposal(
                tenant_id, proposal_id, waiting.output if waiting else {}, token,
            )
        self._orch.record(
            plan_id,
            StepResult(step_id=step_id, status=StepStatus.COMPLETED, output=executed),
        )
        return await self.execute(plan_id=plan_id, tenant_id=tenant_id, token=token)

    async def _resolve_proposal(
        self, tenant_id: str, proposal_id: str,
        waiting_output: dict[str, Any], token: str = "",
    ) -> dict[str, Any]:
        """HITL 合一核心：confirm + execute/apply。"""
        assert self._ont is not None
        await self._ont.confirm(tenant_id, proposal_id, confirmed_by="reviewer", token=token)
        kind = str(waiting_output.get("action_kind") or "action")
        target = str(waiting_output.get("target") or "")
        if kind == "create_instance":
            out = await self._ont.execute_proposal(tenant_id, proposal_id, token=token)
            return {"proposal_id": proposal_id, "confirmed": True, "executed": out}
        if kind == "model_type":
            out = await self._ont.execute_proposal(tenant_id, proposal_id, token=token)
            return {"proposal_id": proposal_id, "confirmed": True, "executed": out}
        out = await self._ont.apply(
            tenant_id, target,
            parameters=dict(waiting_output.get("parameters") or {}),
            target_iid=str(waiting_output.get("target_iid") or ""),
            proposal_id=proposal_id, token=token,
        )
        return {"proposal_id": proposal_id, "confirmed": True, "applied": out}

    async def _dispatch_step(
        self, tenant_id: str, step: PlanStep, state: PlanState,
        plan_id: str, token: str = "",
    ) -> Any:
        payload = self._resolve_payload(state, step)
        if step.kind is StepKind.CALL_AGENT:
            payload.pop("action", "")
            # Resolve the dispatcher at call time so DI (set_dispatcher) and the
            # module singleton stay consistent across tests / restart.
            return await get_dispatcher().dispatch(
                tenant_id=tenant_id,
                target_rid=step.target,
                action="",
                arguments=payload,
            )
        if step.kind in (StepKind.PROPOSE, StepKind.APPLY_ACTION):
            # ADR-0045：APPLY_ACTION ≡ PROPOSE 同管线（枚举名为编排可读性）
            if self._ont is None:
                raise NoRoleForTaskError(
                    "ontology client not configured; PROPOSE/APPLY_ACTION unavailable"
                )
            action_kind = str(payload.get("action_kind") or "action")
            if action_kind == "create_instance":
                prop = await self._ont.propose_instance(
                    tenant_id, step.target,
                    props=dict(payload.get("props") or {}),
                    impact_summary=str(payload.get("impact_summary", "")), token=token,
                )
            else:
                prop = await self._ont.propose_action(
                    tenant_id, step.target,
                    parameters=dict(payload.get("parameters") or {}),
                    target_iid=str(payload.get("target_iid") or ""),
                    impact_summary=str(payload.get("impact_summary", "")),
                    expected_diff=dict(payload.get("expected_diff") or {}), token=token,
                )
            # 产出 proposal → 本步转为 HITL 挂起（record HITL_WAITING 由外层处理：
            # 直接抛专用信号让 execute 循环按 requires_hitl 分支记录）
            self._mark_propose_hitl(plan_id, step, prop, action_kind, payload)
            raise _ProposeWaiting()
        if step.kind is StepKind.EVALUATE_OBJECTSET:
            if self._ont is None:
                raise NoRoleForTaskError("ontology client not configured")
            return await self._ont.object_query(
                tenant_id, {"source": step.target, **payload}, token=token,
            )
        if step.kind is StepKind.RUN_FUNCTION:
            from mate_kernel.sandbox.k8s import SubprocessExecutor

            executor = SubprocessExecutor(
                timeout_seconds=int(payload.get("timeout_seconds", 30)),
            )
            rc, stdout, stderr = executor.execute(
                str(payload.get("source", "")),
                tuple(payload.get("args") or ()),
            )
            return {"exit_code": rc, "stdout": stdout, "stderr": stderr}
        raise NoRoleForTaskError(
            f"step kind {step.kind.value!r} not runnable by the dispatcher yet"
        )

    def _mark_propose_hitl(
        self, plan_id: str, step: PlanStep, prop: dict[str, Any],
        action_kind: str, resolved_payload: dict[str, Any],
    ) -> None:
        """PROPOSE/APPLY_ACTION 步执行结果记录为 HITL_WAITING（携带 proposal）。

        存**已解析** payload（{{steps.*}} 已替换）——approve 时直接用于
        confirm+apply，不再重放模板。
        """
        state = self._orch.get(plan_id)
        state.current_step_idx = state.current_step_idx  # 不推进：等待 review
        self._orch.record(plan_id, StepResult(
            step_id=step.step_id,
            status=StepStatus.HITL_WAITING,
            output={
                "proposal_id": prop.get("proposal_id", ""),
                "action_kind": action_kind,
                "target": step.target,
                "parameters": dict(resolved_payload.get("parameters") or {}),
                "target_iid": str(resolved_payload.get("target_iid") or ""),
                "impact_summary": prop.get("impact_summary", ""),
                "expected_diff": prop.get("expected_diff", {}),
            },
        ))


class _ProposeWaiting(Exception):
    """内部信号：PROPOSE 步已产 proposal 并记录 HITL_WAITING，本步不推进。"""


_default_runner: PlanRunner | None = None


def get_plan_runner() -> PlanRunner:
    global _default_runner
    if _default_runner is None:
        _default_runner = PlanRunner()
    return _default_runner


def set_plan_runner(runner: PlanRunner | None) -> None:
    global _default_runner
    _default_runner = runner
