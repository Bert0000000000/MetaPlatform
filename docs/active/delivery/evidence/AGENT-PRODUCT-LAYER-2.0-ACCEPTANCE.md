# AGENT-PRODUCT-LAYER-2.0 · 验收证据

> 日期：2026-09-17 · 分支：`feat/agent-product-layer-2.0` · 基线：`origin/main` = `2a74df8d`
> 目标：1.0~1.9 收尾 —— 落档 / 统一验收 / 边界登记成表 / 状态同步；会话页与 Agent 产品层合一。
> 上游设计：`docs/active/specs/2026-09-16-agent-product-layer-roadmap.md`、
> `docs/active/specs/2026-09-16-agent-product-layer-env-facts.md`、ADR-0066

本文件是 **1.0~1.9 的统一验收**（此前只有 1.1 一份单独证据）。1.0~1.9 的逐版证据
分散在各自 PR 与路线图里；§1 把它们收成一张可追溯的表，每条给出**出处**。

**本批不改后端代码**——轨 A 只动 `docs/` 与 `CLAUDE.md`，轨 B 只动前端
`pages/superai/` 与 `api/`。§4 的回归数字因此应与开工基线**逐字相同**。

## 0. 测试基线 → 最终

| 项 | 值 |
| --- | --- |
| 开工基线（`packages/mate-tech-agent-team/tests`，`main` = `2a74df8d`） | **357 passed / 0 skipped** |
| 最终（同套件，本批结束时） | **357 passed / 0 skipped** |
| 差异 | **0**（本批未改后端） |

命令与原始输出见 §4.2。

## 1. 统一验收：1.0 ~ 1.9

「判据结果」一列写的是**该版自标的判据**是否达成；「自标边界」一列写的是该版
**自己承认没做完的部分**（不是本批新发现的）。出处一列指向可核对的地方。

| 版本 | 主题 | 交付 commit（PR） | 判据结果 | 自标边界（原文出处） |
| --- | --- | --- | --- | --- |
| **1.0** | 一条主链端到端 | `04d181bb`（PR #41）、`e29c4acd`（PR #42） | ✅ 六任务判据全达成，端到端脚本 7/7 | A2A 外联与多运行时**只留接口不实现**；沙箱只上最小可用形态（`2026-09-16-agent-product-layer-1.0.md` §4） |
| **1.1** | MCP 对外 + 身份 + 权限 | `44cb835b`（PR #43） | ✅ 三任务判据 + Codex 接入 + 包络衰减 + 深度闸门全达成 | 派活闸门尚无 HTTP 面；`employee_profile` 无 Alembic 迁移；`OntAgentToolsClient` 已无消费者；`tenant_switch_enabled` 是**新增的安全边界**待复核（`AGENT-PRODUCT-LAYER-1.1-ACCEPTANCE.md` §7） |
| **1.2** | LangChain 迁移 + 双向消息 | `1706ce9e`（PR #44） | ✅ `create_agent` + `LlmgwChatModel` 落地；`team_task` 表 + `TeamBus` 五项动作 | **通道未换**（仍是 llmgw）；测试 99→122 |
| **1.3** | 派活加固 + 运行控制面 + 交付面 | `6d417d93`（PR #45） | ✅ 三轨全达成（包络解析 / 运行控制面 / 容器重建） | ① Dockerfile 未跟代码涨（源码 bind mount 掩盖）② compose 密钥变量：`mate-tech-orchestrator` **同款问题未修** |
| **1.4** | 安全收敛 | `3aa05896`（PR #46） | ✅ 三件"建了没兜住"全补上；ADR-0040 修订到 v1.1 | 沙箱分层键由「厂商身份」改为「代码来源」（这是修订，不是边界） |
| **1.5** | 运行控制补全 | `f3e91805`（PR #47） | ✅ 四项全达成（执行中取消 / 超时持久化 / 事件流尾随 / 失败重试） | ① 取消信号是**进程内**的（跨副本需共享通道）② 事件流尾随靠**轮询**（250ms，无消息总线）（`agent-product-layer-roadmap.md` §1.5） |
| **1.6** | 证据与交付 | `940a9d7b`（PR #48） | ✅ 四项全达成（证据接线 / 真实 Artifact / CI 门禁 / 前端工作台） | ① 分支保护没开，`python-ci.yml` 有 paths 过滤 → 贸然加 required 会死锁 ② 前端**没做 SSE 实时流**（`EventSource` 带不了 `Authorization`）（同上 §1.6） |
| **1.7** | 异步化与实时流 | `6ff46528`（PR #50） | ✅ 三项全达成；`POST /runs` 202 实测 0.22s | ① 后台执行仍在**进程内事件循环** ② 幂等**跨副本**有极小竞态 ③ SSE 要求客户端声明 `Accept`（同上 §1.7） |
| **1.8** | 三轨并行（可靠 / 外联 / 编排） | `b30043d0`（PR #54） | ✅ 三轨全达成；**330 passed / 0 skipped** | ① 重启续跑**没有链根包络** → fail-closed 转待授权提案 ② 外部 runtime **只验到 CLI 契约**（本机 `claude` 未登录）③ A2A 真端到端**是人工验证项**（规则 7 禁 `skipif`）（同上 §1.8） |
| **1.9** | 多副本与重启下的正确性 | `2a74df8d`（PR #55） | ✅ 三任务 + 一修全达成；**357 passed / 0 skipped** | 四条：① 续跑**没有用户令牌** ② 取消信号**粘性**（只置不清）③ 跨副本取消**不保证回话那刻图已停** ④ 认领靠 **TTL** 兜硬崩（同上 §1.9） |

### 1.1 判据出处的核对方法

每一版的交付 commit 都能在 `main` 上直接查到，命令：

```bash
git log --oneline --merges main | grep agent-product-layer
```

得到的 merge 点与本表逐行一致：`04d181bb` / `e29c4acd` / `44cb835b` / `1706ce9e` /
`6d417d93` / `3aa05896` / `f3e91805` / `940a9d7b` / `6ff46528` / `b30043d0` / `2a74df8d`。

**1.0~1.9 里只有 1.1 有独立证据文件**（`AGENT-PRODUCT-LAYER-1.1-ACCEPTANCE.md`）。
其余各版的验收结论记在路线图的「已交付」各节里（本轮把它补齐为统一表，见 §1）。
这是**如实说明**：1.0、1.2~1.9 **没有**各自独立的 `*-ACCEPTANCE.md`，本文件不假装它们有。

## 2. 本批轨 A：落档与状态同步

| 项 | 结果 |
| --- | --- |
| 未跟踪文档落档 | 14 个（见 §2.1），逐一 `git add`，未用 `git add -A` |
| 统一验收 | 本文件 §1（覆盖 1.0~1.9） |
| 边界登记成表 | 本文件 §3 |
| 状态同步 | `CLAUDE.md` / 路线图 / ADR-0065（**Proposed 保持 Proposed**） |

### 2.1 落档清单

踩坑卡 / 路线图 / 能力面方案 / 调研报告各 1 份，goal-mode 启动提示词 10 份：

| 文档 | 类型 |
| --- | --- |
| `specs/2026-09-16-agent-product-layer-env-facts.md` | 踩坑卡（每版开工前必读） |
| `specs/2026-09-16-agent-product-layer-roadmap.md` | 路线图（跨会话交接） |
| `specs/2026-09-16-superai-capability-plan.md` | 能力面完整方案 |
| `reports/REPORT-LangChain与AgentNative调研-2026-09-16.md` | 开源调研报告 |
| `specs/2026-09-16-ai-launch-prompt-agent-product-layer-1.0-goal-mode.md` | 启动提示词 |
| `specs/2026-09-16-ai-launch-prompt-agent-product-layer-1.1-goal-mode.md` | 启动提示词 |
| `specs/2026-09-16-ai-launch-prompt-agent-product-layer-1.3-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.4-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.5-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.6-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.7-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.8-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-1.9-goal-mode.md` | 启动提示词 |
| `specs/2026-09-17-ai-launch-prompt-agent-product-layer-2.0-goal-mode.md` | 启动提示词（本批） |

1.0 定义与 1.2 提示词此前已在 `main`，本批不动。

### 2.2 落档前的订正

| 文档 | 订正内容 | 原因 |
| --- | --- | --- |
| 路线图 `## 版本规划` 表 | 删掉重复的 2.0 行；1.7 由「进行中」改为已交付；1.8/1.9 补入 | 该表停在 1.6 收尾那一刻，与 `main` 对不上 |
| 路线图 `## 进行中` | 2.0 由「🏃」改为已交付并指向本文件 | 同上 |
| 路线图 / 能力面方案 / 1.9 提示词 | **格式**：列表前后补空行（MD032）、两处围栏补语言（MD040）、一处标题后补空行（MD022） | 这三份是**本次新增**文件，会进 CI 的 `cowork md-lint`（只查变更文件）——**只改格式，不动内容** |

其余 11 份**原样落档**：它们是各版当时的启动提示词与调研快照，属于**历史记录**，
按"历史不被追改"处理；与当前状态不一致时以路线图与本文件为准。

## 3. 边界登记表

每条写「**为什么留着** + **要做的条件**」。前四条是 1.9 的，接着是 1.8 的，最后是更早的。

### 3.1 1.9 四条

| # | 边界 | 为什么留着（不是妥协的理由） | 要做的条件 |
| --- | --- | --- | --- |
| B-1 | **续跑没有用户令牌** | 上游按令牌解析租户的那几处（llmgw / MCP 协议面）仍走服务身份。1.9 只解决了「派活授权的链根」，没解决「上游鉴权面的身份」——把用户令牌落库会破坏"原始 Bearer 一个字节不落库"这条硬约束 | 需要一条**不经落库的令牌传递**通道（如运行期内存态 + 重启后重新协商），或让 llmgw / MCP 协议面接受 per-run 派活授权作为身份。**动这两处之前要先有 ADR** |
| B-2 | **取消信号粘性（只置不清）** | 留一张只增不减的小表。**能清才是错的**——清掉就等于允许"取消后再被续跑捡起来"，那正是取消要防的事 | 不需要"做"，需要的是**定期归档**：若长期运行导致该表膨胀，加一个把已落终态的 run 的取消行归档的清理任务 |
| B-3 | **跨副本取消不保证回话那刻图已停** | B 副本没有 A 的 live 记录，无法"等"；**保证的是终态与信号都已落下**。要强保证就得引入跨副本的 live 通道 | 若要"回话即已停"，需要一个**跨副本的活跃 run 注册表**（谁在跑、跑在哪），或把取消改成异步 + 轮询终态。**当前不阻塞任何判据** |
| B-4 | **认领靠 TTL 兜硬崩** | 正常路径随执行结束归还；被杀时孤儿坑 TTL（默认 30s）后可被接管，接管后还有"查检查点"兜底。TTL 是**兜底层**，不是主路径 | 若要缩短不可用窗口，把 TTL 做成**可配 + 带续租**（长跑 run 定期续租自己的认领），这样 TTL 可以设得很短而不误伤长跑 |

### 3.2 1.8 三条

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| B-5 | **重启续跑没有链根包络**（1.8 的形态） | 令牌刻意不落库，所以进程重启后续跑的那一波会 **fail-closed 转待授权提案**。这是**安全性质不是妥协** | **1.9 已完成**：新增 `delegation.py`，开跑那一刻把链根发成一份与令牌分离的 per-run 派活授权随 run 落库（只有 `run_id / granted_by / envelope / expires_at`，**没有凭据**）。本条保留在此仅为记录演进 |
| B-6 | **外部 runtime 只验到 CLI 契约** | 本机 `claude` CLI 未登录（`claude -p` 回 "Not logged in"），真实模型调用做不了。已验证的是：配置能下发、契约能成立 | 在一台**已登录**的机器（或 CI 上注入凭证）跑真端到端。这属于**环境条件**，不是代码缺口 |
| B-7 | **A2A 真端到端是人工验证项** | 规则 7 禁 `@pytest.mark.skipif`，留不下自动用例；本机没有可联调的外部 agent 系统 | 要有**对端 A2A 服务**（真实或起一个桩）才能写成常跑用例；在此之前只能人工验 |

### 3.3 更早的（ADR-0065 / v6）

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| B-8 | **ADR-0065（SuperAI 上下文感知）仍是 Proposed** | 它是**设计稿**，本批明确"另立批次"。本批**不把它升格**——升格需要书面评审，而它尚未评审 | 走完 ADR 评审流程后转 Accepted，再按 ADR 的 S1~S3 小步实施（`docs/active/decisions/ADR-0065-superai-context-awareness.md`） |
| B-9 | **v6 轨道（dsh preset ×7）未启动** | 能力面方案 §9 把"接第一个外部助手"列为 **later**；1.8 只做到"外部执行面下投影（Claude Code）+ A2A 外联"，没碰 dsh | 另立批次。前置：B-6 解决（要能真跑外部 runtime 才谈得上多 runtime 编排） |
| B-10 | **`tenant_switch_enabled` 安全边界待复核**（1.1） | 为了让 `sk-mcp-*` 路径能代租户行事，把它绑到了**共享** client 的 `optionalClientScopes`。**代价是：任何持有该共享密钥的服务，只要显式申请这个 scope，也能代任意租户行事** | 复核通过则维持；不通过则改走 ① 新建专用 MCP client + SealedSecret 下发新密钥，或 ② Keycloak token exchange 换短时令牌（`AGENT-PRODUCT-LAYER-1.1-ACCEPTANCE.md` §7.1） |

### 3.4 已闭合的边界（记录演进，不重复登记）

| 边界 | 何时提出 | 何时闭合 | 闭合方式 |
| --- | --- | --- | --- |
| 分支保护没开 + paths 过滤死锁 | 1.6 | 1.7（`dc308727`） | `pull_request` 去掉 `paths` 过滤 |
| 前端没做 SSE 实时流 | 1.6 | 1.7（`4abd5e4d`） | `fetch` + `ReadableStream`，不用 `EventSource` |
| 后台执行在请求进程内（进程重启在途 run 停住） | 1.7 | 1.8（`9fd41c95`） | 扫检查点续跑 |
| 幂等跨副本极小竞态 | 1.7 | 1.9（`443cfde3`） | `RunClaims` 原子认领（`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`） |
| 取消信号进程内 | 1.5 | 1.9（`a5d4619a`） | `CancelSignals` 共享信号通道（进程内 + PG 两个实现） |
| 重启续跑没有链根包络 | 1.8 | 1.9（`a4c142dc`） | per-run 派活授权（见 B-5） |

## 4. 回归

### 4.1 13 硬规则门禁（与 `ga-acceptance.yml` 对齐）

| 门禁 job | 本轮结论 |
| --- | --- |
| `ga-001` oasdiff | 契约零改动（本批不碰 `contracts/`） |
| `ga-002` Requirement ID | 未动 |
| `ga-003` forbid_raw_sql（规则 3） | 无新增代码 |
| `ga-004` forbid_bare_httpx（规则 4） | 无新增代码 |
| `ga-005` forbid_legacy_fallback（规则 5） | 无新增代码 |
| `ga-006` ruff + pyright strict | 无 Python 改动；前端另有 `tsc` 与 `vitest` |
| `ga-007` forbid_skip_tests | 本批未新增任何测试（轨 A 只动文档） |
| `ga-008` helm lint + kubeconform | 未触及 |
| `ga-009` OTel collector smoke | 未触及 |
| `ga-010` require_evidence（规则 10） | 本文件 |
| `ga-011` helm-docs --dry-run | 未触及 |
| `ga-012` gitleaks（规则 12） | 无密钥入库 |
| `ga-013` NetworkPolicy 覆盖 | 未触及 |

### 4.2 复现命令

后端（应与基线逐字相同）：

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

前端单元测试与类型检查（轨 B）：

```bash
cd metaplatform-frontend/apps/web && pnpm test:unit && pnpm typecheck
```

### 4.3 提交

| commit | 内容 |
| --- | --- |
| `b64f5633` | 轨 B：会话页接 Agent 产品层 + 调度可视化常驻历史之上 |
| `b17fc80d` | 轨 A：落档 14 份文档 + 统一验收 + 边界表 + 状态同步 |

PR：[#56](https://github.com/Bert0000000000/MetaPlatform/pull/56)（分支 `feat/agent-product-layer-2.0`，基线 `2a74df8d`）。

### 4.4 结果

| 套件 | 结果 |
| --- | --- |
| `packages/mate-tech-agent-team/tests` | **357 passed / 0 skipped**（基线同值） |
| `apps/web` unit（`pnpm test:unit`） | **28 passed / 1 failed**；那 1 条是**预存红** |
| `apps/web` 类型检查（`pnpm typecheck`） | 通过（无输出即通过） |

前端那 1 条红是 `src/pages/ontology/components/ProposalConfirmDrawer.test.tsx`，
**本批改动之前就红**，且本批未触及该文件（`git diff` 里命中数为 0），也不是
`pages/superai/` 下的东西。开工时（未改任何前端代码）同一条即失败。

## 5. 轨 B：会话页整合

### 5.1 做了什么

会话页（`/superai/chat`）此前走**老 copilot stream**——调度信息散在每条消息的
`steps` 卡片里；工作台（`/superai/team`）走 **agent-team run**——有任务图。本批把
两者**合一**：

1. 会话页新增「Agent 产品层」模式：一句话 → `POST /runs` → 拆任务图 → 派数字员工

   → 真实执行 → 停在人工确认闸门 → 确认后汇总。

2. 调度可视化**常驻在会话历史之上**（一个区域，不再散在消息里）：任务图（含

   **波次**）/ 员工状态 / 证据 / 交付物 / 终态。

3. 证据与交付物**沿用既有渲染器**（`EvidenceRenderer` + 交付物按 id 取回），未另造。

**两套调度表示合一的关键**：调度可视化被抽成一个共享组件
`pages/superai/components/AgentTeamSchedule.tsx`，工作台与会话页**用同一个**。
会话页的调度不再走 copilot stream 的 `steps`。

### 5.2 判据对照

| 判据 | 结果 | 出处 |
| --- | --- | --- |
| 一句话 → 拆任务图 → 派数字员工 → 真实执行 → 停人工确认 | ✅ | §5.3 |
| 历史之上常驻调度可视化（任务图 / 员工状态 / 波次 / 终态） | ✅ | §5.3 |
| 证据与交付物沿用既有渲染器 | ✅ 复用 `EvidenceRenderer`，未新增渲染组件 | 代码：`components/AgentTeamSchedule.tsx` |
| 刷新后视图能从 `GET /runs/{id}` 恢复 | ✅ | §5.3 |

### 5.3 浏览器实跑记录

dev server 由本会话自起（配置的 9251 被占，实际落在 `60707`），
经网关 `8100` 走 `/api/v1/agent-team/*`（**与生产同一条路径**，没有直连域容器）。

| 步骤 | 观测 |
| --- | --- |
| 打开 `/superai/chat` | 常驻区域「Agent 产品层调度」在**会话历史之上**渲染（未开模式时给一句引导文案） |
| 点「Agent 产品层」开关 | 按钮文案变 `Agent 产品层 · 开`（原生 `<button>`，`data-testid="chat-team-mode"`） |
| 输入一句话并按 Enter 发送 | 起了一轮：`run_id = 3db0d718100d93c0bf8f710fdbf87f5a` |
| 事件流 | 区域出现 `实时` 标签（SSE 经网关连上——1.7 修的那条通道在本用法下仍然通） |
| 拆图完成 | 任务图 **3 个子任务**、**1 个波次**、员工状态 3 名，全部 `已完成` |
| 停在闸门 | 终态 `等待人工确认`；区域出现「确认并继续 / 驳回」两个**原生**按钮 |
| 点「确认并继续」 | 终态 → `已完成`；汇总（summary）区块出现 |
| **刷新页面** | 视图自动恢复：终态 `已完成`、graph 3 行、employees 3 行、证据 19、交付物 3、波次 1 —— 全部来自 `GET /runs/{id}` |

**几何证据**（`getBoundingClientRect`，取自刷新后的页面）：

| 元素 | top | bottom |
| --- | --- | --- |
| 调度区域 | 136 | 745 |
| 对话区 | 745 | 1167 |
| 输入框 | 1167 | — |

区域底边 ≤ 对话区顶边、且整体在输入框之上 —— 「历史之上常驻」成立。区域
`overflow: auto`，长任务图自行滚动，不挤压对话。

**必须如实说明的一点**：这一轮的员工产出正文是 **llmgw 的 stub-fallback 回显**
（`[stub-fallback] OpenAI unavailable. Echo: …`），不是真实模型答复 —— 这是本机
llmgw 未配 provider 时的既有行为（见 `agent-product-layer-env-facts.md` §4）。
**跑通的是链路**（真实拆图、真实派活、真实调本体工具 `ont_list_classes` /
`ont_inspect_class`、真实 19 条证据与 3 件交付物），**不是模型质量**。

### 5.4 本轨没做的（诚实边界）

| 没做 | 为什么 | 要做的条件 |
| --- | --- | --- |
| 会话 ↔ run 的关联**没有落后端** | 属于新增后端功能，本批明确不做 | run_id 现存在浏览器本地（`mp-agent-team-run:<会话id>`），**换机器看不到上一轮调度**。要跨设备恢复需后端存这张关联 |
| 老 copilot 的「Agent 调度」模式**没有合并进新区域** | 它与 agent-team run 不是同一种东西：那条流是 LLM 工具调用 + 路由决策 + 本体提案，有 `RoutingDecisionPanel` 与 e2e（`superai-routing.spec.ts`）依赖它 | 「两套调度表示合一」指的是**调度**（任务图/派数字员工）合一：会话页现在只有 agent-team 一处显示调度。是否把 copilot 那条也搬进常驻区，取决于产品判断 |
| 调度区域**不能手工切换查看历史轮次** | 只显示当前会话最近一轮 | 需要 `GET /runs?conversation=…` 这类列表端点（后端不存在） |

## 6. 遗留与建议

1. **1.0 / 1.2~1.9 缺独立验收文件** —— 本文件把它们统一收了，但不为它们**补写**

   独立 `*-ACCEPTANCE.md`：那需要重建当时的判据与原始输出，事后补写等于编造证据。
   建议**从 2.1 起每版一份**，别再积累。

2. **`agent-team.yaml` 未进前端类型生成** —— 前端 `api/agentTeam.ts` 是手写的。

   契约再变时这里会漂移。建议把 agent-team 纳入 `pnpm openapi:gen`。

3. **本机 llmgw 未配 provider** —— 所有员工产出都是 stub-fallback 回显，导致

   「员工真的会干活」在本机**验不了**，只能验到链路。要验模型质量需配好
   `ai.provider.*`（env-facts §4 的 service-read 路径）。

4. **`Process` 级取消的 UI 面** —— 会话页现在能发取消（`POST /runs/{id}/cancel`），

   但 1.9 自标的「跨副本取消不保证回话那刻图已停」（B-3）意味着按钮返回时图可能
   还在收尾。UI 上没有把这件事说出来。要么在提示里说明，要么等 B-3 解决。
