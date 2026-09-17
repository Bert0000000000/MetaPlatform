# AGENT-PRODUCT-LAYER-2.1-C · 验收证据

> **日期**：2026-09-18 · **分支**：`feat/agent-product-layer-2.1-c` · **基线**：`main` = `f30d4153`
> **目标**：**产品统一**——把两条并行的东西收敛成一条：
> `Conversation → AgentRun → Runtime → Task/ToolInvocation → Evidence/Proposal/Artifact`。
> 与 A/B（后端硬化）不同，**本批动了前端与契约**。
> **上游**：`docs/active/specs/2026-09-17-agent-product-layer-2.1-roadmap.md` §4、
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md`（平台级量化准出，本文件**只引用不重定义**）、
> `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.1-B-ACCEPTANCE.md`（上一批；本批接住它的 A1）
> **对外批次号**：`MP-SESSION-RUN-LINK-01` / `MP-CONTEXT-AWARE-01` / `MP-LEGACY-SUNSET-01` /
> `MP-ARTIFACT-VERSIONING-01` / `MP-AGENT-PROFILE-MGMT-01` / `MP-EVAL-GOLDEN-01` /
> `MP-OBSERVABILITY-DEEPEN-01`（+ 2.1-B 建议 2 的 kind 脚本收进 CI，顺带做、未单开批次）

## 0. 测试基线 → 最终

| 套件 | 开工基线 | 最终 | 差异 |
| --- | --- | --- | --- |
| `packages/mate-tech-agent-team/tests`（本批主战场） | **501 passed / 0 skipped** | **593 passed / 0 skipped** | **+92** |
| `packages/mate-app-copilot/tests`（C-2 后端 / C-3） | 248（推算：270 − 本批 22） | **270 passed** | **+22** |
| `infra/tests`（动了 helm chart） | 2192 passed / 5 skipped（2.1-B 记录） | **2195 passed / 5 skipped** | +3 |
| `apps/web` vitest | 43（C-2 前端工作流实测口径） | **63 tests / 62 passed / 1 failed** | +20 |
| `apps/web` Playwright（本批新增 3 个 spec） | — | **6 passed / 0 failed** | 新增 |

> 前端那 1 条红是 **`ProposalConfirmDrawer` 的预存红**——2.1-B §4-B4/B5 已登记归
> `MP-QA-BASELINE-01`，平台计划 S0 工作项 3 亦点名"修复现有 `ProposalConfirmDrawer`
> 预存红测试"。**不是本批引入**（本批没碰那个组件）。
>
> `packages/mate-app-copilot/tests` 的基线是**推算**的，本批开工时没有单独取过这个数
> ——写在这里而不是省略，是因为"没说清"和"编一个"是两回事。

命令与原始输出见 §5。

## 1. 七条逐条

### C-1 · `MP-SESSION-RUN-LINK-01`：会话 ↔ run 落后端

| 项 | 内容 |
| --- | --- |
| **判据** | ① 换机器 / 清浏览器 → 会话仍看得到历史轮次的 run（**后端是唯一关系源**） |
| **现状（开工前实取）** | 关系只写在浏览器 localStorage（`mp-agent-team-run:<会话id>`，`ChatPage.tsx:158`）；后端 `grep conversation_id` **零命中** |
| **交付** | ① 新表 `agent_team.conversation_run(tenant_id, conversation_id, run_id, turn_id, created_by, relation_type, created_at)`，主键 `(tenant, conversation, run)` + RLS FORCE；② `POST /runs` 新增 `conversation_id` / `turn_id` 请求字段；③ 新端点 `GET /runs?conversation=`（operationId `agentTeamGetRuns`）；④ 前端 localStorage **降级为缓存**（先画一帧，真值以后端为准） |
| **证据** | `tests/test_conversation_link.py`（14 条：内存 + 真 PG + HTTP + 控制面）；`tests/e2e/session-run-link.spec.ts`（浏览器）；§5.3 活栈实测 |
| **commit** | `f44c0074`（后端）/ `27e816fe`（前端）/ `77f5d4f3`（浏览器判据） |

三个刻意的设计点，都写进了代码注释：

1. **落关系放在 `submit` 最早处**——后面几条去重路径都会提前 `return`，放晚了
   "重复提交"那条路上的关系就丢了（有用例专门钉这条）；
2. **重复关联幂等且不刷新 `created_at`**——否则"这一轮何时进这个会话"会随重复提交
   漂移，历史顺序不稳（与 C-4 拒覆盖写是同一条原则）；
3. **列表项的 `status` / `goal` 走 `RunControl.refresh`**——与 `GET /runs/{id}` 同一份
   事实、同一条读取路径（含超时裁决）。列表与详情不会各说各话；代价是 N 轮 = N 次
   检查点读，因此有 `MAX_CONVERSATION_RUNS = 200` 的上限。

### C-2 · `MP-CONTEXT-AWARE-01`：ADR-0065 先评审再实施

| 项 | 内容 |
| --- | --- |
| **判据** | ② **ADR-0065 转 Accepted 且有评审记录**；选中对象提问 → Agent 先按 RID 查新数据 |
| **硬前置** | 批次门槛写明「不得为赶进度偷偷升格」，所以**评审是独立的一步**（`76df738c`），先于任何 S1 代码 |
| **交付** | ① `ADR-REVIEW-2026-09-18-0065.md`：逐条核对现状描述（5 处相符）、核对自报的兼容性与安全性论断（**3 处需附条件、1 处需订正**）、与既有 ADR / 硬规则的一致性对照，给出 **R1–R4 四条实施条件**；② S1 后端（`02221bf8`）；③ S2 前端写入 + S3 navigate 回向（`993d6459`） |

**评审不是补签字位**，四处实质结论：

| # | 原文说法 | 评审结论 |
| --- | --- | --- |
| **R1** | §4「状态键只影响 prompt 渲染，不参与工具参数注入」 | **只挡住了一半**。`selection[].label` / `pendingSelection.text` / `navigation.view` 是**宿主提供的自由文本**且**会进 system prompt**——那就是指令通道。要求截断 + 换行/控制字符归并 + 段首显式声明"这是数据不是指令" |
| **R2** | §2.1-2「用 system prompt 指令对齐水合」 | 决策成立，但**只能对齐意愿、不能对齐行为**——判据 2 因此是**观察性**的。补：`capturedAt` 的陈旧阈值与超阈值行为必须成文 |
| **R3** | §7-4「旧用例输出逐字节等价」 | 从验收项提为**条件**——它是"新增分层不破坏旧宿主"的唯一硬证据 |
| **R4** | §2.1-1「navigate 不自动执行」 | 决策正确，**但缺一半**：只约束了"谁来跳"，没约束"跳到哪"。`navigate.target.path` 由**模型产出**，直接交给前端路由是注入面 |

**R1 的实施落点**（这是本批最要紧的一条，因为它是**新开的注入面**）：
`mate_app_copilot/context_envelope.py`。归并换行**不是格式化而是安全**——渲染是逐行
拼的，一个含 `\n` 的标签能**自立一行**伪造出 `[Context Protocol]` 把真约定盖掉。
用例按**行**断言（`marker.count("[Context Protocol]") == 1` 那种写法方向反了：
它会把"文本里恰好提到过这个词"也判成注入）。

**S2 的一处诚实订正**：任务前提是过时的——`OntologyDomainShell` **已经不再承载助手**
（`pageCode: 'ontology-domain'` 于 2026-09-17 移除，AI 统一走全局 Copilot），
`useOntologyAssistant` 现在**一处调用方都没有**。**没有为了交差把删掉的入口加回来**，
而是接了**真实消费方** `CopilotDock`——它此前嘴上说"已感知当前页面"、实际一个
`context` 都没发。hook 作为 ADR 形态的宿主 API 保留。

### C-3 · `MP-LEGACY-SUNSET-01`：只剩一条 Agent 主线

| 项 | 内容 |
| --- | --- |
| **判据** | ③ 只剩一条 Agent 主线；旧 copilot loop 有 **Legacy 标注与退役版本** |
| **交付** | ① 后端响应头（`e880a255`）；② 退役登记 `MP-LEGACY-SUNSET-01-AGENT-LOOP.md`；③ 集成指引改指主线；④ 会话页按钮标 Legacy（`76c3fa32`） |

退的不是"一个旧接口"，是**第二套执行真相**：

| | 旧（`chat/agent/stream`） | 新（`agent-team/runs`） |
| --- | --- | --- |
| 调度状态 | SSE 事件里（前端各自拼） | **落库的 Run**（检查点 / 事件日志 / 租约） |
| 可恢复 / 可审计 / 证据交付物 / 跨副本 | 否 | 是 |
| 契约 | **不在 OpenAPI 契约里** | 有 |

两套并存的直接后果是"Agent 在干什么"有两个互相矛盾的来源——正是平台计划 §17 第 3 条
明令禁止的。

**标记用标准头**（RFC 9745 `Deprecation` / RFC 8594 `Sunset` / RFC 8288 `Link`）外加
`X-Sunset-Version: 2.2`——平台按**发布版本**排退役节奏，只给日期说不清"哪个版本之后
没有"。标记落在**响应头**上，所以在 SSE 第一个字节之前就读得到。

**刻意保留**：`chat/completions/stream` **不**标 Legacy（平台计划 S1 工作项 3 明写
"旧 Copilot Stream 仅保留轻量直接问答"）。用例从**两个方向**钉住：旧的带标记指向
继任者、保留的不带——否则"只退旧的"是无法证伪的一句话。

### C-4 · `MP-ARTIFACT-VERSIONING-01`：Artifact 版本化

| 项 | 内容 |
| --- | --- |
| **判据** | ④ Artifact 有 `version` + `digest`；**重跑不覆盖旧版，能证明第一次交付了什么** |
| **现状（开工前）** | `artifact_store.py` 同 id `ON CONFLICT DO UPDATE` **覆盖写** |
| **交付** | 主键 → `(tenant_id, artifact_id, version)`；新增 `version` / `immutable_digest` / `provenance` / `security_classification` / `retention_policy` / `storage_uri`；`get(..., version=None)` + `list_versions()`；正文超阈值走 `storage_uri` 外移 |
| **commit** | `e40c744a` |

**语义**：同地址**同内容** = 幂等（不产生新版本，避免版本号空转）；同地址**内容变了**
= **追加**一版，旧版原样留着、按 `?version=N` 取回。

**为什么是"主键带 version"而不是"另建一张版本表"**：每一个真正描述交付的字段
（`content` / `digest` / `producer_*`）都会落到子表，父表就成了一个每次读都要 join 的
空壳。写在模块 docstring 里了。

**复用而非重复**：`producer_run` / `producer_task` 就是已有的 `run_id` / `task_id`；
`size` / `content_type` 也早就有——不换名再存一份（同一事实两个来源是本项目明令禁止的）。

### C-5 · `MP-AGENT-PROFILE-MGMT-01`：员工执行面落库 + 管理界面

| 项 | 内容 |
| --- | --- |
| **判据** | ⑤ 员工 Runtime 配置**从管理界面落库、重启后保持，且不静默切换** |
| **现状（开工前）** | `profiles.py:78` 有 `runtimes` 字段，但 `profile_store` 的 DDL/读写与 HTTP 模型**都没有**——配了 `claude_code` 的员工读回来一定回到 `superai`。前端**一处都没调用过** `/agent-team/profiles`，管理界面等于不存在 |
| **交付** | ① 列 + 迁移（`ADD COLUMN IF NOT EXISTS`）+ 两个 HTTP 模型暴露；② 契约两个 schema 同步；③ 工作台上的 `EmployeeRuntimePanel`（`ebdd32a1`） |
| **commit** | `e40c744a`（后端）/ `ebdd32a1`（界面）/ `cbccfdcf`（浏览器判据） |

「**不许静默切换 Runtime**」落在**三处**：写时未知值拒绝；HTTP 写时 **422**（陌生值与
**空数组**都拒）；库里已有脏值**读时抛**而不是回落默认。

**为什么这条要紧**：拼错的 `"claude-code"`（少个下划线）若被静默丢掉，员工会一声不响
换回 `superai`——而两个执行面的沙箱与权限假设**完全不同**（外部 CLI 拿不到本仓的
`EnvelopeGate`）。宁可让写/读当场失败，也不换一个执行面代跑。

管理界面放在**工作台**而不是新开一级菜单——本轮收敛原则是"不再新增一级菜单"，而
"谁来跑"与"跑得怎么样"是同一个工作面的两半。

### C-6 · `MP-EVAL-GOLDEN-01`：真实 Provider Golden 评测

| 项 | 内容 |
| --- | --- |
| **判据** | ⑥ Golden Dataset 在**真实 provider** 上跑出基线数字 |
| **前置确认** | 先确认 `llmgw-fallback-hardening`（#57 / `0610811a`）**真的在生效**——实测上游故障时 llmgw 回 **503 `"LLM provider unavailable; synthetic fallback is disabled"`**、整轮如实失败，**没有 `[stub-fallback]` 回显**。回显通道确实已经关上了 |
| **交付** | `eval/golden_dataset.yaml`（4 个企业任务 + 94 条**从 PG 实测导出**的 RID 真值）；`mate_tech_agent_team/eval/{dataset,trace,scorer,client,report,run_golden}.py`；CLI `python -m mate_tech_agent_team.eval.run_golden`；报告落 `eval/baseline-2026-09-18.json` |
| **commit** | `f192b8db` |

**真实基线**（4/4 任务完成，43 次真实模型轮次，16 个子任务，132 条证据，0 回显，
843s wall clock）：

| 指标 | 值 |
| --- | --- |
| 任务拆解完整率 | **1.0** |
| 任务拆解重复率 | **0.3125**（5 对重复 / 16 个子任务——重规划会重派同一个员工） |
| 工具选择正确率 | **0.4375**（模型倾向多调 `kb_search`/`search_skill`、漏 `ont_object_query`） |
| RID 正确率 | **1.0**（15 条引用 0 条编造） |
| 证据覆盖率 | **1.0** |
| 无依据陈述率 | **0.0** |
| 重放副作用重复数 | **0** |
| 敏感操作漏审率 | **0.0** |
| token | **117,830** |
| 首响应 / P95 | mean **14.4s** / P95 **323.1s** |
| 重启后结果一致率 | **not_computed**（要 `--repeat≥2` 的第二遍 14 分钟）——**不编 1.0** |

三条纪律写进数据集头：**不编平台事实**（RID 实测导出）、**不拿回显当成功**
（`assert_real_provider` 判假回执）、**算不出就说算不出**。

口径说明：拆解/工具选择/RID 三项用的是**确定性词法/集合规则**，不是 LLM judge——
为了可复现。这条 limitation 写在报告的 `notes` 里。

### C-7 · `MP-OBSERVABILITY-DEEPEN-01`：观测细化

| 项 | 内容 |
| --- | --- |
| **判据** | ⑦ Span 分层 + token / 成本可查 |
| **交付** | 新模块 `observability.py`（零依赖，一条记录一行 JSON，统一关联键 `tenant_id / run_id / task_id / trace_id / conversation_id`）；八层 `agent.run / plan / wave / subagent / llm / tool / approval / artifact`；结果面新增 tokens / `runtime_kind` / `model` / `prompt_digest` / `failure_category` / 三段延迟 |
| **commit** | `e40c744a` |

`trace_id` 进 `BrainState` **随检查点落库**，所以**重启后续跑**的记录仍带着同一个 trace
重启后同一轮的记录仍串得起来——这是它比"日志里带个进程内 id"强的地方。

**如实登记的边界（不编数字）**：

- 这是**结构化日志，不是 OTel**。本服务此前零 tracing，没有接 OTLP，**就不声称发了
  span**（`grep get_tracer` 在 src 里只命中本模块自己的注释）；
- **不给 `model_cost`**：llmgw 的回包里没有价格，算它就得编费率；
- 图层的 `conversation_id` **恒为空**——那个关系在 C-1 的运行控制面，不在本切片；
- MinIO 未接线：协议 / 阈值 / 回读路径齐且有测试替身，生产未配 = 全部内联；
- `security_classification` / `retention_policy` **只记录不强制**。

## 2. 准出对照

| # | 准出 | 结果 | 证据 |
| --- | --- | --- | --- |
| **①** | 换机器 / 清浏览器 → 会话仍看得到历史轮次的 run | ✅ **已验证** | §5.3 活栈（建 run → 清掉关系 → 只从后端读回）；§5.4 真浏览器（抹掉 localStorage 后刷新，调度面板从后端恢复，并断言真的打了 `GET /runs?conversation=`） |
| **②** | ADR-0065 转 Accepted 且有评审记录；选中对象提问 → Agent 先按 RID 查新数据 | ✅（**一半端到端未跑**，见 §3-A1） | 评审记录 `ADR-REVIEW-2026-09-18-0065.md` + ADR 头部转 Accepted；S1 渲染 + 水合约定 20 条用例（含接线）；S2 `CopilotDock` 真浏览器断言请求体带 `navigation.view`；S3 navigate 卡片 4 条浏览器用例 |
| **③** | 只剩一条 Agent 主线；旧 copilot loop 有 Legacy 标注与退役版本 | ✅ **已验证** | §5.5 活栈实取响应头；退役登记文件；用例双向钉住（旧的带标记 / 保留的不带）；会话页按钮标 Legacy |
| **④** | Artifact 有 `version` + `digest`；重跑不覆盖旧版，能证明第一次交付了什么 | ✅ **已验证** | `test_artifacts.py`：两次写 → v1+v2 且 **v1 仍可取回**（含 HTTP `?version=1`）、同内容重放不churn、迁移幂等无行丢失、租户隔离 |
| **⑤** | 员工 Runtime 配置从管理界面落库、重启后保持，且不静默切换 | ✅ **已验证** | §5.6 活栈：PUT → **重启容器** → 读回仍是 `claude_code`；陌生值 **422** 带原因；§5.4 真浏览器从界面勾选 → 保存 → 刷新后仍在 |
| **⑥** | Golden Dataset 在真实 provider 上跑出基线数字 | ✅ **已验证** | §1 C-6 的基线表 + `eval/baseline-2026-09-18.json`（`valid: true`、`fake_receipts: []`） |
| **⑦** | Span 分层 + token / 成本可查 | ⚠️ **部分**（见 §3-A2） | 八层 + 关联键 + tokens/延迟齐；**成本查不到**（llmgw 不暴露价格，不编）；**不是 OTel 导出** |
| **⑧** | 接住 2.1-B 的 A1：真集群里杀一个正在跑的 Pod → 30s 内被接管续跑 | ✅ **已验证（端到端）** | §5.7：真 kind 集群真 SIGKILL，**默认配置 t+31.1s**（epoch 1→2），**TTL=15/扫描=5 时 t+17.2s**（检查点越过基线）。**修前是 166s 零接管** |

> **准出 ⑧ 的口径**：判据是"**被接管**并继续"——接管发生了、执行继续了。
> **"续跑到底"仍未达成**，卡在 §3-A4 的 llmgw 租户绑定 403。这两件事本批**分开报**，
> 不拿前者冒充后者。

### 2.1 ⑧ 的结论：**原本跑不通 → 根因已修 → 端到端实测通过**

2.1-B 把 A1 标成"没跑过"。本批**真的去跑了**，得到的是一个比"没跑过"更重的结论：
**当时根本跑不通**。

`scripts/ci/agent_team_pod_kill_takeover.sh` 在真 kind 集群里 SIGKILL 掉持有副本的
容器进程之后（**修前**，镜像为 2.1-B 版本）：

```text
baseline lease 1-b43af53b | epoch=1 | hb=…310.3 | exp=…340.3 ; ckpt 1f1b2bda-a74d…
Phase 1: 60 polls / ~166s —— 零接管
         lease_epoch 一直是 1、heartbeat_at 冻住、checkpoint_id 冻住（早已过期）
Phase 2: kubectl rollout restart 后 +5.2s → epoch=2 | 检查点继续前进
```

**根因不是接管判据写错了**（四条件判据、原子抢租约、epoch 前进都对），而是
**`recover()` 只在进程启动时跑一次**：副本 A 被杀时，幸存的 B、C 在它们**各自的启动
时刻**已经扫过一遍，之后再也不会看。判据写着"30 秒内被接管"，而代码里**根本没有那个
30 秒内的观察者**。

**修复**（`5fd6a25e`）：

1. `RunControl.start_rescanner()`：周期性跑 `recover()`（生产默认 10s；没配
   `run_index` 时自己不开；扫不动只记日志、下个周期再试；`shutdown()` **先停扫描再拆
   任务**——反过来会把刚取消的 run 又认领回来）；
2. `configured_heartbeat_grace()`：宽限默认**跟着 TTL 走**而不是固定 30。算术理由：
   `expires_at = heartbeat_at + TTL`，过期那刻 `now − heartbeat_at` 恰好 = TTL，
   宽限 == TTL 时判据正好通过。**固定 30 在 TTL=30 时看不出来，但把 TTL 调小就反噬**
   ——想让接管更快的人会发现宽限仍压在 30，比不改还慢；
3. 两颗旋钮进 chart（`config.rescanSeconds` / `config.heartbeatGraceSeconds`，
   `4033856f`）——我引入 rescanner 时只做到了"代码里可配"，chart 里配不了，那是缺口。

**修复后端到端实测**（同一脚本、同一集群形态、真 SIGKILL）：

| 配置 | 接管时延 | 信号 |
| --- | --- | --- |
| 默认（TTL=30 / 扫描=10） | **t+31.1s** | `lease_epoch 1 → 2` |
| **调小**（TTL=15 / 扫描=5） | **t+17.2s** | 检查点越过基线（执行继续） |

```text
$ REQUIRE_TAKEOVER=1 bash scripts/ci/agent_team_pod_kill_takeover.sh
  >>> 接管发生（换手）：t+31.1s  lease_epoch 1→2
  接管：31.1（lease_epoch 1→2）    预算：30s（TTL=30s + 扫描间隔=10s 决定下限）

$ LEASE_TTL_HINT=15 RESCAN_HINT=5 REQUIRE_TAKEOVER=1 bash scripts/ci/agent_team_pod_kill_takeover.sh
  >>> 接管发生（执行继续）：t+17.2s  1f1b2c6b-… → 1f1b2c6c-…
  === POD-KILL TAKEOVER PASS（t+17.2s ≤ 30s）===
```

**口径**：默认配置落在 **31.1s，比平台判据的 30s 略高**；**达到 <30s 需要把 TTL 与
扫描一起调小**（现在是 chart 里的两个值）。这条差别如实报出来，不拿"调过之后达标"去
冒充"开箱达标"。

## 3. 边界登记（本批自己承认没做完的）

### A. 环境条件 / 未跑到的端到端

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| **A1** | ADR-0065 判据 1（**指代消解**：选中"客户A"→ 问"这个最近怎么样"→ agent 用其 RID 调 query 工具，不反问）**没有端到端跑过** | 它要一个**真实 provider** 且要被选中的行真实存在。本机 `/ontology/objects` 渲染 **0 types / 0 rows**（没有可选的记录），而模型行为不由用例控制 | 在一个本体里有真实实例的环境里，选中一行 → 提问 → 断言事件流里出现按该 RID 的 query 调用 |
| **A2** | ⑦ 的"**成本**"查不到 | llmgw 的回包里没有价格字段。**算它就得编费率**——宁可缺，不可编 | 接一个价格源（llmgw 侧的计费配置 / Provider 价目表），再把 `model_cost` 填上 |
| **A3** | C-2 S3 的 navigate 卡片目前**只在会话页**渲染（`CopilotDock` 收到了事件但不渲染卡片） | 本批范围是先让链路通；Dock 的卡片是同一组件的第二处挂载 | 把 `NavigateCard` 也挂进 Dock 的内容渲染器 |
| **A4** | ⑧ 的"**续跑完成**"仍被 llmgw 租户绑定挡住 | 实测：接管成功后 run 继续推进，但恢复出来的调用在 llmgw 报 `403 tenant binding rejected: X-Tenant-Id header is present and differs from the token tenant, but tenant switching is not enabled` | 归 `MP-MCP-TENANT-SECURITY-01`（§6-3 登记）。**"接管"与"续跑到底"是两件事**，本批验的是前者 |

### B. 本批未做（有意）

| # | 项 | 为什么 |
| --- | --- | --- |
| **B1** | ADR-0065 §7-1 的 Playwright 指代消解用例 | 见 A1 |
| **B2** | `navigation.openRecordIds` 在**点击行**时更新 | 详情浮层不同步 `?id=`，所以目前只反映深链。改 URL 同步超出本切片 |
| **B3** | C-6 `--repeat 2` 的**重启后结果一致率** | 要第二遍 14 分钟。**没跑就不给数**，写 `not_computed` 带理由 |
| **B4** | MinIO 真实接线 | 协议/阈值/回读路径齐；生产未配 = 全部内联。**测试替身刻意放在测试文件里，不放 `src`**——放 `src` 会读起来像"生产有这个存储" |
| **B5** | `security_classification` / `retention_policy` 的**强制** | 只记录不强制；执行属于后续 marking 批次 |
| **B6** | C-5 的**运维面**（多租户批量改执行面） | 管理界面按单员工改；批量是运维工具，不是产品面 |

### C. 口径订正与发现

| # | 项 | 说明 |
| --- | --- | --- |
| **C1** | **本端点的 oasdiff 覆盖是假的** | `contracts/openapi/generated/bundled.yaml` 由 `platform.yaml` 打包，而它**不含 agent-team**（全仓 `grep agent-team` 在 bundle 里**零命中**）。所以 `breaking-change` 那个 job 对 agent-team 的契约**从来没看过一眼**，本批新增的 `GET /runs` 也不在它的保护范围内。**不是本批引入的**，也**没在本批修**（那是打包结构的改动）——记在这里，因为"oasdiff 全绿"很容易被误读成"agent-team 的契约也被看着" |
| **C2** | `chat/agent/stream` **从来没进过 OpenAPI 契约** | `grep -rn "chat/agent/stream" contracts/openapi/services/` 零命中（只在 CI 生成的 `contracts/runtime/*.json` 里）。所以 C-3 的退役**没有契约改动可做**——`deprecated: true` 无处可加。**不补**（给要退的端点补契约等于续命） |
| **C3** | **Vite dev server 的 `VITE_PROXY_HOST=localhost` 是台坑** | `.claude/launch.json` 的 `mate-web` / `mate-web-verify` 两条把 host 设成 `localhost`，而 `vite.config.ts` 的默认**刻意**是 `127.0.0.1` 并在注释里写明"Windows 上 `localhost` 可能解析到 IPv6 而 Docker 在 IPv4 上发布网关，页面 API 调用会一直挂到超时"。实测：直连网关 **34ms**，经 9251 代理 **500 / 30s 超时**。已把 `mate-web-verify` 改成 `127.0.0.1`（该文件 gitignore，不影响仓库）；`mate-web` 与 `mate-rag-e2e` 两条仍是 `localhost`，**留给它们的主人** |
| **C4** | 前端 e2e 的**发送入口**：本页 `AIChatInput` 的 **Enter 热键在某些路径上不发请求** | 实测：`composer.fill(text)` + `press('Enter')` 之后 `POST /copilot/chat/agent/stream` **一次都没发出去**，页面停在输入态；换成点「发送」按钮就发。判据本身要验的是 navigate 怎么渲染，不是"回车灵不灵"——所以 `context-navigate.spec.ts` 改用发送按钮，并把这条**写给下一个读它的人**。另处 spec 用 Enter 能过，说明是路径相关的时序，不是普遍坏掉 |
| **C5** | `mate-app-copilot` 的**共享登录 helper 超时写死 30s** | 本机重载下一次 IAM 登录实测 15s、尖峰过 30s，共用 helper 会**假红**。本批的三个新 spec 各自自带放宽超时的登录（**不改共用 helper**——为一次本机尖峰放宽它的语义是把环境问题转嫁给所有人）。这条本身值得上游修，登记在 §6-4 |
| **C6** | `superai.css` 被**并发会话的 `git add` 扫进了 `ebdd32a1`** | 本批的两个工作流同时在改这个文件，我按文件 `add` 时把它那部分一起带进去了。内容是对的（CSS 都在），**没有丢东西**，但这条再次印证 `add -u` 类操作的教训——按文件 add 也可能撞上同名文件的并发写 |
| **C7** | **两个 kind 脚本按文件头的用法跑不起来**（三处，全是"照抄就炸"型） | ① 集群名不一致（multi 默认 `mate-agent-team-e2e`、pod-kill 默认 `mate-agent-team-ci`）→ 文档里那两步**必然**报 `找不到 context`；② pod-kill 选受害副本时**没筛 `status.phase=Running`**，而 `component=superbrain` 也挂在 migrate / 沙箱 probe 的 Job Pod 上 → 死 `cannot exec into a container in a completed pod`（同文件的 `run_status` 早筛了，这里漏）；③ `BUILD_IMAGE=auto` **静默复用旧镜像**。已全部修（`34375d2a`）。**这三条都是"跑一遍"才会暴露的**——脚本写完不跑，等于没写 |
| **C8** | **`BUILD_IMAGE=auto` 让我白追了一轮** | 第一次复跑 ⑧ 时 "120s 内没有接管"，差点当成"修复无效"；实际上跑的是**上一次构建的旧镜像**（`start_rescanner` 根本不在里面）。修好脚本让它**打印复用镜像的构建时刻**并显式提示 `BUILD_IMAGE=1` 之后才看清。这条与 §3-C7③ 是同一件事的两面：**验证脚本最容易骗的是跑它的人** |

## 4. 与 2.1-B 边界的关系

| 2.1-B 边界 | 本批状态 |
| --- | --- |
| **A1（判据 ⑦ 端到端未跑）** | **本批跑了**，结论比"没跑过"更重：**跑不通**（166s 零接管），根因已定位并修复，见 §2.1 |
| **建议 2（kind 脚本收进 CI）** | **本批做了**——`scripts/ci/agent_team_multi_replica.sh` + `platform-k8s-ci.yml` 的 `multi-replica` job |
| **A2（真外部 CLI 未跑）** | 本批**未动**（本机 `claude -p` 仍回 `Not logged in`） |
| **B1（B-7 长任务）** | 本批**未动** |
| **B3（MCP 协议面 / `tenant_switch_enabled`）** | 本批**未动**，仍归 `MP-MCP-TENANT-SECURITY-01`。但 §3-A4 给了它**一条新的实证输入**：恢复出来的调用就是被租户绑定拒的 |

## 5. 回归

### 5.1 13 硬规则门禁

| 门禁 | 结论 |
| --- | --- |
| ga-001 oasdiff | 契约改动均为**附加式**（新 path、新 schema、新可选字段）。**但见 §3-C1**：bundle 不含 agent-team，这个 job 对它的覆盖是名义上的 |
| ga-002 requirement IDs | `validate_contracts.py` exit 0 · `validate_traceability.py` exit 0；新增 1 个 operationId（`agentTeamGetRuns`）已登记 `FR-AGENT-TEAM-AGENTTEAMGETRUNS` |
| ga-003 forbid_raw_sql | **PASS**（新表 `conversation_run` 走 `TenantConnections.for_tenant` + 事务级 GUC） |
| ga-004 forbid_bare_httpx | **PASS**（本批没有新的外部 HTTP 调用） |
| ga-005 forbid_legacy_fallback | **PASS**。新增的默认值全部是**收窄方向**（宽限跟随 TTL、扫描间隔坏配置回默认而非 0、`runtimes` 缺省 = `[superai]` 的**存量行为不变**） |
| ga-006 ruff + pyright | `ruff check` / `ruff format --check` 全绿（agent-team 109 文件、copilot 61 文件） |
| ga-007 forbid_skip_tests | **PASS**；本批新增 114 条用例（agent-team 92 + copilot 22），**一条都不 skip** |
| ga-008 helm | chart 改了 `migration-job.yaml`（pre-install 死锁修复）；`infra/tests` 2195 passed / 5 skipped |
| ga-009 OTel | 未接真 OTLP（见 C-7 的边界）；trace_id 进状态并**随检查点落库** |
| ga-010 require_evidence | 本文件 |
| ga-011 helm-docs | 本次改的是模板、未改 values 表，README 无需动 |
| ga-012 gitleaks | 无密钥入库 |
| ga-013 NetworkPolicy | 未动 |

### 5.2 复现命令

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-app-copilot/tests -q
```

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_contracts.py && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_traceability.py
```

```bash
cd infra && PYTHONIOENCODING=utf-8 ../mate-platform-backend/.venv/Scripts/python.exe -m pytest tests -q
```

```bash
cd metaplatform-frontend/apps/web && npx vitest run && npx tsc -b --noEmit
```

```bash
cd metaplatform-frontend/apps/web && E2E_BASE_URL=http://localhost:9251 npx playwright test tests/e2e/session-run-link.spec.ts tests/e2e/employee-runtime-config.spec.ts tests/e2e/context-navigate.spec.ts --reporter=list
```

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m mate_tech_agent_team.eval.run_golden --out eval/golden-report.json --poll-interval 5 --timeout 420
```

```bash
KEEP_CLUSTER=1 bash scripts/ci/agent_team_multi_replica.sh && bash scripts/ci/agent_team_pod_kill_takeover.sh
```

### 5.3 C-1 活栈实取（后端是唯一关系源）

```text
$ curl -s -X POST "$G/api/v1/agent-team/runs" -d '{"goal":"…","conversation_id":"conv-c1-probe-…","turn_id":"turn-probe-1"}'
{"run_id":"86c0f498120f47cfa5b41bf5b22f48ca","tenant_id":"tenant-default","status":"running","deduplicated":false}

$ curl -s "$G/api/v1/agent-team/runs?conversation=conv-c1-probe-…"     # 全程不碰任何浏览器状态
{"conversation_id":"conv-c1-probe-…","items":[{
  "run_id":"86c0f498120f47cfa5b41bf5b22f48ca","turn_id":"turn-probe-1",
  "created_by":"e94348e4-9bbd-4fcb-a767-149af3090453","relation_type":"initiated",
  "created_at":"2026-09-18T01:03:20.391601+08:00","status":"running","goal":"…"}]}
```

`created_by` 取自令牌的 `sub`（不是请求体）；`status` 是**此刻**从该轮自己的检查点读的。

### 5.4 真浏览器实取（3 个新 spec，6 条）

```text
$ E2E_BASE_URL=http://localhost:9251 npx playwright test tests/e2e/session-run-link.spec.ts --reporter=list
1 passed (8.8s)      ← ①：抹掉 mp-agent-team-run:* → 刷新 → 面板从后端恢复

$ E2E_BASE_URL=http://localhost:9251 npx playwright test tests/e2e/employee-runtime-config.spec.ts --reporter=list
1 passed (4.2s)      ← ⑤：界面勾选 → 保存（真的发了 PUT 且 200）→ 刷新仍在

$ E2E_BASE_URL=http://localhost:9251 npx playwright test tests/e2e/context-navigate.spec.ts --reporter=list
4 passed (14.2s)     ← ②S3+R4：合规路径可点击且点击跳转；javascript: / //evil.com 零可点击元素；
                       CopilotDock 请求体带 navigation.view === 'ontology-objects'
```

### 5.5 C-3 活栈实取（Legacy 头）

```text
$ curl -D - -o /dev/null -X POST "$G/api/v1/copilot/chat/agent/stream" -d '{"messages":[…]}'
HTTP/1.1 200 OK
deprecation: true
sunset: Thu, 31 Dec 2026 23:59:59 GMT
link: </api/v1/agent-team/runs>; rel="successor-version"
x-sunset-version: 2.2
x-migrated-to: /api/v1/agent-team/runs
```

### 5.6 C-5 活栈实取（落库 + 重启保持 + 拒绝陌生值）

```text
$ curl "$G/profiles/EMP-SMOKE-1"                       → runtimes: ["superai"]
$ curl -X PUT … -d '{…,"runtimes":["superai","claude_code"]}'
                                                        → saved: EMP-SMOKE-1 ["superai","claude_code"]
$ docker restart mate-tech-agent-team && sleep 25
$ curl "$G/profiles/EMP-SMOKE-1"                       → persisted runtimes: ["superai","claude_code"]
$ curl -X PUT … -d '{…,"runtimes":["claude-code"]}'     → HTTP 422
  {"detail":[{"msg":"Value error, 未知的执行面：'claude-code'（可选：superai、claude_code、external_a2a）"}]}
```

（另：`runtimes` 列在活库上的建出由启动 `bootstrap` 完成，实测
`information_schema.columns` 从"无此列"变为存在。）

### 5.7 ⑧ 端到端复跑

```text
# 先把多副本环境装起来（本批把这一步收进了 CI，见 §4）
$ BUILD_IMAGE=1 KEEP_CLUSTER=1 bash scripts/ci/agent_team_multi_replica.sh
readyReplicas=3（期望 3）
superbrain Pod 数=3（只数 Running；Terminating / Completed 不算）
  …-9ng2z /healthz -> 200    …-pg9nf /healthz -> 200    …-phrdq /healthz -> 200
迁移 Job succeeded=1
=== AGENT-TEAM MULTI-REPLICA PASS：3 副本全部 Ready 且各自 /healthz 200 ===

# 确认跑起来的镜像**真的含本批的修复**（这一步是被 §3-C8 教会的，别省）
$ kubectl … exec … python -c "…"
has start_rescanner: True
grace: 30.0 ttl: 30.0 rescan: 10.0

# ⑧：真 SIGKILL + 观察
$ REQUIRE_TAKEOVER=1 bash scripts/ci/agent_team_pod_kill_takeover.sh
=== 5. 阶段 1：SIGKILL 掉 …-d6kl2 里的应用进程（模拟节点故障 / OOM） ===
  t+28.3s  lease=[1-884956e6|1|…989.3|…1019.3|]  ckpt=1f1b2c54-ceb6-6223-8000-1ebf17a86a16
  >>> 接管发生（换手）：t+31.1s  lease_epoch 1→2
  接管：31.1（lease_epoch 1→2）
  ERROR: 接管发生但超预算：t+31.1s > 30s        ← 默认配置略超预算，如实报

$ LEASE_TTL_HINT=15 RESCAN_HINT=5 REQUIRE_TAKEOVER=1 bash scripts/ci/agent_team_pod_kill_takeover.sh
  t+14.4s  lease=[1-cc55fe02|1|…205.8|…220.8|]  ckpt=1f1b2c6b-c6be-6f73-8000-15809d17a8b0
  >>> 接管发生（执行继续）：t+17.2s  1f1b2c6b-… → 1f1b2c6c-…
  接管：17.2（检查点越过基线（执行继续））
  预算：30s（TTL=15s + 扫描间隔=5s 决定下限）
=== POD-KILL TAKEOVER PASS（t+17.2s ≤ 30s）===
```

**两次实测的最终 run 状态都是 `failed`**，原因同一个（§3-A4）：

```text
"error":"llmgw returned 403: … tenant binding rejected: X-Tenant-Id header is present
 and differs from the token tenant, but tenant switching is not enabled for this caller"
```

即：**接管成立、执行继续成立**；被接管的那一轮**跑到 llmgw 那一步被租户绑定拒掉**。
这与 §3-A4 登记的是同一条，本批不在范围里修。

### 5.8 提交

| commit | 内容 |
| --- | --- |
| `f44c0074` | C-1 会话 ↔ run 落后端（后端） |
| `27e816fe` | C-1 前端降级为缓存 |
| `77f5d4f3` | C-1 浏览器判据 |
| `76df738c` | C-2 前置：ADR-0065 评审转 Accepted + R1–R4 |
| `02221bf8` | C-2 S1 分层信封 + 消毒渲染 + 水合约定 |
| `e880a255` | C-3 旧 Agent loop 标 Legacy + 退役登记 |
| `ebdd32a1` | C-5 执行面管理界面 + C-3 集成指引改指主线 |
| `e40c744a` | C-4 / C-5 / C-7（Artifact 版本化 + runtimes 落库 + 可观测细化） |
| `cbccfdcf` | C-5 浏览器判据 |
| `993d6459` | C-2 S2 + S3（含 R4 白名单） |
| `f192b8db` | C-6 Golden 评测 + 基线 |
| `8d2b4d0c` | 多副本 kind 收进 CI + pre-install 死锁修复 |
| `5fd6a25e` | 周期接管扫描 + 心跳宽限跟随 TTL（⑧ 根因） |
| `76c3fa32` | 会话页旧入口标 Legacy |
| `34375d2a` | 两个 kind 脚本按文档跑不起来的三处 |
| `4033856f` | 接管时延旋钮进 chart + pod-kill 脚本变成可判的门 |
| `1304b8ad` | 本文件（首次落档） |
| `2bee5bae` | CI 抓到的第 1 条：golden 基线 JSON 过 prettier |
| `6e040a95` | CI 抓到的第 2 条：多副本 job 的镜像灌入要先确保本地有 |

共 **20 个 commit**（含本文件），**75 个文件**（+10969 / −258）。

### 5.9 CI 实跑（PR #63）

**13 条硬规则门禁全绿**：`ga-001 oasdiff` / `ga-002 requirement IDs` / `ga-003 forbid_raw_sql` /
`ga-004 forbid_bare_httpx` / `ga-005 forbid_legacy_fallback` / `ga-006 ruff + pyright strict` /
`ga-007 forbid_skip_tests` / `ga-008 helm lint + kubeconform` / `ga-009 OTel collector smoke` /
`ga-010 require_evidence` / `ga-011 helm-docs --dry-run` / `ga-012 gitleaks` /
`ga-013 NetworkPolicy coverage` / `ga-014 Ontology PostgreSQL RLS isolation`。

其余 required 同样全绿：`agent-team pytest` / `pyright strict` / `Lint (ruff)` /
`Frontend` / `Validate compose + Dockerfiles` / `lint-and-bundle` / `traceability` /
`runtime-parity` / `breaking-change` / `ga tests` / `ga format (pre-commit)`。
`mergeStateStatus = UNSTABLE`（不是 `BLOCKED`）——即 required 全过，挂着的都是非 required。

**本批新增的 CI job 也真的跑起来了**：

```text
SUCCESS   agent-team 3 replicas actually come up (kind)   3m24s
```

这是 2.1-B 建议 2 的**闭环**：以前"真的起得来多副本"是手敲的结论，现在它是 CI 里
一条会红的判据。它第一次跑**就抓到一条只在新环境显形的问题**（见下），这正是把它
收进 CI 的价值。

**CI 抓到的两条真问题（都是本批引入的，都已修）**：

| # | 症状 | 根因 | 修 |
| --- | --- | --- | --- |
| 1 | `ga format (pre-commit)` 红：prettier `files were modified by this hook` | `eval/baseline-2026-09-18.json` 没过 prettier（**只这一个文件**；同 job 其余 20+ 钩子全 Passed） | 重排该 JSON（`2bee5bae`）。语义不变，`json.load` 后 11 项指标俱在 |
| 2 | 新 job `agent-team 3 replicas…` 红：`reference does not exist` → `ctr: unrecognized image format` | `load_image_into_node` 直接 `docker save`，而 **CI runner 上没有任何预装镜像**（`postgres:16-alpine` 本地不存在）。本地开发机有这个镜像，所以本地两次实跑都过 | save 前先 `docker image inspect`，没有就 `docker pull`（`6e040a95`） |

> **本地检查的一处假阳性（记下来免得下次被吓到）**：Windows 工作树里那两个新增
> YAML（`agent-team.yaml` / `golden_dataset.yaml`）本地跑 prettier 也会报不通过，
> 但那是 **CRLF** 造成的——把 `git show HEAD:<file>`（LF）拿出来跑，两个都是
> "All matched files use Prettier code style"。**别按本地的报错去重排契约文件**，
> 那会造出一份整文件级别的假 diff。

**非 required 的预存红（9 条，逐条核过，没有一条由本批引入）**：

| job | 根因（出处） |
| --- | --- |
| `Architecture kernel governance` | pyright strict 预存债，2.1-A §4-B7 已量过（`continue-on-error: true`） |
| `Static chart checks (Python + YAML)` | `infra/tests` 缺 `sqlalchemy`，workflow 头部自己登记过 |
| `helm-unittest` | 卡在**装插件**（`requested version "0.7.2" does not exist`），chart 一个都没跑 |
| `helm template + kubeconform` | 6 条 `could not find schema` 全来自他 chart 的 CRD；汇总行 `Invalid: 0` |
| `helm-docs sync` | helm-docs 下载源失效 |
| `kind cluster helm install + smoke` | 装的是 **keycloak 的 CRD**，而它要的 `metaplatform` 命名空间还没建 |
| `boot ontology-loop stack` / `playwright ontology-loop e2e` | `.env.local not found`（CI 环境变量缺失） |
| `cowork md-lint (pymarkdownlnt)` | 既有的 md-lint 债（见 `ci-preexisting-red-checks` 登记） |

以上九条与 2.1-B §5.7 的登记表**逐条对得上**（`cowork md-lint` 见 2.1-A/跟进批的登记）。
判断"是登记债还是新回归"的三条查法沿用 2.1-B（先看 `continue-on-error`、再看
合并前的 `main` 上红不红、最后核因果），本批按这三条核过。

## 6. 遗留与建议

1. **验收证据文件本身**（本文件）要随批提交。
2. **§3-A4（恢复出来的调用被 llmgw 租户绑定拒）是本批最该接着查的一条**：现在
   "接管"成立、"续跑到底"不成立，中间就差这一步。建议并入
   `MP-MCP-TENANT-SECURITY-01`，并把本批 §5.7 的实测记录当输入带过去——它给那条
   批次提供了**第一条生产形态的实证**（不是构造出来的，是故障恢复路径上真撞的）。
3. **默认配置 31.1s 略超 30s 预算**：想要开箱达标，得把 chart 的
   `leaseTtlSeconds` / `rescanSeconds` 调小（实测 TTL=15/扫描=5 → 17.2s）。**要不要
   把默认值调小是个取舍**——TTL 越小，"活的但慢"的副本被误接管的风险越高。建议由
   `MP-STAGING-GATE-01` 在真实负载下定，别拍脑袋改默认。
4. **§3-C1（agent-team 不在 oasdiff bundle 里）值得单独收口**：现在
   `breaking-change` 这条 job 对本服务是**名义覆盖**。要么把 agent-team 的 path
   并进 `platform.yaml`，要么如实把这条 job 的覆盖面写进它的名字里。
5. **§3-C5（共用登录 helper 超时写死 30s）建议上游修**：改成可配（环境变量），而不是
   让每个受影响的 spec 各抄一份。本批有三个 spec 抄了同一段。
6. **pod-kill 脚本目前**不能**直接进 CI**：它需要宿主机那套 compose 全栈（llmgw /
   MCP / Ontology）从集群里可达。本批交付的是**可重复的脚本 + 可判的门**
   （`REQUIRE_TAKEOVER=1`），进 CI 的条件是"环境里有那套全栈"（staging 起来之后）。
   `multi_replica.sh` 那条**已经进 CI**了（它不需要全栈）。
7. **`MP-REPLICA-READINESS-01` 的 kind job 首次 CI 实跑还没发生**（本机没有 runner）
   ——本地实跑通过两次，CI 侧待观察。
8. **C-6 的重启后结果一致率**：`--repeat 2` 的第二遍 14 分钟没跑。它是"重启后行为
   一致"的唯一直接读数，建议下一批补。
9. **平台季度计划未落档**：`MetaPlatform-调整优化方案执行计划-2026-09-17.md` 是维护者的
   在途文档，本批**只挂靠不改、也没提交它**。本批引用的量化准出（接管 30s、取消 10s、
   p95 等）**数值只在那一份里定义**，本文件不重定义；§2.1 与 §5.7 只报**本批实测到的**
   那一部分。
10. **roadmap §8.3 的 2.1-C 行仍是「🟡 已规划，待开工」** —— **本批没有改**。
    `docs/active/specs/2026-09-17-agent-product-layer-2.1-roadmap.md` 在当前工作树里有
    **另一个会话未提交的改动**（68 插入 / 10 删除），改它就等于把别人的在途工作一起
    提交进去。按 2.1-B 对平台计划用的同一条纪律处理：**留给它的主人**，本文件在此
    登记这处待同步。
