"""真实的任务拆解：走 LLM 网关，而不是写死的模板。

产出约束（防止"拆出来的任务"退化成一句话复制 N 份）：

* 每个子任务必须有**不同的 profile_id**——同一句话派给同一个员工 N 次没有意义；
* 每个子任务的 instruction 必须是**给该员工的、可独立执行的指令**，
  不是原目标的分词切片；
* 解析不出来 / 少于 2 个 → 抛 :class:`PlanError`，由图上抛为本次运行失败，
  **不静默回落到模板**（回落会把"模型没按格式答"伪装成"拆解成功"）。

1.8 轨 3 起还负责**再规划**（:meth:`LlmPlanner.replan`）：一波跑完之后，把已经
产出的回执摘要喂回去，问"还差不差活"。这里的约束与首轮不同，刻意不同：

* **允许只补 1 件**——"再派一个人对齐口径"本来就是一件，凑两份是硬凑；
* **允许带依赖**——补出来的件常常要吃前面那几件的产出，这正是重规划相对于
  "重新起一轮"的价值所在；
* **"够了"是合法答案**（``{"subtasks": []}``）——不是解析失败。把收工判成失败
  会让每一轮都硬补一批活。
"""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable

from .employee import LlmFactory, aclose_quietly
from .planner import PlanError
from .profiles import DEFAULT_MODEL, EmployeeProfile
from .state import SubTask, SubTaskResult

#: 按租户现取名册（1.1 任务 3：名册是租户相关的）。
RosterProvider = Callable[[str], Awaitable[list[EmployeeProfile]]]

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)

#: 计划内标签的形状（``t1``/``t2``…）。重规划靠它给新件编号。
_TASK_LABEL = re.compile(r"^t(\d+)$")

#: 回执摘要里每份产出最多回灌多少字符。重规划要的是"结论与遗留问题"，
#: 不是全文——把整份产出塞回去，上下文会随轮次线性膨胀。
_RESULT_DIGEST_CHARS = 800

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

_REPLAN_SYSTEM = """你是任务调度大脑。**第一轮的子任务已经跑完了**，现在判断还差不差活。

规则：
- 只有在"还差一件必须做的、且现在才判断得出来的工作"时才补活——**不差就别补**；
- **不差活就回空数组**：{{"subtasks": []}}。这是最正常的一种回答，不是失败；
- 补出来的子任务可以**依赖已经存在的任务标签**（见下面的"已有任务"），
  表示"要等它先出结果"；依赖只能指向已有标签或本次新补的标签；
- 新补的子任务的 instruction 要写成**给那个员工看的、可独立执行的指令**，
  并把需要用到的上游结论直接写进去（那个员工看不到别人在干什么）；
- 不要重复已经做过的工作，也不要给同一个员工派两件同样的活；
- 只输出 JSON，不要解释，不要 markdown 代码块。

输出格式：
{{"subtasks": [{{"profile_id": "EMP-XXX", "instruction": "……", "depends_on": ["t1"]}}]}}

可用员工名册：
{roster}

已有任务（标签（员工）：状态 —— 产出摘要）：
{progress}
"""


def _digest(text: object, limit: int = _RESULT_DIGEST_CHARS) -> str:
    """把一份产出压成一行摘要（超长截断，换行拍平）。"""
    flat = " ".join(str(text or "").split())
    return flat if len(flat) <= limit else flat[:limit] + "…"


def _next_label_index(known: set[str]) -> int:
    """给新件编号的起点：``t`` 编号里最大的那个 + 1（没有就从 1 开始）。

    刻意**不**用"已有件数 + 1"：轮次之间可能有件没被派出去（取消 / 硬拒），
    数量与编号会错位，撞号就会把前面那件的回执悄悄覆盖掉。
    """
    numbers = [int(m.group(1)) for label in known if (m := _TASK_LABEL.match(label))]
    return max(numbers, default=0) + 1


class LlmPlanner:
    """把一句话拆成并行子任务图；跑完一波之后再决定要不要补活。"""

    def __init__(
        self,
        *,
        llm_factory: LlmFactory,
        roster: list[EmployeeProfile],
        model: str = DEFAULT_MODEL,
        temperature: float = 0.0,
        roster_provider: RosterProvider | None = None,
    ) -> None:
        self._llm_factory = llm_factory
        self._roster = roster
        self._roster_provider = roster_provider
        self._model = model
        self._temperature = temperature

    async def _resolve_roster(self, tenant_id: str) -> list[EmployeeProfile]:
        """本租户的名册：接了 provider 就现取（含本租户落库的员工）。

        1.1 任务 3 起名册是租户相关的（内置 + 该租户在 PG 里的行），所以拆解时
        要按**当前租户**取，而不是构造时快照。
        """
        if self._roster_provider is None:
            return self._roster
        return await self._roster_provider(tenant_id)

    @staticmethod
    def _roster_text(roster: list[EmployeeProfile]) -> str:
        return "\n".join(
            f"- {p.profile_id}（{p.name}）：{p.system_prompt.splitlines()[0][:60]}" for p in roster
        )

    async def _ask(self, *, tenant_id: str, system: str, user: str) -> str:
        """把一次拆解请求打出去，返回模型的原始回复文本。"""
        llm = self._llm_factory(tenant_id)
        try:
            reply = await llm.chat_with_tools(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                model=self._model,
                tools=None,
                temperature=self._temperature,
            )
        finally:
            await aclose_quietly(llm)
        return str(reply.get("content") or "")

    @staticmethod
    def _load_items(raw: str) -> list[dict]:
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
        return [item for item in raw_items if isinstance(item, dict)]

    def _parse(self, raw: str, allowed_ids: set[str], max_parallel: int) -> list[SubTask]:
        subtasks: list[SubTask] = []
        seen: set[str] = set()
        for item in self._load_items(raw):
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
        roster = await self._resolve_roster(tenant_id)
        raw = await self._ask(
            tenant_id=tenant_id,
            system=_SYSTEM.format(max_parallel=max_parallel, roster=self._roster_text(roster)),
            user=goal,
        )
        return self._parse(raw, {p.profile_id for p in roster}, max_parallel)

    # -- 再规划（1.8 轨 3）-------------------------------------------------
    def _parse_extra(
        self,
        raw: str,
        *,
        allowed_ids: set[str],
        known_labels: set[str],
        max_parallel: int,
    ) -> list[SubTask]:
        """解析"再补一批"。与首轮解析的区别见模块 docstring（允许 1 件、允许依赖）。

        依赖校验放在这里而不是留给图：模型给的标签是**不可信输入**，指错了要么
        让节点永远等不到、要么成环让整波卡死。这里判失败，错误信息里带上那个标签。
        """
        items = self._load_items(raw)
        if not items:
            return []  # 模型说够了

        label = _next_label_index(known_labels)
        extra: list[SubTask] = []
        assigned: set[str] = set()
        for item in items:
            profile_id = str(item.get("profile_id") or "")
            instruction = str(item.get("instruction") or "").strip()
            if profile_id not in allowed_ids or not instruction:
                continue
            depends_on = [str(d) for d in (item.get("depends_on") or []) if str(d)]
            unknown = [d for d in depends_on if d not in known_labels and d not in assigned]
            if unknown:
                raise PlanError(f"重规划给出的依赖指向不存在的节点：{'、'.join(sorted(unknown))}")
            task_id = f"t{label}"
            label += 1
            assigned.add(task_id)
            extra.append(
                SubTask(
                    task_id=task_id,
                    profile_id=profile_id,
                    instruction=instruction,
                    depends_on=depends_on,
                )
            )
            if len(extra) >= max_parallel:
                break
        if not extra and items:
            # 有活但一件都用不上（员工不存在 / 指令空）——这是模型没按名册来。
            raise PlanError("重规划给出的子任务一件都用不上（员工不在名册 / 指令为空）")
        return extra

    @staticmethod
    def _progress_text(results: dict[str, SubTaskResult]) -> str:
        lines = []
        for task_id in sorted(results):
            row = results.get(task_id) or {}
            status = str(row.get("status") or "?")
            profile_id = str(row.get("profile_id") or "?")
            body = row.get("output") if status == "ok" else row.get("error")
            lines.append(f"- {task_id}（{profile_id}）：{status} —— {_digest(body)}")
        return "\n".join(lines) if lines else "（还没有任何回执）"

    async def replan(
        self,
        *,
        goal: str,
        results: dict[str, SubTaskResult],
        round_index: int,
        max_parallel: int,
        tenant_id: str,
    ) -> list[SubTask]:
        roster = await self._resolve_roster(tenant_id)
        known = set(results)
        raw = await self._ask(
            tenant_id=tenant_id,
            system=_REPLAN_SYSTEM.format(
                roster=self._roster_text(roster), progress=self._progress_text(results)
            ),
            user=f"（第 {round_index} 轮已跑完）目标：{goal}",
        )
        return self._parse_extra(
            raw,
            allowed_ids={p.profile_id for p in roster},
            known_labels=known,
            max_parallel=max_parallel,
        )


__all__ = ["LlmPlanner", "RosterProvider"]
