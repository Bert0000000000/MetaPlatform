# Mate Platform（MetaPlatform）

> 2026-07-26 v1.3 落地
> 已完成 Ontology-Native DeerFlow 全 8 阶段集成。

## 关键能力

- **Ontology 引擎**（TECH-ONT）：Concept / Object / Metric / Action / Event / Version
- **Ontology Context Envelope**：DeerFlow / Agent 的不可变业务上下文 + 签名 + 5 分钟 TTL
- **OpenAI 兼容 LLMGW**（TECH-LLMGW）：DeerFlow Adapter 可直接用 `base_url=https://llmgw/v1` 调用
- **Ontology 治理闭环**：Candidate Fact → Validator → Draft → Approve → Commit → Version Diff
- **KB / RAG 闭环**（APP-KB / TECH-RAG）：文档 → 切片（4 策略） → 向量化 → Milvus → 引用回溯
- **DeerFlow 接入**（TECH-AGENT）：Adapter + 5 个 Ontology Middleware + MiddlewareChain
- **Sub-Agent 隔离 + K8s Sandbox**：每 Thread 独立 Pod
- **Skills / Scheduled / MCP / Artifact**
- **SuperAI 统一入口**：InteractionContext + Claim/Evidence/Artifact + Object Copilot + 跨域路由
- **Action 治理**：ActionPolicy + ActionProposal + Approve/Reject + 幂等执行
- **Authoring 流水线**：Document → DeerFlow Extraction → Candidate Fact → Draft → Commit
- **事件驱动**：TriggerEngine + ContractExpiringTrigger + Ontology DomainEvent
- **企业长期记忆**：Working/Episodic/Semantic/Organizational 四层 + PII 检测
- **Native Agent Runtime**：P8.1 不依赖 DeerFlow 的 Java + SAA 原生 Runtime

## 8 阶段落地录像

详见 [docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md](docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md)。

## 启动

```bash
# 启动基础设施
docker compose up -d

# 启动 TECH-* 服务（按 start-tech-services.ps1）
./start-tech-services.ps1

# 启动前端
cd metaplatform-frontend
pnpm install
pnpm dev
```

## 关键文档

- [设计基线](docs/superpowers/specs/2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md)
- [落地录像](docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md)
- [TECH-AGENT README](TECH-AGENT/README.md)
- [TECH-ONT / Context Service](TECH-ONT/src/main/java/com/metaplatform/ont/context/)
- [TECH-LLMGW OpenAI 兼容层](TECH-LLMGW/src/main/java/com/metaplatform/llmgw/openai/)
- [TECH-RAG Milvus + Ontology Filter](TECH-RAG/src/main/java/com/metaplatform/rag/milvus/)
