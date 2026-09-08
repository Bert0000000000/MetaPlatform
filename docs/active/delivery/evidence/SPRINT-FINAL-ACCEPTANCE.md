# SPRINT-FINAL ACCEPTANCE — V1.0 残余收口最终冲刺（批次一/二/三部分 + 边界）

> 日期: 2026-09-09 · 环境: 真实全栈（Keycloak RS256 / gateway 8100 / 真实 PG）+ kind 四节点

## 批次一 · 轻量面（4/4 完成）

### 1. Sprint 0 条件验收核销（2 [x] + 2 [~] 收窄）
- **MP-ONT-PROPOSAL-01 [~→x]**：重复确认 409 / 未确认执行 409 / 非法转移 409 /
  越权 403 / create_instance revert 等价回滚（实例 404）/ confirm 后重启服务
  状态存活再 execute 成功 / 真实 LLM（ARK Plan）/ 真实 PG。
  **附随修复**：跨租户 upsert/read 泄漏（外租户前缀 rid 可写入他租户名下并读回）
  ——`upsert_object_type` 补 403 写守门、`get_object_type` 补 404 读守门
  （GOVERN-06 第一道防线补全），脏行已清。
- **MP-DEDUP-01 [~→x]**：partial UNIQUE 实证（pg_indexes + 同 slug v2 → 409
  slug_conflict）/ 4 线程并发创建恰 1×200+3×409 / 跨租户写 403 读 404 /
  merge propose→confirm→execute→revert（reverted + 补偿注记）/ precheck 候选。
  边界：真实 embedding 相似度 + 规模性能列 PRD-07 增量。
- **MP-SR-01 [~]（收窄）**：跨租户路由拒绝 403 ✓、真实 provider 路由 ✓；
  剩两 provider failover（MiniMax 429 外部边界）+ staging SSE 断线恢复。
- **ACTION-ORCHESTRATION v1.7 [~]**：Temporal 自愈探针已修（temporalio 1.32
  `GetSystemInfoRequest` 签名 + 无 `Client.close`）；持久运行/outbox/staging
  演练核销依赖 mate-app-wfe 入栈。
- 脚本：`scripts/smoke_sprint_final_batch1.py` **16/16 PASS**。

### 2. 真实 LLM 接入 + LEGACY_LOGIN_COMPAT 移除 [x]
- 19+ 服务 `LEGACY_LOGIN_COMPAT`/`INSECURE_SKIP_SIGNATURE` 翻 false（compose
  修编 + flip 脚本）；Keycloak JWKS RS256 签名强校验生效：篡改 token 401、
  伪造 jwt 401。
- LLM 通道切 ARK Plan（`/api/plan/v3` + glm-5.3-flash，IAM admin configs
  `ai.provider.custom.*`）；**stub-fallback 消除**：默认模型真实返回。
- copilot `/chat/completions/stream` 补 default_model 覆盖（与 agent 流对齐，
  独立变量避免闭包重绑定）。

### 3. PRD 起稿族 [x]
11 份落稿（状态如实）：PRD-09 [ ]（mcp 联邦增量）/ 14 [x] / 19 [x] /
21 [~] / 22 [~] / 24 [ ]（ONT-G15 目标稿）/ 25 [~] / 26 [~] / 27 [~] /
28 [~] / 29 [~]；PRD-20 更新 [x]（SDK 交付）。

### 4. 北极星 demo v2 [x]
真实界面走查 6 截图（登录→工作台→SuperAI 真对话→本体引擎 48 概念→数据资产）：
`evidence/NORTHSTAR-DEMO-V2.md` + `northstar-demo-v2.cjs`。

## 批次二 · Ontology/平台面（8/8 落地）

| 项 | 结果 | 证据 |
|---|---|---|
| 5. MP-MKT-INSTALL-01 | [x] uninstall/retry 事务化 + 同事务审计表 `marketplace_install_audit` + outbox；allowed-from 校验（409/404）| 单测 4 |
| 6. MP-INTEGRATION-HUB-01 | [~] kernel `composition/topology.py`（拓扑排序/环检测/缺失依赖/影响面）单测 4；live 拓扑面留尾 | 同左 |
| 7. INTERCEPT/POLICY | [~] kernel `composition/policy.py`（deny-first、谓词异常 fail-closed、async intercept/PolicyDenied）单测 5；端点接线留尾 | 同左 |
| 8. G6 OSDK typed client | [~] `generate_typed_client.py` operationId→方法（56 生成）+ 4 单测 + live（容器内经网关 3 types）| osdk_generated.py |
| 9. ONT-G11 ontology-sdk | [x] `mate_clients/ontology_sdk.py`（CRUD/proposal/SHACL+推理联动/reasoning/alignment）单测 8 + 网关 live 全链 | PRD-20 [x] |
| 10. llmgw 语音/视频 | [!] **外部边界**：ARK Agent Plan 唯一可用模型 glm-5.3-flash 为纯文本（audio input 显式不支持、video_url 解析失败实测）；MiniMax 429 保留。解锁=含音频/视频的 plan 或第二多模态 provider | §2.6 行 |
| 11. ont SHACL 推理 | [~] kernel `subclass_axioms`（G21 闭包扩展 target + sh:class 子类 is-a）单测 6 + REST live A/B；kernel 全套 617 | contracts ont.yaml |
| 12. SAL §5 风险消化 | [~] ① AGENT_TOOLS_BUDGET 工具预算截断 ② kernel 写回一致性门（unknown_class/tenant_mismatch/duplicate_target/missing_pk）单测 6 | app.py + writeback.py |

**批次一/二新增单测 37+（≥30 ✓）**；kernel 全套 617 绿、clients 42 绿、
marketplace 26 绿、copilot 基线持平（仅存 HEAD 存量失败）。

## 批次三 · 重资源窗口（部分完成 + 如实 [!]）

### 13. staging 演练 [!]（部署成功 · 探活被窗口阻塞）
- **已完成**：① 修复 `marketplace` NetworkPolicy 模板 bug（egress cidr 列表
  被 quote 成 `[...]`）→ 改 range 展开；② 新增 `infra/helm/crds/
  staging-crds.yaml`（datahub ×3 / monitoring ×2 / SealedSecret，含
  `x-kubernetes-preserve-unknown-fields` 修正）；③ 创建 metaplatform ns；
  ④ **helm install 成功**：release mate-staging deployed，19 pods 调度
  （trino×3 / starrocks-fe+be / paimon / iceberg / kafka / marquez / datahub /
  debezium / ge / deerflow / keycloak / marketplace×3 / otel / postgresql），
  trino-coordinator 达 Running。
- **阻塞（如实）**：docker.io 镜像拉取波（12 ImagePullBackOff；otel 0.104/
  marketplace 镜像缺失）+ VM 内存压力 → apiserver TLS 超时 ×2（其间一次
  WSL 硬重启恢复；PG 崩溃恢复一轮后自愈）。
- **解锁**：独立大窗口 + 预拉镜像（daocloud→kind load）+ 构建 marketplace
  镜像或 `--set marketplace.enabled=false`。

### 14. StarRocks + Trino BI [!]
镜像拉取受同一窗口限制（starrocks-fe/be 从未 Running）；Trino 数据面已可用
（联邦查询 + Iceberg Roundtrip 已收口），StarRocks→Trino 联邦查询待窗口。

### 15. Sandbox L2 [ ]
本窗口被 staging 挤占未尝试；kind 集群可用后按 kernel test_k8s_job_executor
路径做真实 Job 执行留证。

## 环境事件记录（如实）
- Docker VM 两次进入内存挤占（daemon API 500 / 端口转发 10054 / healthcheck
  exec 超时）；第二次以 `wsl --shutdown` + Docker Desktop 重启恢复；
  mate-postgres 崩溃恢复两轮均自愈（redo 极小、无数据损失）。
- 恢复期发现「连接重试风暴拖慢 PG recovery」——静默停依赖服务后 PG 数分钟内
  就绪；依赖服务按序重启即绿。

## 收尾态
31 容器 Up（trino 按文档边界回 stopped）、kind 四节点 Ready、fe9200=200、
login=200（容器内网络验证；宿主端口转发层间歇抖动为 Docker Desktop 基础设施
问题，与栈无关）、check_plan_tables 0。
