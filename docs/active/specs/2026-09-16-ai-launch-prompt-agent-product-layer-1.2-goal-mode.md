# GOAL 模式启动提示词 —— Agent 产品层 1.2

> **开工前必读**：`2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）、
> `2026-09-16-agent-product-layer-roadmap.md` §1.2（范围与理由）、ADR-0066 R10 与 §5.5。
> 1.0/1.1 已在 main；服务 `mate-tech-agent-team`（8013）。

你是自主执行工程师。按任务 1→2 推进，每任务**先写 failing tests 再实现**，完成后跑验证并 commit，最后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

把「以 langgraph + langchain 为核心」**真正落实**——1.0/1.1 只用了 langgraph，**langchain 零 import**（虽已装在 venv）。本次把**员工执行循环迁到 LangChain**，并补**双向消息**。

## 锁死决策

- 迁移**不是**重写循环，是**改用 LangChain 现成的**：`create_agent` / `langchain_core.tools` / `BaseChatModel`
- **迁进去，但不许漏出来**（ADR-0066 R10）：LangChain 类型**不得进 TeamBus 公开契约**
- 员工对外形状不变：仍是 `EmployeeRuntime.run(subtask, tenant_id) -> SubTaskResult`
- **不换 LLM 通道**——`BaseChatModel` 底层仍打自研 `mate_clients.llmgw.LlmgwClient`
- 白拿的中间件**至少启用** `summarization` / `context_editing`（当前唯一明确的上下文缺口）
- 双向消息按 ADR-0066 §5.5：写 `team_task.inbox`，子 agent 在**下一轮迭代边界**消费；**终态 409**，不隐式起新轮
- **不用 `interrupt()`**；**不用裸 dict 作状态 schema**（1.0 教训）
- 包络链根 = 发起用户；不扩权免审、扩权才审（1.1 已落地，**别打破**）

## 硬约束

不绕过 13 硬规则（tenant 守门 / 禁裸 httpx / 禁 fallback / secret 不进 git）；只用 `mate-platform-backend/.venv`，首跑记基线此后不得低于；网络走代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-1.2`；契约先行；中文加 `PYTHONIOENCODING=utf-8`。

## 任务 1 · 员工执行循环迁到 LangChain

**要迁共 377 行**：`employee.py`（224，手写"调模型→调工具→回灌"循环 + `LlmGateway`）＋ `toolbox.py`（153，MCP 描述符手工转 OpenAI schema）。

**迁四项**：

1. `LlmEmployeeRuntime` → **`create_agent`**
2. `toolbox.py` schema 转换 → **`langchain_core.tools`**
3. `LlmGateway` → **`BaseChatModel`** 实现（底层仍打 `LlmgwClient`）
4. 装 **`langchain-mcp-adapters`**，MCP 工具改走它（1.1 刚把本体工具收回总线，正好接）

**判据（四条都要）**：

- 执行链路**真的经过 `create_agent`**（断言，不能只是 import）
- `summarization` **真的生效**：长上下文 → 证明被压缩（而非原样堆进 prompt）
- **TeamBus 公开契约零 LangChain 类型**（R10 守卫，CI 断言 import 边界）
- 既有 `EmployeeRuntime` 行为**不回归**（1.0/1.1 员工测试全绿）

## 任务 2 · 双向消息

`send` 写目标 `team_task.inbox`；子 agent 在**下一轮迭代边界**消费即清空；**终态返回 409**（不隐式起新轮）；子 agent 回问走**同一机制反向**。

**判据**：运行中 `send` → 下一轮生效；终态 `send` → 409；**跨租户 send 被拒**。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

既有链路**不得回归**：端到端主链 + 权限包络衰减 + 深度闸门 + MCP 对外租户绑定。

## 报告

任务 1~2 验证结果 + 回归 + 基线→最终 + commits + PR + 遗留与建议。

## 边界

不接 Claude Code / dsh；不做沙箱分级 / 复杂图 / A2A；不重写本体引擎 / SkillHub / MCP 中心。
**不换 LLM 通道**；**不让 LangChain 类型漏进公开契约**。
不用 `interrupt()`；不用裸 dict 作状态 schema；建表不用服务角色（RLS 静默失效）；隔离断言不用 `meta`（假通过）；secret 不进 git。
