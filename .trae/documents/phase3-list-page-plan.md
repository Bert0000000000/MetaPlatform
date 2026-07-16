# Phase 3 实现计划：列表页（US-203）

> **版本**：v1.0.1「Forge+Flow」M2 收尾
> **目标**：让表单提交后的数据能被业务用户按列排序、过滤、分页查询，并支持 CSV 导出。
> **关联文档**：
> - `docs/v1.0.x/v1.0.1/01-user-stories.md` US-203
> - `docs/v1.0.x/v1.0.1/03-test-cases.md` TC-M2-005 / TC-M2-006
> - `metaplatform-app-service` 当前为 Java 21 + Spring Boot 3 + H2/PostgreSQL

---

## 一、目标

闭合 v1.0.1 Epic M2「表单 + 列表」：

1. 业务用户在表单编辑器里可配置「列表页」要显示的列。
2. 终端用户提交表单后，能进入列表页看到所有提交记录。
3. 列表页支持：
   - 分页（默认 20 条/页）
   - 列头点击排序（升/降/取消）
   - 按任意列过滤（精确 / 范围 / 模糊 / 是否为空）
   - CSV 导出
4. 数据必须按 `tenant_id` 隔离。

---

## 二、数据流

```
PublicForm 提交成功
  -> 动态表 data_{code}_{hash} 新增一行
  -> 用户进入 /apps/{appId}/pages/{pageId} (type=list)
  -> ListPageEditor 从 Java 后端拉取列表数据
  -> GET /api/apps/{appId}/forms/{formId}/data?page=1&size=20&sort=-amount&filter=amount>1000
  -> DynamicTableService.queryRows(...) 按 tenant_id 分页查询
  -> 前端渲染表格 + 分页 + 排序 + 过滤
```

---

## 三、后端设计

### 3.1 新增 `FormDataController`

**文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/form/FormDataController.java`

端点：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/apps/{appId}/forms/{formId}/data` | 查询表单提交数据 |
| GET | `/api/apps/{appId}/forms/{formId}/data.csv` | 导出 CSV |

查询参数：

```
page          int    默认 1
size          int    默认 20，最大 200
sort          string 如 "-created_at" 或 "amount"，前缀 - 表示降序
filter        string 如 "amount>1000"，可传多个 filter[]=
columns       string 逗号分隔的列名，控制返回字段
```

返回结构：

```json
{
  "success": true,
  "data": {
    "rows": [
      { "id": 1, "amount": 2000, "created_at": "2026-07-13T10:00:00", ... }
    ],
    "total": 100,
    "page": 1,
    "size": 20,
    "sort": "-created_at",
    "filters": { "amount": ">1000" }
  }
}
```

### 3.2 扩展 `DynamicTableService`

**文件**：`metaplatform-app-service/src/main/java/com/metaplatform/appservice/domain/dynamic/DynamicTableService.java`

新增方法：

```java
public PageResult queryRows(String tableName, QueryRequest req, String tenantId)
public List<Map<String, Object>> queryRowsForCsv(String tableName, QueryRequest req, String tenantId)
```

职责：

1. 校验表名和列名（复用 `TABLE_NAME_PATTERN` / `IDENT_PATTERN`）。
2. 仅查询 `tenant_id = ?` 的数据。
3. 按 `sort` 参数拼 `ORDER BY`，支持多字段。
4. 按 `filter` 参数拼 `WHERE`：
   - `amount>1000` → `amount > ?`
   - `name~张` → `name LIKE '%张%'`
   - `status=approved` → `status = ?`
   - `remark:` → `remark IS NULL`
5. 使用 `JdbcTemplate` + `COUNT(*)` 分页。

### 3.3 新增 DTO / 查询对象

**文件**：

- `metaplatform-app-service/.../domain/form/FormDataQueryRequest.java`（或内部 static class）
- `metaplatform-app-service/.../domain/form/FormDataPageResult.java`

包含：page / size / sort / filters / columns。

### 3.4 权限与租户隔离

- `FormDataController` 从 `TenantContext.get()` 取当前租户。
- 根据 `formId` 加载 `AppFormEntity`，校验表单存在且已发布。
- 根据 `form.objectId` 找到 `data_table_name`。
- 查询时强制附加 `tenant_id = ?`。
- 返回字段中**不包含** `tenant_id`（前端不需要）。

---

## 四、前端设计

### 4.1 API 层扩展

**文件**：`metaplatform-frontend/src/lib/api.ts`

在 `appServiceApi.forms` 下新增：

```typescript
listData: (appId, formId, params) => appServiceRequest<FormDataPageResult>(`/apps/${appId}/forms/${formId}/data?${qs}`),
exportCsv: (appId, formId, params) => fetch(`${APP_SERVICE_BASE}/apps/${appId}/forms/${formId}/data.csv?${qs}`),
```

### 4.2 改造 `ListPageEditor`

**文件**：`metaplatform-frontend/src/pages/apps/editors/ListPageEditor.tsx`

当前问题：

- 使用写死的 mock 分类树和 mock 行数据。
- 没有对接真实后端。
- 不支持分页、排序、过滤。

改造后：

1. 接收 `appId` 和 `pageData`（含 `form_id`）。
2. 首次加载时调用 `appServiceApi.forms.listData(appId, form_id)`。
3. 表格列从 `AppFormEntity.schema_json.sections[].fields` 自动推导：
   - 列名 = 字段 `name`
   - 字段 key = 字段 `fieldKey`
4. 支持列头点击排序。
5. 支持列头旁过滤输入框（简单过滤面板）。
6. 内部分页组件。
7. 保留左侧分类树占位（v1.0.1 不做真实分类，显示空树或隐藏）。

### 4.3 新增运行时列表页

业务用户配置的「列表页」需要在应用运行时被访问。v1.0.1 最小实现：

- 在 `Pages.tsx` 中，当 `selectedPage.type === "list"` 时，内联编辑器显示 `ListPageEditor`（设计时）。
- 终端用户访问公开列表：新增路由 `/public/lists/{appId}?formId={formId}` 或在表单提交后直接跳转到 `/public/forms/{formId}/submissions`（后者已存在，可复用并增强）。

**推荐**：复用已有的 `/public/forms/{formId}/submissions` 路由，但改成真正的数据表格（当前可能是占位页）。

### 4.4 `PublicForm` 提交后跳转

**文件**：`metaplatform-frontend/src/pages/PublicForm.tsx`

提交成功后：

1. 显示成功提示。
2. 「查看提交记录」按钮跳转到 `/public/forms/{formId}/submissions`。
3. 该页面用新列表组件渲染真实数据。

---

## 五、实施步骤

### 步骤 1：后端 — DynamicTableService 增加查询

- 新增 `queryRows` / `queryRowsForCsv`。
- 实现过滤解析器（FilterParser）。
- 单测：测试过滤语法、排序、分页。

### 步骤 2：后端 — 新增 FormDataController

- 实现 `/data` 和 `/data.csv`。
- 实现 CSV 生成（UTF-8 BOM + 表头 + 数据行）。
- 集成测试：提交数据 → 查询 → 过滤 → 导出。

### 步骤 3：前端 — API 层扩展

- `api.ts` 增加 `forms.listData` 和 `forms.exportCsv`。

### 步骤 4：前端 — 改造 ListPageEditor

- 删除 mock 数据。
- 对接 `forms.listData`。
- 实现排序、过滤、分页 UI。
- 保留配置持久化到 `components[0].props`。

### 步骤 5：前端 — PublicFormSubmissions 列表页

- 查看 `PublicFormSubmissions.tsx` 当前实现。
- 改为真实数据表格，支持分页/排序/过滤/导出。
- 提交成功后跳转逻辑调整。

### 步骤 6：端到端验证

- 创建对象 → 创建表单 → 提交 5 条 → 进入列表页。
- 验证：分页、按金额降序、过滤 `>1000`、CSV 导出。

---

## 六、验收标准

| ID | 验收项 | 标准 |
|---|---|---|
| AC-203.1 | 分页 | 默认 20 条，可翻页，total 正确 |
| AC-203.2 | 排序 | 点击列头切换升/降，再次点击取消 |
| AC-203.3 | 过滤 | 支持 `>`, `<`, `=`, `~`, `:` 五种操作符 |
| AC-203.4 | CSV 导出 | 导出文件 UTF-8 BOM，包含表头和数据 |
| AC-203.5 | 租户隔离 | 跨租户查询不到数据 |
| TC-M2-005 | E2E | 列表分页 + 排序 + 过滤 全绿 |
| TC-M2-006 | CSV | 导出格式正确 |

---

## 七、风险与决策

| 风险 | 应对 |
|---|---|
| `data_table_name` 在动态表和 `AppObjectEntity` 中不一致 | 统一从 `AppFormEntity.objectId -> AppObjectEntity.dataTableName` 解析 |
| 过滤语法安全（SQL 注入） | 仅允许预定义操作符，列名走 `IDENT_PATTERN` 校验，值用占位符 |
| H2 与 PostgreSQL 分页语法差异 | 使用 `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY` 或 Spring `JdbcTemplate` + 标准 SQL |

---

## 八、完成后下一步

列表页完成后，v1.0.1 M2 全部闭合。下一步进入 **M3 简单流程 + 审批**（US-301 / US-302）。
