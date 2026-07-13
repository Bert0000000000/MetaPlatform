# Phase 2 端到端验证与提交计划

## 摘要

Phase 2 的核心代码（表单设计器绑定对象字段、公开表单提交写入动态表）已经实现完毕。本计划聚焦剩余工作：编译检查、服务启动、端到端回归验证、问题修复与代码提交。

## 当前状态分析

### 已完成的实现

1. **Java 后端**
   - `DynamicTableService` 已支持 `insertRow` 和 `exists`（[DynamicTableService.java](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/dynamic/DynamicTableService.java)）。
   - `FormSubmissionService` 已创建，负责表单提交校验与写入（[FormSubmissionService.java](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/FormSubmissionService.java)）。
   - `PublicFormController` 已创建，提供 `GET /api/public/forms/{formId}` 和 `POST /api/public/forms/{formId}/submit`（[PublicFormController.java](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/PublicFormController.java)）。
   - `AppFormService` 已支持对象型 schema 入参并统一序列化为字符串（[AppFormService.java](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/AppFormService.java)）。
   - `AppFormController` 已支持字符串 `appId` 并通过 `AppService.resolveByIdOrCode` 解析（[AppFormController.java](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/AppFormController.java)）。

2. **前端**
   - `api.ts` 已新增 `appServiceApi.forms` 与 `appServiceApi.public`，并扩展 `AppServiceObjectField` 增加 `unique` 字段（[api.ts](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-frontend/src/lib/api.ts)）。
   - `FormLowCodeEditor` 已从 Java 后端拉取对象字段并支持拖拽生成表单字段（[FormLowCodeEditor.tsx](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-frontend/src/pages/apps/editors/FormLowCodeEditor.tsx)）。
   - `usePageEditor` 保存表单页时已调用 `appServiceApi.forms.create/update` 并回写 `form_id`（[usePageEditor.ts](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-frontend/src/pages/apps/editors/usePageEditor.ts)）。
   - `PublicForm` 已适配 Java 后端公开接口（[PublicForm.tsx](file:///d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/metaplatform-frontend/src/pages/PublicForm.tsx)）。

### 待验证/待完成

- 前端 TypeScript 类型检查通过。
- Java 后端 `mvn compile` 通过。
- Java 后端、Node 平台、前端服务正常启动。
- 端到端验证：创建应用 → 创建对象（含 text/number/date/boolean/select 字段，部分必填/唯一） → 创建表单页 → 拖拽字段 → 保存并发布 → 公开提交 → 查询动态表确认数据写入。
- 修复验证过程中发现的任何问题。
- 提交代码。

## 拟议变更

本阶段以验证和提交为主，不引入新功能。可能需要的修改取决于验证结果，常见修复点包括：

1. **编译问题修复**
   - 若 `tsc --noEmit` 报错，修复 TypeScript 类型错误。
   - 若 `mvn compile` 报错，修复 Java 编译错误。

2. **运行时问题修复**
   - 端口冲突：使用 `Get-NetTCPConnection` 定位并停止占用进程。
   - 服务启动失败：检查 H2 / Flyway / CORS 配置。
   - API 404/500：检查请求路径、参数类型、租户上下文。

3. **端到端脚本**
   - 复用或更新 `verify-object-fields.py` 风格的验证脚本，覆盖表单创建、发布、公开提交、数据查询。

4. **代码提交**
   - 整理变更文件，生成符合 conventional commits 的提交信息。

## 假设与决策

1. 本地开发继续使用 H2 内存数据库，生产仍走 PostgreSQL。
2. Node 平台仅用于认证和已有功能，应用中心新业务数据逐步迁移到 Java 后端。
3. 公开表单无 JWT，租户隔离通过 `form.appId` 查询 `AppEntity.tenantId` 设置上下文。
4. 唯一校验保持运行时 `SELECT COUNT(*)`，不添加物理唯一索引。

## 验证步骤

1. **前端类型检查**
   ```powershell
   cd metaplatform-frontend
   npm run typecheck
   ```

2. **后端编译**
   ```powershell
   cd metaplatform-app-service
   mvn compile
   ```

3. **启动服务**
   - Java 后端：`mvn spring-boot:run "-Dspring-boot.run.profiles=dev"`
   - Node 平台：`npm run dev`（在 Node 22 环境下）
   - 前端：`npm run dev`

4. **端到端验证**
   - 创建应用。
   - 创建业务对象，包含 text、number、date、boolean、select 字段，部分标记必填/唯一。
   - 创建表单页，绑定对象，拖拽字段到画布，保存页面。
   - 在 Java 后端发布表单（`POST /api/apps/{appId}/forms/{formId}/publish`）。
   - 打开 `/public/form/{appId}?formId={formId}`，填写并提交。
   - 查询 H2/PostgreSQL 动态表，确认记录写入且 `tenant_id` 正确。

5. **提交代码**
   - `git status` 查看变更。
   - `git diff` 复核。
   - 生成提交信息并提交。
