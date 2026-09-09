# SPRINT-4 ACCEPTANCE — 集成核心 + 17 域全链路 + 联邦多模态

> **日期**: 2026-09-08/09 · **范围**: goal「Sprint 4 集成核心+17域+联邦」 · **部署**: docker 全栈（31 容器 / worker 1.5 / llmgw MiniMax 路由）

## 1. 17 域全链路 e2e → **24/26 PASS**

脚本 `scripts/e2e_17_domains.py`（全局 ProxyHandler 绕代理 + 直连端口探活 + 网关业务 API）。

| 域 | healthz | 业务 API | 状态 |
|---|---|---|---|
| ont | 8007 ✅ | GET object-types 200 ✅ | PASS |
| llmgw | 8008 ✅ | chat（ARK Plan GLM-5.3-flash）✅ | PASS |
| mcp | 8081 ✅ | GET tools 200 ✅ | PASS |
| copilot | 8601 ✅ | agent-loop + reasoning 450 tokens ✅ | PASS |
| arch | 8321 ✅ | GET capabilities 200 ✅ | PASS |
| apphub | 8301 ✅ | GET apps 200 ✅ | PASS |
| orchestrator | 8505 ✅ | roles + plans ✅ | PASS |
| auth | 8101 ✅ | login 200 ✅ | PASS |
| agent | 8002 ✅ | registry agents ✅ | PASS |
| rag | 8001 ✅ | documents ✅ | PASS |
| dw | 8021 ✅ | employees ✅ | PASS |
| msg | 8082 ✅ | healthz ✅ | PASS |
| kb | 8003 ✅ | healthz ✅ | PASS |
| data | 8701 ✅ | /api/v1/data/health ✅ | PASS |
| etl | 8022 ✅ | /api/v1/etl/health ✅ | PASS |
| scheduler | 8023 ✅ | /api/v1/scheduler/health ✅ | PASS |
| metrics | 8024 ✅ | /api/v1/metrics/health ✅ | PASS |
| a2a | 8502 ✅ | delegation ✅ | PASS |
| temporal gRPC | 7233 ✅ | gRPC 连通 ✅ | PASS |

## 2. MP-MKT-INSTALL-01（Marketplace 第三方订阅）

EMP-EVOLVE FR-008 消费面对齐：`SessionEvolution.mount` 即为第三方能力订阅的运行时入口（composition 通道 mount/unmount），`CapabilityRuntime` 反应式可用性即订阅生效/失效语义。MP-MKT-INSTALL-01 的完整 install 事务（DB 持久化 + 审计）已由 MARKETPLACE-CONSUMER-01 收口（7-31），本批确认消费面连通。

## 3. mcp federation 真实化

live：`ont_list_classes` 工具经 MCP center federation 路由可达（tool_call 200 返回本体类型清单），`base_url` 修复 + token 注入后连通。PRD-09 联邦完整化（多 server 注册/策略路由）留增量。

## 4. ONT-G11 ontology-cli 最小版

`scripts/ontology_cli.py`：list-classes / get-type / query / export 四子命令，走网关 API（Bearer token + X-Tenant-Id），单测 ≥4。

## 5. PRD 起稿清账

PRD-03/04/09/13/20 五份落 `docs/active/prd/`（状态字段如实）。

## 6. 测试

G17 validation 8/8 + relay loop 2 + 前批各套件累计 ≥50 全绿；既有套件无新增失败。

---

## 7. 残余修零（第四轮，2026-09-08）→ 26/26 全 PASS

### 7.1 a2a healthz 修复
- 根因：a2a 服务只有 `/api/v1/a2a/health`，缺平台统一的 `/healthz` 探活路由（e2e 000/404）。
- 修复：`mate-app-a2a/main.py` 补 `GET /healthz`（匿名，与 copilot 等域对齐）+ 容器重启。
- 单测：`test_healthz.py` 2/2（匿名 200 + legacy alias 保持）。

### 7.2 copilot agent-tools 修复（404 → 真实 API）
- 根因：路由根本不存在（非 token 问题）——copilot 无工具注册表面向调用方的 API。
- 新增：`GET /api/v1/copilot/agent-tools` 返回 agent loop 实时工具集：dispatch_employee（target_rid 枚举=授权角色，来自 orchestrator authorized-snapshot）+ 本体工具面（build_ontology_tools 虚拟注册表，ONT_HTTP_BASE 指向 tech-ont）。双源独立降级，`sources` 字段可见。
- 契约先行（硬规则 #1）：copilot.yaml 增 `copilotGetCopilotAgentTools`（implemented）。
- 单测：`test_agent_tools.py` 5/5（含契约 operationId 检查）。
- live：网关调用 200，total=33，sources={orchestrator: ok, ontology: ok}。
- 附带修复：copilot compose 补 `ONT_HTTP_BASE=http://mate-tech-ont:8007`（缺省 localhost 在容器内指向自身，导致本体工具静默降级 ConnectError）。

### 7.3 e2e 复跑结果（26/26 PASS）
18 直连/API 探活 + temporal gRPC + 7 网关业务 API 全 PASS，`DOMAIN-E2E PASS`（2026-09-08 实测输出存 session 记录）。

### 7.4 llmgw 多模态真实 vision live
- 代码：`routes.py` multimodal 端点接入真实 provider（请求级 base_url/api_key 覆盖 > OPENAI_BASE_URL/OPENAI_API_KEY env > dev stub）；引擎简化消息 → OpenAI-Vision 适配桥 `_OpenAIMultimodalBridge`；契约 llmgw.yaml 同步（model 默认空 + base_url/api_key 字段）。
- 单测：`test_llmgw_multimodal_provider.py` 6/6；既有 `test_llmgw_multimodal.py` 19 passed 无回归。
- 部署边界（如实）：llmgw 镜像为 Sprint 3 基线（无 volume 挂载），改动经 docker cp 至容器内 `/usr/local/lib/python3.12/site-packages/` + 补 `mate_platform/runtime.py`（镜像过旧缺失）后重启生效；**镜像重建时需以 worktree 代码为准固化**。
- live：PIL 生成图（白底 + 红色圆形左上 + 蓝色方块右下）→ `POST /api/v1/llmgw/chat/multimodal`（ARK Plan 覆盖，glm-5.3-flash）→ HTTP 200：正确描述「红色圆形位于左侧偏上、蓝色正方形位于右侧偏下、白色背景」，usage 280 tokens。默认 MiniMax 通道 429（配额，known limitation）。

### 7.5 routing_audit sink live 验证
- 3 次 agent stream live（信息查询直答 / 未授权目标 fail-closed 拒绝 / 授权目标派发成功）：
  - `routing_audit_unavailable` 出现次数 = 0/0/0；
  - 第三次：final routing_decision `outcome=selected, selected=workflow, reason_code=model_selected, taken_path=llm_fc, policy_version=semantic-router-v1` + dispatch_employee(workflow) 真实调度；
  - PG `outbox_event` 落库：`copilot.routing.decided`，status=pending，payload reason/selected_rid/policy_version 齐全；
  - 真实 LLM：单轮最高 873 个 reasoning 事件（GLM-5.3-flash 流式）。
- 回归：`test_routing_audit.py` 12/12。

### 7.6 ONT-G11 ontology-cli 真网关全链
- `scripts/ontology_cli.py`（主树 backend/scripts）：list-classes / get-type / query / export，Bearer 自动登录 + X-Tenant-Id，仅标准库。
- 单测 7/7（含裸数组包络兼容——网关 v2 object-types 实测返回裸数组）。
- live：list-classes 3 类型；get-type 完整元数据；query employee.v1 返回 3 行真实实例 + result_schema；export bundle 1286 字节 JSON-LD 落盘。

### 7.7 v1.0 Release 沉淀
- `docs/active/release/v1.0-release-notes.md` + `docs/active/release/v1.0-known-limitations.md` 落地（如实边界）。
- §2.6 行更新（17域e2e [x] / ONT-G11 [~] / 多模态 [~]）；§2.8 Release [ ]→[~]。

### 7.8 测试汇总（本批）
新增 20（agent-tools 5 + healthz 2 + multimodal provider 6 + ontology-cli 7）全绿；既有 routing_audit 12 / multimodal 19 无新增失败。全栈复验：容器无 Restarting/unhealthy、fe9200=200、登录 token 正常、check_plan_tables 0 格式问题。
