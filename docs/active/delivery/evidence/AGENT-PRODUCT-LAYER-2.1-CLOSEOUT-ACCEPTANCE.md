# AGENT-PRODUCT-LAYER-2.1-CLOSEOUT · 验收证据

> **日期**：2026-09-18 · **分支**：`feat/agent-product-layer-2.1-closeout` · **基线**：`main` = `34e6a664`（PR #63 合并后，含其后两笔 docs 提交）
> **目标**：把未收尾清单里**代码可做**的四件做掉，让「接管 → 续跑**到底**」真正成立。
> **上游**：`AGENT-PRODUCT-LAYER-2.1-OPEN-ITEMS.md`（§1 最优先 / D1 / D5 / D2-登录）、
> `…-2.1-C-ACCEPTANCE.md` §3-A4 与 §5.7（主任务实证输入）
> **对外批次号**：`MP-MCP-TENANT-SECURITY-01`（平台 S2 已有）+ **新提 `MP-CONTRACT-COVERAGE-01`**
> **决策记录**：**ADR-0068**（租户切换边界收口，Accepted）

## 0. 测试基线 → 最终

| 套件 | 开工基线 | 最终 | 差异 |
| --- | --- | --- | --- |
| `packages/mate-tech-agent-team/tests` | **593 passed / 0 skipped** | **605 passed / 0 skipped** | **+12** |
| `infra/tests`（动了 chart / realm / CI 门） | 2195 passed / 5 skipped（2.1-C 记录） | **2201 passed / 5 skipped** | +6 |
| `packages/mate-app-copilot/tests` | 未动 copilot 代码，未跑（2.1-C 终值 270） | — | 0 改动 |
| `mate-clients` | 未动其源码（测试里只读用它） | — | 0 改动 |

命令与原始输出见 §5。

## 1. 四件逐条

### 任务一（主）· `MP-MCP-TENANT-SECURITY-01`：租户切换安全边界收口

| 项 | 内容 |
| --- | --- |
| **判据** | ⑧ 复跑：接管后**续跑到底**（不再 403），全程有审计行；负例：共享密钥**不能**代任意租户；决策落 ADR |
| **实证输入** | 2.1-C §3-A4：接管成功后续跑的 llmgw 调用被 `403 tenant binding rejected … tenant switching is not enabled` 拒掉 |
| **根因** | 恢复出来的调用拿**共享服务 client** 的 token（无 tenant claim）+ `X-Tenant-Id` 去撞 llmgw 的租户绑定守卫——守卫是对的（它挡的正是"持服务密钥者指名别人的租户"），错的是客户端走了一条守卫必拒的路。而 B-10 早已登记过这条共享 client 的越权面：`tenant_switch_enabled` 链在共享 client 的 optionalClientScopes 上，**任何持共享密钥者申请即得** |
| **方案评估**（goal 要求先评 ②） | **② token exchange 是身份上的正解**（ADR-0067 全套已在），但端到端要 Keycloak 侧配 exchange 权限——那是环境条件（未收尾清单 E2），本批明确不在范围，靠它闭环不了 ⑧。**结论：本批落 ①（B-10 三个候选里的"专用 client"路线）**，② 保留为配置好后的第一优先级。ADR-0068 §2.1 记录了这个对位 |
| **交付** | ① **ADR-0068**（Accepted）：D1 共享 client 摘 scope；D2 两个专用 client（`mcp-tenant-proxy` / `agent-team-runtime`，切换 scope 是它们的 defaultClientScope）；D3 身份优先级序列（用户令牌/委托令牌 → runtime client → 如实失败）；D4 MCP `sk-mcp-*` → ONT 路径同批迁移；D5 存量栈迁移通道。② realm-mate.json 按上述结构改（两个专用 client + 摘共享链接）。③ `scripts/keycloak/apply_tenant_boundary.py`：对**运行中** Keycloak 幂等落边界（活栈 realm 不重导 JSON）。④ agent-team wiring：`_runtime_bearer()`（配一半启动失败）；无用户令牌时 llmgw / MCP 工具 / provider 取数三处改用 runtime 身份；`_resolve_outbound_token` 固化取值序（N4）。⑤ compose（agent-team 两 env + MCP 两 env）/.env.example（三键）/ chart（config.runtimeClientId + secretRef 两键）/ 两个 kind 脚本随迁。⑥ **llmgw / MCP / ONT 的守卫一行未动**——只动"谁拿得到 scope"，不动"守卫怎么判" |
| **commit** | 见 §4 提交表（首笔 + 幂等收口笔 + 审计装配笔） |

**实测证据**（判据逐条）：

**⑧ 复跑（§5.7 脚本，TTL=15/扫描=5）**——修前（2.1-C 实测）vs 本批：

| | 修前（2.1-C §5.7） | 本批 |
| --- | --- | --- |
| 接管 | t+17.2s（检查点越过基线） | **t+14.6s**（lease_epoch 1→2，见 §5.1） |
| 接管后 | run 继续推进，**撞 llmgw 403 终态 failed** | 3 子任务全部执行（planner + 员工经 runtime client 过 llmgw / MCP，无 403），停在 HITL 闸门（设计内） |
| 批准后 | —（failed 不可批） | **approve → `status: completed`，error 空**（§5.1） |
| 审计行 | 表建了、**一行没有**（见下） | delegation / approval / 派活全程落库（§5.2） |

**顺带抓到并修掉一条真 bug**：⑧ 的"全程有审计行"取证时发现 `agent_team.audit_events` **零行**——
`main._lifespan` 建 bus 时漏传 `audit=`，而 `build_service` 只在**不传** bus 时才自己挂
PG 账本；生产装配下审计全落进程内账本、重启即失。2.1-A 的 16 条账本用例都直接构造
`PgAuditLedger`，测不到"装配有没有接上"这条缝。已修 + 补源码级装配断言（AST 手法，
与 `test_sandbox_isolation` 同款）。

**负例（准出②，活栈 drill，容器内跑以对齐 iss）**——§5.3 原文：

```text
N1 共享 client 申请 tenant_switch_enabled → 拿不到 token：HTTP 400 invalid_scope
N2 共享 client 只申请 openid → scope = 'openid email profile'（无 tenant_switch_enabled）
N3 共享 token + X-Tenant-Id → llmgw HTTP 403: tenant binding rejected: X-Tenant-Id
   header is present and differs from the token tenant, but tenant switching is not
   enabled for this caller        ← 2.1-C §3-A4 的那条 403，现在成了受控负例
P1 runtime client token → scope='openid tenant_switch_enabled email profile'
P2 runtime token + X-Tenant-Id → llmgw HTTP 503（上游故意指坏；租户绑定守卫已放行）
```

即：**申请不到**（N1）、**拿到了也过不了守卫**（N3）、**只有专用 client 过得了**（P1/P2）。

**幂等性**（D5 通道）：对活栈连跑两遍 apply_tenant_boundary.py，第二遍全部"无需变更"（§5.4）。

### 任务二 · `MP-CONTRACT-COVERAGE-01`：oasdiff 名义覆盖收口（清单 D1 / 2.1-C C1）

| 项 | 内容 |
| --- | --- |
| **判据** | 故意做一次破坏性契约改动，oasdiff **能抓到**（探针 → revert） |
| **根因** | `platform.yaml` 是**手工维护**的：`build_platform.py` 存在但**没有任何 CI/脚本调用它**——manifest 加了 agent-team / deep-research / orchestrator 之后没人重建，三个服务的 path 全部不在 bundle 里。顺带核对：**copilot 在 bundle 里**（58 处引用），不在漏网名单上 |
| **交付** | ① `build_platform.py` 补齐三个 securityScheme（旧手工版有 `tenantHeader` / `oidcScopes`，脚本只写 `bearerAuth`——照脚本重建会产 768 个 `security-defined` 错，这是脚本与手工版漂移的实证）；② 重建 platform.yaml + bundled.yaml（三个服务全部进 bundle，+8115/−2971）；③ **CI drift 门**：`openapi-ci.yml` 的 lint-and-bundle 里重建 platform.yaml 并 `git diff --exit-code`——"改 manifest 不重建"当场红（治的是流程不是人）；④ platform.yaml 转生成物、移出 prettier 范围（与 `generated/` 同一条理由）；⑤ 顺带修 orchestrator 契约一处 `array-items` 缺 `items`（从未进过 bundle 所以从未被 spectral 查过——名义覆盖的代价本体） |
| **探针证据** | 删 `GET /api/v1/agent-team/runs/{run_id}` + 重建两产物 → `oasdiff breaking --fail-on ERR` 报 `error [api-path-removed-without-deprecation]` **exit 1**；revert 后产物与探针前**逐字节一致**。修前对 agent-team 的任何破坏性改动都静默通过 |

### 任务三 · 小件（D5 / D2-登录）

| 项 | 内容 | 判据 | 证据 |
| --- | --- | --- | --- |
| **D5 控制面口令** | `migration.controlPassword`（`--set` 明文）整条删除；口令走 `secretRef.keys.controlPassword`（迁移 Job 从 Secret 读）；两个 kind 脚本把口令塞进既有的 `agent-team-secret` | 无明文 `--set` | 全仓 `grep controlPassword` 只剩 Secret 键名与注释；kind 迁移 Job 实跑 succeeded（走 Secret 路径） |
| **D2-登录超时** | 共用 helper `timeout: 30_000` → `E2E_LOGIN_TIMEOUT_MS`（默认仍 30s，解析失败回默认）；2.1-C 三个抄同段的 spec 副本退役，回归 `fetchAccessToken`（这三条 spec 自身默认抬到 120s，外部可覆盖） | 登录超时可配 | `tsc -b --noEmit` 通过；副本删除（−69 行） |

## 2. 准出对照

| # | 准出 | 结果 | 证据 |
| --- | --- | --- | --- |
| **①** | ⑧ 复跑：接管后续跑**到底**（不再 403），全程有审计行 | ✅ | §5.1：接管 t+14.6s → 3 子任务全执行 → HITL → approve → **completed / error 空**；§5.2 审计行（delegation denied+原因、approval、派活） |
| **②** | 共享密钥代任意租户的**负例**存在且被拒 | ✅ | §5.3：N1 400 invalid_scope + N3 403 tenant binding rejected（双层拒绝） |
| **③** | oasdiff 探针证明 agent-team 契约**真被看着**（抓到后 revert） | ✅ | §1 任务二：`api-path-removed-without-deprecation` exit 1 → revert → 逐字节一致 |
| **④** | 控制面口令无明文 `--set`；登录超时可配 | ✅ | §1 任务三 |
| **⑤** | 环境类未做项（E1~E5）**如实登记**，不留空 | ✅ | §3-A（本批一条都没关掉，边界如实挪移） |

## 3. 边界登记（本批自己承认没做完的）

### A. 环境条件类（E1~E5 逐条，全部**未闭合**，与开工时一致）

| # | 事项 | 本批状态 | 要做的条件 |
| --- | --- | --- | --- |
| **E1** | 真 CLI 端到端（Claude Code） | 未动（`claude -p` 仍回 Not logged in） | 已登录的机器 / CI 注入凭证 |
| **E2** | token exchange 端到端 | **未动**（本批刻意不靠它闭环，见任务一方案评估）。ADR-0068 把它定为配置好后的**第一优先级**：届时续跑身份从 runtime client 升回用户 | Keycloak 配 exchange 权限 + `MATE_AGENT_TEAM_TOKEN_EXCHANGE=1` |
| **E3** | ADR-0065 指代消解端到端 | 未动 | 真实 provider + 本体有真实实例 |
| **E4** | pod-kill 端到端进 CI | 未动（脚本与可判的门 2.1-C 已交付；进 CI 需 staging 全栈） | staging 起来之后 |
| **E5** | kind multi-replica job 首次 CI 实跑 | 未动（本机又实跑两轮全绿；CI 侧待观察） | 合并后看 CI |

### B. 本批未做（有意）

| # | 项 | 为什么 |
| --- | --- | --- |
| **B1** | runtime client 的**残差风险**未消除 | 持有 `agent-team-runtime` / `mcp-tenant-proxy` 任一 secret 者仍可代任意租户——收窄的是**持有面**（19+ 服务 + 所有本地开发者 → 各一个服务的 Secret），不是能力本身。ADR-0068 §4 如实登记；彻底消除要 E2 铺开 |
| **B2** | compose 存量栈的 `.env` 迁移靠文档 | `.env` 不进 git；本机已改，别的机器要照 `.env.example` 注释补三键 + 跑一次 apply_tenant_boundary.py，否则 `sk-mcp-*` → ONT 那一跳会 401（显式失败，不是静默） |
| **B3** | 平台季度计划（`MetaPlatform-调整优化方案执行计划-2026-09-17.md`）未提交 | 维护者在途文档，沿用 2.1-B/C 的纪律：只挂靠不代提交 |
| **B4** | roadmap §8.3 增行 | 同 2.1-C §6-10：该文件有另一会话在途改动，不碰 |
| **B5** | 负例 drill 未收成常驻脚本 | 三条 curl/python 即可复现（§5.3 命令在验收档里）；等 `MP-QA-BASELINE-01` 统一收口，避免脚本增殖 |

### C. 口径与发现

| # | 项 | 说明 |
| --- | --- | --- |
| **C1** | **2.1-A 的 A-1 在生产装配下从未生效过** | 审计账本本体（PG/RLS/哈希链）从 2.1-A 起就是对的，但 `main._lifespan` 漏传 `audit=`——**所有真实部署的审计行都只活在内存里**。本批 ⑧ 取证时撞破并修复（§1 任务一）。这不是"2.1-A 验收造假"——它验的判据（账本可重启可查可检篡改）在它构造的装配下成立；漏的是**生产装配路径**那条缝，而这正是"验收判据要贴着生产形态"的又一次教训 |
| **C2** | **build_platform.py 与手工 platform.yaml 漂移了三个 securityScheme** | 照脚本重建会产 768 个 lint 错。这解释了为什么当初没人重建——一旦有人跑了脚本，CI 会全红，于是"手工补 path"成了阻力最小的路，漂移越来越远。drift 门（任务二③）把这条路堵死 |
| **C3** | kind 复跑的镜像必须 `BUILD_IMAGE=1` | 沿用 §3-C8 教训，两轮复跑都显式重建（第一轮还抓到审计 bug，正是重建的价值） |
| **C4** | P2 负例对照的 503 是**故意构造的上游故障**（base_url 指向不存在的端口 + `allow_stub_fallback=false`），用于证明"守卫放行后失败发生在别处"；不是 llmgw 故障 |

## 4. 提交

| commit | 内容 |
| --- | --- |
| `e6f12f9e` | feat(security): ADR-0068 租户切换边界收口（realm / wiring / applier / compose / chart / 脚本 / 测试 +17） |
| `f6af11ba` | fix(contracts): MP-CONTRACT-COVERAGE-01 —— oasdiff 名义覆盖收口（platform 重建 + drift 门 + 探针 revert） |
| `f8c6b508` | test(e2e): 登录 helper 超时可配 —— 三个抄同段的副本退役 |
| `2ed6967b` | fix(keycloak): apply_tenant_boundary 幂等收口（mapper 归一化比对） |
| `4076b5c9` | fix(agent-team): 生产装配接上 PG 审计账本（main._lifespan 漏传 audit） |
| （本笔） | docs(evidence): 本文件 + goal-mode 提示词落档 + 未收尾清单收口标记 |

## 5. 回归与复现

### 5.1 ⑧ 端到端（第二轮，镜像含审计修复）

```text
$ BUILD_IMAGE=1 KEEP_CLUSTER=1 bash scripts/ci/agent_team_multi_replica.sh
=== AGENT-TEAM MULTI-REPLICA PASS：3 副本全部 Ready 且各自 /healthz 200 ===
（迁移 Job succeeded=1 —— 控制面口令走 Secret 的首验）

$ LEASE_TTL_HINT=15 RESCAN_HINT=5 REQUIRE_TAKEOVER=1 bash scripts/ci/agent_team_pod_kill_takeover.sh
  0c. 租户切换边界 → 运行中 Keycloak（apply_tenant_boundary.py，幂等）
  >>> 接管发生（换手）：t+14.6s  lease_epoch 1→2
  === POD-KILL TAKEOVER PASS（t+14.6s ≤ 30s）===

# 接管后这轮跑完执行段、停在 HITL（run=806770a431d444898de02c923051f87d）：
  status: awaiting_approval | error: '' | subtasks: 3 | results: 3
# 批准后到底：
$ POST /runs/{id}/approve {"approved":true}
  status: completed | error: '' | summary len: 97
```

### 5.2 审计行（⑧ 那一轮，`agent_team.audit_events` 按 run_id 过滤，原文）

```text
sequence | action                | outcome  | detail.reason                        | task
1        | agent_team.delegation | denied   | 未配置 token exchange
           （MATE_AGENT_TEAM_TOKEN_EXCHANGE）：续跑不带用户身份（与 2.0 一致） | -
2        | agent_team.spawn      | granted  | -                                    | 806770a4-t1
3        | agent_team.spawn      | granted  | -                                    | 806770a4-t2
4        | agent_team.spawn      | granted  | -                                    | 806770a4-t3
5        | agent_team.approval   | approved | -                                    | -
```

读法：第 1 行如实记**拒签**（runtime client 接管了上游身份但**不冒充用户**——账本不撒谎）；
2-4 行是接管后续跑那三件派活；第 5 行是人工批准。修前这张表在真实部署里**一行都不会有**
（§3-C1）。

### 5.3 负例 drill（容器内，llmgw 容器执行）

命令形态：取共享 client token（申请 / 不申请切换 scope 两种）→ 带 `X-Tenant-Id` 打
`POST /api/v1/llmgw/chat/real` → 对照 runtime client token 同型调用。输出见 §1 任务一。

### 5.4 幂等性（apply_tenant_boundary.py 两遍）

```text
第 1 遍：+ client mcp-tenant-proxy（新建） / + defaultClientScopes += tenant_switch_enabled
        + client agent-team-runtime（新建） / + defaultClientScopes += tenant_switch_enabled
        - metaplatform-backend optionalClientScopes -= tenant_switch_enabled
第 2 遍：= 三项全部「已与 realm JSON 一致 / 无需变更」
```

### 5.5 复现命令

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
cd infra && PYTHONIOENCODING=utf-8 ../mate-platform-backend/.venv/Scripts/python.exe -m pytest tests -q
cd mate-platform-backend/contracts && npm run check
KEEP_CLUSTER=1 bash scripts/ci/agent_team_multi_replica.sh && bash scripts/ci/agent_team_pod_kill_takeover.sh
PYTHONIOENCODING=utf-8 python scripts/keycloak/apply_tenant_boundary.py --keycloak-url http://127.0.0.1:8180
```

### 5.6 13 硬规则门禁

| 门禁 | 结论 |
| --- | --- |
| ga-001 oasdiff | 本批 bundle 改动为**纯增量**（三个服务并入 + 一处补 `items`）；**drift 门新增**（openapi-ci） |
| ga-002 requirement IDs | 无新增 operationId（`validate_contracts.py` / `validate_traceability.py` exit 0，随 npm check 之外单独跑过） |
| ga-003 forbid_raw_sql | 未新增 SQL 访问 |
| ga-004 forbid_bare_httpx | apply_tenant_boundary.py 用 urllib（对 Keycloak Admin API——IdP 面，与 mate_clients.iam 同类边界；不走业务 httpx）。其余无新 HTTP |
| ga-005 forbid_legacy_fallback | runtime client 未配时**不回落**（保持既有失败形态）；配一半启动失败 |
| ga-006 ruff + pyright | ruff check / format 全绿（改动文件）；pyright 范围（mate-platform/mate-clients）未触及 |
| ga-007 forbid_skip_tests | 新增 18 条用例（agent-team 12 + infra 6），0 skipped |
| ga-008 helm | chart 改 values/模板/README；`infra/tests` 2201 passed |
| ga-009 OTel | 未触及（审计走既有账本） |
| ga-010 require_evidence | 本文件 |
| ga-011 helm-docs | README values 表已同步 |
| ga-012 gitleaks | realm JSON 里的 dev 值沿用既有 in-realm 先例（共享 client 的 secret 一直在那）；本地 `.env` 改动不进 git |
| ga-013 NetworkPolicy | 未动 |

## 6. 遗留与建议

1. **31.1s 接管默认值**（2.1-C §6-3）：归 `MP-STAGING-GATE-01` 在真实负载下定，本批不动
   chart 默认（复跑仍用 TTL=15/扫描=5 的调小形态）。
2. **pyright 295**（2.1-A §4-B7）：独立工程，本批未动。
3. **E2 铺开后撤掉 runtime client 的租户切换依赖**：ADR-0068 已把它定为第一优先级——
   配好 exchange 后续跑身份升回用户，runtime client 退为过渡形态（可再评估是否保留）。
4. **审计装配那条缝的普适教训**：A-1 式"本体用例全绿但装配没接"值得在
   `MP-QA-BASELINE-01` 里立一条检查项——每个"生产装配换掉默认值"的点（audit / artifacts /
   checkpointer）都该有装配形态断言（本批的 AST 手法可复用）。
5. 「连续 10 次合并 required 全绿」观察项：本批合并后仍是 4+N/10，继续观察（O2 无需动作）。
