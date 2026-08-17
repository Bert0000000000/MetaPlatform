# MP-SAL-02 ACCEPTANCE — OAG 检索上下文（想）

> **Batch**: MP-SAL-02（Semantic layer AI Landing · 02 · OAG 检索上下文，对位差距 G3）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-01`（SAL 系列同枝推进）
> **Spec**: `docs/active/specs/2026-08-17-semantic-layer-ai-landing-plan.md` v0.3 §4.2（SAL-02 段）
> **上游**: MP-SAL-01（IR 查询 + 工具面）已 Accepted（`MP-SAL-01-ACCEPTANCE.md`）

## 1. 交付范围

| 项 | 落点 | 状态 |
|---|---|---|
| 检索器（PG） | `mate_tech_ont/v2_kernel/object_search.py`（Embedder 协议 + HashEmbedder 离线确定性实现 + OpenAI 兼容 env embedder + cosine）+ `ont_object_embedding` 表（属性级 chunk，index-on-write，best-effort 不阻断主写入）+ `search_objects`（cosine 召回 → 对象卡片）+ `reindex_object_embeddings`（存量补齐） | ✅ |
| 检索器（InMemory dev） | `InMemoryOntologyRepository.set_embedder/_index_embeddings/search_objects` 同语义 | ✅ |
| REST | `POST /api/v1/ont/v2/object-search`（ontSearchV2Objects，租户前缀校验）+ `POST /v2/object-search/reindex`（ontReindexV2ObjectSearch） | ✅ |
| **copilot 通道（核心）** | `ontology_tools` 固定第 4 工具 `search_objects`（注册+执行）；`agent_loop.build_system_prompt(roles, object_cards)` —— 检索命中的对象卡片以「相关对象上下文」段注入 system prompt，**每行显式带 individual_rid（可追溯）** | ✅ |
| 对象卡片契约 | `{individual_rid, class_rid, score, matched: [{property_rid, value_text, score}], card_text}` | ✅ |

**设计要点**：embedding 复用平台 PG 设施（JSONB + 进程内 cosine 的 dev 形态，与 tech-rag kb_chunks 同款；pgvector halfvec+HNSW 升级路径不变）；`OPENAI_API_KEY` 缺席时 embedder=None 索引跳过（dev 优雅降级），`ONT_EMBEDDER=hash` 强制离线确定性模式。

## 2. 契约（硬规则 1）

ont.yaml 30→**32 paths** / 54→**57 schemas**（yaml 校验通过）：`ObjectSearchV2` / `ObjectCardV2` / `ObjectSearchResultV2`；需求 ID `FR-ONT-SAL02-OBJECTSEARCH / -REINDEX`。

## 3. 测试证据（硬规则 7）

| 套件 | 结果 | 新增 |
|---|---|---|
| mate-tech-ont | **172+11=全绿**（全套 634 passed / 8 skipped 与 kernel 合跑） | `test_v2_object_search.py` 9 项：HashEmbedder 确定性/归一/近邻排序；InMemory 卡片可追溯/class 过滤/无 embedder 降级；PG SQL 捕获（embedding 表查询/reindex 扫 individuals） |
| mate-app-copilot | 相关 39 passed | `test_ontology_search_channel.py` 6 项：search_objects 注册+执行；**system prompt 注入（rid 进上下文断言）**；无卡片时 prompt 不变 |
| mate-kernel | 455 passed | InMemory repo 新方法回归（无新增文件，行为内聚） |

## 4. 静态检查（硬规则 6）

新文件 `object_search.py` + 测试 ruff All checks passed；pyright（in_memory.py + object_search.py）**0 errors / 0 warnings**。

## 5. 幻觉率对照（spec 验收项）

CI 内以确定性断言覆盖等价物：卡片注入后 prompt 显式携带 rid + 「回答时优先引用」指令 + 无检索时 prompt 逐字节不变（test_no_cards_unchanged）。**真实 LLM 幻觉率对照实验（无 OAG vs 有 OAG）需 live LLM**，属 demo 环境人工步骤：`OPENAI_API_KEY` 配置后 reindex → 同题双跑对比——留 demo 脚本执行，不阻塞 Accepted（与 spec §5.5 独立验收原则一致）。

## 6. 出范围

pgvector halfvec+HNSW 实装（升级路径已留，量级触发时做）/ rerank / 对象卡片缓存 —— 未做，符合 SAL-02 范围。

## 7. 北极星进度

**SAL-01 读 ✅ → SAL-02 想 ✅ → SAL-03 生产门（并行待做）→ SAL-04 写（先 ADR-0044）**。
