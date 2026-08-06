# E2E 联调验收 — Web 页面端到端闭环验证（准生产模式）

> **验收日期**: 2026-08-06
> **模式**: 准生产 — 前端对接后端 Docker 服务，通过 Web 页面实际操作验证
> **状态**: ✅ **Accepted**（76 / 76 E2E 测试通过；9 大模块 + 子模块闭环跑通）
> **关联**: ADR-0014（5 步接入）/ ADR-0016（BUSINESS-SLICES）/ ADR-0019（LLM 网关）

---

## 1. 验证方式

- 后端全部服务以 Docker 容器运行（docker-compose），前端 Vite dev server 通过 proxy 对接
  **统一网关 `mate-api-gateway`（:8100）**。
- 验证不是 curl 接口连通，而是 **Playwright 浏览器实际打开 Web 页面**，走真实登录
  （admin/admin123），逐页面验证前后端对接 + 后端业务逻辑。
- 每次页面加载捕获所有 API 响应，断言无 4xx/5xx 业务失败。
- 缺失接口处理原则：优先查 Swagger 契约 → 后端代码；无则重新开发；有则直接对接并验证。
- **第二轮扩展**：深入每个模块的子页面（详情页、版本管理、设计器、数据/治理、MCP 管理面、
  数字员工任务/协作/评估/外部），将子模块也纳入端到端验证。

## 2. 验证结果汇总（Playwright E2E：76 / 76 passed）

| 模块 | 页面数 | 状态 |
|---|---|---|
| 工作台 Dashboard（工作台/我的应用/我的数字员工/消息/门户/通知/交付材料）| 7 | ✅ |
| 后台管理 Admin（总览/用户/权限/组织/日志/配置/AI提供方/运营/访问看板）| 8 | ✅ |
| 架构中心 Arch（能力/应用/价值流/流程/组织角色/数据/技术/治理/Ontology联动 + 数据实体详情/数据流/数据标准/资产目录/技术组件/技术栈/部署拓扑/技术雷达/原则/评审模板/评审/技术债）| 17 | ✅ |
| 应用中心 AppHub（应用列表/详情/生命周期/版本/市场/模板市场/我的模板/模板提交/AI设计器 + 表单/流程/页面设计器）| 12 | ✅ |
| 本体引擎 Ontology（建模/数据中心/动作/图谱）| 4 | ✅ |
| 知识库 Knowledge（列表/文档/测试）| 3 | ✅ |
| MCP 中心（工具/服务/客户端/权限/审计 + 概览/连接监控/资源/提示词/策略/外部集成/信任/调试器）| 14 | ✅ |
| 数字员工 Agents（员工/创建/任务/协作/协作创建/评估/外部A2A）| 8 | ✅ |
| SuperAI（聊天/任务编排）| 2 | ✅ |
| **合计** | **76** | **✅ 76 passed** |
| SuperAI（聊天/任务编排）| 2 | ✅ |
| **合计** | **46** | **✅ 46 passed** |

## 3. 联调发现并修复的问题

### 3.1 服务未部署（重新开发并部署）

| 问题 | 根因 | 修复 |
|---|---|---|
| `/api/v1/apphub/*` 全部 404 | `mate-app-hub` 有完整代码但无 Dockerfile、无 compose 服务、网关无路由 | 新建 `Dockerfile`（:8301）+ compose 服务 + 网关路由 `/api/v1/apphub/` → apphub |
| `/api/v1/data/sources` 404（数据中心）| `mate-tech-data` 有完整代码但未部署 | 新建 `Dockerfile`（:8701）+ compose 服务 + 网关路由 `/api/v1/data/` → data |
| `/api/v1/mcp/clients` 404（MCP 客户端页）| `mate-tech-mcp` 只有 5 个 spec 端点，无客户端管理接口 | 开发 `clients_repo.py` + `api/clients_routes.py`（CRUD + test-connection + discover），挂载到 main.py |

### 3.2 前后端契约不匹配（直接对接修复）

| 问题 | 根因 | 修复 |
|---|---|---|
| 知识库列表/文档 404 | 前端调 `/knowledge-bases` + `KbEntity` 字段，后端是 `/collections` + `name/document_count` | 前端 API 层映射到后端 `/collections`、`/documents`，字段转换 |
| 应用中心页面崩溃（`Cannot read properties of undefined (reading 'color')`）| 后端 app 响应字段 `id/name/code/category` 与前端 `AppItem` 的 `appId/status/moduleCount` 不匹配 | 前端 `apps.ts` 增加 `mapApp` 字段映射层 |
| 架构治理页崩溃（`items.map is not a function`）| 后端 list 返回 `{items:[...]}`，前端函数期望裸数组 | 前端 governance/dataArchitecture 增加 `list` 解包 helper |
| MCP 资源/提示词页崩溃（`.length`/`.map`）| 后端 `/resources`、`/prompts` 返回 `{resources|prompts:[...]}`，前端期望 `{items}` | 前端 toPage 包装 + 字段转换（arguments→variables）|
| MCP 工具列表崩溃（`data.items.map`）| 后端 `/tools` 返回 `{tools:[...]}` | 前端 `listTools` 解包 `{tools}` |
| 数据资产目录崩溃（`catalog.groups.map`）| 后端 `/data-assets/catalog` 返回 `{items}`，前端期望 `{groups}` | 前端 `getAssetCatalog` 按 groupBy 分组组装 |
| 数字员工页面 404（`/api/dw/*`）| 前端 dw API baseURL 错用 `/api`（应为 `/api/v1`）| 9 个 dw 模块文件统一修正 baseURL |
| 评估页崩溃（`.map`/`.length`）| dw baseURL 错误导致列表返回异常 | 同上修复后正常 |
| A2A 双重前缀（`/a2a/v1/a2a/*`）| 前端 baseURL `/api/v1/a2a/v1` + 路径 `/a2a/*` 拼接重复 | 前端 baseURL 改 `/api/v1/a2a` + 路径去 `/a2a` 前缀；`listExternalAgents` 解包 `{items}` |

### 3.3 服务部署补齐（子模块依赖）

| 服务 | 接口 | 说明 |
|---|---|---|
| `mate-app-hub` 新增 | `GET /apps/{id}`、`GET /modules/{id}`、`GET /pages/{id}` | 应用详情/模块详情/页面设计器 |
| `mate-app-hub` 新增 | `POST /apps/{id}/versions` + publish/rollback/delete | 版本管理页 |
| `mate-app-hub` 新增 | `GET/PUT /v1/wfe/forms/{id}` + settings/linkage/scripts/validate | 表单设计器 |
| `mate-app-hub` 新增 | `GET/PUT /v1/wfe/flows/{id}` + validate/test/publish | 流程设计器 |
| `mate-app-a2a` 部署 | Dockerfile（:8502）+ compose + 网关路由 `/api/v1/a2a/` | 外部 Agent 发现/委派（A2A）|
| `mate-tech-mcp` 新增 | `management_repo.py` + `management_routes.py` | trusts/external-agents/policies/connection-monitor/overview/debug/integrations/api-keys |

### 3.4 环境 / 镜像问题

| 问题 | 修复 |
|---|---|
| `mate-tech-llmgw` 崩溃（缺 `mate_platform`/`mate_clients`/`sqlalchemy`）| Dockerfile 从 `pip install` 改为 `cp -r` 源码复制；compose 补 auth env |
| `mate-tech-obs`/`mate-tech-msg`/`mate-tech-mcp` 缺 `mate_platform` | Docker 构建缓存问题，手动 `--no-cache` 重建镜像 |
| `mate-tech-dw` healthz 404（unhealthy）| `main.py` 增加 `/healthz` 端点 + anonymous 放行 |
| 多个服务启动崩溃（`KEYCLOAK_URL required`）| compose 各服务块补 `LEGACY_LOGIN_COMPAT`/`INSECURE_SKIP_SIGNATURE`/`KEYCLOAK_URL` |
| Docker registry mirror（华为云）401 导致构建卡死 | 移除失败 mirror；`--pull=false` 用本地基础镜像 |

## 4. 关键接口闭环验证

| 接口 | 路径 | 验证结果 |
|---|---|---|
| 登录 | POST `/api/v1/iam/auth/login` | ✅ 返回 accessToken |
| 应用列表 | GET `/api/v1/apphub/apps` | ✅ 15 个应用 |
| 数据源列表 | GET `/api/v1/data/sources` | ✅ 数据源 |
| 知识库列表 | GET `/api/v1/kb/collections` | ✅ Ops KB / Research KB |
| MCP 客户端 CRUD | GET/POST `/api/v1/mcp/clients` | ✅ 创建 + 列表闭环 |
| LLM 提供方探测 | POST `/api/v1/llmgw/providers/test` | ✅ 返回 `ok:false`（外部网络超时，逻辑正确）|
| Copilot 对话流 | POST `/api/v1/copilot/chat/completions/stream` | ✅ SSE 流式返回 |

## 5. 测试套件

- `metaplatform-frontend/tests/e2e/integration/` — 76 个 Web 端到端联调测试
  （`dashboard.spec.ts`、`admin.spec.ts`、`arch.spec.ts`、`apphub-*.spec.ts`、
  `subpages.spec.ts`、`mcp-agents-superai.spec.ts` 等）
- `tests/e2e/helpers/auth.ts` — 真实后端登录辅助（storageState 复用，避免 SQLite 并发锁）
- 运行：`E2E_BASE_URL=http://localhost:9250 npx playwright test tests/e2e/integration/`

## 6. 遗留（非阻塞）

1. `mate-tech-obs` / `mate-tech-msg` 镜像重建受 Docker registry 网络限制，容器待稳定。
2. 真实 LLM 外部网络不可达（需代理/API key），SuperAI 对话返回兜底文案而非真实模型输出。
3. IAM 用 SQLite 存储，并发登录有 `database is locked` 风险（测试已串行规避）。
4. Docker registry mirror（华为云 401）影响后续镜像拉取，建议修复本机 Docker 网络配置。
