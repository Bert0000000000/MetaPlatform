# Phase 2 实现计划：表单编辑器绑定对象字段 + 表单渲染/提交

## 上下文

Phase 1（业务对象字段管理）已完成并提交。应用中心后端已从 Node/Express/SQLite 迁移到 Java 21 + Spring Boot 3 + PostgreSQL（本地开发使用 H2）。

本计划的目标是让表单设计器真正基于对象字段生成表单，并且用户提交的数据能写入数据库，形成「建对象 → 画表单 → 填数据」的完整链路。

## 目标

1. `FormLowCodeEditor` 能从当前应用的业务对象拖拽字段到画布。
2. 保存表单页时，字段绑定关系写入 Java 后端的 `app_forms.schema_json`。
3. `PublicForm` 根据已发布表单配置渲染真实表单组件。
4. 提交时 Java 后端校验并写入对象对应的动态数据表。
5. 校验失败返回明确的中文提示。

## 推荐方案

复用现有低代码编辑器能力，最小改动打通链路：

- 后端：复用 `app_forms` 表存储表单设计，复用 `app_objects.data_table_name` 指向的物理表存储实例数据；新增公开表单拉取与提交接口。
- 前端：`FormLowCodeEditor` 已支持 `boundObjectId`，本次补全对象字段拖拽；`usePageEditor` 保存时直接对接 Java 后端；`PublicForm` 改调 Java 公开接口。

## 数据流

```
DataModeling / ObjectFieldPanel（Java 后端）
  -> app_objects（含 schema_json、data_table_name）
  -> FormLowCodeEditor 选择 boundObjectId 并拖拽字段
  -> DesignerState（boundObjectId + DesignerField.fieldKey/boundProperty）
  -> usePageEditor 保存 -> appServiceApi.forms.create/update
  -> app_forms.schema_json
  -> 发布 -> status = published
  -> PublicForm 调用 GET /api/public/forms/{formId}
  -> 用户填写 -> POST /api/public/forms/{formId}/submit
  -> FormSubmissionService 校验 -> DynamicTableService.insertRow
  -> data_{code}_{hash} 新增记录
```

## 后端变更

### 1. 动态表 DML 支持

**文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/dynamic/DynamicTableService.java`

新增方法：

- `Long insertRow(String tableName, Map<String, Object> row, String tenantId, String createdBy)`：按字段名动态拼 `INSERT`，返回自增 `id`。
- `boolean exists(String tableName, String column, Object value, String tenantId)`：唯一性校验。

约束：

- 入参表名/字段名使用已有正则校验。
- SQL 使用标准占位符 `?`，保持 H2 / PostgreSQL 兼容。
- 所有写入必须带 `tenant_id`。

### 2. 对象字段支持「唯一」标记

**文件**：

- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/object/AppObjectFieldService.java`
- `metaplatform-frontend/src/lib/api.ts`

修改点：

- `FieldView` / `FieldRequest` / `AppServiceObjectField` 增加 `Boolean unique`。
- `ObjectFieldPanel` 把 `unique_field` 通过 `appServiceApi` 发送给后端。
- Phase 2 不建物理唯一索引，只做提交时的 `SELECT COUNT(*)` 校验。

### 3. 表单提交服务

**新建文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/FormSubmissionService.java`

职责：

1. 根据 `formId` 加载 `AppFormEntity`，校验 `status = published`。
2. 根据 `form.objectId` 加载 `AppObjectEntity`，拿到 `schema_json` 与 `data_table_name`。
3. 解析 `schema_json`（`DesignerState` 结构），提取字段列表。
4. 按字段 `fieldKey` / `key` / `field` 匹配提交值。
5. 逐项校验：
   - 必填：值为 `null` / 空字符串时报 `字段 {label} 不能为空`。
   - 类型：`number` 可转 Double；`boolean` 可转 Boolean；`date` / `datetime` 可解析；其他按文本处理。
   - 唯一：对象字段 `unique=true` 时调用 `DynamicTableService.exists`。
6. 类型转换后写入动态表，返回 `rowId`。

### 4. 公开接口

**新建文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/PublicFormController.java`

端点：

- `GET /api/public/forms/{formId}`
  - 返回 `{ id, name, boundObjectId, sections: [...] }` 子集，供 `PublicForm` 渲染。
- `POST /api/public/forms/{formId}/submit`
  - Body：`{ values: Map<String, Object>, submitterEmail?, submitterName? }`
  - 返回：`{ id: <data row id> }`

租户隔离：

- 公开接口无 JWT，但 `TenantAndTraceFilter` 会把 `X-Tenant-Id` 注入 `TenantContext`；未带 header 时使用 `default-tenant`。
- `PublicFormController` 根据 `form.appId` 查询 `AppEntity.tenantId`，重新设置 `TenantContext` 后再调 Service，确保按应用隔离。

### 5. AppFormService 调整

**文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/AppFormService.java`

- `create` / `update` 的 `schema` 参数允许 JSON 对象或 JSON 字符串；内部统一序列化为字符串后落库。
- `AppFormCreateRequest` / `AppFormUpdateRequest` 支持接收对象型 schema。
- `AppFormController` 的 `appId` 路径参数改为 `String`，复用 `AppService.resolveByIdOrCode` 兼容前端 slug。

### 6. 数据库迁移

本次不新建业务表，复用现有：

- `app_forms`
- `app_objects`
- 运行时动态创建的 `data_{code}_{hash}`

## 前端变更

### 1. API 层统一走 Java 后端

**文件**：`metaplatform-frontend/src/lib/api.ts`

在 `appServiceApi` 中新增（直接访问 `http://localhost:8092/api`）：

- `forms.list(appId)`
- `forms.get(appId, formId)`
- `forms.create(appId, data)`：参数包含 `objectId`、`code`、`name`、`schema`。
- `forms.update(appId, formId, data)`
- `forms.publish(appId, formId)`
- `public.getFormSchema(formId)`
- `public.submitForm(formId, values, submitterEmail?, submitterName?)`

给 `AppServiceObjectField` 增加 `unique?: boolean`。

### 2. 表单设计器绑定对象字段

**文件**：`metaplatform-frontend/src/pages/apps/editors/FormLowCodeEditor.tsx`

1. 对象/字段数据源从 `ontologyApi` 切换到 `appServiceApi.listObjects(appId)`，因为表单需要绑定 Java 后端的 `app_objects`。
2. 当 `state.boundObjectId` 选中后，解析该对象的 `schemaJson`，在左侧组件库新增「对象字段」区域，展示可拖拽字段。
3. 拖拽对象字段到画布时，自动生成 `DesignerField`：
   - `fieldKey = 字段 code`
   - `label = 字段 name`
   - `required = 字段 required`
   - `boundObject = state.boundObjectId`
   - `boundProperty = 字段 code`
   - `type` 按映射表选择
4. 属性面板选择 `boundProperty` 后自动同步 `fieldKey` 与 `label`（若用户未手动修改）。

### 3. 页面保存流程接入 Java 表单表

**文件**：`metaplatform-frontend/src/pages/apps/editors/usePageEditor.ts`

修改 `mirrorToBusinessTable` 与 `loadPage`：

- 保存时：
  - 从 `pageDef` 中取出 `DesignerState`。
  - 若 `state.boundObjectId` 存在，转换为 `Number(objectId)`。
  - 生成合法 `code`：`form_page_{pageId}` 并清洗（小写、数字、下划线，首字符字母，长度 <= 64）。
  - 调用 `appServiceApi.forms.create` / `update`，参数 `{ objectId, code, name: pageName, schema: state }`。
  - 回写 `form_id` 到 `app_pages`（`appsApi.updatePage(..., { form_id })`）。
- 加载时：
  - 若 `page.form_id` 存在，调用 `appServiceApi.forms.get(appId, page.form_id)` 并把 `schema` 反序列化为 `DesignerState`。

### 4. 公开表单渲染与提交

**文件**：`metaplatform-frontend/src/pages/PublicForm.tsx`

1. 接口指向 Java 后端：使用 `appServiceApi.public.*` 或 `VITE_APP_SERVICE_URL`。
2. 兼容 `DesignerState` schema：
   - 字段来源：`schema.sections.flatMap(s => s.fields)`
   - 字段名：`f.field || f.key || f.name`
   - 类型：`f.widget`
3. widget -> HTML 输入类型映射：
   - `input`, `phone`, `url`, `rate`, `color`, `reference`, `formula` -> text
   - `email` -> email
   - `number`, `currency`, `percent`, `slider` -> number
   - `textarea`, `richtext` -> textarea
   - `select`, `radio` -> select
   - `checkbox`, `switch` -> checkbox
   - `datepicker` -> date
   - `datetime` -> datetime-local
4. 提交体保持 `{ values, submitterEmail?, submitterName? }`。

## 类型映射表

### 对象字段类型 -> 设计器 widget

| 对象字段类型 | 设计器 widget |
|---|---|
| text | input |
| longtext | textarea |
| number | number |
| boolean | switch |
| date | datepicker |
| datetime | datetime |
| select | select |
| multiselect | select（multiple=true） |
| email | email |
| phone | phone |

### 提交值 -> SQL 类型

| 对象类型 | 转换目标 | 校验规则 |
|---|---|---|
| text / longtext / select / multiselect / email / phone | String | 必填时非空 |
| number | Double | 可解析为数字 |
| boolean | Boolean | "true"/"1" 等 |
| date | LocalDate | ISO 日期 |
| datetime | LocalDateTime | ISO 日期时间 |

## 关键文件清单

- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/dynamic/DynamicTableService.java`
- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/FormSubmissionService.java`
- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/PublicFormController.java`
- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/AppFormService.java`
- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/AppFormController.java`
- `metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/object/AppObjectFieldService.java`
- `metaplatform-frontend/src/lib/api.ts`
- `metaplatform-frontend/src/pages/apps/editors/FormLowCodeEditor.tsx`
- `metaplatform-frontend/src/pages/apps/editors/usePageEditor.ts`
- `metaplatform-frontend/src/pages/PublicForm.tsx`

## 实施步骤

### Step 1：后端基础能力

- [x] 扩展 `DynamicTableService`：`insertRow`、`exists`。
- [x] 扩展 `AppObjectFieldService` 支持 `unique` 字段读写。
- [x] 新增 `FormSubmissionService`：schema 解析、校验、写入。
- [x] 新增 `PublicFormController`：两个公开端点。
- [ ] 调整 `AppFormService` / `AppFormController` 支持对象型 schema 与字符串 appId。
  - `AppFormController` 已支持字符串 `appId`。
  - `AppFormService.create/update` 仍需允许 `schema` 入参为 JSON 对象，内部序列化为字符串后落库。
- [ ] 运行现有测试 + 新增提交测试，确保编译通过。

**验收点**：`POST /api/public/forms/{formId}/submit` 能写入动态表并返回 id；必填/类型/唯一校验返回中文错误。

### Step 2：前端设计器绑定

1. `api.ts` 增加 `appServiceApi.forms` / `appServiceApi.public`。
2. `FormLowCodeEditor` 改拉 Java 对象、新增对象字段拖拽面板、自动填充绑定字段。
3. `usePageEditor` 保存/加载接入 `appServiceApi.forms`。

**验收点**：表单页保存后，Java `app_forms.schema_json` 包含 `boundObjectId` 与字段绑定信息。

### Step 3：公开表单渲染与提交

1. `PublicForm` 改调 Java 公开接口。
2. 支持从 `sections` 读取字段、`fieldKey` 作为提交键。
3. 提交成功后显示成功页。

**验收点**：通过公开链接打开表单，填写后提交，动态表中新增一条记录；提交错误时显示中文提示。

### Step 4：端到端回归

1. 创建应用 -> 创建对象（含 text/number/date/boolean/select 字段，部分必填/唯一）-> 创建表单页 -> 拖拽字段 -> 保存并发布。
2. 打开 `/public/form/{appId}?formId={formId}`，提交数据。
3. 查询数据库/接口确认数据写入且 `tenant_id` 正确。

## 验证方式

- 后端单元/集成测试：新增 `FormSubmissionServiceTest` 与 `PublicFormControllerTest`，覆盖必填校验、类型转换、唯一校验、成功写入。
- 前端类型检查：`cd metaplatform-frontend && tsc --noEmit`。
- 端到端：启动 Java 后端 + Node 平台（用于 auth）+ 前端，创建对象、表单、提交，验证动态表数据。

## 决策点

以下事项已在计划中采用推荐方案，如需调整请指出：

1. **公开接口租户隔离**：公开接口无 JWT，根据 `form.appId` 自动设置租户上下文；dev 模式下未传 `X-Tenant-Id` 时使用 `default-tenant`。
2. **旧表单数据兼容**：Java 后端使用 Long 自增主键，与 Node 旧 UUID 数据不兼容；Phase 2 直接基于 Java 后端重新创建表单。
3. **唯一校验强度**：Phase 2 仅运行时 `SELECT COUNT(*)` 校验，不添加物理唯一索引。
4. **文件/图片/签名字段**：Phase 2 渲染为文本输入（占位），不处理上传存储。
5. **表单 code 生成规则**：使用 `form_page_{pageId}` 清洗后的合法 slug，不允许前端自定义。
