# TECH-AGENT - Agent 框架服务

> Mate Platform Agent 框架服务（v1.3 全 Java + SAA 重写）。
> 是 Ontology-Native DeerFlow 集成方案的核心承载者。

## 关键能力

- Agent 定义 / 对话 / Plan / Checkpoint / Memory / SubAgent / Collaboration / Evaluation / Learning
- **DeerFlow Adapter**（P3.1）：包装 DeerFlow Gateway HTTP API
- **5 个 Ontology Middleware**（P3.1）：Context / Grounding / Permission / Evidence / ActionGuard
- **MiddlewareChain**（P3.1）：按 order() 排序的可插拔拦截链
- **SubAgentContextBuilder**（P3.2）：上下文隔离
- **WorkspaceProvisioner**（P3.2）：MinIO 工作区
- **K8sSandboxProvider**（P3.2）：每 Thread 独立 Pod
- **SkillRegistry / ScheduledAgentService / ArtifactService**（P3.3）
- **OnboardingMcpServer**（P3.3）：21 个 Ontology 工具的 MCP 暴露
- **Customer Copilot / SuperAI Page**（P4.2 / P4.3）前端
- **ActionPolicy + ActionProposal**（P5.1 / P5.2）：自动 / 审批 / 拒绝 三态
- **Document Extraction Trigger + Candidate Listener**（P6.1）
- **TriggerEngine + ContractExpiringTrigger**（P7.1 / P7.2）
- **MemoryService**（P7.3）：四层记忆 + PII 检测
- **NativeAgentRuntime**（P8.1）：不依赖 DeerFlow 的 Java 原生 Runtime

## Native Agent Runtime

P8.1 之后，MetaPlatform 默认走 Native Runtime，DeerFlow 降级为可选高级执行器：

```yaml
mate:
  runtime:
    mode: native   # 或 deerflow / hybrid
```

## Middleware 链

```text
1. OntologyContextMiddleware   order=100  envelope 校验
2. OntologyGroundingMiddleware order=200  NL → Concept/Metric/Action
3. OntologyPermissionMiddleware order=300 Tool 白名单
4. OntologyEvidenceMiddleware   order=400  Claim 强制绑定 Evidence
5. OntologyActionGuardMiddleware order=500  ActionProposal 风险分级
6. ObservationMiddleware        order=600  RunEvent 上报
7. ClarificationMiddleware      order=700  用户澄清中断
```

## 关键 API

| Method | Path | 用途 |
|---|---|---|
| POST | /api/v1/agent/agents/{id}/execute | 同步执行 |
| POST | /api/v1/agent/agents/{id}/execute/stream | SSE 流式 |
| POST | /api/v1/agent/superai/route | 路由判断 |
| POST | /api/v1/agent/superai/run | 启动 Run |
| POST | /api/v1/agent/skills | 注册 Skill |
| POST | /api/v1/agent/scheduled | 注册定时任务 |
| POST | /api/v1/agent/triggers | 注册事件触发器 |
| POST | /api/v1/agent/memories | 写企业记忆 |
| GET  | /api/v1/agent/memories?scope=... | 召回记忆 |

## 与 DeerFlow 关系

- 默认：Native Runtime（Java + SAA）
- 可选：DeerFlow Adapter 包装 Gateway
- 配置：`mate.runtime.mode`
