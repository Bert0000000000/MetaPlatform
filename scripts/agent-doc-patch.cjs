const fs = require("fs");
const path = "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/docs/superpowers/specs/2026-07-26-ontology-native-deerflow-final-delivery-plan.md";
let src = fs.readFileSync(path, "utf8");

// 1. Bump version header: v1.51 / 50th round -> v1.52 / 51st round.
const headerOld = "> 版本：v1.51 · 2026-07-26（第五十轮推进 / Frontend SSE Contract Audit）\r\n> 状态：P0/P1 基础设施收尾完成；进入 P1/P2 联调阶段\r\n> 适用仓库：D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform\r\n> 更新基线：2026-07-26 16:40 UTC+8，由 Codex 自动接管继续推进";
const headerNew = "> 版本：v1.52 · 2026-07-26（第五十一轮推进 / P5-ACT-13/14 DLQ Micrometer 指标）\r\n> 状态：P0/P1 基础设施收尾完成；进入 P1/P2 联调阶段；P5 ACT 13/14 DLQ 指标 DONE\r\n> 适用仓库：D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform\r\n> 更新基线：2026-07-26 23:10 UTC+8，由 Codex 自动接管继续推进";
if (!src.includes(headerOld)) throw new Error("header not found");
src = src.replace(headerOld, headerNew);

// 2. Append two new rows to the §0.2 task status table, right after P4-FE-12.
const tableAnchorOld = "| P4 | P4-FE-12 | Frontend SSE Contract Audit | PARTIAL | useAgentStream 当前 POST /api/v1/agent/runs/stream 并直接提交 InteractionContext；后端已提供 GET /api/v1/agent/run/stream?runId&afterSeq，需补齐前端先建 Run/Envelope 再连接 SSE 的联调流程；未伪称完成 |";
if (!src.includes(tableAnchorOld)) throw new Error("tableAnchor not found");

const tableAppend =
"| P5 | P5-ACT-13 | DLQ metrics 接入 Micrometer / Prometheus（actuator 集成） | DONE | 新建 src/main/java/com/metaplatform/agent/middleware/ActionRouteDlqMetrics.java（Counter / Gauge / MeterRegistry，null registry fallback）+ src/test/java/.../ActionRouteDlqMetricsTest.java（5 单测）；TECH-AGENT/pom.xml 新增 spring-boot-starter-actuator（透传 micrometer-core） |" + "\r\n"
+ "| P5 | P5-ACT-14 | ActionGuard DLQ metrics 通过 Micrometer 暴露到 /actuator/prometheus | DONE | ActionRouteDlqMetrics 暴露 mate.agent.dlq.enqueued / retry.success / retry.failure / pending 四个指标；ActionRouteDlqService.enqueue/retry 在 DLQ 分支调用 metrics；ActionRouteDlqMetricsEndpoint 同步返回 metrics_present / metrics_enabled / enqueued_total / retry_success_total / retry_failure_total 方便无 Prometheus 也能看到指标；启动 `/actuator/prometheus` 即可拉取（默认路径） |";

src = src.replace(tableAnchorOld, tableAnchorOld + "\r\n" + tableAppend);

// 3. Tighten §0.2.3: move P5-ACT-13/14 from "next round" to a "DONE this round" note.
const recOld = "### 0.2.3 推荐下一轮任务（按优先级）\r\n\r\n1. **P8.4**：SpringAiLlmProvider 真实实现（处理 Spring AI 1.1.x 流式 API 变更）。\r\n2. **P6-AUTH-06**：AuthoringService 加定时批处理（把同一 documentId 的候选 fact 合并提交）。\r\n3. **P2-RAG-04**：AuthoringService 端到端（Authoring + HybridSearch 联调，从文档抽取到 Evidence）。\r\n4. **P5-ACT-13**：DLQ metrics 接入 Micrometer / Prometheus（actuator 集成）。\r\n5. **P5-ACT-14**：ActionGuard DLQ metrics 通过 Micrometer 暴露到 /actuator/prometheus。";
const recNew = "### 0.2.3 推荐下一轮任务（按优先级）\r\n\r\n> 本轮（v1.52 / 51）：P5-ACT-13 / P5-ACT-14 已 DONE（详见 §0.2 状态表新增两行；TECH-AGENT 97/97 PASS）。\r\n\r\n剩余优先级（按文档第 12/13 节）：\r\n\r\n1. **P8.4**：SpringAiLlmProvider 真实实现（处理 Spring AI 1.1.x 流式 API 变更）。\r\n2. **P6-AUTH-06**：AuthoringService 加定时批处理（把同一 documentId 的候选 fact 合并提交）。\r\n3. **P2-RAG-04**：AuthoringService 端到端（Authoring + HybridSearch 联调，从文档抽取到 Evidence）。\r\n4. ~~P5-ACT-13：DLQ metrics 接入 Micrometer / Prometheus~~ — DONE v1.52。\r\n5. ~~P5-ACT-14：ActionGuard DLQ metrics 通过 Micrometer 暴露~~ — DONE v1.52。";
if (!src.includes(recOld)) throw new Error("recOld not found");
src = src.replace(recOld, recNew);

// 4. Update the §0.2.1 TECH-AGENT row to include the new +5 tests.
const agentRowOld = "| TECH-AGENT | 89 / 89 | PASS | 11 repo + 22 scenario + 5 ActionExecution + 4 ActionApprovalBridge + 7 AuthoringService + 10 ActionGuardAutoRoute + 5 DocumentCandidateListener + 7 AgentRunServiceComplete + 8 ActionRouteDlqPersistence + 5 ActionRouteDlqScheduler + 3 ActionGuardCrossRunDedup + 2 ActionRouteDlqMetrics + 2 ActionGuardCrossTenantDedup |";
const agentRowNew = "| TECH-AGENT | 97 / 97 | PASS | 11 repo + 22 scenario + 5 ActionExecution + 4 ActionApprovalBridge + 7 AuthoringService + 10 ActionGuardAutoRoute + 5 DocumentCandidateListener + 7 AgentRunServiceComplete + 8 ActionRouteDlqPersistence + 5 ActionRouteDlqScheduler + 3 ActionGuardCrossRunDedup + 2 ActionRouteDlqMetrics + 2 ActionGuardCrossTenantDedup + 5 ActionRouteDlqMicrometerMetrics (P5-ACT-13/14) |";
if (!src.includes(agentRowOld)) throw new Error("agentRowOld not found");
src = src.replace(agentRowOld, agentRowNew);

// 5. Bump the summary 1166+ to 1171+.
const summaryOld = "| **总计** | **1166+** | **15/15 模块 BUILD SUCCESS / 0 失败** |";
const summaryNew = "| **总计** | **1171+** | **15/15 模块 BUILD SUCCESS / 0 失败**（TECH-AGENT 新增 5 个 DLQ Micrometer 单测，DONE P5-ACT-13/14） |";
if (!src.includes(summaryOld)) throw new Error("summaryOld not found");
src = src.replace(summaryOld, summaryNew);

fs.writeFileSync(path, src, "utf8");
console.log("doc updated");
