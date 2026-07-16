# Phase 2 收尾与端到端验证计划

## 目标

在已有 Phase 2 实现（表单设计器绑定对象字段、公开表单提交后端）基础上，补齐剩余功能缺口、跑通端到端链路，并提交代码。

## 当前状态分析

- **Java 后端**：`metaplatform-app-service` 已使用 H2 dev 启动，端口 `8092`，Flyway 迁移正常。
- **前端**：`metaplatform-frontend` dev server 运行在 `5174`。
- **Node 后端**：`metaplatform-api` 启动失败（背景任务 `job-e9c9...` 已失败），端口 `3001` 未监听，需排查。
- **ID 映射**：`AppObjectController` / `AppFormController` 已支持字符串 `appId`（slug），`DataModeling` / `ObjectFieldPanel` / `FormLowCodeEditor` / `usePageEditor` 已直接传递 URL 中的 slug，映射基本打通。
- **剩余缺口**：
  1. `ObjectFieldPanel` 未把「唯一」标记发送给后端，列表也永远显示「否」。
  2. `AppOverview` 中公开别名「打开」链接路径错误（`/apps/:appId/public/form?formId=...`），与路由 `/public/form/:appId?formId=...` 不匹配。
  3. 页面编辑器没有「发布表单」入口，用户无法把 form status 改为 `published`，导致公开表单无法提交。
  4. 验证脚本 `verify-object-fields.py` 仍使用前端旧端口 `5173`，且只覆盖字段管理，未覆盖表单提交链路。

## 拟修改清单

### 1. 补齐对象字段「唯一」标记

**文件**：`metaplatform-frontend/src/pages/apps/ObjectFieldPanel.tsx`

- `handleSave` 构造的 `AppServiceObjectField` 增加 `unique: form.unique_field`。
- 字段列表的「唯一」列改为显示 `p.unique ? "是" : "否"`。

### 2. 修复公开表单别名链接

**文件**：`metaplatform-frontend/src/pages/apps/AppOverview.tsx`

- 把 `a.kind === "form"` 的打开路径从 `/apps/${appId}/public/form?formId=...` 改为 `/public/form/${appId}?formId=...`，与 `App.tsx` 路由一致。

### 3. 增加表单发布入口

**文件**：

- `metaplatform-frontend/src/pages/apps/editors/EditorShell.tsx`
- `metaplatform-frontend/src/pages/apps/editors/usePageEditor.ts`
- `metaplatform-frontend/src/pages/apps/PageEditor.tsx`

- `EditorShell` 增加可选 `onPublish?: () => void` 与 `canPublish?: boolean`，仅在 `pageType === "form"` 时显示「发布」按钮。
- `usePageEditor` 暴露 `publishForm: async () => void`：
  - 若 `linkedIds.form_id` 不存在，先 toast 提示保存页面。
  - 否则调用 `appServiceApi.forms.publish(appId, linkedIds.form_id)`。
  - 成功后 toast「表单已发布」。
- `PageEditor` 把 `publishForm` 传入 `EditorShell`。

### 4. 编译与类型检查

- 前端：`cd metaplatform-frontend && tsc --noEmit`。
- 后端：`cd metaplatform-app-service && mvn compile`。
- 根据报错修复类型或编译错误。

### 5. 排查并启动 Node 后端

- 查看 `metaplatform-api` 启动日志，定位失败原因（当前看到 `pruner start failed: aliasMap is not defined` 及 Kafka 连接错误）。
- 修复阻塞性启动错误（Kafka 缺失可接受为降级，不应导致进程退出）。
- 使用 Node 22 启动：`npm run dev`。
- 确认 `http://localhost:3001/api/health`（或 `/api/apps`）可访问。

### 6. 更新并运行端到端验证脚本

**文件**：`scripts/verification/verify-object-fields.py`

- 前端端口改为实际端口 `5174`（或从环境变量读取）。
- 增加 API 响应格式校验，避免 `KeyError`。
- 扩展脚本覆盖完整链路：
  1. 登录并取应用 slug。
  2. 在 Java 后端创建对象（含 text/number/date/boolean/select 字段，部分必填/唯一）。
  3. 通过 Playwright 打开数据建模页，添加字段并截图。
  4. 创建表单页、拖拽对象字段、保存。
  5. 调用 `POST /api/apps/{appId}/forms/{formId}/publish` 发布表单。
  6. 打开 `/public/form/{appId}?formId={formId}` 提交数据。
  7. 查询 H2 动态表或调用接口确认数据写入且 `tenant_id` 非空。

### 7. 提交代码

- `git status` / `git diff` 检查变更范围。
- 创建提交：迁移 Node 后端应用中心能力到 Java + 完成 Phase 2 表单绑定/提交流量。
- 不提交工具目录（`tools/node-v22`、`tools/maven`）与验证截图。

## 验证步骤

1. `tsc --noEmit` 无类型错误。
2. `mvn compile` 无编译错误。
3. Node 后端 `3001`、Java 后端 `8092`、前端 dev server 全部启动。
4. 运行 `verify-object-fields.py`，断言全部通过并生成截图。
5. 手动打开公开表单链接，提交后确认动态表新增记录、必填/唯一校验提示中文、错误时提交失败。

## 决策与假设

- **应用标识**：继续使用 Node 生成的 slug（字符串）作为 URL 中的 `appId`，Java 后端通过 `AppService.resolveByIdOrCode` 兼容解析。
- **发布入口**：把「发布表单」按钮放在页面编辑器 toolbar，只有 form 类型页面显示。
- **租户隔离**：公开接口无 JWT，根据 `form.appId` 查到 `AppEntity.tenantId` 后设置 `TenantContext`；dev 环境未传 header 时使用 `default-tenant`。
- **唯一校验**：Phase 2 仅运行时 `SELECT COUNT(*)` 校验，不建物理唯一索引。
- **Node 后端**：Kafka 连接失败属于预期降级，不应导致服务退出；若启动失败根因为 `pruner` 代码错误，则修复该代码。
