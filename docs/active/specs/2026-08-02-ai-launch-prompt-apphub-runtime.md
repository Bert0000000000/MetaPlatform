# AI 助手启动 Prompt 模板（批次 K · 应用中心运行时 + 短链）

> 版本：v1.0 · 2026-08-02
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：v3.0 GA 后应用中心（mate-app-hub）缺口诊断 · 2026-07-30 ~ 2026-08-02 访谈
> 状态：**本批次待启动**（接续 BUSINESS-SLICES ADR-0016 后置批次）
> 前置：v3.0 GA 8 个 Delivery Batch 全部 Accepted；ADR-0016 business-slices 进行中

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 全栈工程师，正在为本仓库执行
"批次 K · 应用中心运行时 + 短链"（APPHUB-RUNTIME-01）。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（v3.0 GA 已合并，HEAD = 87f589be）
本批次位置：v3.1 BUSINESS-SLICES 之后 / DATA-D0-D8 收口前
目标：把 mate-app-hub 从"纯元数据注册表"升级为"可运行的部门级应用装配平台"

## 上下文速览（先读这一段）

mate-app-hub 当前只能做"创建 App 元数据 + 保存 Form/Flow/Page/Template 的数据描述符"。
缺三件事：
1. 运行时引擎 —— 用户访问应用时，没有任何组件把描述符解释成可响应页面
2. 短链入口 —— 没有 /s/{code} 路由让用户访问已发布的应用
3. 平台 console 自举 —— 17 个平台域（IAM / DW / KB / RAG / MCP / Agent / ...）的 console
   都还在手写 React，没有走应用中心装配

本批次的目标只解决 #1 与 #2，#3 留到下一批次（APPHUB-SELFHOST-01）。
上线口径：跑通 "营销人员注册一个 App → 拖拽 3 个 Module → 点发布 → 同事访问 /s/{code} → 看到页面" 的最小闭环。

## 必须读完的文档（按顺序）

1. docs/README.md                                       — 仓库导航
2. docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md
   — 17 域 + 13 硬规则
3. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §13 硬规则 1-13（每条都对应一个 CI job + 守门脚本）
4. docs/active/decisions/ADR-0014-tech-services.md
   — 17 域接入 5 步法（contract → failing tests → feature → infrastructure → acceptance）
5. docs/active/decisions/ADR-0016-business-slices.md
   — 上下文：本批次的父级
6. docs/active/specs/2026-07-30-ai-launch-prompt-batchI-business-slices.md
   — 17 域接入 checklist
7. mate-platform-backend/contracts/openapi/services/apphub.yaml
   — 当前契约（5 个 GET operationId，全 x-mate-implementation-status: planned）
8. mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/
   — api/app.py / repositories/in_memory.py / repositories/sql_models.py
9. metaplatform-frontend/apps/web/src/api/apphub/{apps,modules,forms,flows,pages,versions,release,marketplace}.ts
   — 已存在的前端 API 层（CRUD 完整）
10. metaplatform-frontend/apps/web/src/pages/apphub/
    — AppListPage / AIDesignerPage / FormDesignerPage / FlowDesignerPage / PageDesignerPage
11. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md
    — 本文档本身

## 你的任务（按优先级 4 个阶段）

### 阶段 A — OpenAPI 契约补齐（必做，与硬规则 1 闭环）

mate-app-hub 当前契约只声明了 5 个 GET，代码层已实现 16 个 endpoint 但未登记。
先把契约补齐到代码一致，再加 4 类新 operation：

新增 operation（必填字段：operationId / x-mate-permission / x-mate-fr-id / responses）：

| Method | Path | Tag | operationId | 作用 |
|---|---|---|---|---|
| GET | /api/v1/apphub/apps/{appId}/runtime | runtime | apphubGetAppRuntime | 拉取已发布版本的视图渲染数据（Module + Page + Form + Flow 配置 + 当前用户数据） |
| POST | /api/v1/apphub/apps/{appId}/runtime/execute | runtime | apphubPostAppRuntimeExecute | 提交表单 / 触发流程 / 调用动作（统一入口） |
| POST | /api/v1/apphub/apps/{appId}/publish | publish | apphubPostAppPublish | 把指定 version 标记为 PUBLISHED 并落版本快照 |
| GET | /api/v1/apphub/shortlinks/{code} | shortlink | apphubGetShortlink | 短链解析，返回 { appId, version, scope, targetRole } |
| POST | /api/v1/apphub/shortlinks | shortlink | apphubPostShortlink | 为已发布 App 生成短链（code 由后端生成 8 位 base62） |
| GET | /api/v1/apphub/shortlinks | shortlink | apphubListShortlinks | 列租户内所有短链（管理视图） |

每条 operation 必须：
- 含 `security: [bearerAuth: [], tenantHeader: [], oidcScopes: [platform.read]]`（读）
  或 `[platform.write]`（写）
- 含 4xx / 5xx 错误响应（401 / 403 / 404 / 409 / 422）
- 含 `x-mate-required-tenant: true` 标记

硬规则 1 闭环：CI job `ga-001-openapi` 会校验每个 operation 是否在 routes 中实现。

### 阶段 B — 运行时引擎（mate-app-hub 新增 runtime 模块）

在 `mate-app-hub/src/mate_app_hub/runtime/` 下新增：

```
runtime/
├── __init__.py
├── schema.py           # ApphubRuntimeContext / RuntimeRenderNode / RuntimeAction Pydantic 模型
├── loader.py           # load_app_runtime(app_id, version) → 拉 ApphubModule + Page + Form + Flow
├── renderer.py         # render_page(runtime) → 列出可渲染 node 树（JSON）
├── executor.py         # execute_action(runtime, action_id, payload) → 调下游服务
├── binding.py          # form-binding 解析（flow 节点引用 form 字段的字段映射）
├── authz.py            # 短链 gating + 角色可见性（基于 token.tenant_id + scope + 角色）
└── errors.py           # RuntimeErrorCode 枚举 + 422 转换
```

关键约束（来自硬规则 3）：
- 仓库层（`repositories/`）的访问必须经 `mate-platform/tenancy/db_filter.py` 加 tenant_id 过滤
- 不能直连 SQL / 不能落绕过 `apphub_id` 的数据
- HTTP 出站（调 KB / RAG / Agent）必须走 `mate-clients/*` 的 ACL Client（硬规则 4）

预期单元测试（`tests/test_apphub_runtime_01.py`）：
- 加载已发布 App → 拿到完整配置树
- 跨租户访问 → 404（不能泄露存在性）
- 提交表单 → 触发 Flowable 流程启动（mock 即可，integration 留给端到端）
- 短链访问被禁用 → 404
- 角色不足 → 403

### 阶段 C — 短链 + 平台入口

在 `mate-app-hub/src/mate_app_hub/shortlink/` 下新增：

```
shortlink/
├── __init__.py
├── generator.py        # generate_code(app_id) → 8 位 base62 + 冲突重试
├── repository.py       # SQL 建模 ApphubShortlinkORM（id / tenant_id / app_id / code / role / expires_at）
├── resolver.py         # resolve(code) → 校验租户 + 过期 + 角色 → 返回 appId/entry/version
└── service.py          # 业务编排：生成 / 解析 / 撤销
```

短链格式：`/s/{code}`（8 位 base62，避开 0/O/1/I/l 等易混字符）
唯一性：租户内全局唯一，跨租户隔离（同 code 在不同 tenant 指向不同 App）

前端路由（`metaplatform-frontend/apps/web/src/`）：
- 新增 `pages/apphub/runtime/AppRuntimePage.tsx` —— 接收 `:code`，调 `apphubGetShortlink` + `apphubGetAppRuntime`，渲染成响应式页面
- 路由 `/s/:code` 注册到 App.tsx（无需 AuthGuard，因为短链自决权限）
- 主 Loader 内打点 `app.runtime.start` / `app.runtime.end`（OTel span）

### 阶段 D — 前端补完（应用中心相关 7 个页面）

按前一轮扫描结果（2026-08-02），应用中心目录里 23 个页面只有部分对接：

必须改的页面（按性价比排序）：
1. `MarketPage.tsx`—— 接 `listTemplates` + `installTemplate`，渲染模板市场
2. `MyTemplatesPage.tsx`—— 接 `listTemplates` 过滤本人 createdBy
3. `TemplateDetailPage.tsx` / `TemplateSubmitPage.tsx`—— 接 `getTemplate` + 评论
4. `AppLifecyclePage.tsx`—— 增加 "发布" 按钮触发 `apphubPostAppPublish` + 生成短链
5. `AppDetailPage.tsx`—— 显示短链链接 + QR Code SVG
6. `pages/apphub/runtime/AppRuntimePage.tsx`（新增）—— 阶段 C 的前端配套

类型补丁：`api/apphub/types/index.ts` 新增 `AppRuntime / Shortlink / RenderNode / ActionResult` 四个 interface。

## 13 条硬规则（特别关注本批次触发的几条）

- **§13 第 1 条**：Swagger 没有接口，不写 route —— 阶段 A 必须先做完
- **§13 第 2 条**：PRD 没有 Requirement ID —— 每个 operation 必须有 `x-mate-fr-id`
- **§13 第 3 条**：没有 tenant 上下文，不访问 repository —— 阶段 B 的 `loader.py` 必须先 `require_tenant(ctx)`
- **§13 第 4 条**：外部系统没有 ACL Client —— 阶段 B 的 `executor.py` 调下游只能走 `mate-clients/`
- **§13 第 7 条**：契约或集成测试跳过不标记 Accepted —— 阶段 B/C 单元测试必须真跑
- **§13 第 9 条**：没有审计、指标、trace —— 阶段 C 的 `/s/{code}` 必须有 OTel span `shortlink.resolve`
- **§13 第 10 条**：所有状态以验收证据为准 —— 提交前必须有 `APP-HUB-RUNTIME-01-ACCEPTANCE.md`

## 启动方式

1. 切到 v3.0 GA 基线 worktree：
   `git worktree add .worktrees/apphub-runtime-01 -b codex/apphub-runtime-01 main`
2. 跑通当前基线确认无回归：
   `cd mate-platform-backend/packages/mate-app-hub && pytest -q`
3. 创建新分支并按阶段 A → D 顺序推进，每个阶段独立 commit（Conventional Commits）
4. 每个阶段 commit 前必须跑：
   - `ruff check && pyright packages/mate-app-hub/`（硬规则 6）
   - `pytest tests/test_apphub_runtime_01.py -q`（硬规则 7）
   - `scripts/ci/forbid_bare_httpx.py packages/mate-app-hub/`（硬规则 4）
   - `scripts/ci/require_evidence.py`（硬规则 10）
5. 全部 4 阶段完成后，PR 描述必须包含：
   - ADR-0014 + ADR-0016 引用
   - 6 个新 operationId 列表
   - `docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md` 链接
   - 端到端跑通截图（手动 + curl）

## 已知陷阱（来自上一轮扫描）

1. **ApphubApp 无 url 字段** —— 阶段 C 需要先 schema migration，给表加 `shortlink_code / current_version_id / runtime_status` 三列
2. **ApphubModule.entry_path 是字符串** —— 阶段 B 的 `binding.py` 需要兼容多种形态（FORM / FLOW / PAGE / BOARD）
3. **AppLifecyclePage "发布" 按钮当前只改 status 枚举** —— 阶段 D 改这个按钮时必须确认不会破坏现有 125 个页面的契约
4. **AI Designer 现在用 localStorage 存草稿** —— 阶段 D 不要动这个，否则会破坏现有交互；让 AI Designer 仍写 localStorage，发布动作才落 ApphubApp
5. **mate-app-hub 仅有 in-memory + SQL 双实现** —— 阶段 B 的 `loader.py` 必须可以跑在两种后端上，建议用 repository 抽象

## 验收清单（Acceptance Evidence）

提交 PR 前必须产出：

- [ ] `contracts/openapi/services/apphub.yaml` 含 6 个新 operation，每条都有 operationId / security / x-mate-fr-id
- [ ] `packages/mate-app-hub/src/mate_app_hub/runtime/` 7 模块源码 + `__init__.py`
- [ ] `packages/mate-app-hub/src/mate_app_hub/shortlink/` 4 模块源码 + SQLAlchemy ORM
- [ ] `packages/mate-app-hub/tests/test_apphub_runtime_01.py` ≥ 35 tests pass
- [ ] `packages/mate-app-hub/tests/test_apphub_shortlink_01.py` ≥ 20 tests pass
- [ ] migration 脚本：`packages/mate-app-hub/migrations/versions/xxxx_add_shortlink_and_runtime.py`
- [ ] 前端 `apps/web/src/pages/apphub/runtime/AppRuntimePage.tsx` + 路由注册
- [ ] 前端 5 个页面对接改造（Market / MyTemplates / TemplateDetail / TemplateSubmit / AppLifecycle / AppDetail 任选 5）
- [ ] OTel span: `shortlink.resolve` / `app.runtime.render` / `app.runtime.execute`
- [ ] `docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md` 含 13 门禁证据
- [ ] Program Board 更新（`docs/active/delivery/PROGRAM-BOARD.md`）
- [ ] 端到端 e2e 跑通：注册 App → 拖拽 Module → 发布 → 生成短链 → 访问 /s/{code} → 看到页面
```

## 关联文档

- 上一轮扫描（2026-08-02）：诊断应用中心 4 类缺口
- ADR-0014 tech-services（17 域接入 5 步法）
- ADR-0016 business-slices（父级批次）
- 13 硬规则（§13 production-readiness）
- 已有 `mate-app-hub` 16 个路由的 in-memory + SQL 双实现

## 元说明

- **本批次不解决**：K8s 部署（应用中心走 platform-native 路由而非容器）；AI Designer 持久化（保留 localStorage）；多 App 共享 Module（属下一批次 APPHUB-COMPOSE-01）
- **本批次解决**：L1 描述符已存 → L2 运行时引擎 + 短链入口 + 7 个前端页面
- **估