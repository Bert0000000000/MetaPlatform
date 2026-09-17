"""数字员工运行时（治 D-10「派活返回假回执」）。

**"真实执行"的含义**：一个员工被派活后，必须

1. 真的把它的**提示词**发出去（不是把原话抄回去）；
2. 真的调 **LLM 网关**做一轮函数调用决策；
3. 真的把工具调用打到 **MCP 中心**并拿回结果（白名单外的被拒且不落网）；
4. 把模型的**产出**作为 ``output`` 返回，而不是 ``instruction`` 的副本。

回执里的 ``source`` 与 ``llm_calls`` 就是这条链的凭据：调用方据此断言"真跑了"。
``output == instruction`` 的实现会被测试直接判红。

**1.2 起循环交给 ``create_agent``**（GOAL 任务 1）：1.0/1.1 这里是手写的
"调模型 → 调工具 → 回灌"循环。手写循环自己能跑，但**上下文管理是空白**——
消息只涨不缩，工具结果只做一次性裁剪。迁到 ``create_agent`` 之后白拿它的
中间件：``summarization``（超阈值把历史压成摘要）与 ``context_editing``
（清掉陈旧的工具结果）。

**迁进去、但不许漏出来**（ADR-0066 R10）：LangChain 只出现在本模块与
:mod:`.chat_model` / :mod:`.toolbox` 的实现里；``EmployeeRuntime`` 协议、
``SubTaskResult`` 与 ``TeamBus`` 公开契约保持 runtime 中立——将来接
``RuntimeKind.CODEX`` / ``DSH`` 的子 agent 时，上层语义不用改。

**客户端按租户构造**（工厂注入）：llmgw 与 MCP 中心都按 ``X-Tenant-Id``
取租户配置，共享单例会跨租户串味，所以每次运行现开现关。
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Sequence
from contextlib import suppress
from typing import Any, Protocol

from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ContextEditingMiddleware,
    SummarizationMiddleware,
)
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.tools import StructuredTool
from langgraph.errors import GraphRecursionError

from .authority import Envelope
from .chat_model import LlmgwChatModel, RunTrace
from .envelope_gate import EnvelopeGate
from .evidence import as_mapping, evidence_items, utc_now
from .profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry
from .runtime import TaskChannel, TransientRunError
from .skills import SkillCatalog
from .state import SubTask, SubTaskResult
from .tool_ledger import ToolCallAdmission, ToolLedger, call_id, new_lease_owner
from .toolbox import Toolbox, ToolNotAllowed

#: 一条工具结果最多回灌多少字符——上下文裁剪（ADR-0066 §5.4）的最小形态。
#: 取 8000 而非更小：本体的对象类型清单有 47 条、压到 rid+名称仍有 ~4400 字符，
#: 上限太小会把清单一刀切掉，模型只看得到前几个类型（实测因此挑错了订单类）。
#: 8000 与技能清单预算同口径（上下文 2%）。
TOOL_RESULT_CHARS = 8000

#: 摘要触发的默认口径：上下文累积到约 10 万 token 时压缩，保留最近 20 条消息。
#: 用**绝对 token 数**而非比例——比例要模型自带 ``profile.max_input_tokens``，
#: 而 llmgw 是自研网关、不提供该元数据；写死一个保守阈值比依赖不存在的元数据可靠。
DEFAULT_SUMMARY_TRIGGER: tuple[str, Any] = ("tokens", 100_000)
DEFAULT_SUMMARY_KEEP: tuple[str, Any] = ("messages", 20)


class LlmGateway(Protocol):
    """对 LLM 网关的最小依赖面（生产是 :class:`mate_clients.llmgw.LlmgwClient`）。"""

    async def chat_with_tools(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> dict[str, Any]: ...


LlmFactory = Callable[[str], LlmGateway]
ToolboxFactory = Callable[[str], Toolbox]


async def aclose_quietly(client: object) -> None:
    """关掉带 ``aclose`` 的客户端；没有就跳过。"""
    close = getattr(client, "aclose", None)
    if close is not None:
        await close()


def _clip(value: Any, limit: int = TOOL_RESULT_CHARS) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    if len(text) <= limit:
        return text
    return text[:limit] + f"…（已截断，原长 {len(text)} 字符）"


class _RejectedCalls:
    """从运行结束后的消息序列里补记"模型要了但没绑上"的工具调用。

    模型只看得见绑上去的工具，但它照样可能凭记忆点名一个它"知道"的工具
    （prompt injection / 幻觉的常见形态）。1.0 在派发处拒绝并记下原因；
    迁移后那些名字根本不在工具表里，所以改由**回执侧**对照名单补记——
    ``tool_calls`` 的语义与 1.0 保持一致。

    **为什么不做成中间件**：实测 ``SummarizationMiddleware`` 与本仓的自定义
    ``after_model`` 钩子同时挂上时，langgraph 的模型后路由会在两者之间空转，
    一路撞到 recursion_limit（langchain 1.3.14）。读状态补记没有这个耦合。
    """

    def __init__(self, *, known: set[str], reason_for: Callable[[str], str]) -> None:
        self._known = known
        self._reason_for = reason_for

    def collect(self, messages: Sequence[BaseMessage]) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        for message in messages:
            if not isinstance(message, AIMessage):
                continue
            for call in message.tool_calls or []:
                name = str(call.get("name") or "")
                if name and name not in self._known:
                    entries.append(
                        {
                            "name": name,
                            "arguments": call.get("args") or {},
                            "allowed": False,
                            "rejected": self._reason_for(name),
                        }
                    )
        return entries


class InboxMiddleware(AgentMiddleware):
    """在**每一轮模型调用的边界**把外部投递的消息并入会话，消费即清空。

    ADR-0066 §5.5 的 runtime 中立表述："下一轮迭代边界"就是这里——每次
    模型调用之前。取一次就清空（drain 语义），所以同一批消息只回灌一轮，
    不会每轮重复出现。

    **为什么不塞进 AgentMiddleware 之外的地方**：``send`` 与消费是两件事，
    投递方不做唤醒（任务终态后投递直接 409），消费方自己来取——两者解耦，
    子 agent 回问父级也只是换一个 task_id 走同一条通道。
    """

    def __init__(self, *, drain: Callable[[], Awaitable[list[Any]]]) -> None:
        super().__init__()
        self._drain = drain
        self.consumed: list[str] = []

    async def abefore_model(self, state: Any, runtime: Any = None) -> dict[str, Any] | None:
        pending = await self._drain()
        if not pending:
            return None
        texts = [_render_inbox_message(m) for m in pending]
        self.consumed.extend(texts)
        return {"messages": [HumanMessage(content=text) for text in texts]}


def _render_inbox_message(message: Any) -> str:
    """把一条 inbox 消息渲染成给模型看的一行（不带框架/存储类型进契约）。"""
    if isinstance(message, str):
        return message
    sender = str(getattr(message, "sender", "") or "user")
    text = str(getattr(message, "text", "") or message)
    return f"【来自 {sender} 的补充消息】{text}"


class _EvidenceCollector:
    """把工具结果**忠实映射**成证据条目（1.6 任务 1）。

    编号（``evidenceId``）在**捕获时**定死，不在事件流读取时现算：证据随回执落进
    检查点，而事件流与 ``GET /runs/{id}`` 读的是同一份——编号若在读取时重算，
    两次读之间就可能对不上号，前端按 id 去重/追加会错乱。

    取不到字段就不产出条目（:func:`~mate_tech_agent_team.evidence.evidence_items`
    的既有原则），所以"工具成功了但没证据"是**正常结果**，不是异常。
    """

    def __init__(self, prefix: str) -> None:
        self._prefix = prefix
        self.items: list[dict[str, Any]] = []

    def capture(self, name: str, result: Any) -> None:
        items = evidence_items(name, as_mapping(result))
        if not items:
            return
        captured_at = utc_now()
        for item in items:
            item["evidenceId"] = f"{self._prefix}-e{len(self.items)}"
            item["capturedAt"] = captured_at
            self.items.append(item)


def _channel_drainer(
    channel: TaskChannel, tenant_id: str, task_id: str
) -> Callable[[], Awaitable[list[Any]]]:
    async def _drain() -> list[Any]:
        return list(await channel.consume_inbox(task_id=task_id, tenant_id=tenant_id))

    return _drain


def _final_text(messages: Sequence[BaseMessage]) -> str:
    """最后一条 AI 消息的文本（没有 AI 消息就是空串）。"""
    for message in reversed(list(messages)):
        if isinstance(message, AIMessage):
            return str(message.content or "")
    return ""


def _wants_tools(messages: Sequence[BaseMessage]) -> bool:
    for message in reversed(list(messages)):
        if isinstance(message, AIMessage):
            return bool(message.tool_calls)
    return False


class LlmEmployeeRuntime:
    """把一份子任务真的跑完的员工运行时（执行循环由 ``create_agent`` 驱动）。"""

    def __init__(
        self,
        *,
        registry: ProfileRegistry,
        llm_factory: LlmFactory,
        toolbox_factory: ToolboxFactory,
        skills: SkillCatalog | None = None,
        max_tool_rounds: int = 3,
        temperature: float = 0.7,
        summarization_trigger: tuple[str, Any] | None = DEFAULT_SUMMARY_TRIGGER,
        summarization_keep: tuple[str, Any] = DEFAULT_SUMMARY_KEEP,
        summary_prompt: str | None = None,
        context_editing: bool = True,
        channel: TaskChannel | None = None,
        tool_ledger: ToolLedger | None = None,
    ) -> None:
        self._registry = registry
        self._llm_factory = llm_factory
        self._toolbox_factory = toolbox_factory
        self._skills = skills
        self._max_tool_rounds = max_tool_rounds
        self._temperature = temperature
        self._summarization_trigger = summarization_trigger
        self._summarization_keep = summarization_keep
        self._summary_prompt = summary_prompt
        self._context_editing = context_editing
        #: 实例层通道（建行 / 取信箱 / 收尾）；给了就能被 ``send`` 追问到。
        self._channel = channel
        #: 工具调用级幂等账本（A-3 / ADR 见 :mod:`.tool_ledger`）。**默认不记账**——
        #: 没接的部署行为与 A-3 之前逐字一致；生产由 ``wiring`` 接 PG 账本。
        self._tool_ledger = tool_ledger
        self._lease_owner = new_lease_owner()

    async def _admit(
        self,
        *,
        name: str,
        arguments: dict[str, Any],
        tenant_id: str,
        run_id: str,
        task_id: str,
    ) -> ToolCallAdmission | None:
        """向账本要一次准入。没接账本 / 缺 run 上下文（老调用方）→ 不记账。"""
        if self._tool_ledger is None or not (tenant_id and run_id and task_id):
            return None
        return await self._tool_ledger.begin(
            tenant_id=tenant_id,
            run_id=run_id,
            task_id=task_id,
            tool_call_id=call_id(name, arguments),
            tool_name=name,
            arguments=arguments,
            owner=self._lease_owner,
        )

    async def _settle(
        self, admission: ToolCallAdmission | None, *, result: Any, error: str
    ) -> None:
        """落回执。**尽力而为**，且失败的方向是安全的：

        写不进去 → 那一行留在 ``running`` → 恢复时**不会**重跑（上限仍是 1）。
        反过来（写失败却当成没发生）才会导致重复副作用，那种做法这里没有。
        """
        if admission is None or admission.invocation is None or self._tool_ledger is None:
            return
        invocation = admission.invocation
        try:
            if error:
                await self._tool_ledger.fail(
                    tenant_id=invocation.tenant_id, invocation=invocation, error=error
                )
            else:
                await self._tool_ledger.complete(
                    tenant_id=invocation.tenant_id, invocation=invocation, result=result
                )
        except Exception:
            return

    def _system_prompt(self, profile: EmployeeProfile) -> str:
        """身份提示词 + **技能清单**（只出名字与一句话描述，不出正文）。"""
        parts = [profile.system_prompt.strip()]
        if "ont_" in " ".join(profile.tools):
            parts.append(
                "【本体使用规则】涉及本体对象时，rid 必须来自 ont_list_classes 的返回："
                "先列清单、从中挑选，**禁止凭业务名词自己拼造 rid**（拼出来的必 404）。"
                "清单里没有你要的类型，就如实说没有，不要换一个名字再试。"
            )
        if self._skills is not None and profile.skills:
            manifest = self._skills.render(profile.skills)
            if manifest:
                parts.append(
                    "你可以使用以下技能。清单里只有名字与一句话说明；"
                    "需要具体做法时先调用 read_skill 取全文，不要凭名字臆测。\n" + manifest
                )
        return "\n\n".join(parts)

    def _gated_tool(
        self,
        descriptor: dict[str, Any],
        *,
        allowed: tuple[str, ...],
        toolbox: Toolbox,
        log: list[dict[str, Any]],
        evidence: _EvidenceCollector,
        tenant_id: str = "",
        run_id: str = "",
        task_id: str = "",
    ) -> StructuredTool:
        """把一个工具描述符包成 LangChain 工具，闸门仍在**派发处**。

        A-3 起，这一步还是**幂等账本**的落点：执行前先落一条 ``running`` 意图，
        执行后落回执。于是"工具已经执行了、回执还没落"那个窗口里死掉的进程，
        恢复后**不会**把这一次工具调用再执行一遍（:mod:`.tool_ledger`）。
        """
        name = descriptor["name"]

        async def _call(**arguments: Any) -> str:
            entry: dict[str, Any] = {"name": name, "arguments": arguments}
            admission = await self._admit(
                name=name,
                arguments=arguments,
                tenant_id=tenant_id,
                run_id=run_id,
                task_id=task_id,
            )
            if admission is not None and not admission.execute:
                # **不执行**：要么回放已记下的结果，要么这一次已经开过头（in_flight）。
                entry["allowed"] = True
                entry["deduplicated"] = admission.reason
                entry["invocation_id"] = (
                    admission.invocation.invocation_id if admission.invocation else ""
                )
                log.append(entry)
                if admission.reason == "already_completed":
                    evidence.capture(name, admission.reuse)
                    return _clip(admission.reuse)
                return json.dumps(
                    {
                        "error": f"tool '{name}' not re-executed: {admission.reason}",
                        "hint": "这一次调用此前已经开始过，幂等账本不允许重复执行",
                    },
                    ensure_ascii=False,
                )
            try:
                result = await toolbox.invoke(name=name, arguments=arguments, allowed=allowed)
            except ToolNotAllowed as exc:
                # 闸门拒绝：记下来，并且**没有**真的打到后端
                entry["allowed"] = False
                entry["rejected"] = exc.reason
                log.append(entry)
                await self._settle(admission, result=None, error=f"rejected:{exc.reason}")
                return json.dumps(
                    {"error": f"tool '{name}' rejected: {exc.reason}"}, ensure_ascii=False
                )
            except Exception as exc:
                # 工具**执行**失败（多为参数不合后端 schema）——把错误原文回灌给模型，
                # 让它自己改参数重试，而不是把一次手滑升级成整轮失败。
                entry["allowed"] = True
                entry["error"] = f"{type(exc).__name__}: {exc}"
                log.append(entry)
                # 失败 = 这次没落地：账本记 failed，允许下一次重来。
                await self._settle(admission, result=None, error=f"{type(exc).__name__}: {exc}")
                return _clip({"error": f"tool '{name}' failed: {exc}", "hint": "修正参数后重试"})
            entry["allowed"] = True
            log.append(entry)
            await self._settle(admission, result=result, error="")
            # 只有**成功**的工具结果才映射成证据：失败/被拒的结果里没有可取证的事实，
            # 对它取证就是编造。
            evidence.capture(name, result)
            return _clip(result)

        return StructuredTool(
            name=name,
            description=descriptor.get("description", ""),
            args_schema=descriptor.get("inputSchema") or {"type": "object", "properties": {}},
            coroutine=_call,
        )

    def _middleware(self, *, chat: LlmgwChatModel) -> list[Any]:
        """白拿的中间件：摘要 / 上下文编辑。

        **轮次预算不走 ``ModelCallLimitMiddleware``**：实测（langchain 1.3.14）
        它在模型调用超限后只是**不再调模型**，图本身不会走到 END，仍会一路空转
        撞到 ``recursion_limit`` 才抛错。所以预算用 ``recursion_limit`` 表达，
        撞线后由 :meth:`run` 显式补一次纯文本答复——与 1.0 手写循环同一语义。
        """
        middleware: list[Any] = []
        if self._summarization_trigger is not None:
            kwargs: dict[str, Any] = {
                "model": chat,
                "trigger": self._summarization_trigger,
                "keep": self._summarization_keep,
            }
            if self._summary_prompt is not None:
                kwargs["summary_prompt"] = self._summary_prompt
            middleware.append(SummarizationMiddleware(**kwargs))
        if self._context_editing:
            middleware.append(ContextEditingMiddleware())
        return middleware

    async def _close_channel(self, task_id: str, tenant_id: str, status: str) -> None:
        """把任务实例置终态（尽力而为）。

        **刻意不抛出**：终态标记是次要产物，运行结果才是主要产物——收尾出错
        不该把一份已经跑出来的回执变成异常。代价是任务可能留在 ``running``，
        表现成"还能再投递一次"，可在任务列表上看出来。
        """
        if self._channel is None or not task_id:
            return
        with suppress(Exception):
            await self._channel.finish(task_id=task_id, tenant_id=tenant_id, status=status)

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        result = SubTaskResult(
            task_id=subtask.get("task_id", ""),
            profile_id=subtask.get("profile_id", ""),
            status="error",
            source="llm",
            llm_calls=0,
            tool_calls=[],
            evidence=[],
        )
        try:
            profile = await self._registry.get(subtask["profile_id"], tenant_id)
        except ProfileNotFound:
            result["error"] = f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）"
            return result

        result["profile_id"] = profile.profile_id
        # 工具面取**派活闸门实际发放**的那一份（= 员工白名单 ∩ 发起用户包络 ∩
        # 调用方 tool_scope）。没走闸门的直调（单测、离线）退回员工白名单。
        allowed = tuple(subtask.get("granted_tools") or profile.tools)
        tool_log: list[dict[str, Any]] = []

        llm = self._llm_factory(tenant_id)
        toolbox = self._toolbox_factory(tenant_id)
        # 1.4 任务 1：`tools` 之外的三维（action_rids / kb_ids / markings）也要
        # 在执行侧拦人。包络取派活闸门**四维一起发放**的那份；没走闸门的直调
        # 退回员工定义自己的包络——退回空包络会把每次直调变成全拒。
        granted = subtask.get("granted_envelope")
        envelope = Envelope.of_state(granted) if granted is not None else Envelope.of(profile)
        toolbox = EnvelopeGate(toolbox=toolbox, envelope=envelope)
        trace = RunTrace()
        # 实例身份 = 派活侧给的 ``team_task_id``（按运行唯一，外部就投这个 id）。
        # 兜底用计划内标签 ``task_id``：直接调运行时、不经图的场景没有前者。
        team_task_id = str(subtask.get("team_task_id") or subtask.get("task_id") or "")
        result["team_task_id"] = team_task_id
        # 证据编号前缀取**实例身份**（按运行唯一）；没有实例身份的直调退回计划内标签。
        # 与 ``result["evidence"]`` 绑同一个 list 对象：捕获处 append，回执侧就看得见，
        # 出错早退的那条路也一样带上（已经取到的证据不该因为后面的失败而消失）。
        evidence = _EvidenceCollector(team_task_id or profile.profile_id)
        result["evidence"] = evidence.items
        try:
            if self._channel is not None and team_task_id:
                # **先登记再开跑**：没有这一行，外部 ``send`` 只会 404——
                # 通道等于不存在，"追问正在干活的员工"就是句空话。
                await self._channel.start(
                    task_id=team_task_id, tenant_id=tenant_id, profile_id=profile.profile_id
                )
            descriptors = await toolbox.descriptors(allowed=allowed)
            known = {d["name"] for d in descriptors}

            def _reason_for(name: str) -> str:
                # 闸门的两条理由与 1.0 逐字一致（派发处与发现处共用同一套措辞）。
                return (
                    "not_in_employee_tool_whitelist"
                    if name not in allowed
                    else "center_marks_not_agent_invokable"
                )

            tools = [
                self._gated_tool(
                    d,
                    allowed=allowed,
                    toolbox=toolbox,
                    log=tool_log,
                    evidence=evidence,
                    tenant_id=tenant_id,
                    # 幂等键要的 run/任务身份（A-3）：run 从派活那一刻就写进子任务，
                    # task_id 用计划内标签——两者都在重启后原样读得回来。
                    run_id=str(subtask.get("run_id") or ""),
                    task_id=str(subtask.get("task_id") or ""),
                )
                for d in descriptors
            ]
            chat = LlmgwChatModel(
                gateway=llm,
                llm_model=profile.model,
                temperature=self._temperature,
                trace=trace,
            )
            rejected = _RejectedCalls(known=known, reason_for=_reason_for)
            middleware = self._middleware(chat=chat)
            if self._channel is not None and team_task_id:
                middleware.append(
                    InboxMiddleware(drain=_channel_drainer(self._channel, tenant_id, team_task_id))
                )
            agent = create_agent(
                model=chat,
                tools=tools,
                system_prompt=self._system_prompt(profile),
                middleware=middleware,
            )
            state = None
            try:
                state = await agent.ainvoke(
                    {"messages": [HumanMessage(content=subtask["instruction"])]},
                    {"recursion_limit": 2 * (self._max_tool_rounds + 1) + 1},
                )
            except GraphRecursionError:
                # 轮次预算用尽（模型还在要工具）。拿模型看过的最后一份消息
                # 去补一次纯文本答复——绝不返回空产出。
                pass
            messages: list[BaseMessage] = (
                list(state.get("messages") or [])
                if state is not None
                else list(trace.last_messages)
            )
            tool_log.extend(rejected.collect(messages))
            content = _final_text(messages)

            if not messages or _wants_tools(messages) or not content.strip():
                # 工具轮次用尽、模型仍在要工具（或压根没给结论）：再要一次**纯文本**
                # 答复（不给工具）。否则员工会以 status=ok 返回空产出——跑是跑完了
                # 却什么也没说，这本身就是另一种"假回执"（实测：研究员连调 8 次
                # 知识库后产出为空串）。
                final = await chat.ainvoke(messages)
                content = str(getattr(final, "content", "") or "")
        except Exception as exc:  # 运行期故障（网关/中心/网络）不应炸掉整轮编排
            # 1.5 任务 4：**上游可能自己好**的失败（传输错 / 429 / 5xx，由报错方用
            # ``retryable`` 标注）且**还没有任何工具调用落地**时，抛给图按策略重试。
            # 已经调过工具的不重试——那可能有副作用，"再试一次"得先确认它可重复。
            # 这里是全链路上**唯一**允许重试的地方：再往上就是整轮编排，重跑会重派活。
            if not tool_log and getattr(exc, "retryable", False):
                raise TransientRunError(f"{type(exc).__name__}: {exc}") from exc
            result["error"] = f"{type(exc).__name__}: {exc}"
            result["tool_calls"] = tool_log
            result["llm_calls"] = trace.calls
            await self._close_channel(team_task_id, tenant_id, "failed")
            return result
        finally:
            await aclose_quietly(llm)
            await aclose_quietly(toolbox)

        await self._close_channel(team_task_id, tenant_id, "completed")
        result["status"] = "ok"
        result["output"] = content
        result["llm_calls"] = trace.calls
        result["tool_calls"] = tool_log
        return result


__all__ = [
    "DEFAULT_SUMMARY_KEEP",
    "DEFAULT_SUMMARY_TRIGGER",
    "TOOL_RESULT_CHARS",
    "LlmEmployeeRuntime",
    "LlmFactory",
    "LlmGateway",
    "ToolboxFactory",
    "aclose_quietly",
]
