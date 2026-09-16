"""真实的任务拆解：走 LLM 网关，而不是写死的模板。

产出约束（防止"拆出来的任务"退化成一句话复制 N 份）：

* 每个子任务必须有**不同的 profile_id**——同一句话派给同一个员工 N 次没有意义；
* 每个子任务的 instruction 必须是**给该员工的、可独立执行的指令**，
  不是原目标的分词切片；
* 解析不出来 / 少于 2 个 → 抛 :class:`PlanError`，由图上抛为本次运行失败，
  **不静默回落到模板**（回落会把"模型没按格式答"伪装成"拆解成功"）。
"""

from __future__ import annotations

import json
import re

from .employee import LlmFactory, aclose_quietly
from .planner import PlanError
from .profiles import DEFAULT_MODEL, EmployeeProfile
from .state import SubTask

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)

_SYSTEM = """你是任务调度大脑。把用户的一句话目标拆成 2–{max_parallel} 个**可以并行**执行的子任务。

规则：
- 每个子任务派给一个不同的数字员工（下面的员工名册里选）；
- 子任务的 instruction 要写成**给那个员工看的、可独立执行的指令**，
  让它不需要看别人在干什么就能干活；
- 子任务之间不允许有依赖（本批是并行执行的）；
- 只输出 JSON，不要解释，不要 markdown 代码块。

输出格式：
{{"subtasks": [{{"profile_id": "EMP-XXX", "instruction": "……"}}]}}

可用员工名册：
{roster}
"""


class LlmPlanner:
    """把一句话拆成并行子任务图。"""

    def __init__(
        self,
        *,
        llm_factory: LlmFactory,
        roster: list[EmployeeProfile],
        model: str = DEFAULT_MODEL,
        temperature: float = 0.0,
    ) -> None:
        self._llm_factory = llm_factory
        self._roster = roster
        self._model = model
        self._temperature = temperature

    def _roster_text(self) -> str:
        return "\n".join(
            f"- {p.profile_id}（{p.name}）：{p.system_prompt.splitlines()[0][:60]}"
            for p in self._roster
        )

    def _parse(self, raw: str, allowed_ids: set[str], max_parallel: int) -> list[SubTask]:
        match = _JSON_BLOCK.search(raw or "")
        if match is None:
            raise PlanError(f"拆解结果不是 JSON：{raw[:200]!r}")
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise PlanError(f"拆解结果 JSON 解析失败：{exc}") from exc

        raw_items = payload.get("subtasks") if isinstance(payload, dict) else None
        if not isinstance(raw_items, list):
            raise PlanError("拆解结果缺少 subtasks 数组")

        subtasks: list[SubTask] = []
        seen: set[str] = set()
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            profile_id = str(item.get("profile_id") or "")
            instruction = str(item.get("instruction") or "").strip()
            if profile_id not in allowed_ids or not instruction:
                continue
            if profile_id in seen:
                continue  # 同一员工只派一件：否则"并行"只是重复劳动
            seen.add(profile_id)
            subtasks.append(
                SubTask(
                    task_id=f"t{len(subtasks) + 1}",
                    profile_id=profile_id,
                    instruction=instruction,
                    depends_on=[],
                )
            )
            if len(subtasks) >= max_parallel:
                break

        if len(subtasks) < 2:
            raise PlanError(f"模型只拆出 {len(subtasks)} 个可用子任务（需要 ≥2）")
        return subtasks

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        messages = [
            {
                "role": "system",
                "content": _SYSTEM.format(max_parallel=max_parallel, roster=self._roster_text()),
            },
            {"role": "user", "content": goal},
        ]
        llm = self._llm_factory(tenant_id)
        try:
            reply = await llm.chat_with_tools(
                messages=messages,
                model=self._model,
                tools=None,
                temperature=self._temperature,
            )
        finally:
            await aclose_quietly(llm)
        return self._parse(
            str(reply.get("content") or ""),
            {p.profile_id for p in self._roster},
            max_parallel,
        )


__all__ = ["LlmPlanner"]
