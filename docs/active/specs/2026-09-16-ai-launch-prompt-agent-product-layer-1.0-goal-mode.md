# GOAL 模式启动提示词 —— Agent 产品层 1.0 建设

> 整段粘贴到新会话。目标驱动、自验证、无需逐步确认。
> **必读**：`docs/active/specs/2026-09-16-agent-product-layer-1.0.md`（1.0 定义，权威）
> ＋ `docs/active/decisions/ADR-0066-agent-team-role-config-and-task-scoped-subagents.md`（身份与协同设计）

你是一名自主执行工程师，在 MetaPlatform 仓库完成下述 GOAL。**按任务 1→6 顺序推进，每任务先写 failing tests 再实现，完成后跑验证并 commit；全部完成后输出完成报告。** 只有"完成判据"无法自行达成、且继续会造成破坏时才停下问人。

## GOAL

用户一句话 → 大脑拆成任务图 → **并行派给 ≥2 个数字员工**（各有自己的提示词与工具）→ **真实执行**（非假回执）→ 中途**停一次等人确认** → 汇总。**全程租户隔离由数据库强制。**

## 已锁死的决策（不得偏离）

| # | 决策 |
|---|---|
| D-1 | 底座 **langchain / langgraph**（.venv 已装：langgraph 1.2.9 / langchain 1.3.14 / langgraph-checkpoint-postgres 3.1.2） |
| D-2 | 形态 = **云端服务**；产品层 = 超级大脑 + 数字员工；**坐在 Ontology 之上**；外联 MCP / A2A |
| D-3 | **1.0 = 一条主链 + 每块最小形态**；不追求复杂图 |
| D-4 | **租户隔离 = RLS 挂 `thread_id` 前缀**（格式 `租户ID\|任务ID`），**不改 langgraph 表结构** |
| D-5 | 状态 schema **必须显式声明字段**（`TypedDict`）；用裸 `dict` 会**静默丢写入** |
| D-6 | **禁用 `interrupt()`**（它会重跑节点）；暂停恢复用 `update_state(as_node=…)` + `invoke(None, cfg)` |
| D-7 | **复用不重写**：MCP 中心 / SkillHub / 本体（走既有 Action 通道） |
| D-8 | 员工身份 = 提示词 + 技能清单 + 工具白名单 |
| D-9 | A2A / Codex / dsh **只留接口，不实现** |
| D-10 | **"真实执行"是硬要求**——现状有"派活返回假回执"的病 |

## 硬约束（违反任何一条 = 立即停止）

1. 不绕过 13 硬规则：tenant 上下文守门 / 禁裸 httpx / production 禁 fallback / secret 不进 git
2. 只用 `mate-platform-backend/.venv`；开工首跑记录基线，此后任何提交不得低于基线
3. 网络走代理 7897：`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897`
4. Conventional Commits + **按文件 add**；**严禁 `git add -A` / `git add .`**（工作区可能有他人在途文件）
5. 从 main 开分支 `feat/agent-product-layer-1.0`，push 后开 PR
6. 契约先行：新接口先改 `mate-platform-backend/contracts/`
7. 中文输出加 `PYTHONIOENCODING=utf-8`（Windows 控制台会乱码）

## 环境事实卡（前人实跑踩过的坑 —— 最值钱的一段）

| 事实 | 细节 |
|---|---|
| **`meta` 是超级用户，会绕过 RLS** | 隔离断言**必须**用 `mate_app:mate_app@localhost:5432/metaplatform`（非超级、`rolbypassrls=false`）。用 `meta` 测会**假通过** |
| **裸 `dict` 作状态 schema 会静默丢写入** | 必须 `TypedDict` 显式声明字段（D-5） |
| **`interrupt()` 会重跑整个节点** | 用 `update_state` + `invoke(None)` 替代（D-6） |
| **`setup()` 含 `CREATE INDEX CONCURRENTLY`** | 连接必须 autocommit，否则报错 |
| **langgraph 建 4 张表** | `checkpoints` / `checkpoint_blobs` / `checkpoint_writes` / `checkpoint_migrations`；前三张主键首列均为 `thread_id` |
| **RLS 策略要点** | 需同时给 `USING` 与 `WITH CHECK`；租户上下文用 `current_setting('app.tenant_id', true)`；未设 = 返回空（**fail-closed，设计如此**） |
| 数据库清单 | `metaplatform`（主）/ `metaplatform_ont` / `metaplatform_agent` / `metaplatform_orchestrator` 等 |
| 目录约定 | 包在 `mate-platform-backend/packages/mate-*`；spike 脚本在 `scripts/spikes/` |

## 任务 0 · 地基验证（**已完成，勿重做**；开工先复跑确认仍通过）

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/spikes/spike_langgraph_foundation.py
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/spikes/spike_langgraph_tenant_rls.py
```

## 任务 1 · 大脑骨架

新建**独立服务**（不塞进现有编排服务）。langgraph 任务图：一句话 → 拆 ≥2 个可并行节点 → 并行执行 → 结果回灌状态。租户标识 `租户ID|任务ID` 作 `thread_id`，每连接设 `app.tenant_id`。
**判据**：3 个并行子任务全部执行并汇总；换租户互不可见。

## 任务 2 · 数字员工运行时（**治"假回执"**）

员工 = 提示词 + 技能清单（来自 **SkillHub**）+ 工具白名单。真实调 LLM（走既有 `mate-tech-llmgw`）与工具（接既有 **MCP 中心**）。
**负例**：白名单外的工具调用必须被拒。
**判据**：同一句话派给两个不同员工，产出**内容不同且真实**的结果。

## 任务 3 · 打通本体

复用 `mate-tech-ont` 既有工具面（`list_classes` / `inspect_class` / `object_query` / `propose_*`）；**写操作走 proposal 管道**（AI 只能提议，人确认才落库）。不新建交互方式。
**判据**：让员工"查本月异常订单"→ 返回**真实数据**。

## 任务 4 · 人工确认（HITL）

未批准时停在闸门不执行后续；批准后继续；**已完成节点的调用次数不变**（D-6 的核心断言）。
**判据**：演示"跑到闸门停住 → 点确认 → 继续完成"，日志证明前半段没被重跑。

## 任务 5 · 前端最小演示

能看到任务图 / 各员工状态 / 最终结果；只做**读**，不改既有页面结构。
**判据**：浏览器里走完一条主链。

## 任务 6 · 技能渐进加载

先给清单（名字 + 一句描述），选中才读正文；初始清单 ≤ 上下文 2% 或 8000 字符。
**判据**：给一个员工挂 20 个技能，提示词仍在预算内。

## 验证循环（每任务后必跑）

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <本任务涉及的包>/tests -q
```

任务 1 / 2 / 4 完成后**加跑任务 0 的两个 spike**，确认地基未被破坏。低于基线 → 修复后再继续。

## 完成报告格式

```text
## Agent 产品层 1.0 完成报告
- 任务 1 大脑骨架 / 任务 2 数字员工 / 任务 3 本体 / 任务 4 人工确认 / 任务 5 前端 / 任务 6 技能：

  <各自验证结果>
- 地基回归：<任务 0 两 spike 结果>
- 回归：<基线 → 最终> | commits：<hash 列表> | PR：<链接>
- 遗留与建议：<明确不在本轮范围的项>
```

## 边界（不要做）

- 不接 A2A / Codex / dsh；不做复杂图（回环、嵌套子图、动态图）
- 不做技能市场；不做技能自带工具依赖
- 不做沙箱分级 / 会话快照 / per-call fork
- 不做完整的权限包络衰减（ADR-0066 §3.3 留到 1.x）
- 不重写 MCP 中心 / SkillHub / 本体引擎；不改 `PlanRunner` 与既有调度端点
- **不用 `interrupt()`**（D-6）；**不用裸 `dict` 作状态 schema**（D-5）
- 不碰他人在途文件；`git add -A` 禁止；secret 值不进 git
