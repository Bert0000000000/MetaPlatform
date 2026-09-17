# AGENT-PRODUCT-LAYER-2.1-B · 验收证据

> **日期**：2026-09-17 · **分支**：`feat/agent-product-layer-2.1-b` · **基线**：`main` = `f457a0d8`
> **目标**：把 2.1-A 的机制从「只在单进程、不重启前提下成立」推到「多副本 + 重启下也正确」。**不扩功能面**。
> **上游**：`docs/active/specs/2026-09-17-agent-product-layer-2.1-roadmap.md` §3 / §3.1 / §3.2（定义与证据）、
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md`（平台级量化准出，本文件**只引用不重定义**）、
> `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.1-A-ACCEPTANCE.md`（上一批）
> **对外批次号**：`MP-REPLICA-READINESS-01`（前置）/ `MP-RUN-LEASE-01` / `MP-RUN-EVENTS-01` /
> `MP-RUN-CANCEL-01` / `MP-RUNTIME-DB-POOL-01` / `MP-APPROVAL-GATE-ABI-01` /
> `MP-EXTERNAL-RUNTIME-E2E-01`（计量部分）/ `MP-AGENT-SANDBOX-ISOLATION-01`（Job 部分）

## 0. 测试基线 → 最终

| 项 | 值 |
| --- | --- |
| 开工基线（`packages/mate-tech-agent-team/tests`，`main` = `f457a0d8`） | **415 passed / 0 skipped** |
| 最终（同套件） | **501 passed / 0 skipped** |
| 附加套件（`infra/tests`，本批动了 helm chart） | **2192 passed / 5 skipped**（5 条 skip 是**预存**，非本批引入） |
| 契约校验 | `validate_contracts.py` exit 0 · `validate_traceability.py` exit 0 |
| 差异 | **+86**（只升不降，无 skipped） |

命令与原始输出见 §5。

## 1. 八条逐条

### 前置 · `MP-REPLICA-READINESS-01`：多副本运行态

| 项 | 内容 |
| --- | --- |
| **判据** | **真能起 3 副本并观测到**；两进程/两容器的跨副本用例常跑 |
| **现状（开工前实取）** | compose 用固定 `container_name`（起第二个副本必然名字冲突）· `infra/helm/charts/` 下无 agent-team chart · K8s 集群上 `get all -A` 零 MetaPlatform workload · "跨副本"用例是同进程两个 `RunControl` 共享一个内存对象 |
| **交付** | ① compose 去掉固定 `container_name`（服务名仍是网络别名），`--scale mate-tech-agent-team=3` 可用；② 新增 `infra/helm/charts/agent-team`（Deployment **replicaCount: 3** / Service / ServiceAccount / ConfigMap / NetworkPolicy / 迁移 Job / 沙箱 Job），登记进 umbrella `Chart.yaml`，附 helm-docs 体例 README；③ `values-local.yaml` + `verify/postgres.yaml`（本地验证那套）；④ `tests/test_replica_two_process.py`：**两个真 Python 进程** |
| **证据** | §5.3 集群实取：3 个 `mate-tech-agent-team-*` Pod `1/1 Running`；`/healthz` 200；库侧 13 张表全部建出且 RLS `enabled + FORCED` |
| **commit** | `f2832e02` |

**真集群实取（kind，`--wait` 装完后）**：

```text
NAME                                   READY   STATUS    RESTARTS   AGE
mate-tech-agent-team-94c65c96c-99zm7   1/1     Running   0          25s
mate-tech-agent-team-94c65c96c-9mt72   1/1     Running   1 (21s ago)  25s
mate-tech-agent-team-94c65c96c-jp4mm   1/1     Running   1 (21s ago)  25s
$ curl -s http://127.0.0.1:18013/healthz
{"status":"ok","service":"mate-tech-agent-team"}
```

```text
active_run_lease | t | t      ← B-1 新建
audit_events     | t | t
cancel_signals   | t | t
run_claims       | t | t
run_event        | t | t      ← B-2 新建
tool_invocations | t | t
（relrowsecurity | relforcerowsecurity）
```

> **为什么用 kind 而不是 Docker Desktop 内置 K8s**：后者的 containerd 镜像源在本机是坏的
> —— `registry-mirror:1273` 对 `docker.io/library/*` 一律回 `500 Internal Server Error`，
> 镜像既拉不下来、也不与宿主 Docker 共享镜像存储（`imagePullPolicy: Never` 实测
> `ErrImageNeverPull`）。kind 的 node 镜像**本地已有缓存**，配 `ctr images import`
> 可以离线灌镜像。这是环境事实，不是选择偏好。

### B-1 · `MP-RUN-LEASE-01`：活跃 run 租约 / 心跳 / 接管

| 项 | 内容 |
| --- | --- |
| **判据** | 3 副本并发无双重认领；随机杀死执行 Pod 后 Run 30s 内被接管并继续；**长跑 run 不被误接管**；真崩的孤儿能接管 |
| **交付** | `run_lease.py`：`active_run_lease(tenant_id, run_id, owner_instance, lease_epoch, heartbeat_at, expires_at, current_step, acquired_at)`；`lease_epoch` 每次接管 +1（**续租与释放都带 epoch**，上一任的延迟写被数据库拒掉）；TTL **可配 + 带续租**（心跳间隔硬夹在 TTL/3 以内）；接管判据 `decide_takeover` **四条件同时成立**：租约过期 AND 心跳已停 AND 检查点未进展 AND **无在途幂等调用**；`RunControl.submit` 多一道租约幂等；`recover` 先判后抢 |
| **新增的账本查询** | `ToolLedger.running_invocations()`（roadmap 点名"账本缺这一问"） |
| **证据** | `tests/test_run_lease.py`（24 条，含 9 条真 PG）；`tests/test_replica_two_process.py`（**两个真进程**，3 条） |
| **commit** | `7277c744` |

**真实的两进程证据**（同进程模拟验不到的那部分）：

```text
test_two_real_processes_cannot_both_claim_the_same_run          PASSED
test_a_second_process_cannot_steal_a_lease_a_live_process_is_holding  PASSED
test_a_killed_holder_leaves_a_lease_another_process_can_take_over     PASSED
```

子进程各起一个真 Python 进程、各连真库、同打那一条
`INSERT … ON CONFLICT … WHERE … RETURNING`：**恰好一个赢**；持有者还在续租时挑战者
抢不走；持有者被硬杀（`proc.kill()`）后，租约到期另一个进程接管且 **epoch +1**。

### B-2 · `MP-RUN-EVENTS-01`：Run Event Log + SSE 续传

| 项 | 内容 |
| --- | --- |
| **判据** | 断线重连**按 sequence 补发不丢事件**；高并发下不再「连接数 × 每秒 4 次读检查点」；**丢 event log 不影响续跑** |
| **交付** | `run_events.py`：追加式 `run_event`（`(tenant, run, sequence)` 主键 + RLS），序号由 `pg_advisory_xact_lock` 串行化分配；写入同事务 `pg_notify`；订阅侧**进程级一条** LISTEN 连接 + 读泵（不是每条 SSE 一条）；`RunControl` **每轮一个**记录器（先看廉价的检查点 id，变了才读历史）；`events()` 按 `Last-Event-ID` 补发（**没有事件日志的退路也按游标补发**）；保留期走启动扫描 |
| **证据** | `tests/test_run_events.py`（11 条，含真 PG 的 NOTIFY 唤醒） |
| **commit** | `3fd19870` |

**判据 ⑤ 是怎么量的**：拿**计数桩**顶替 `service.history`，三个订阅方并发消费完，
断言 `history` 的调用次数**在订阅方接入前后一模一样**——订阅方不再碰检查点。

**测试抓出的两个真 bug**（都不是设计问题，是写错了）：

1. advisory lock 的锁键用 `f"{tenant}|{run}"` 时误用了 `\x00` 拼接 → PG 的 text 参数
   不接受 NUL，直接 `DataError`；
2. 通知的读泵不是可选的：psycopg 的异步连接**只在被使用时**才把通知从 socket 取出来，
   只 `await queue.get()` 永远等不到（表现为"NOTIFY 发了但没人醒"，只能靠兜底轮询）。

### B-3 · `MP-RUN-CANCEL-01`：取消改异步受理 + 跨副本传播

| 项 | 内容 |
| --- | --- |
| **判据** | 跨副本取消 10s 内进入终态**或明确等待状态**；客户端能观测到**中间态**；不再暗示"回话那刻图已停" |
| **交付** | `POST /runs/{id}/cancel` → **202** + `RunCancelAccepted{status, cancel_requested}`；`cancelling` 是**推导**出来的中间态（收到信号且未终态），不是检查点里的第二个状态；**"有没有人在跑"由活跃 run 注册表（B-1 租约）回答**——有活跃租约时取消方**绝不代庖**落终态；有界等待（默认 2s）；终态之后**归档**那格信号 |
| **证据** | `tests/test_cancel_async.py`（9 条）；3 条既有用例按新语义更新（行为变更是有意的） |
| **commit** | `98ff468b` |

> **代庖那句为什么是关键**：1.5 起就有的 bug 是"B 副本写了终态、A 上在途的图下一步
> 又盖回去"。B-3 之前它被"同步阻塞等图停"掩盖着；改成受理制之后必须显式回答
> "有没有人在跑"，否则会把同步阻塞换成"没人知道停没停"。答案用的是 B-1 的租约表。

### B-4 · `MP-RUNTIME-DB-POOL-01`（前半）：Admin DSN 移出运行 Pod

| 项 | 内容 |
| --- | --- |
| **判据** | 运行 Pod 的 env 里**没有** admin DSN；恢复扫描仍可用；服务能起来 |
| **交付** | `migrate.py`（`python -m mate_tech_agent_team.migrate`，helm **pre-install/pre-upgrade hook**）拥有 admin DSN，建 schema / 表 / RLS / GRANT 后退出；运行 Pod 改为 `MATE_AGENT_TEAM_ROLE=api` + app DSN + **控制面 DSN**，**配了 admin DSN 反而启动失败**；`bootstrap()` 新增独立控制面角色 `mate_control`（**只 GRANT SELECT 到 checkpoints**，跨租户靠一条 permissive 策略——RLS 多条策略是 OR 关系，app 那条租户策略一个字没改） |
| **证据** | `tests/test_runtime_role.py`（9 条）+ §5.4 集群实取 |
| **commit** | `23749e7c` |

**真集群实取**：

```text
$ kubectl get job -n mate-agent-team
mate-tech-agent-team-migrate   Complete   1/1   6s

$ kubectl get deploy mate-tech-agent-team -o jsonpath='{...env[*].name}'
LEGACY_LOGIN_COMPAT INSECURE_SKIP_SIGNATURE MATE_AGENT_TEAM_ROLE
MATE_AGENT_TEAM_DSN MATE_AGENT_TEAM_CONTROL_DSN SERVICE_CLIENT_SECRET
                                          ↑ 没有 MATE_AGENT_TEAM_ADMIN_DSN

$ # 控制面身份：读得到检查点（恢复扫描可用）
$ psql -U mate_control -tAc 'select count(*) from agent_team.checkpoints;'
0
$ # 读不到业务数据
$ psql -U mate_control -tAc 'select count(*) from agent_team.artifact;'
ERROR:  permission denied for table artifact
```

### B-5 · `MP-RUNTIME-DB-POOL-01`（后半）：连接池（租户安全）

| 项 | 内容 |
| --- | --- |
| **判据** | **连接复用不泄漏租户上下文**（归还后下一个租户拿到干净连接）——这条**本身就是判据**，不是附带注意事项 |
| **实测的规模** | 路线图说"7 个 store 文件里 15 处 `set_config(…, false)`"。**实测：src 里是 8 处 / 7 个文件**（另 6 处在测试里），总数 14。口径订正在此（见 §4-D3） |
| **交付** | 新增 `tenant_db.TenantConnections`：默认走**事务级** `set_config(…, true)` + `SET LOCAL search_path`（出块即失效，靠数据库语义而非纪律）；池的归还钩子**无条件 `RESET ALL`**（给 autocommit 那条路兜底，也是第二道网）；7 个 store 全部改走它；审计那条路把显式 `commit` 交还给事务块 |
| **证据** | `tests/test_tenant_db.py`（9 条，**真库真池**） |
| **commit** | `9c3d0e93` |

判据的写法是刻意的：池上限设成 **1**，于是"没看到上一个租户的 GUC"才**等价于**
"归还时被清干净了"，并断言两次取用是**同一条物理连接**（`pg_backend_pid()` 相等）。
另有终局判据：同一条连接上，A 写的行 B **一行都读不到**。

### B-6 · `MP-APPROVAL-GATE-ABI-01`：HITL gate 统一协议

| 项 | 内容 |
| --- | --- |
| **判据** | 至少支持多级审批 / 会签 / 超时中的两项，**且有用例**；协议可被统一审批中心消费 |
| **二选一的结论** | **保留自定义 gate**。`interrupt()` 会重跑它所在的节点，而本项目要在"跑到闸门 → 人确认 → 继续"之间保证**已完成节点的调用次数不变**（1.0 起反复立的判据）——换过去等于把那个性质换掉 |
| **交付** | `approval_gate.py`：`gate_id / tenant_id / run_id / gate_type / required_roles（有序=多级）/ required_approvals（>1=会签）/ payload / editable_fields / expires_at / decisions[]`；`evaluate_gate` 是**纯函数**（语义全在里面）；归级用**令牌里签出来的角色**；`gate_node` 建闸门（缺省形态与旧布尔语义**逐字等价**，过期时刻取本轮截止时间）；`resume` 记决定→评估→三路分流（够→续跑 / 驳回→failed / **还差→只写闸门不推图**）；多级与会签由部署策略配（**改配置不改图**）；老检查点读不到 → 退回单布尔语义 |
| **证据** | `tests/test_approval_gate.py`（16 条，三项能力各有用例 + 会签接进真图） |
| **commit** | `43645e81` |

### B-7 · `MP-EXTERNAL-RUNTIME-E2E-01`（计量部分）：A2A 计量拆分

| 项 | 内容 |
| --- | --- |
| **判据** | 外部 agent 往返**不再计入 `llm_calls`**；A2A E2E 常跑不用永久 skip |
| **交付** | 拆为 `llm_calls` / `external_agent_calls` / `runtime_calls`（工具调用数**不另设标量**——`tool_calls` 那张清单就是记录，长度就是计数；同一事实两个来源是本项目明令禁止的）；计量记在**拿到返回值之后、判定之前**（成本口径问的是"打出去几次"，不是"成功几次"）；`source` 新增 `external` |
| **长任务部分** | **缓做**（roadmap 复核后收窄）：本机没有真实对端，给不存在的对端写状态轮询是空转。改成一条**回执如实**的常跑用例：通了就断言计量与产出，没通就断言"失败且不编造产出"，**不加 skip** |
| **证据** | `tests/test_a2a_outbound.py`（17 条，含该 E2E） |
| **commit** | `33d0dc98` |

### B-8 · `MP-AGENT-SANDBOX-ISOLATION-01`（Job 部分）：外部 Runtime 迁 K8s Job

| 项 | 内容 |
| --- | --- |
| **判据** | 与 A-4 **同一套断言**，只是换到 Job 里跑：沙箱里看不到任何宿主凭据 |
| **交付** | chart 的 `templates/sandbox-job.yaml`：独立 ServiceAccount + `automountServiceAccountToken: false` / 最小环境变量白名单（**刻意不 envFrom** 服务的 ConfigMap 与 Secret）/ 只读根 + `emptyDir` / `seccomp: RuntimeDefault` / 非 root / `drop: ALL` / CPU·内存·`activeDeadlineSeconds` 限额；配套 NetworkPolicy **默认拒绝一切出站** |
| **证据** | `tests/test_sandbox_k8s_job.py`（5 条：模板层永远在跑；实跑层**如实回执**）+ §5.5 真集群日志 |
| **commit** | `f2832e02` |

**实跑读出沙箱环境**（`job-name=agent-team-sandbox-probe` 的 `env`）：
**凭据类变量 0 个**（按 DSN / SECRET / PASSWORD / TOKEN / KEYCLOAK / POSTGRES /
CREDENTIAL / PRIVATE 逐个名字找，全 0）。

**实跑还抓出一条模板里没料到的事**：K8s 会把**同命名空间里所有 Service 的地址**
自动注入成环境变量（`AGENT_TEAM_PG_SERVICE_HOST`、`MATE_TECH_AGENT_TEAM_PORT_8013_TCP`
……）。它们不是凭据，但那是本不该给一段不受信代码的信息。已加
**`enableServiceLinks: false`** 关掉，并把它写成断言。

## 2. 准出对照

### A 组（单进程下就能验，本批**已验**）

| # | 准出 | 结果 | 证据 |
| --- | --- | --- | --- |
| ① | 断线重连 SSE **不丢事件**（按 sequence 补发，非内存计数） | ✅ | `test_run_events.py`：`Last-Event-ID=2` → 补发的 id 恰好 `[3,4,5]`；**没有事件日志的退路也按游标补发** |
| ② | 连接复用**不泄漏租户上下文**（会话级 GUC 事务化 / RESET） | ✅ | `test_tenant_db.py`：池上限 1，同一物理连接上 A→B 无残留；A 写的行 B 读不到 |
| ③ | 运行 Pod 的 env **无 admin DSN**，且恢复扫描仍可用 | ✅ | `test_runtime_role.py` + §5.4 集群实取（控制面身份能读 checkpoints、读 artifact 被拒） |
| ④ | 外部 agent 往返**不再计入 `llm_calls`** | ✅ | `test_a2a_outbound.py`：成功与失败两路都断言 `llm_calls == 0` |
| ⑤ | 高并发 SSE 不再按**连接数 × 每秒 4 次**读检查点 | ✅ | `test_run_events.py`：三个订阅方接入前后 `history` 调用次数不变 |

### B 组（前置完成后才可验）

| # | 准出 | 结果 | 证据 |
| --- | --- | --- | --- |
| ⑥ | **3 副本并发 → 无双重认领** | ✅ **已验证** | 两个真进程 + 3 副本真集群；`test_replica_two_process.py` 断言**恰好一个赢**；§5.3 三副本同时 Ready |
| ⑦ | 随机杀死执行 Pod → Run **30s 内被接管并继续** | ⚠️ **部分已验证**（见 §4-A1） | 机制与判据齐（四条件接管、`test_a_run_whose_heartbeat_stopped_is_takeable`、`test_a_killed_holder_leaves_a_lease_another_process_can_take_over` 真杀进程），**但"杀掉一个真 Pod 并观察 Run 在 30s 内续跑"没有端到端跑过**——那需要这一轮真的在跑（要 llmgw/MCP/Ontology 全栈） |
| ⑧ | 跨副本取消 → **10s 内终态或明确等待** | ✅ **已验证** | `test_a_cross_replica_cancel_reaches_a_terminal_state_well_inside_ten_seconds` 实测 elapsed < 10s；中间态 `cancelling` 可观测 |
| ⑨ | 外部 CLI 在 K8s Job 里 → **看不到任何宿主凭据** | ✅ **已验证** | §5.5：真 Job 的 env 里凭据类变量 **0 个** |

> **⑦ 为什么只做到"部分"**：本批**没有**把"Run 真的在跑"这件事在 K8s 里复现——
> 那需要 llmgw / MCP / Ontology 全栈进集群。**不把机制验过当成端到端验过**：
> 被验的是"租约/心跳/接管"这套语义（含真杀进程），**没被验**的是"服务在真集群里
> 端到端续跑一个被杀的 run"。见 §4-A1 的补做条件。

## 3. 与 2.1-A 边界的关系

2.1-A 自标的边界逐条对位（**别当新账**）：

| 2.1-A 边界 | 本批状态 |
| --- | --- |
| **A2（K8s Job 未做）** | **本批做了** —— 就是 B-8；`sandbox_env.py` 原样复用（一个字没重写） |
| **B1（连续 10 次合并 required 全绿）** | 观察性判据，归 2.1-A 的后续观察，本批不重复声明 |
| **B3（approval 规则集没开）** | 本批**不做**：本仓只有一个 collaborator，开 required review 会让所有 PR（含人自己开的）立刻不可合并。组织决策，不是代码缺口 |
| **B4 / B5（前端预存红 + `test_recovery` flaky）** | 本批**不做**，归 `MP-QA-BASELINE-01`。B-2 碰了 run 恢复路径，本批连跑多次未见那条 flaky 复现（见 §4-D2） |
| **A1（token exchange 端到端未跑）** | 环境条件（IdP 侧要配 exchange 权限），不是代码缺口。本批未动 |
| **C1/C2（`tenant_switch_enabled` 连带复核）** | 本批**未动 MCP 协议面**，也**未动任何 realm / Keycloak 配置**（`git diff --name-only` 里无 `infra/keycloak/**`）→ 复核结论**维持现状，不放松**。下次再动 MCP 协议面/取数路径时要重做这一条 |

## 4. 边界登记（本批自己承认没做完的）

### A. 环境条件（不是代码缺口）

| # | 边界 | 为什么留着 | 要做的条件 |
| --- | --- | --- | --- |
| **A1** | 判据 ⑦ 的**端到端**部分未跑：没在真集群里杀一个正在跑 run 的 Pod、观察它 30s 内被接管续跑 | 需要把 llmgw / MCP / Ontology 一起搬进集群（本批只搬了 agent-team + PG）。**机制层验过了**（四条件接管 + 真杀进程 + 真库 epoch 前进），端到端那一步没验 | 在一个全栈可达的环境里：起一轮真 run → `kubectl delete pod` → 断言 30s 内另一个副本接管且检查点继续推进 |
| **A2** | ⑨ 的"真外部 CLI"部分是**模板 + probe**，不是真跑一次 Claude CLI | 本机 `claude -p` 回 `Not logged in`（2.0 的 B-6，老边界）。判据本身（"沙箱里看不到宿主凭据"）已用真 Job 验过 | 在一台已登录 CLI 的机器 / 注入凭证的 CI 上，把 `sandboxJob.command` 换成真 CLI 调用 |
| **A3** | 本地验证用的是**自带的 PG + `--set migration.controlPassword=…`**，不是 SealedSecret | 本地验证要自成一体系；生产路径见 chart 的 `secretRef` 与 README | 生产 values 里把控制面口令也改成 Secret 引用（本批留了 `secretRef.keys` 的位，没接） |

### B. 本批未做（有意）

| # | 项 | 为什么 |
| --- | --- | --- |
| **B1** | B-7 的**长任务部分**（状态轮询 / 中途取消 / trace） | roadmap 复核后收窄：没有真实对端，写了是空转 |
| **B2** | B-6 的 `gate_type` 只有 `plan_gate` 一种 | 没有第二种闸门的真实需求；协议留了位置（`gate_type` 是枚举，新增要走契约 + 用例） |
| **B3** | MCP 协议面 / `tenant_switch_enabled` 的共享-client 代价 | 本批未动，仍归 `MP-MCP-TENANT-SECURITY-01` |

### C. 口径订正与发现

| # | 项 | 说明 |
| --- | --- | --- |
| **C1** | **`set_config` 的处数**：roadmap §3.1 写"7 个 store 文件里 15 处"，**实测 src 里 8 处 / 7 个文件**（另外 6 处在测试里），合计 14 | 本文件按实测口径走。结论不变（全是会话级 `false`、事务级零处） |
| **C2** | **`git add -u` 的教训再次适用**：本批全程按文件 `add` | 开工时工作树里有别人的在途文件（两份 roadmap 的修改、两份未跟踪文档），**一次都没有被带进提交** |
| **C3** | 沙箱 Job 里仍看得到 `KUBERNETES_SERVICE_HOST/PORT` | `enableServiceLinks: false` 关掉了**同命名空间 Service 的自动注入**，但 API server 那一条由 kubelet 直接给，关不掉。它是**地址**不是凭据，且 `automountServiceAccountToken: false` 已经让那个地址无 token 可用 |
| **C4** | 运行 Pod 的探针曾让 2 个副本重启过一次 | 首次部署时 liveness 早于 startupProbe 生效（`startupProbe` 期间 liveness 本不该跑，但探针参数偏紧）。已把 startup 的 `periodSeconds` 调到 5 / `failureThreshold` 60；后续 `helm upgrade --wait` 与 rollout 均一次通过 |
| **C5** | **CI 抓到两条真问题**（本机全绿、CI 红） | ① `cancel` 里 `status == CANCELLING` 的短路是错的：状态是 `cancelling` 只说明"信号已置且未终态"，**不说明有人在跑**——停在闸门等人的 run 正是这样，于是第二次取消永远回 `cancelling` 而**没人落终态**，那一轮卡死。本机没红是因为本地那条既有用例走的是"信号还没置"的路径；本批新增的「在途不清、终态后归档」用例把它逼出来了。② A2A 的常跑 E2E 在**没装 `a2a-sdk`** 的环境里抛 `ImportError`（CI 与开发机的 SDK 安装情况不同）。两条都已修，见 `0cd95983` |
| **C6** | **本批第一次触发了 `infra/helm/**` 路径过滤的几条 workflow**，于是"发现"了一批**预存红** | 逐条核过根因，**没有一条是本批引入的**：`helm-unittest` 卡在**插件安装**（`requested version "0.7.2" does not exist`，chart 都还没跑）；`helm template + kubeconform` 的 6 条 `could not find schema` 全来自 datahub / starrocks / observability-alerts / postgresql 的 **CRD**（本 chart 只出 Deployment/Service/ConfigMap/ServiceAccount/NetworkPolicy/Job 这些核心 kind，且汇总行是 `Invalid: 0`）；`Static chart checks` 是 workflow 头部**自己登记过的**债务（`infra tests 缺 sqlalchemy`，`continue-on-error: true`）；`kind cluster helm install + smoke` 失败在 `failed to install CRD crds/keycloak-realm-configmap.yaml: namespaces "metaplatform" not found`（装的是 keycloak 的 CRD，与 agent-team 无关）；`boot ontology-loop stack` 是 `.env.local not found`（CI 环境变量）；`Architecture kernel governance` 是 2.1-A §4-B7 已量过的 pyright 预存债（294 errors）。**完整清单见 §5.7** |

## 5. 回归

### 5.1 13 硬规则门禁

| 门禁 | 结论 |
| --- | --- |
| ga-001 oasdiff | 契约改动均为**附加式**：新增字段（`external_agent_calls` / `runtime_calls` / `approval_gate`）+ 一个 enum 值（`source: external`）+ 一个状态值（`cancelling`）+ 一个新 schema（`ApprovalGate` / `RunCancelAccepted`）+ 一个新头（`Last-Event-ID`）。**一处破坏性变更**：cancel 的响应从 `200 RunState` 改为 `202 RunCancelAccepted`——**有意的**（旧语义在多副本下不成立），已随契约与用例一起改 |
| ga-002 requirement IDs | `lint-and-bundle` / `traceability` / `runtime-parity` 全绿；**无新增 operationId** → `REQUIREMENT-MATRIX.yaml` 不需要动 |
| ga-003 forbid_raw_sql | 新表（`active_run_lease` / `run_event`）全部走既有 `TenantConnections.for_tenant` + 事务级 GUC |
| ga-004 forbid_bare_httpx | 本批**没有**新的外部 HTTP 调用（K8s 访问走 `kubectl`/`ctr`，不在服务代码里） |
| ga-005 forbid_legacy_fallback | 新增的三处"读不出来就取默认"全部是**收窄方向**（`ApprovalGate.from_dict` 读不出→退回旧语义；`control_dsn` 没配→回落 admin 的**本地形态**；`role` 没配→`all`） |
| ga-006 ruff + pyright | `ruff check` / `ruff format --check` 全绿（agent-team 92 文件） |
| ga-007 forbid_skip_tests | 本批新增 86 条用例；本机 `0 skipped`。**CI 上是 3 skipped** —— 那 3 条是**既有的** `importorskip`（CI 的 venv 没装 `a2a-sdk`，开发机装了），规则 7 明确放行 `importorskip`。本批**新加**的用例一条都不 skip |
| ga-008 helm | `helm dependency update` + `helm lint`（umbrella + 新 chart）通过；`infra/tests` 2192 passed |
| ga-009 OTel | 未触及 |
| ga-010 require_evidence | 本文件 |
| ga-011 helm-docs | 新 chart 的 README 按 helm-docs 体例手写（含 Values 表）；本地无 `helm-docs`（CI 那条 job 是 `continue-on-error`） |
| ga-012 gitleaks | 无密钥入库。**注意**：`values-local.yaml` 与 `verify/postgres.yaml` 里出现的是 Docker 栈公开的**本地开发口令**（`meta/meta`、`mate_app/mate_app`），不是任何真实凭据；`verify/secret.example.yaml` 一度写了字面 DSN，**已删除**（改由 README/注释给命令） |
| ga-013 NetworkPolicy | 新 chart 带默认拒绝的 NetworkPolicy（服务 + 沙箱各一条）；`validate_networkpolicy_coverage.py` 的口径未变（`agent-team` 本来就在 rule-13 对账清单里） |

### 5.2 复现命令

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_contracts.py && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe contracts/scripts/validate_traceability.py
```

```bash
cd infra/helm && helm dependency update && helm lint . && helm template agent-team charts/agent-team --set sandboxJob.enabled=true
```

```bash
cd infra && PYTHONIOENCODING=utf-8 ../mate-platform-backend/.venv/Scripts/python.exe -m pytest tests -q
```

### 5.3 多副本真集群实取

见 §1 前置那一段（3 副本 Ready / healthz 200 / 13 张表 + RLS）。

### 5.4 B-4 真集群实取

见 §1 B-4 那一段（迁移 Job Complete / 运行 Pod 无 admin DSN / 控制面能读检查点、读不了业务表）。

### 5.5 B-8 沙箱 Job 实取

```text
$ kubectl logs -n mate-agent-team -l job-name=agent-team-sandbox-probe
GPG_KEY=…            HOME=/workspace      HOSTNAME=agent-team-sandbox-probe-nv25r
KUBERNETES_PORT=…    KUBERNETES_SERVICE_HOST=10.96.0.1
LANG=C.UTF-8         PATH=…               PIP_INDEX_URL=…
PORT=8013            PWD=/app             PYTHONDONTWRITEBYTECODE=1
PYTHONIOENCODING=utf-8  PYTHON_SHA256=…   PYTHON_VERSION=3.12.14
TMPDIR=/tmp

$ kubectl logs … | grep -ciE "DSN|SECRET|PASSWORD|TOKEN|KEYCLOAK|POSTGRES|CREDENTIAL|PRIVATE"
0
```

### 5.6 提交

| commit | 内容 |
| --- | --- |
| `9c3d0e93` | B-5 租户连接源事务化 + 归还前 RESET |
| `7277c744` | B-1 活跃 run 租约 / 心跳 / 四条件接管 |
| `33d0dc98` | B-7 A2A 出站计量拆分 + 回执如实的 E2E |
| `3fd19870` | B-2 Run 事件日志 + SSE 按 sequence 续传 |
| `98ff468b` | B-3 取消改异步受理 + 中间态可观测 + 信号归档 |
| `43645e81` | B-6 HITL gate 统一协议（多级 / 会签 / 超时） |
| `f2832e02` | 前置 MP-REPLICA-READINESS-01 + B-8 沙箱 Job |
| `23749e7c` | B-4 Admin DSN 移出运行 Pod + 独立控制面身份 |
| `69556fa2` | 本文件（2.1-B 验收证据） |
| `0cd95983` | CI 抓出的两条真问题的修复（cancel 短路 / A2A 无 SDK 环境的落点） |

共 10 个 commit，50 个文件。

### 5.7 CI 实跑：required 全绿 + 预存红清单

**11 条 required check 全部 pass**（`gh pr checks 61` 实取）：

```text
Architecture tests (import-linter + four-layer guardrails)  pass
Frontend (metaplatform-frontend)                            pass
Lint (ruff)                                                 pass
Type check (pyright strict)                                 pass
Validate compose + Dockerfiles                              pass
agent-team pytest (mate-tech-agent-team)                    pass   ← 第一轮红过，见 §4-C5①
ga format (pre-commit: rules 3 / 4 / 5 / 7 / 10 / 12)       pass
ga tests (infra + mate-platform + mate-app-kb + governance) pass
ga-014 Ontology PostgreSQL RLS isolation                    pass
lint-and-bundle                                             pass
traceability                                                pass
```

**第一轮 `agent-team pytest` 红过**，根因是本批自己的两条代码 bug（§4-C5）——
**门禁真的在本批的代码上抓到了东西**，与 2.1-A 的结论一致。

**非 required 的预存红（逐条核过，没有一条由本批引入）**：

| job | 根因 | 与本批的关系 |
| --- | --- | --- |
| `helm-unittest` | `helm plugin install … --version 0.7.2` → `requested version "0.7.2" does not exist`。卡在**装插件**，chart 一个都没跑 | 无关（工作流自身坏） |
| `helm template + kubeconform` | 6 条 `could not find schema for {Dataset,DataProduct,PrometheusRule,DataJob,ServiceMonitor,SealedSecret}` —— 全是他 chart 的 CRD；汇总 `Invalid: 0` | 无关（本 chart 只出核心 kind） |
| `Static chart checks (Python + YAML)` | `ModuleNotFoundError: No module named 'sqlalchemy'`（`infra/tests/test_data_d0_d8_d1.py`）—— workflow 头部**自己登记过**的债务，`continue-on-error: true` | 无关（预存） |
| `kind cluster helm install + smoke` | `failed to install CRD crds/keycloak-realm-configmap.yaml: namespaces "metaplatform" not found` | 无关（装的是 keycloak CRD） |
| `boot ontology-loop stack` / `playwright ontology-loop e2e` | `.env.local not found`（CI 环境变量缺失） | 无关 |
| `Architecture kernel governance` | `Pyright strict (kernel + tests)` 294 errors —— 2.1-A §4-B7 已量过（当时 295），`continue-on-error: true` | 无关（预存债） |
| `helm-docs sync` | `continue-on-error: true`（helm-docs 下载源失效，workflow 头部登记） | 无关 |

> **为什么这些"红"以前没出现过**：`platform-k8s-ci.yml` 等几条 workflow 带
> `paths: [infra/helm/**, …]` 过滤——**本批是近期第一个动 `infra/helm/**` 的 PR**，
> 于是把它们唤醒了。这与 2.1-A §4-B6/B7 是同一类现象（预存红只在特定路径被触发时
> 才显形），**不是本批引入的回归**。逐条根因见上表。

## 6. 遗留与建议

1. **判据 ⑦ 的端到端补做**（§4-A1）：全栈进集群之后，把"杀 Pod → 30s 接管续跑"跑一遍。
   机制层已验，缺的是那一次端到端。这是本批**最该接着做的一件事**。
2. **`MP-REPLICA-READINESS-01` 的 kind 验证脚本值得收进 CI**：本批是手敲的
   （`kind create` → `docker save` → `ctr images import` → `helm install`）。
   把它写成 `scripts/ci/` 下的一个脚本，`platform-k8s-ci.yml` 就有了"真的起得来多副本"
   这条判据，而不是只有静态 lint。
3. **控制面口令仍走 `--set`**（§4-A3）：生产要改成 Secret 引用。chart 里 `secretRef.keys`
   已经留好了位置。
4. **`PgRunIndex` 的控制面 DSN 只授了 `checkpoints` 的 SELECT**：如果将来恢复扫描要
   读别的表（比如租约表），记得**同步扩授**并在这里登记——不要让"顺便读一下"变成
   默认。
5. **B-6 的 `gate_type` 只有一种**：第二种闸门出现时，`required_roles` 的"有序层级"
   语义够不够用要重新判断（当前实现里，一个决定按**角色**归级，先到的两级决定
   互不阻塞）。
6. **平台季度计划未落档**：`MetaPlatform-调整优化方案执行计划-2026-09-17.md` 是维护者的
   在途文档，本批**只挂靠不改、也没提交它**。本批引用的量化准出（`POST /runs` p95、
   SSE 首事件 p95、3 副本、30s 接管、10s 取消）**数值只在那一份里定义**，本文件不重定义、
   也不声称达成——只把"本批能验的那几条"逐条对位（§2）。
