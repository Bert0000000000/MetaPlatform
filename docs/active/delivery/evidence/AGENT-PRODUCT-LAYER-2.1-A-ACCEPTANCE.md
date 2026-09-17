# AGENT-PRODUCT-LAYER-2.1-A · 验收证据

> **日期**：2026-09-17 · **分支**：`feat/agent-product-layer-2.1-a` · **基线**：`origin/main` = `24976a4c`
> **目标**：把五条生产性质从「机制存在」变成「有判据、可复现、能拦住」。
> **上游**：`docs/active/specs/2026-09-17-agent-product-layer-2.1-roadmap.md`（§2.1-A 七条）、
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md`（平台级量化准出，本文件只引用不重定义）、
> ADR-0067（运行期委托身份）、ADR-0066（Agent Team 角色/执行面）
> **对外批次号**：`MP-AGENT-SANDBOX-ISOLATION-01` / `MP-AUDIT-LEDGER-01` /
> `MP-RUN-DELEGATED-IDENTITY-01` / `MP-TOOL-IDEMPOTENCY-01` / `MP-AGENT-VERSIONING-01` /
> `MP-MAIN-GATE-01` / `MP-FEATURE-REGISTRY-01`

本批**不扩功能面**：没有新员工类型、没有新图节点、没有新编排能力。
七条各自的判据、交付与出处见 §1；五条准出对照见 §2；**没做完的**见 §4。

## 0. 测试基线 → 最终

| 项 | 值 |
| --- | --- |
| 开工基线（`packages/mate-tech-agent-team/tests`，`main` = `24976a4c`） | **357 passed / 0 skipped** |
| 最终（同套件） | **415 passed / 0 skipped** |
| 附加套件（`packages/mate-clients/tests`，A-2 动了它的 ACL 包） | **57 passed** |
| 差异 | **+58**（只升不降，无 skipped） |

命令与原始输出见 §5.2。

## 1. 七条逐条

每条写：**判据 → 交付 → 可复现的证据**。判据用「可复现的动作 + 断言的量」表述，
不用「已支持 / 已加固」这类无法证伪的说法。

### A-4 · `MP-AGENT-SANDBOX-ISOLATION-01`：外部 Runtime 环境变量白名单

| 项 | 内容 |
| --- | --- |
| **判据** | 起一次真子进程，断言它的 `os.environ` **不含** DB DSN / Service Secret / Keycloak 配置；`{**os.environ, ...}` 这个构造在源码里被替换 |
| **交付** | 新增 `runtimes/sandbox_env.py`（唯一构造入口：白名单进、其余全出；凭据类名字**硬否决**）；`ClaudeCodeRuntime._invoke` 改用 `child_env()`；`wiring` 启动期校验运维追加的白名单 |
| **证据** | `tests/test_sandbox_isolation.py`（9 条）：桩 CLI 把子进程的 env 原样落盘 → 按**名字**与**值**双断言；AST 级断言源码里不再有 `{**os.environ}` |
| **commit** | `276fa463` |

**如实登记两条**：① 白名单里放了 `PYTHONIOENCODING`——它是编码提示不是凭据，父进程按
utf-8 解码回执，不放它中文会被打碎（POSIX 上同理由 `LANG`/`LC_ALL` 承担）；
② 租户工作区目录**只做归属**，不是安全边界（写进了 `workspace_for` 的注释），
真正的墙是「拿不到宿主凭据」+ B-8 的独立 Job。

### A-1 · `MP-AUDIT-LEDGER-01`：持久、可取证、带哈希链的审计

| 项 | 内容 |
| --- | --- |
| **判据** | 重启后可查；多副本合并成**一条**链；改一行/删一行/换一次序都能被哈希链指出断在哪；跨租户查询被拒 |
| **交付** | `audit.py` 重做：`PgAuditLedger`（新表 `agent_team.audit_events`，RLS + **只授 SELECT/INSERT**）+ 按租户哈希链（`pg_advisory_xact_lock` 串行化成链）；`records()` 的 `tenant_id` 改为**必填关键字参数**；投递复用平台既有 Outbox |
| **证据** | `tests/test_audit_ledger.py`（16 条，含 5 条 PG/RLS）；契约 `AuditRecord` 附加式补字段 |
| **commit** | `b6bb6899` |

### A-2 · `MP-RUN-DELEGATED-IDENTITY-01`：运行期委托身份（**先出 ADR**）

| 项 | 内容 |
| --- | --- |
| **判据** | 续跑以**用户身份**过 llmgw / MCP；权限撤销后旧 run 不能扩权；快照断言原始 Bearer 零落库 |
| **前置** | **ADR-0067** 先落地（2.0 的 B-1 写明「动这两处之前要先有 ADR」）——`b5d5d047` |
| **交付** | 快照补归属字段 + `attenuate()`（`委托 ⊆ 快照 ⊆ 当前权限`）；`delegated_identity.py` 的签发面（Keycloak token exchange，换回的令牌超出快照/租户不符/换不到 → **拒签**）；续跑路径接线，签不出就 `user_token=""` + 可读原因，**绝不退回服务身份** |
| **证据** | `tests/test_delegated_identity.py`（14 条，含两条端到端续跑）；ACL 客户端 `mate_clients.iam.token_exchange` |
| **commit** | `7af54ffc`、`0edfdeaf`（rule 4 整改） |

### A-3 · `MP-TOOL-IDEMPOTENCY-01`：工具调用级幂等账本

| 项 | 内容 |
| --- | --- |
| **判据** | 在工具执行的**任意时刻** kill 进程 → 恢复后业务副作用**最多一次**（带计数的假外部系统作桩，断言计数 ≤ 1） |
| **交付** | `tool_ledger.py`：**执行前**先落 `running` 意图；幂等键固定 `run_id + task_id + tool_call_id`（`tool_call_id = sha256(工具名 + 规范化参数)`，不是框架那枚随轮次变化的随机 id）；`completed` 回放、`running` **不重跑**、`failed` 允许重试 |
| **证据** | `tests/test_tool_ledger.py`（10 条，含 4 条 PG：跨重启、跨副本只一个执行） |
| **commit** | `74766fca` |

### A-6 · `MP-AGENT-VERSIONING-01`：State / Graph / 员工定义版本化

| 项 | 内容 |
| --- | --- |
| **判据** | 旧 checkpoint 读得出；恢复后结果一致；**Run 中途改员工定义，本轮行为不变** |
| **交付** | `versioning.py`：四个版本号随 run 落检查点；`AgentProfileSnapshot` 在**计划期**把员工定义拍成不可变快照（含提示词正文 + 摘要），运行时与路由**只**从快照读 |
| **证据** | `tests/test_versioning.py`（9 条，含「中途改定义」与「被杀后续跑结果逐字相同」两条端到端） |
| **commit** | `e9d4b181` |

**为什么拍在计划期**：续跑会**重新派活**（要再过一次闸门）。派活时才拍 = 每次续跑都用
"当下的定义"，那正是本条要治的。

### A-5 · `MP-MAIN-GATE-01`：门禁收口

| 项 | 内容 |
| --- | --- |
| **判据** | 格式红灯**照样拦合并**，但功能验收的结论**一定拿得到**（不再"因为前面红了所以没跑"）；修掉 `main` 当前那道红 |
| **现状（`main` `24976a4c` 实取）** | ga-acceptance 里只有一个 job，格式检查是它的**第一个 step**——Prettier 一红，后面 4 个 step（含 `mate-platform/tests`）全部 `skipped` |
| **交付** | 拆成 `ga-format` 与 `ga-tests`（**无 needs 依赖**）；去掉两个工作流的 `pull_request.paths`（否则 required check 永远停在 "Expected — Waiting"）；新增 `.github/CODEOWNERS`；修 `CLAUDE.md` 的 Prettier |
| **证据** | §5.3 的 CI 实跑 + §5.4 的探针 |
| **commit** | `5b7f5527` |

### A-7 · `MP-FEATURE-REGISTRY-01`：文档与版本口径订正

| 项 | 内容 |
| --- | --- |
| **判据** | 三处 Sprint 1A 说法与 `git log` / 验收证据对得上；版本号不再是 `0.1.0`、不再写「1.0」 |
| **订正的事实** | M1/M2/M3 三份 ACCEPTANCE 在 `main` 上（2026-09-07~08），代码也在 —— **引擎接入已交付并 Accepted；切流未做**（`WORKFLOW_ENGINE` 默认 `legacy`，双轨并存）。`CLAUDE.md:6` 与 `architecture-implementation.md:12/167/853` 原来写的「尚未完成 / Not Started」**与事实不符** |
| **交付** | 三处口径统一 + `V1.0-RELEASE-PLAN.md` 补注「Accepted 指接入不是切流」；`pyproject` `0.1.0 → 2.1.0`、描述不再写 1.0，`main.py` / 契约 / Dockerfile / README 同步；`CLAUDE.md` 增「版本口径」表 |
| **commit** | `8ed8f428` |

## 2. 五条准出对照

| # | 准出（本批自定） | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 进程在工具执行任意时刻被 kill → 恢复后业务副作用最多一次 | ✅ | `test_tool_ledger.py`（计数桩，断言 ≤ 1；PG 版跨重启复验） |
| 2 | 用户权限被撤销 → 旧 Run 不能继续扩权执行 | ✅（机制 + 断言） | `attenuate()` 三条 + 「换回令牌超出快照即拒」+ 「撤空 → 拒签且不退回服务身份」 |
| 3 | 任何审批 → 重启后仍可查完整记录（可取证、可检篡改） | ✅ | `test_audit_ledger.py`：重启后同批行 + 篡改断链 + RLS 拒跨租户 |
| 4 | 外部 CLI 子进程 → 看不到任何宿主凭据 | ✅ | `test_sandbox_isolation.py`：真子进程 env 按名按值双断言 |
| 5 | `main` → 连续 10 次合并全部 required check 通过 | ⏳ **不可能在本会话内完成** | 见 §4-B1：需要本 PR 先合并、再观察 10 次真实合并。本批给出的是**这条性质成立的前提**（拆分 + 去 paths 过滤 + 修红），不是它本身 |

> **与平台计划的关系**：平台计划的量化准出（`POST /runs` p95 < 500ms、SSE 首事件
> p95 < 1s、3 副本无双重认领、30s 接管…）**只在那一份里定义**，本文件不重定义、
> 也不声称达成。本批只对 §2 这五条负责。

## 3. 与 2.0 边界表的关系

2.0 的 §3 边界表是**已登记取舍**，不是本批的新账。本批动了其中三条，逐条说明：

| 2.0 边界 | 本批状态 |
| --- | --- |
| **B-1 续跑没有用户令牌** | **本批做了机制与判据**（A-2 + ADR-0067）。真实 token exchange 需要 IdP 侧配置 —— 见 §4-A1 |
| **B-10 `tenant_switch_enabled` 待复核** | **本批不立项**（归 `MP-MCP-TENANT-SECURITY-01`），但 A-2 动了 MCP 协议面的取数路径，所以**连带复核**了 —— 见 §4-C1 |
| **B-4 认领靠 TTL 兜硬崩** | 未动（2.1-B / `MP-RUN-LEASE-01`） |
| 其余 10 条 | 未动，原样保留在 2.0 验收 §3 |

## 4. 边界登记（本批自己承认没做完的）

### A. 环境条件（不是代码缺口）

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| **A1** | A-2 的 token exchange **端到端未跑** | 本机 Keycloak 没配该 client 的 token-exchange 权限，起不了真实交换。已验的是**代码路径与全部负例**：换回的令牌超出快照/租户不符/换不到/无主体 → 四种拒绝都有断言 | 在一台把 exchange 权限配好的环境跑一次真交换（同 2.0 的 B-6：环境条件，不是代码缺口） |
| **A2** | A-4 的**远端形态**（K8s Job）未做 | 本批只做近端 subprocess 层；远端是 2.1-B 的 `MP-AGENT-SANDBOX-ISOLATION-01`（Job 部分） | 与 A-4**同一套断言**换到 Job 里跑（白名单模块已经抽出来了，就是为了这个） |

### B. 门禁（受权限与本仓形态限制）

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| **B1** | 「连续 10 次合并 required 全绿」**未达** | 它是**观察性判据**：需要本 PR 先合并，再看之后 10 次真实合并。本批交付的是它的**前提**（拆分 + 去 paths 过滤 + 修红 + CODEOWNERS） | 本 PR 合并后连续观察 10 次；任一次 required 红即为此判据不成立 |
| **B2** | required check 收紧：本次只加了**已验证在 `main` 上绿**的那些 | 把一个当前红的 job 设为 required = 立刻冻结所有合并。`main` 上 `ga pre-commit + infra pytest + mate-platform pytest` 是红的（本批已拆开并修绿，但**要先合并**才生效） | 本 PR 合并后把 `ga-format` 与 `ga-tests` 加进 required（命令见 §5.5） |
| **B3** | CODEOWNERS 只**立归属**，没开「≥1 / ≥2 approve」规则 | 本仓只有**一个** collaborator（`Bert0000000000`）。GitHub 不允许作者批自己的 PR —— 开了 required review，**所有 PR 立刻不可合并**（包括人自己开的） | 加第二个评审人 / bot 账号后，再开规则集：普通路径 1 个、敏感路径 2 个（CODEOWNERS 已把敏感档分好） |
| **B4** | 前端**单测**没进 required | `apps/web` 有一条**预存红**（`ProposalConfirmDrawer.test.tsx`，本批未触及）。把带预存红的套件设成 required = 冻结合并 | 修掉那条预存红（平台计划 Sprint 0 的 `MP-QA-BASELINE-01`）后把 `pnpm test:unit` 加进去 |
| **B5** | `test_recovery.py::test_list_unfinished_reads_the_checkpoint_table_by_status` **在本批的某一次 CI 上红过一次**，本机连跑 3 次 + 后续 CI 均绿 | **判定为既有 flaky**（PG 共享 schema 的用例互相干扰：那条断言写的是"扫描结果 == `[]`"，隐含"这个 schema 里只有我这一轮"。它**不是本批引入的**——同一用例在本批早一轮 CI（head `5b7f5527`，已含 A-1/A-2/A-3/A-6 全部改动）是绿的 | 断言改成"按 `run_id` 过滤后再比"，别假设 schema 里只有自己。归 `MP-QA-BASELINE-01`（与 B4 同一处收口） |
| **B6** | `cowork md-lint (pymarkdownlnt)` 红（**非 required**） | 它只查 `docs/active/specs` 与 `docs/active/delivery/evidence` 下**变更的** .md，只关掉了 md013/md041。本批落档的 2.1 路线图被 MD004（它期望无序列表用 `+`、本仓文档一律用 `-`）/MD024/MD025 判红；`architecture-implementation.md` 的 MD031/MD040 在**我没碰的** 491/577 行（预存） | 两件事要分开定：① 是本仓文档改用 `+`，还是把 MD004 关掉——这是**风格决策**，不该由本批顺手改掉几十处列表；② 491/577 行的围栏补语言与空行属预存格式债。归 `MP-QA-BASELINE-01` |
| **B7** | `Architecture kernel governance` 红（**非 required**） | **`main` 上就是红的**（`24976a4c` 的同一 job 同为 failure），本批未触及 | 预存债，非本批引入 |

### C. 复核与建议

| # | 项 | 结论 |
| --- | --- | --- |
| **C1** | **`tenant_switch_enabled` 连带复核**（ADR-0067 §8 的要求） | **复核通过（维持现状，不放松）**。三条依据：① 本批**没有**动任何 realm / Keycloak 配置（`git diff --name-only` 里无 `infra/keycloak/**`、无 realm 文件）；② A-2 给 MCP 协议面新增的是**收窄**：换回的令牌要过「包络 ⊆ 快照」与「租户必须等于快照租户」两道判，`_protocol_connection` 仍然**不带** `X-Tenant-Id`（租户由令牌唯一决定）；③ 该 scope 的共享-client 代价（任何持有共享密钥者显式申请即可代任意租户）**未被本批改变**，仍归 `MP-MCP-TENANT-SECURITY-01` |
| **C2** | 动 MCP 协议面时**连带复核 B-10** | 已做（C1）。**下次再动 MCP 协议面/取数路径时要重做这一条**，不要因为"有专门批次"就跳过 |
| **C3** | `ProfileStore` 加 `revision` 列 | 本批的 `revision` 取**定义内容摘要**（与存储无关），所以没动表。做成"库里的自增修订号"是 2.1-C 的 C-5，届时两者要对齐（摘要仍应保留——它能在没查库时判"定义变没变"） |
| **C4** | A-3 的 `at-most-once` 语义 | 「工具执行中」的窗口里选择**不重跑**，代价是那条**可能一次都没发生**。这是 at-most-once 的定义而非妥协；要 exactly-once 得让下游按 `invocation_id` 幂等（2.1-B 的接管条件里再谈） |
| **C5** | A-6 的快照没含 skill **正文**摘要 | 快照记的是 skill **id 列表**；skill 正文在 SkillHub（自带版本）。若将来要求"skill 正文也随 run 冻结"，需要把正文摘要一并拍进快照 |

## 5. 回归

### 5.1 13 硬规则门禁

| 门禁 | 结论 |
| --- | --- |
| ga-001 oasdiff | 契约**附加式**改动（新增可选字段 + 一个 enum 值 + `info.version`），无破坏性变更 |
| ga-002 requirement IDs | `lint-and-bundle` / `traceability` / `runtime-parity` 全绿；**无新增 operationId** → `REQUIREMENT-MATRIX.yaml` 不需要动 |
| ga-003 forbid_raw_sql | 新表访问全部走既有 `_conn(tenant_id)` + GUC 写法 |
| ga-004 forbid_bare_httpx | ✅ **本批自己撞过一次并改对**：token exchange 起初直连 httpx，已收进 `mate_clients.iam.token_exchange`（ACL 层）；见 §5.4 |
| ga-005 forbid_legacy_fallback | 无 fallback 引入；A-2/A-6 的"读不出来就取默认"都是**收窄方向** |
| ga-006 ruff + pyright | ruff check 全后端绿（pyright strict 是**预存**的 `continue-on-error` 项，未触及） |
| ga-007 forbid_skip_tests | 本批新增 58 条用例，`0 skipped` |
| ga-008 helm | 未触及 |
| ga-009 OTel | 未触及 |
| ga-010 require_evidence | 本文件 |
| ga-011 helm-docs | 未触及 |
| ga-012 gitleaks | 无密钥入库；测试里的凭据样貌全是**探针值**（拼接字符串，不用私钥头） |
| ga-013 NetworkPolicy | 未触及 |

### 5.2 复现命令

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-clients/tests -q
```

契约：

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_contracts.py && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_traceability.py
```

### 5.3 提交

| commit | 内容 |
| --- | --- |
| `276fa463` | A-4 外部 Runtime 子进程改用环境变量白名单 |
| `b6bb6899` | A-1 审计落持久账本 + 按租户哈希链 |
| `b5d5d047` | ADR-0067 运行期委托身份（A-2 的硬前置） |
| `7af54ffc` | A-2 Keycloak token exchange + 续跑接线 |
| `74766fca` | A-3 工具调用级幂等账本 |
| `e9d4b181` | A-6 状态/图/员工定义版本化 + 不可变快照 |
| `8ed8f428` | A-7 Sprint 1A 口径订正 + 服务版本对齐 |
| `5b7f5527` | A-5 格式/功能 job 拆分 + CODEOWNERS + 修 CLAUDE.md Prettier |
| `0edfdeaf` | rule 4 整改（token exchange 收进 ACL）+ 清预存行尾空白 |
| `9408d166` | 清 17 个前端文件的行尾空白（纯空白，`git diff -w` 为空） |
| `77d40fac` → `7d3cf222` | 临时探针 → revert（§5.4 ③） |

PR：[#59](https://github.com/Bert0000000000/MetaPlatform/pull/59)。

### 5.4 CI 实跑：门禁真的报了该报的东西

**① 拆分后的第一轮**（head `5b7f5527`）—— 判据当场成立：

| job | 结果 |
| --- | --- |
| `ga format (pre-commit: …)` | **failure** |
| `ga tests (infra + mate-platform + mate-app-kb + governance)` | **success**（**不是 skipped**） |
| `agent-team pytest (mate-tech-agent-team)` | **success** |

同一个 job 里"格式在前、功能在后"时，后两条会被整体跳过（`main` 上
`mate-platform/tests` **从未跑过**就是这个原因）。

**② 它报出的两条真问题**（都修了）：

| # | 问题 | 处置 |
| --- | --- | --- |
| 1 | **rule 4 违规 —— 本批自己引入的**：`delegated_identity.py` 直接 `httpx.AsyncClient` 打 Keycloak | 收进 ACL 层 `mate_clients.iam.token_exchange`（`0edfdeaf`） |
| 2 | `trailing-whitespace`：17 个前端文件（25 行）行尾空格 | 纯空白清理（`9408d166`，`git diff -w` 为空）。另有 2 个 docs 文件只在 Windows 工作树里带 CRLF、blob 是干净的 → **没动** |

> **结论**：门禁不是装饰 —— 它在本批**自己的**代码上抓到了硬规则违规。

**③ 临时探针**（1.6 的做法：探针 → 验证 → revert；`77d40fac` → `7d3cf222`）
—— 故意放一个写坏的 markdown 表格，验证拆分**可复现**而不是碰巧：

| job | 结果（run `35216730592`） |
| --- | --- |
| `ga format (pre-commit: rules 3 / 4 / 5 / 7 / 10 / 12)` | **failure** |
| `ga tests (infra + mate-platform + mate-app-kb + governance)` | **success** |
| `agent-team pytest (mate-tech-agent-team)` | **success** |

**④ 去探针后全绿**（head `7d3cf222` / 最终 `832c7a74`）：`ga-acceptance` 的
**19 个 job 全 success**；**9 条 required check 全 pass**（`gh pr checks 59` 实取：

```text
Architecture tests (import-linter + four-layer guardrails)  pass
Frontend (metaplatform-frontend)                            pass
Lint (ruff)                                                 pass
Type check (pyright strict)                                 pass
Validate compose + Dockerfiles                              pass
agent-team pytest (mate-tech-agent-team)                    pass
ga-014 Ontology PostgreSQL RLS isolation                    pass
lint-and-bundle                                             pass
traceability                                                pass
```

）。另有两条**非 required** 的红，逐条登记在 §4-B（B6 / B7）。

### 5.5 required check：本批做了什么、还差什么

**已经生效（本批当场改，`gh api` 实取回读）** —— required check 从 **4 条 → 9 条**：

```text
Lint (ruff) / Type check (pyright strict) / Architecture tests (import-linter + four-layer guardrails)
/ Validate compose + Dockerfiles
+ agent-team pytest (mate-tech-agent-team)
+ ga-014 Ontology PostgreSQL RLS isolation
+ Frontend (metaplatform-frontend)
+ lint-and-bundle
+ traceability
```

只加**在 `main` 上已经绿**的那些（`24976a4c` 逐个 job 实取）。把一个当前红的 job 设为
required = 立刻冻结所有合并，那不是收口是自杀。

**还差的两条**（本 PR 合并后才能补，命令如下）：`ga-format` 与 `ga-tests` 是本批**新拆出来**
的 job 名，只在**本分支**上报过到。把还不存在于 `main` 的 check 名设为 required，会让
**所有**在途 PR 停在 "Expected — Waiting for status to be reported"。

```bash
gh api -X PATCH repos/Bert0000000000/MetaPlatform/branches/main/protection/required_status_checks \
  -H "Accept: application/vnd.github+json" -F strict=false \
  -f 'contexts[]=Lint (ruff)' \
  -f 'contexts[]=Type check (pyright strict)' \
  -f 'contexts[]=Architecture tests (import-linter + four-layer guardrails)' \
  -f 'contexts[]=Validate compose + Dockerfiles' \
  -f 'contexts[]=agent-team pytest (mate-tech-agent-team)' \
  -f 'contexts[]=ga-014 Ontology PostgreSQL RLS isolation' \
  -f 'contexts[]=Frontend (metaplatform-frontend)' \
  -f 'contexts[]=lint-and-bundle' \
  -f 'contexts[]=traceability' \
  -f 'contexts[]=ga format (pre-commit: rules 3 / 4 / 5 / 7 / 10 / 12)' \
  -f 'contexts[]=ga tests (infra + mate-platform + mate-app-kb + governance)'
```

## 6. 遗留与建议

1. **ADR-0065（SuperAI 上下文感知）仍是 Proposed** —— 本批不碰、不升格（2.1-C）。
2. **员工产出间歇性变 stub-fallback 回显** —— 归 `llmgw-fallback-hardening` 批次；
   本批的 A-1 让"某次产出是回显"这件事在审计账本里也留得下痕（`decision`/`outcome` 可读），
   但**没有**去治成因。
3. **`tenant_switch_enabled` 的共享-client 代价** —— 见 §4-C1，仍归 `MP-MCP-TENANT-SECURITY-01`。
4. **`ProfileStore` 的 `runtimes` 列**（2.0 的 C-5 边界）未动 —— `RuntimeRouter` 已经
   支持路由，但库里的行读回来仍是默认值。属 2.1-C。
5. **平台季度计划未落档** —— `MetaPlatform-调整优化方案执行计划-2026-09-17.md` 是维护者的
   在途文档，本批**只挂靠不改、也不落档**。2.1 路线图 §8.2 提的 9 个新批次号仍待它接纳。
