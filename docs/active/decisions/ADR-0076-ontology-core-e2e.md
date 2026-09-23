# ADR-0076：Ontology Core E2E（单 Job · 本体最小依赖 · 真实栈 · 取消 continue-on-error）

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：GOVERN-11（本体闭环验收）、ADR-0064（统一执行器 / `/apply` 退役）、
  ADR-0074/0075（模型原子性 / 关系并发）、13 硬规则 #5（禁止伪成功）

## 1. 背景

`.github/workflows/ontology-loop.yml` 长期红且被 `continue-on-error: true` 掩盖。实测定位三处**结构性**缺陷：

1. **跨 Job 假定共享 localhost**：`boot-stack` 起栈、`e2e-playwright` 在**另一个 Job**
   用 `E2E_GATEWAY_URL=http://localhost:8100/api/v1`。GitHub 的每个 Job 是**独立 Runner**，
   localhost 不共享 → 前端/浏览器永远连不上网关，**必然失败**。
2. **启动清单与真实依赖不符**：缺少真实登录所需的 **keycloak + mate-auth-service**
   （网关 `/iam/*` → `mate-auth-service:8101` → keycloak），登录无从成功；同时多起了
   `mate-tech-agent / mate-app-copilot / mate-app-a2a / mate-app-hub / mate-tech-dw`
   等**本体闭环不需要**的服务（把验收绑死在 Agent/LLM/A2A 上）。
3. **长期 `continue-on-error`**：启动与 E2E 两个 Job 都是 `continue-on-error: true`
   （"债务登记"），红了不阻塞、也无人修。

此外旧 `scripts/ci/ontology-loop-wait-healthy.sh` 探的端口/服务与 compose 实际发布面
不一致（探 8501/8531/8521… 而实际是 8007/8021/8002…），进一步制造假红。

## 2. 决策

### 2.1 单一 Job 内完成全流程

启动 → 健康 → 前端 → 测试 → **always 清理**全部在**同一个 Job**（同一 Runner）内完成，
localhost 语义成立。

### 2.2 只起本体闭环最小依赖

`postgres, redis, neo4j, keycloak, mate-auth-service, mate-tech-ont, mate-api-gateway`
（其中 neo4j/postgres 是 ont 的 `depends_on`；keycloak+auth-service 是**真实登录**所必需）。
**不含** Agent / LLM Gateway / A2A / Copilot / Hub / DW —— 本体闭环不依赖它们。

### 2.3 唯一命令集（CI 与本地同一套）

`scripts/ci/ontology-core-e2e.sh {all|up|wait|test|down}`：
- 干净 Runner：`bash scripts/ci/ontology-core-e2e.sh all`（生成最小 `.env` → 起栈 → 等健康
  → 跑 E2E → 清理）；
- 本地已有栈：`E2E_REUSE=1 bash scripts/ci/ontology-core-e2e.sh test`。
工作流只调用这一个脚本，不再内联 compose/健康逻辑；旧的 `ontology-loop-wait-healthy.sh` 删除。

### 2.4 真实栈、不 mock、确定性

`tests/e2e/ontology-loop/ontology-core.spec.ts`（Playwright 项目 `ontology-loop-core`）：
真实 Keycloak 登录 → 真实网关 → 真实 ont + PG。**不 mock** 被验收的接口与数据库。
数据落在专用命名空间 `core-e2e-*`，schema 走 upsert、幂等键按 proposal 派生 →
**可重复运行**（实测连跑 3 次均 9/9）。

覆盖：建模（ObjectType+层级/LinkType/ActionType）→ 数据映射与同步（真源表→同步→逐字段对账）
→ 对象/关系查询（列表/关系写入/一跳遍历）→ Proposal 确认执行 → 审计；
负例：**违规数据**（预检 409 且不落库）、**重复提交**（同 Idempotency-Key 重放）、
**失败恢复**（目标不存在 → 执行显式 4xx 且无副作用，随后有效请求成功）、
**跨租户拒绝**（异租户 rid 读写/关系写入一律 4xx）。
失败的 **trace / screenshot / video** 由 Playwright 配置留存并在工作流 `if: always()` 上传。

### 2.5 取消 continue-on-error

两个 Job 合并为一个且**去掉所有 `continue-on-error`**；失败即红。
`pull_request` 触发器**不加 `paths` 过滤**，使该 check 能在所有 PR 上报到
（带 `paths` 会让不相关 PR 永久 pending）。加入 Required Checks 见 §4.3。

## 3. 不做的

- 不删除历史 spec（`consistency/a2a/evaluation/model-edit/routing`）：它们依赖
  dw/copilot/a2a，超出本工作流范围，仍保留在其项目名下方可运行。
- 不为"第二个租户"改 Keycloak realm：本环境 realm 只有 `tenant-default`（两个用户同租户），
  跨租户以**异租户 rid 前缀**驱动守门（真实网关 + 真实 RLS/守卫，非 mock）。
- 不引入服务端 mock / stub（违反目标 §3）。

## 4. 实施与验证

### 4.1 本地实测（真实栈）

| 命令 | 结果 |
| --- | --- |
| `npx playwright test --project=ontology-loop-core --workers=1` | **9 passed**（8.3s） |
| 连续第 2、3 次重跑 | **9 passed**（确定性） |
| `E2E_REUSE=1 bash scripts/ci/ontology-core-e2e.sh test` | **9 passed**（同一套命令集） |
| `docker compose config --services` 逐一核对 7 个服务名 | 全部存在 |
| `tsc --noEmit`（spec） | exit 0 |
| `yaml.safe_load` 解析工作流 | 单 Job / 无 `continue-on-error` / 3 触发器 |

### 4.2 干净 Runner

工作流 steps：free ports → node/pnpm → 装前端依赖 + Chromium → 备 compose 输入 →
`script up` + `script wait` → `script test` → 失败转储容器日志 → `if: always()` 上传
Playwright 产物 → `if: always()` `script down`。**跨 Job 变量不再存在**。

### 4.3 Required Checks（待稳定）

取消 `continue-on-error` 后，待该 check 在 `main` 上连续若干次绿（且已上报过）再加：

```bash
gh api -X PATCH repos/Bert0000000000/MetaPlatform/branches/main/protection/required_status_checks \
  -F strict=false -f 'contexts[]=<现有 11 条...>' -f 'contexts[]=ontology core e2e'
```

（注意：`-f`/`-F` 写法与"新 job 名须先在 main 上报到"的既有约束见
`docs/active/governance` 与既往 memory。）

## 5. 已知边界

1. **realm 仅一个租户**：跨租户验证是"异租户 rid 前缀 → 4xx"，不是"两个真实租户互访"。
2. **keycloak 冷启动约 3 分钟**（`start_period: 180s`），单 Job 超时设 45 分钟。
3. `pull_request` 去掉 `paths` → 本 check 会在**所有 PR** 上跑（docker 栈 ~8–12 分钟）。
4. 历史 spec 未纳入本工作流（依赖 Agent/A2A）。
5. 本地跑会向共享 dev 库写 `core-e2e-*` 命名空间数据（源表在套件结束时删除）。
