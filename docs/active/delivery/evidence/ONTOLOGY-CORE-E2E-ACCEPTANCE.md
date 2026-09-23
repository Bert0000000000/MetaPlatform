# ONTOLOGY-CORE-E2E 验收证据（本体核心闭环 E2E：单 Job · 真实栈 · 无 continue-on-error）

> **批次**：ONTOLOGY-CORE-E2E（ontology-loop 工作流重建）
> **日期**：2026-09-23
> **分支**：`feat/ontology-core-e2e`（基于 `origin/main@215fbc03`）
> **决策**：ADR-0076（`docs/active/decisions/ADR-0076-ontology-core-e2e.md`）
> **工作流**：`.github/workflows/ontology-loop.yml`（job `ontology core e2e`）
> **Requirement ID**：`FR-ONTOLOGY-CORE-E2E`

## 1. 问题与根因（实测定位）

| # | 根因 | 后果 |
| --- | --- | --- |
| 1 跨 Job localhost | `boot-stack` 与 `e2e-playwright` 是**两个 Job**；后者用 `E2E_GATEWAY_URL=http://localhost:8100/api/v1` | 两 Job 在不同 Runner → localhost 不共享 → 前端/浏览器永远连不上网关 |
| 2 依赖不匹配 | 启动清单缺 **keycloak + mate-auth-service**（网关 `/iam/*` → auth-service:8101 → keycloak） | 真实登录无从成功；E2E 无 token |
| 3 过度依赖 | 还起了 agent / copilot / a2a / hub / dw | 把本体验收绑死在 Agent/LLM/A2A（违反"不依赖 Agent"） |
| 4 长期豁免 | 两个 Job 均 `continue-on-error: true` | 红了不阻塞、无人修；旧 `ontology-loop-wait-healthy.sh` 探的端口与实际发布面不符，制造假红 |

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `scripts/ci/ontology-core-e2e.sh` | **唯一命令集**（CI 与本地同一套）：`all|up|wait|test|down`；最小栈 + 真实登录健康探针 + 前端 + 清理 |
| `metaplatform-frontend/tests/e2e/ontology-loop/ontology-core.spec.ts` | 本体核心闭环 9 项（真实栈、专用命名空间、含 4 类负例） |
| `docs/active/decisions/ADR-0076-ontology-core-e2e.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONTOLOGY-CORE-E2E-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `.github/workflows/ontology-loop.yml` | 两个 Job → **一个 Job**；只起 7 个本体闭环服务；**移除全部 `continue-on-error`**；失败转储日志 + `always()` 上传 trace/截图/报告 + `always()` 清理；`pull_request` 去掉 `paths`（使 check 可 required） |
| `metaplatform-frontend/playwright.config.ts` | 新增 `ontology-loop-core` 项目（自带真实登录，不依赖 auth-setup 的 storageState） |
| `metaplatform-frontend/tests/e2e/helpers/pg.ts` | 默认密码对齐 compose 内置默认（`mate-pass` → `meta`） |

**删除**：`scripts/ci/ontology-loop-wait-healthy.sh`（端口/服务与 compose 实际发布面不符，
已被 `ontology-core-e2e.sh wait` 取代；无任何工作流引用）。

## 3. 实现要点

- **单 Job**：启动/健康/前端/测试/清理同 Runner —— 消除跨 Job localhost 假设。
- **最小依赖**：`postgres redis neo4j keycloak mate-auth-service mate-tech-ont mate-api-gateway`
  （经 `docker compose config --services` 逐一核对）。
- **真实登录健康门**：`wait` 阶段要求 `/iam/auth/login` 返回 200 才算就绪（Keycloak 冷启动约 3 分钟）。
- **不 mock**：spec 走真实 Keycloak → 网关 → ont → PG；`pg` helper 只用于播种确定性源表与安全断言。
- **确定性**：专用命名空间 `core-e2e-*`；schema upsert；幂等键按 proposal 派生（跨运行不冲突）。

## 4. 测试命令与真实结果（2026-09-23 实测，本地真实栈）

| 命令 | 结果 |
| --- | --- |
| `npx playwright test --project=ontology-loop-core --workers=1` | **9 passed / 0 failed**（8.3s） |
| 同上（连续第 2、3 次重跑） | **9 passed**（确定性） |
| `E2E_REUSE=1 bash scripts/ci/ontology-core-e2e.sh test` | **9 passed**（同一套命令集） |
| `docker compose config --services` 核对 7 服务 | 全部存在 |
| `tsc --noEmit`（spec 单文件） | exit 0 |
| workflow YAML 解析：job 数 / `continue-on-error` / 触发器 | 1 / **无** / push+PR+dispatch |

**用例覆盖**：

| # | 用例 | 断言要点 |
| --- | --- | --- |
| 1 | 建模 | ObjectType(+parent_class) / LinkType / ActionType 落库；`hierarchy` 与详情读回一致 |
| 2 | 数据映射与同步 | 真源表 5 行 → 声明背挂源 → `sync` → **逐字段对账**（`total_failed=0`） |
| 3 | 对象与关系查询 | 个体列表、关系写入、`/individuals/{rid}/around` 一跳遍历命中对端 |
| 4 | Proposal | 预检 `blocked=false` → 确认 → 执行 → 个体落库 + 提案终态 `executed` |
| 5 | 违规数据 | 缺主键 → 预检 `blocked=true` → 执行 **409** 且**不落库** |
| 6 | 重复提交 | 同 `Idempotency-Key` 重复 confirm/execute → 语义不变，效果唯一 |
| 7 | 失败恢复 | 目标不存在 → 执行显式 4xx；随后有效 Action（propose→confirm→execute）成功并留 **action-audit** |
| 8 | 跨租户拒绝 | 异租户 rid 的类型写入 / 读取 / 关系写入一律 **4xx** |
| 9 | 前端 | 本体页面在真实后端下无未捕获错误（截图/Trace 价值） |

## 5. 已知边界

1. **realm 只有 `tenant-default`**（两个用户同租户）→ 跨租户用例是"异租户 rid 前缀 → 4xx"，
   不是"两个真实租户互访"；后者需改 Keycloak realm（未做）。
2. **Required Checks 未立即打开**：先去掉 `continue-on-error`，待该 check 在 `main` 上
   连续若干次绿再加（命令见 ADR-0076 §4.3）。
3. `pull_request` 去掉 `paths` → 该 check 将在所有 PR 上运行（docker 栈 ~8–12 分钟）。
4. 历史 spec（consistency/a2a/evaluation/model-edit/routing）不纳入本工作流（依赖 Agent/A2A）。
5. 本地运行会向共享 dev 库写 `core-e2e-*` 命名空间数据（源表在套件结束删除；schema/个体保留）。
6. **回滚**：`git revert` 本批提交即恢复原双 Job 工作流（含 `continue-on-error`）。

## 6. 结论

**准出达成**：跨 Job localhost 假设消除（单 Job）、依赖与真实登录对齐（含 keycloak/auth-service，
去掉 Agent/LLM/A2A 依赖）、真实栈不 mock、核心闭环 + 4 类负例全覆盖、确定性可重跑、
trace/截图/日志随失败留存、`continue-on-error` 全部取消。CI 与本地共用同一套命令。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | N/A 本批不改接口/契约（仅 E2E 调用既有端点） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONTOLOGY-CORE-E2E`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ E2E 专用命名空间；跨租户拒绝为显式用例（4xx） |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无新增外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ **本批核心之一**：取消 `continue-on-error`，失败即红；负例断言"失败显式、无副作用" |
| ga-006-static | 6 静态检查失败不合并 | ✅ `tsc --noEmit`（spec）exit 0；工作流 YAML 解析通过 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 9/9 全真跑（无 skip）；PG 门控仅在库不可达时跳过（本批实测可跑） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.6 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 断言 `action-audit` 留痕；失败留 Playwright trace/screenshot/video 并上传 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ `.env` 由脚本生成（测试默认口令，非生产 secret） |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
**commit**：`34bb8c65`（命令集 + spec + 删除旧健康脚本）、`4ffc01ec`（工作流单 Job）、`80627207`（ADR + 本验收证据）。
