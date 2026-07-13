# Phase 3 M3 实现计划：流程编辑器 + 审批（Flowable 8）

> **版本**：v1.0.1「Forge+Flow」M3  
> **引擎**：Flowable 8.0（Docker `flowable/flowable-rest:8.0.0`，REST 端口 8081）  
> **代理**：Node 后端 `metaplatform-api/src/routes/flowable.js` 转发 `/api/flowable/*`  
> **目标**：表单提交后自动进入审批流，审批人在待办中心处理，申请人可查看流程进度。

---

## 一、现状盘点

| 组件 | 状态 | 说明 |
|---|---|---|
| Flowable 8 Docker | ✅ 已运行 | `localhost:8081/flowable-rest/service`，admin/test |
| Node 代理 | ✅ 已配置 | `/api/flowable/*` 透传到 Flowable REST |
| 前端 Flowable API | ✅ 已有 | `metaplatform-frontend/src/lib/flowable-api.ts` |
| 前端 BPMN 设计器 | ⚠️ 已有组件 | `components/flow-designer/` 有 V2 版本，需确认能否生成 BPMN XML |
| 表单提交 | ✅ Java 后端 | `FormSubmissionService` 写入动态表 |
| 业务表关联 | ❌ 未做 | Java 后端尚未把表单提交与 Flowable 实例关联 |

---

## 二、总体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         前端 (React + Vite)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ 表单编辑器    │  │ BPMN 流程设计器│  │ 待办中心      │  │ 流程详情  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
└─────────┼─────────────────┼─────────────────┼───────────────┼────────┘
          │                 │                 │               │
          ▼                 ▼                 ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Node 后端 (metaplatform-api)                     │
│  /api/apps/{id}/pages /api/flowable/* /api/apps/{id}/workflows ...   │
└──────────────────────────────────────────────────────────────────────┘
          │                 │                 │               │
          ▼                 ▼                 ▼               ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│ Java app-service  │  │ Flowable 8 REST   │  │ PostgreSQL / H2 / SQLite│
│ 表单提交/动态表    │  │ 流程定义/实例/任务 │  │ 业务数据                 │
└──────────────────┘  └──────────────────┘  └─────────────────────────┘
```

**关键链路**：

1. 业务用户在表单详情页点击「配置流程」→ BPMN 设计器生成 BPMN XML → 通过 `/api/flowable/deployments` 部署到 Flowable → Java 后端记录 `app_workflow_definition`。
2. 表单保存时关联 workflow_definition_id。
3. 终端用户提交表单 → Java `FormSubmissionService` 写入动态表 → 调用 Flowable REST 启动流程实例（`businessKey` = 提交记录 ID）。
4. 流程走到用户任务 → Flowable 生成 task → 前端待办中心调用 `/api/flowable/runtime/tasks` 查询。
5. 审批人点击通过/驳回 → Java 后端校验权限 → 调用 Flowable REST 完成任务。
6. 申请人查看流程实例详情 → BPMN.js 渲染流程图并高亮已执行节点。

---

## 三、数据模型（Java 后端）

### 3.1 `app_workflow_definition` 表

存储业务层流程定义元数据，与 Flowable deployment / processDefinition 做映射。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| app_id | BIGINT FK | 应用 ID |
| form_id | BIGINT FK | 绑定的表单（可选，一个表单一个流程） |
| name | VARCHAR(128) | 流程名称 |
| key | VARCHAR(128) | BPMN process key |
| deployment_id | VARCHAR(64) | Flowable deploymentId |
| process_definition_id | VARCHAR(64) | Flowable processDefinitionId |
| bpmn_xml | TEXT | BPMN XML 内容 |
| status | VARCHAR(20) | draft / published / suspended |
| field_permissions | JSON | 各任务节点的字段权限配置 |
| created_at / updated_at | TIMESTAMP | |
| tenant_id | VARCHAR(64) | 租户隔离 |

### 3.2 `app_form_workflow` 表

表单与流程的绑定关系。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | |
| app_id | BIGINT FK | |
| form_id | BIGINT FK | |
| workflow_definition_id | BIGINT FK | 当前生效的流程定义 |
| enabled | BOOLEAN | 是否启用 |
| created_at / updated_at | TIMESTAMP | |

### 3.3 `form_submission` 表扩展

当前 `form_submission` 表已有 `id`, `form_id`, `object_id`, `row_id`, `values_json` 等字段。需要新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| process_instance_id | VARCHAR(64) | Flowable 流程实例 ID |
| workflow_status | VARCHAR(32) | running / approved / rejected / completed |
| current_task_id | VARCHAR(64) | 当前任务 ID |
| current_task_name | VARCHAR(128) | 当前任务名称 |

---

## 四、字段权限设计

在 BPMN XML 的 `<userTask>` 扩展元素中嵌入字段权限配置，例如：

```xml
<userTask id="finance_approval" name="财务审批" flowable:candidateGroups="finance">
  <extensionElements>
    <mp:fieldPermissions>
      {"visible": ["amount", "status"], "editable": ["status"], "hidden": ["applicant_note"]}
    </mp:fieldPermissions>
  </extensionElements>
</userTask>
```

**规则**：

- `hidden`：申请人/其他角色看不到。
- `visible`：可见但只读。
- `editable`：可见且可编辑（审批时可修改某些字段）。
- 未列出的字段默认可见只读。

**实现**：

- 后端保存流程定义时解析 BPMN XML，把 `mp:fieldPermissions` 提取到 `app_workflow_definition.field_permissions` JSON 中。
- 查询任务/实例详情时，根据当前任务 key 和当前用户角色返回字段权限。
- 前端根据字段权限渲染表单：hidden 不渲染，editable 启用输入，visible 只读展示。

---

## 五、后端接口设计

### 5.1 流程定义管理（Java 后端）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/apps/{appId}/workflows` | 保存/部署流程定义 |
| GET | `/api/apps/{appId}/workflows` | 列表 |
| GET | `/api/apps/{appId}/workflows/{id}` | 详情（含 BPMN XML） |
| PUT | `/api/apps/{appId}/workflows/{id}` | 更新 |
| POST | `/api/apps/{appId}/workflows/{id}/publish` | 发布 |
| POST | `/api/apps/{appId}/workflows/{id}/suspend` | 暂停 |

保存时：

1. 校验 BPMN XML 基本结构。
2. 调用 Flowable REST `/repository/deployments` 部署（Node 后端已代理，Java 可直接调用 Flowable 8081 或走 `/api/flowable/deployments`）。
3. 解析返回的 deploymentId 和 processDefinitionId。
4. 插入/更新 `app_workflow_definition`。

### 5.2 表单绑定流程

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/apps/{appId}/forms/{formId}/bind-workflow` | 绑定/解绑 workflow_definition_id |
| GET | `/api/apps/{appId}/forms/{formId}/workflow` | 查询表单绑定的流程 |

### 5.3 表单提交后启动流程（改造现有提交接口）

改造 `FormSubmissionService.submit` 或 `PublicFormController.submit`：

1. 写入动态表后得到 `rowId`。
2. 检查表单是否绑定已发布流程。
3. 若绑定，调用 Flowable REST `POST /runtime/process-instances`：
   - `processDefinitionId`：来自 `app_workflow_definition`
   - `businessKey`：`submission:{id}` 或 `{rowId}`
   - `variables`：表单字段值 + `starterId` + `tenantId`
4. 更新 `form_submission.process_instance_id / workflow_status / current_task_id / current_task_name`。

### 5.4 待办与审批

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/apps/{appId}/todos` | 当前用户的待办任务 |
| GET | `/api/apps/{appId}/todos/{taskId}` | 任务详情（含表单快照、字段权限） |
| POST | `/api/apps/{appId}/todos/{taskId}/complete` | 通过 |
| POST | `/api/apps/{appId}/todos/{taskId}/reject` | 驳回 |

内部逻辑：

1. 从 Flowable 查询任务，校验当前用户是否在 candidateGroups / assignee 中。
2. `complete`：调用 Flowable `POST /runtime/tasks/{id}` with `action=complete`。
3. `reject`：若当前任务是排他网关前最后一个任务，可设置变量 `approved=false`，然后 complete；或者直接 delete process instance（更简单粗暴）。
   - v1.0.1 推荐：在 BPMN 中增加一个 `approved` 变量，网关判断 `approved == false` 走结束节点。
4. 完成后更新 `form_submission.workflow_status`。

### 5.5 流程实例详情

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/apps/{appId}/submissions/{submissionId}` | 提交记录 + 流程实例状态 |
| GET | `/api/apps/{appId}/process-instances/{instanceId}/history` | 历史节点用于高亮 |

---

## 六、前端改动

### 6.1 表单编辑器增加「配置流程」入口

在 `FormLowCodeEditor` 或表单详情页增加按钮：

- 「配置流程」→ 打开 BPMN 设计器。
- 设计器生成 BPMN XML → 保存到 `app_workflow_definition`。
- 表单保存时自动绑定该流程定义。

### 6.2 BPMN 流程设计器

使用现有 `ProcessDesignerV2`：

- 支持拖放开始 / 用户任务 / 排他网关 / 结束。
- 用户任务属性面板配置：
  - 处理人：角色 / 固定用户 / 表达式
  - 字段权限：visible / editable / hidden
- 导出 BPMN XML。
- 部署到 Flowable。

如果现有设计器不能直接生成 BPMN XML，需要改造或集成 `bpmn-js`。

### 6.3 待办中心

新增页面 `src/pages/TodoCenter.tsx`：

- 顶部 tab：待处理 / 已处理 / 我发起的。
- 列表显示：任务名、关联表单、提交人、提交时间。
- 点击打开任务详情抽屉/弹窗：
  - 显示表单快照（按字段权限过滤）。
  - 通过/驳回按钮。
  - 驳回意见输入框。

### 6.4 流程实例详情

新增页面或在提交记录详情中嵌入：

- 使用 `bpmn-js` 渲染 BPMN XML。
- 高亮：
  - 已完成节点：绿色
  - 当前节点：黄色
  - 未到达节点：灰色
- 显示审批历史（时间、操作人、意见）。

### 6.5 字段权限应用

在渲染表单时，根据字段权限：

- hidden：不渲染。
- visible：只读展示。
- editable：正常输入。

---

## 七、实施步骤

### 步骤 1：数据库迁移

- 新增 `app_workflow_definition` 表。
- 新增 `app_form_workflow` 表。
- `form_submission` 表新增 `process_instance_id`、`workflow_status`、`current_task_id`、`current_task_name`。

### 步骤 2：Java 后端 — 流程定义 CRUD

- 创建实体、Repository、Service、Controller。
- 实现 BPMN XML 解析（提取 key、fieldPermissions、candidateGroups）。
- 调用 Flowable REST 部署。

### 步骤 3：Java 后端 — 表单提交启动流程

- 改造 `FormSubmissionService`。
- 在动态表写入成功后启动 Flowable 实例。
- 更新提交记录状态。

### 步骤 4：Java 后端 — 待办与审批 API

- 实现 `TodoController`。
- 查询 Flowable tasks，校验权限。
- complete / reject 流程。

### 步骤 5：前端 — 流程设计器改造

- 检查 `ProcessDesignerV2` 是否能导出 BPMN XML。
- 集成属性面板中的字段权限配置。
- 对接保存/部署接口。

### 步骤 6：前端 — 待办中心

- 新增页面和路由。
- 对接待办列表和任务详情 API。
- 实现通过/驳回 UI。

### 步骤 7：前端 — 流程可视化

- 集成 `bpmn-js`。
- 渲染流程图并高亮节点。

### 步骤 8：端到端验证

- 创建对象 → 建表单 → 配置 2 节点审批流 → 发布。
- 提交表单 → 流程实例 running → 待办生成。
- 财务角色登录 → 看到待办 → 通过/驳回。
- 申请人查看流程状态变更和流程图高亮。

---

## 八、验收标准

| ID | 验收项 | 标准 |
|---|---|---|
| AC-301.1 | 流程编辑器 | 支持开始/用户任务/排他网关/结束节点 |
| AC-301.2 | 处理人配置 | 支持角色、固定用户、表达式 |
| AC-301.3 | 字段权限 | 可按任务角色配置字段 visible/editable/hidden |
| AC-301.4 | 流程部署 | 保存后 Flowable 中存在对应 process definition |
| AC-301.5 | 流程状态 | 支持发布/暂停/终止 |
| AC-302.1 | 自动发起 | 表单提交后自动启动流程实例 |
| AC-302.2 | 待办实时 | 轮询 5s 刷新待办列表 |
| AC-302.3 | 审批操作 | 支持通过 / 驳回 |
| AC-302.4 | 驳回必填 | 驳回时意见必填 |
| AC-302.5 | 可视化 | 流程详情页按状态高亮节点 |
| AC-302.6 | 字段隔离 | 申请人看不到财务隐藏字段 |

---

## 九、风险与决策

| 风险 | 应对 |
|---|---|
| Flowable 8 REST 路径与前端 flowable-api.ts 不一致 | 已核对：使用 `/repository/process-definitions`、`/runtime/process-instances`、`/runtime/tasks` |
| Java 后端调用 Flowable REST 需要 basic auth | 使用 admin/test，与 Node 代理一致 |
| BPMN 设计器无法生成标准 XML | fallback 使用 `bpmn-js` Modeler |
| 字段权限解析复杂 | 先支持用户任务的 `mp:fieldPermissions` 扩展元素 |
| 驳回逻辑 | 通过 `approved=false` 变量 + 排他网关实现，避免直接删实例 |
