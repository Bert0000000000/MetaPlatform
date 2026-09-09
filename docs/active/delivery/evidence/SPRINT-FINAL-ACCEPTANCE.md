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

### 13. staging 演练 [!]（两轮部署 · 最终卡点=存储权限/内存上限/上游镜像删除）

**第二轮部署（Docker Desktop 内置 k8s，WSL2 模式）**：
- 用户中途将 Docker Desktop 切到 Docker VMM 模式 → 触发引擎数据根切换、
  全部容器不可见（数据仍在原 WSL2 盘，已切回并确认 111.6GB
  docker_data.vhdx 完好保留于 D:\Docker\wsl_storage\DockerDesktopWSL\disk\）。
- VMM 期间还发现 MemoryMiB=4096 是全天内存挤占的根源，已调至 8192。
- 镜像拉取真相：旧引擎的 daocloud daemon-mirror 白名单拦截了大量 docker.io
  镜像（paimon/datahub/GE 等 403 "not in allowlist"）；新引擎直拉可用。
- **上游镜像已被删除（真实发现）**：bitnami/kafka:3.7.1（bitnami 清库）、
  apache/paimon:0.8（仓库迁移）、starrocks 3.3（已换 3.5.21 tag 拉取成功）。
- 已预拉成功：postgres:16 / trino:435 / keycloak:24.0(quay) /
  debezium:2.7.0(quay) / otel:0.110.0 / marquez:0.30.0 / starrocks fe+be:3.5.21。
- **部署**：helm install deployed（keycloak/otel/postgresql/trino×2/marquez/
  debezium/starrocks×2 + 33 NetworkPolicy）；**otel-collector 1/1 Running、
  trino-worker×2 1/1 Running** 达成。
- **修复清单**：trino chart launcher 直启（node.properties/jvm.config 自生成，
  修「-D 参数位置」崩溃 +「Too small maximum heap」）；6 个 CRD；4 个 DB
  secret（keycloak-db/postgres-admin/marquez-db/postgresql-credentials）；
  metaplatform ns。
- **最终卡点（如实）**：① postgresql local-path 卷属主 initdb 报
  Operation not permitted（需 fsGroup/存储类手术）② keycloak/starrocks
  Pending（单节点内存上限）③ marquez/debezium 依赖 postgres 就绪
  ④ kafka/chart 引用的上游镜像 tag 已删除。
- **解锁**：修复 local-path+postgres 权限（subPath 或 storageClass）、
  8GB 内存生效后逐批调度、chart 镜像 tag 全面升级。

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
- **mate-temporal-worker 二次根因**：容器系裸 `docker run` 创建，
  `TEMPORAL_HOST=172.27.0.2:7233` 硬编码容器 IP——WSL 重启后 IP 洗牌
  （172.27.0.2 变为 temporal-db）导致永连不上。已按服务名
  `temporal:7233` 重建（双网络 metaplatform_default + temporal-net），
  temporal 本体亦因等待环卡死重启后恢复；worker 稳定运行（自愈探针
  补丁保留）。教训：容器互联一律用服务名，禁止硬编码 IP。

## 收尾态（最终验证）
31 容器 Up / 0 Restarting / 0 Exited / 0 unhealthy（含 temporal 栈全绿）。
fe9200=200、login=200、check_plan_tables=0。
k8s：WSL2 模式下单节点 Ready（Docker Desktop 内置 k8s 在 WSL2 模式为单节点；
四节点为 VMM 模式特性，切回 WSL2 恢复数据后 k8s 降为单节点——Docker Desktop
架构限制，非平台问题）。

## 16. 安全审计（部分）[~]

- 门禁复跑（mate-platform-backend 域）：forbid_raw_sql / forbid_bare_httpx /
  forbid_legacy_fallback / forbid_skip_tests 全 PASS。
- NetworkPolicy 覆盖：`validate_networkpolicy_coverage --rendered` →
  **OK: 21 runtime services**（helm 渲染 101 manifests 基础上）。
- 签名强校验负例：篡改 token 401 / 伪造 jwt 401 / 跨租户 header 403。
- 留尾：渗透测试、FOLLOW-UP 台账终审。

## 17. 压测 + 性能审计（部分）[~]

- 压测（`scripts/load_test_v1.py`，容器内经网关）：阶梯 1/4/16 并发 ×
  login / ont list / reasoning —— 全程 **0 错误**；w4 p95 86-176ms；
  w16 饱和 ~30rps（p95 0.8-0.95s，受 VM 资源上限）；失败注入（坏 token）
  401 路径 p50 94ms。数据：evidence/LOAD-TEST-V1.0.json。
- 性能审计：大查询（100 类型列举）p50≈29ms / reasoning 闭包 ≈20ms
  （容器内实测）；结合历史 G4 10k 实例基准 P50=25ms。大对象与长任务
  （Temporal 持久运行）审计随 mate-app-wfe 入栈补全。

## 18. 手册与对位文档 [x]/[~]

- 用户手册 + 运维手册：`docs/active/release/v1.0-{user,ops}-manual.md` [x]
  （含拓扑、安全基线、Trino/Paimon 互斥窗口操作、故障处理、备份）。
- ONT-G10 三层对位：`evidence/ONT-G10-PALANTIR-ALIGNMENT.md` [~]。
- ONT-G34 SHACL conformance：kernel `test_ont_g34_shacl_conformance.py`
  **10/10**（W3C 核心子集语义对位）[~]。

## 19. 最终冲刺状态总览

| 批次 | 结果 |
|---|---|
| 一 | 4/4 [x]（含 2 条件验收转正 + 2 收窄；真 LLM；PRD×11；demo v2）|
| 二 | 8/8 落地：5/6/7/8/11/12 [~]、9 [x]、10 [!]（外部模型白名单）|
| 三 | staging [!]（install deployed + 探活被窗口阻塞）、StarRocks [!]、Sandbox L2 [ ] |
| 四 | 压测/性能/安全审计 [~]、手册 [x]、G10/G34 [~]、demo [~]；G15/G22/G7 dev 留 [ ] |
