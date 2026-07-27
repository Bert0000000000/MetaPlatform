# Ontology-Native DeerFlow · 全栈 E2E 路线图

> 版本：v1.0 · 2026-07-26
> 状态：执行中
> 路线总时长：~1-2 周（4 个批次 + 1 个集成验证）
> 输入：
> - 主文档 `2026-07-26-ontology-deerflow-phase1-interfaces.md`
> - 补丁 `2026-07-26-ontology-deerflow-phase1-interfaces-errata.md`
> - 代工清单 `2026-07-26-ontology-deerflow-engineering-handoff.md`
> - 启动 prompt `2026-07-26-ai-launch-prompt.md`
> - 本次 WIP commit 已含前端骨架与后端 schema

## 0. 全局总览：4 个批次 + 1 个集成

```
┌─ 批次 A：前端对齐（半天）               ┐
│  状态：执行中                           │
├─ 批次 B：后端 Controller/Service（2-3天）┤
│  状态：未开始（依赖 6 个 entity 生成）   │
├─ 批次 C：DeerFlow + 基础部署（1-2 天）  │
│  状态：未开始（依赖 Nacos 3 / MinIO）   │
├─ 批次 D：E2E 测试（1 天）              ┤
│  状态：未开始（依赖 A + B + C）         │
└─ 集成：客户详情页 SuperAI（半天）        ┘
   状态：最后一步
```

| 批次 | 工时 | 可并行 |
|---|---|---|
| A 前端对齐 | 0.5 天 | 是 |
| B 后端 API | 2-3 天 | 与 A 并行 |
| C 基础部署 | 1-2 天 | 与 A+B 并行 |
| D E2E 测试 | 1 天 | 必须 D 之前完成 |
| 集成验证 | 0.5 天 | — |

**最短路径**：A + B + C 并行，D 串行，集成。总时长 ~3.5-5.5 个工作日。

## 1. 批次 A — 前端接口对齐（半天）

### 目标
让前端 5 个组件按今天新 OpenAPI spec 工作，与后端连接时不会 404。

### 文件清单（已存在，需 patch）

| 文件 | 现有问题 | 改动 |
|---|---|---|
| `metaplatform-frontend/packages/shared/src/interaction/SuperAIApi.ts` | 路径 `/api/v1/agent/context/build` 是旧的 | 改到 `/ontology/context/build` |
| 同上 | SSE endpoint 路径 `/agent/agents/{id}/execute/stream` 是旧的 | 改到 `POST /agent/runs` 后接流（OpenAPI 缺明示 SSE 路径） |
| 同上 | `RunEvent` interface 与 OpenAPI 不齐（缺 `traceId` / `tenantId` / `seq` / `payload`） | 改名为 `RunEventV1` 并对齐 OpenAPI schema |
| `metaplatform-frontend/packages/shared/src/interaction/InteractionContextProvider.tsx` | 缺 `selectedText` / `clientHints` | 增加这两个字段 |
| `packages/shared/src/renderers/ClaimRenderer.tsx` | `evidenceRefs?` 可空，主文档要求 FACT 必填 ≥1 | 仅前端警告（不阻断） |
| `EvidenceRenderer.tsx` / `ArtifactViewer.tsx` | 与 OpenAPI schema 兼容，不需改 | — |

### 验收
- [ ] SuperAIApi.ts 路径全部对齐 OpenAPI
- [ ] InteractionContext JSON 序列化含 `selectedText` 与 `clientHints`
- [ ] 前端 `npm run build` 无错
- [ ] 前端发请求不再 404（用 mock 后端验证或真实后端）

### 启动 prompt（下次新会话直接复制）

```text
【批次 A 启动 prompt】

任务：把 metaplatform-frontend 5 个组件对齐到 OpenAPI spec：
docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1.yaml

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

具体改动（详见 §1 表格）：
1. SuperAIApi.ts 改路径 /ontology/context/build、POST /agent/runs 等
2. InteractionContextProvider.tsx 补 selectedText / clientHints 字段
3. RunEvent 接口对齐 OpenAPI 21 种事件 schema

约束：
- 不动渲染组件（Claim / Evidence / Artifact）的 props
- 不改 CreateContext 之外的 React API 形态
- 不增加新依赖

完成后跑 npm run build 验证。
```

## 2. 批次 B — 后端 Controller / Service（2-3 天）

### 目标
按 OpenAPI 实现 13 个 endpoint。

### 必新建 / 必修改的 Java 类

| 模块 | 类型 | 内容 |
|---|---|---|
| TECH-ONT | Controller | 已有 `OntologyContextController`，补全 `getEnvelope` |
| TECH-ONT | Service | 已有 `OntologyContextService`，加验签逻辑 |
| TECH-AGENT | Controller | 新建 `AgentRunController`（POST/GET/Cancel/Lists） |
| TECH-AGENT | Controller | 新建 `RunEventController`（流式 + 历史） |
| TECH-AGENT | Controller | 新建 `ClaimController` + `EvidenceController` + `ArtifactController` |
| TECH-AGENT | Controller | 新建 `ActionProposalController` |
| TECH-AGENT | Service | `AgentRunService` / `RunEventService` / `ClaimService` / `ArtifactService` / `ActionProposalService` |
| TECH-AGENT | Repository | 6 个 AI 助手已生成的 Repository 补齐 |

### 必填业务逻辑
- Envelope.signature 验签（HS256/RS256，kid 指向 KMS）
- Envelope.expiry 校验（expiresAt 过期返回 ENVELOPE_EXPIRED）
- AgentRun 创建时落 PENDING → 启动 DeerFlow → 回收 runId → RUNNING
- RunEvent 先持久化后转发（RE-2 / C6 不变量）
- 13 种 error code 映射至 HTTP 状态码

### 验收
- [ ] 13 个 endpoint 在 swagger-ui 可见
- [ ] 错误码映射正确（ENVELOPE_EXPIRED → 410 等）
- [ ] DeferFlow 适配层（批次 C 完成后真正联调）

### 启动 prompt（尚未写）

> OK: docs/superpowers/specs/2026-07-26-ai-launch-prompt-batchB.md exists, ready to copy-paste.

## 3. 批次 C — 基础部署（1-2 天）

### 目标
把 Postgres / MinIO / Nacos / DeerFlow Gateway 部署到位。

### 子任务

| # | 任务 | 关键文件 |
|---|---|---|
| C-1 | Nacos 3.0.2+ 升级（替换 v2.4.3-slim） | `docker-compose.yml`、`docs/NACOS-3.0-POC-CHECKLIST.md` |
| C-2 | MinIO 服务加入 compose | `docker-compose.yml` |
| C-3 | Kafka / Loki / RabbitMQ（按需） | `docker-compose.yml` |
| C-4 | 多库脚本（metaplatform / metaplatform_ont / metaplatform_agent / metaplatform_obs / metaplatform_kb） | `infra/init-multiple-databases.sql` |
| C-5 | 6 个 Flyway migration 落到各库 | 已在 V4-V8 / V14 中 |
| C-6 | DeerFlow Gateway 在 K8s namespace `mate-deerflow` 部署 | `k8s/deerflow/*.yaml`、Helm values |
| C-7 | NetworkPolicy / Secret 管理 | `k8s/deerflow/network-policy.yaml` |

### 注意：仓库基础问题
当前基线 6 个文件编译失败（ArtifactService / DocumentCandidateListener / ContractExpiringTrigger / K8sSandboxProvider / WorkspaceProvisioner / OntologyDraftService）。  
**批次 B 与 C 启动前必须先解决这些基线问题**，或在工作流中显式跳过。

### 启动 prompt（尚未写）

## 4. 批次 D — E2E 测试（1 天）

### 目标
按主文档 §8.3（15 条 AC）+ §8.4（第一验收场景）实现端到端测试。

### 测试框架
- Playwright（前端 e2e）
- JUnit 5 + Testcontainers（后端契约测试）
- 端到端：前端 → TECH-AGENT Gateway → DeerFlow → MinIO / Postgres

### 第一个验收场景
「客户详情页 → SuperAI → 分析销售下降 → 返回带 Evidence + Claim 的分析」

### 验收
- [ ] 15 条 AC 全绿
- [ ] 第一场景通过率 ≥ 95%（连续 5 天）

### 启动 prompt（尚未写）

## 5. 批次依赖与并行机会

```
A 前端对齐  ──┐
              ├──→ D E2E 测试  ──→ 集成验证
B 后端 API  ──┤
C 基础部署  ──┘
```

- A 与 B 与 C 完全可并行（人手足够时）
- D 必须等 A+B+C 都完成
- 集成验证等 D 完成

## 6. 风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| 仓库基线 6 个文件编译失败 | A 不受影响；B / C 都受影响 | 批次 B / C 启动前先做 0.5 天基线清理 |
| LLMGW Java 重写延期 | 全栈阻塞 | 不在路线图范围；推后到独立工单 |
| K8s 集群不具备 | C 卡死 | 本地用 kind/k3d，生产由 ops |
| Sandbox 安全审计不通过 | C 卡死 | NetworkPolicy / 资源限制先行 |
| DeerFlow 上游破坏性升级 | Adapter 重做 | 严格用 Sub-Agent / Hook 接口，少改核心 |

## 7. 立即可执行：批次 A 已开始

见下文 session 内执行结果。本路线图与 §1 启动 prompt 由 session 内产生。

## 8. 文档维护

- 每个批次完成时，更新本文档对应章节状态
- 批次 B / C / D 启动 prompt 在 §2-§4 链接处追加独立 .md
- 集成验证通过后，本文档升级为 v1.1 archived