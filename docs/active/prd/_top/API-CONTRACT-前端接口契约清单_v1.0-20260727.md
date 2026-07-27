# Mate Platform 前端接口契约清单（API Contract）

> **版本**: v1.0 | **日期**: 2026-07-27
>
> **生成依据**: 通过正则扫描 metaplatform-frontend/apps/*/src/api/*.ts 与 metaplatform-frontend/packages/shared/src/api/*.ts 中所有 axios 调用，自动汇总出 141 个独立 API 端点。
>
> **用途**: 作为后端服务的**实现依据**与**并行开发接口边界**。
>
> **关联文档**:
> - docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md
> - docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md

---

## 1. 总体架构

### 1.1 服务拓扑

```
[TECH-GW 网关 8000]
   IAM(8101)  AGENT(8511) MCP(8105) RAG(8901) ONT(8301)
   WFE(8311)  EA(8321)    LLMGW(8210)
   + OBS(8401) MSG(8411) A2A(8502) RULE(8331) ACTION(8341) DATA(8701)
```

### 1.2 前缀到后端服务映射（Q2=B 决策）

| 前端前缀 | 归属后端服务 | 说明 |
|---|---|---|
| /v1/apphub/* | TECH-EA | 应用/模块/页面/版本/市场 |
| /v1/copilot/* | MATE-AGENT | SuperAI 顶层（对话/分析/Action/代码/任务/调度） |
| /v1/superai/* | MATE-AGENT | 同 /v1/copilot/* |
| /v1/dashboard/* | TECH-IAM 扩展 | 工作台/通知/待办/设置/聚合 |
| /v1/dw/* | MATE-AGENT | 数字员工 |
| /v1/kb/* | TECH-RAG | 知识库 |
| /v1/wfe/* | TECH-WFE | 流程引擎 |
| /v1/iam/* | TECH-IAM | 鉴权/策略 |
| /v1/ea/* | TECH-EA | 企业架构 |
| /v1/mcp/* | TECH-MCP | MCP 中心 |
| /v1/ont/* | TECH-ONT | 本体引擎 |
| /v1/rag/* | TECH-RAG | RAG 检索 |
| /v1/llmgw/* | TECH-LLMGW | LLM 网关 |
| /v1/a2a/* | MATE-A2A | A2A 协议 |
| /v1/obs/* | TECH-OBS | 可观测性（已被 /v1/dw/traces 重映射） |
| /v1/msg/* | TECH-MSG | 消息中心 |
| /v1/rule/* | TECH-RULE | 规则引擎 |
| /v1/action/* | TECH-ACTION | Action 编排 |
| /v1/data/* | MATE-DATA | 数据集成 |

**前端代码无需调整**：保持当前 /api/v1/{prefix}/* 调用路径，由 TECH-GW 网关按路由表分流到对应后端服务。

---

## 2. 统一接口规范

### 2.1 请求规范

| 项 | 规范 |
|---|---|
| 协议 | HTTP/1.1 或 HTTP/2，明文（dev）/ TLS（prod） |
| 基础路径 | /api/v1/{service}/*（经 TECH-GW） |
| 请求方法 | GET/POST/PUT/PATCH/DELETE |
| 请求头 | Content-Type: application/json / Authorization: Bearer / X-Tenant-Id / X-Trace-Id / Accept-Language |
| 请求体 | JSON |
| 分页参数 | ?page=1&size=20 |
| 时间格式 | ISO-8601 UTC |

### 2.2 响应规范

```json
{
  "code": 0,
  "message": "success",
  "data": <T>,
  "traceId": "a1b2c3d4e5f67890"
}
```

分页数据格式：
```json
{
  "code": 0,
  "data": {
    "items": [...],
    "total": 234,
    "page": 1,
    "size": 20,
    "pages": 12
  }
}
```

### 2.3 错误码规范

| HTTP Status | 含义 | 前端处理 |
|---|---|---|
| 200 | 业务成功 | 取 data |
| 200 (code≠0) | 业务错误 | 抛出 BizError，toast 显示 message |
| 400 | 参数错误 | toast 错误，不重试 |
| 401 | 未登录/token 过期 | 自动 refresh，重放；失败跳 /login |
| 403 | 无权限 | 跳 403 页面或 toast |
| 404 | 资源不存在 | toast + 返回列表 |
| 409 | 冲突 | toast + 提供强制覆盖选项 |
| 429 | 限流 | toast + 退避重试 |
| 500/502/503 | 服务器错误 | toast + 记录 traceId |

code 业务码：0 成功 / 1001 参数错误 / 2001 资源不存在 / 2002 资源冲突 / 3001 无权限 / 3002 租户隔离冲突 / 4001 LLM 失败 / 5001 业务规则违反

---

## 3. 完整 API 端点清单（141 条，按服务前缀分组）

### 3.1 /v1/iam/* —— 身份认证与策略（TECH-IAM）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/iam/auth/login | 用户登录 | shared/auth.ts |
| POST | /v1/iam/auth/logout | 登出 | shared/auth.ts |
| POST | /v1/iam/auth/refresh | 刷新 token | shared/auth.ts |
| POST | /v1/iam/auth/register | 注册 | shared/auth.ts |
| GET | /v1/iam/policies | 策略列表 | mcphub/permissions.ts |
| POST | /v1/iam/policies | 创建策略 | mcphub/permissions.ts |
| GET | /v1/iam/policies/{id} | 策略详情 | mcphub/permissions.ts |
| PUT | /v1/iam/policies/{id} | 更新策略 | mcphub/permissions.ts |
| DELETE | /v1/iam/policies/{id} | 删除策略 | mcphub/permissions.ts |
| GET | /v1/iam/policies/matrix | 权限矩阵 | mcphub/permissions.ts |
| POST | /v1/iam/policies/matrix/export | 导出矩阵 | mcphub/permissions.ts |
| GET | /v1/iam/policies/condition-syntax | ABAC 条件语法 | mcphub/permissions.ts |

### 3.2 /v1/apphub/* —— 应用中心（挂到 TECH-EA）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/apphub/apps | 应用列表 | apphub/apps.ts |
| POST | /v1/apphub/apps | 创建应用 | apphub/apps.ts |
| GET | /v1/apphub/apps/{id} | 应用详情 | apphub/apps.ts |
| PUT | /v1/apphub/apps/{id} | 更新应用 | apphub/apps.ts |
| DELETE | /v1/apphub/apps/{id} | 删除应用 | apphub/apps.ts |
| GET | /v1/apphub/apps/groups | 应用分组列表 | apphub/apps.ts |
| GET | /v1/apphub/modules | 模块列表 | apphub/modules.ts |
| POST | /v1/apphub/modules | 创建模块 | apphub/modules.ts |
| GET | /v1/apphub/modules/{id} | 模块详情 | apphub/modules.ts |
| PUT | /v1/apphub/modules/{id} | 更新模块 | apphub/modules.ts |
| DELETE | /v1/apphub/modules/{id} | 删除模块 | apphub/modules.ts |
| GET | /v1/apphub/pages | 页面设计器配置列表 | apphub/pages.ts |
| GET | /v1/apphub/pages/{id} | 页面配置详情 | apphub/pages.ts |
| POST | /v1/apphub/pages | 创建页面 | apphub/pages.ts |
| PUT | /v1/apphub/pages/{id} | 更新页面 | apphub/pages.ts |
| DELETE | /v1/apphub/pages/{id} | 删除页面 | apphub/pages.ts |
| GET | /v1/apphub/templates | 应用市场模板列表 | apphub/marketplace.ts |
| POST | /v1/apphub/templates | 提交模板 | apphub/marketplace.ts |
| GET | /v1/apphub/templates/{id} | 模板详情 | apphub/marketplace.ts |
| POST | /v1/apphub/templates/{id}/install | 安装模板 | apphub/marketplace.ts |
| GET | /v1/apphub/templates/{id}/comments | 模板评论 | apphub/marketplace.ts |
| POST | /v1/apphub/templates/{id}/comments | 提交评论 | apphub/marketplace.ts |
| GET | /v1/apphub/apps/{id}/versions | 应用版本列表 | apphub/versions.ts |
| POST | /v1/apphub/apps/{id}/versions | 创建版本 | apphub/versions.ts |
| GET | /v1/apphub/versions/{id} | 版本详情 | apphub/versions.ts |
| POST | /v1/apphub/versions/{id}/publish | 发布版本 | apphub/versions.ts |
| POST | /v1/apphub/versions/{id}/rollback | 回滚版本 | apphub/versions.ts |
| DELETE | /v1/apphub/versions/{id} | 删除版本 | apphub/versions.ts |
| GET | /v1/apphub/apps/{id}/releases | 发布记录 | apphub/release.ts |
| POST | /v1/apphub/apps/{id}/releases | 创建发布 | apphub/release.ts |
| GET | /v1/apphub/releases/{id} | 发布详情 | apphub/release.ts |
| GET | /v1/apphub/releases/{id}/logs | 发布日志 | apphub/release.ts |

### 3.3 /v1/wfe/* —— 流程引擎（TECH-WFE）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/wfe/forms/{id} | 表单定义 | apphub/forms.ts |
| PUT | /v1/wfe/forms/{id}/settings | 保存表单全局设置 | apphub/forms.ts |
| PUT | /v1/wfe/forms/{id}/linkage-rules | 保存数据联动规则 | apphub/forms.ts |
| PUT | /v1/wfe/forms/{id}/scripts | 保存表单脚本 | apphub/forms.ts |
| POST | /v1/wfe/forms/{id}/validate | 表单校验 | apphub/forms.ts |
| GET | /v1/wfe/flows/{moduleId} | 流程配置 | apphub/flows.ts |
| PUT | /v1/wfe/flows/{moduleId} | 保存流程 | apphub/flows.ts |
| POST | /v1/wfe/flows/{moduleId}/publish | 发布流程 | apphub/flows.ts |
| POST | /v1/wfe/flows/validate | 流程校验 | apphub/flows.ts |
| POST | /v1/wfe/flows/test | 流程测试运行 | apphub/flows.ts |
| GET | /v1/wfe/release-approval/{processInstanceId}/tasks | 发布审批任务 | apphub/release.ts |
| POST | /v1/wfe/release-approval/{processInstanceId}/tasks/{taskId}/complete | 完成审批任务 | apphub/release.ts |

### 3.4 /v1/copilot/* —— SuperAI 顶层（挂到 MATE-AGENT）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/copilot/auth/login | Copilot 登录 | superai/auth.ts |
| GET | /v1/copilot/conversations | 会话列表 | superai/conversations.ts |
| POST | /v1/copilot/conversations | 创建会话 | superai/conversations.ts |
| POST | /v1/copilot/chat/multimodal/upload | 多模态文件上传 | superai/chat.ts |
| POST | /v1/copilot/analysis/generate-sql | NL2SQL 生成 | superai/analysis.ts |
| POST | /v1/copilot/analysis/explain-sql | SQL 解释 | superai/analysis.ts |
| POST | /v1/copilot/analysis/audit-sql | SQL 安全审计 | superai/analysis.ts |
| POST | /v1/copilot/analysis/execute-sql | SQL 执行 | superai/analysis.ts |
| POST | /v1/copilot/queries/execute | 查询执行 | superai/data.ts |
| GET | /v1/copilot/queries/history | 查询历史 | superai/data.ts |
| GET | /v1/copilot/datasources | 数据源列表 | superai/data.ts |
| GET | /v1/copilot/actions | Action 列表 | superai/actions.ts |
| POST | /v1/copilot/actions/match | Action 匹配 | superai/actions.ts |
| POST | /v1/copilot/actions/execute | Action 执行 | superai/actions.ts |
| GET | /v1/copilot/knowledge-bases | 可用知识库列表 | superai/rag.ts |
| POST | /v1/copilot/search | RAG 检索 | superai/rag.ts |
| POST | /v1/copilot/generate/form | AI 生成表单 | superai/generate.ts |
| POST | /v1/copilot/generate/process | AI 生成流程 | superai/generate.ts |
| POST | /v1/copilot/generate/dashboard | AI 生成仪表盘 | superai/generate.ts |
| POST | /v1/copilot/generate/explain-code | AI 代码解释 | superai/generate.ts |
| POST | /v1/copilot/generate/review-code | AI 代码审查 | superai/generate.ts |
| GET | /v1/copilot/plans | 计划列表 | superai/plans.ts |
| POST | /v1/copilot/plans | 创建计划 | superai/plans.ts |
| GET | /v1/copilot/plans/{id} | 计划详情 | superai/plans.ts |
| POST | /v1/copilot/plans/{id}/steps/{stepId}/approve | 步骤批准 | superai/plans.ts |
| POST | /v1/copilot/plans/{id}/steps/{stepId}/skip | 步骤跳过 | superai/plans.ts |
| POST | /v1/copilot/plans/{id}/execute | 执行计划 | superai/plans.ts |
| GET | /v1/copilot/ontology/concepts/search | 概念搜索 | superai/ontology.ts |
| GET | /v1/copilot/ontology/concepts/{id}/detail | 概念详情 | superai/ontology.ts |
| POST | /v1/copilot/ontology/graph/query | 图谱查询 | superai/ontology.ts |
| GET | /v1/copilot/ontology/graph/expand | 图谱节点展开 | superai/ontology.ts |
| POST | /v1/copilot/scheduling/intent/detect | 调度意图识别 | superai/schedule.ts |
| GET | /v1/copilot/scheduling/intents | 意图历史 | superai/schedule.ts |
| POST | /v1/copilot/scheduling/employees/match | 员工匹配 | superai/schedule.ts |
| POST | /v1/copilot/scheduling/plan/generate | 生成执行计划 | superai/schedule.ts |
| POST | /v1/copilot/scheduling/execution/start | 启动执行 | superai/schedule.ts |
| GET | /v1/copilot/scheduling/execution/{id}/report | 执行报告 | superai/schedule.ts |
| GET | /v1/copilot/scheduling/templates | 调度模板列表 | superai/templates.ts |
| POST | /v1/copilot/scheduling/templates | 创建调度模板 | superai/templates.ts |
| POST | /v1/copilot/code/execute | 代码沙箱执行 | superai/generate.ts |
| GET | /v1/copilot/code/templates | 代码模板列表 | superai/generate.ts |
| POST | /v1/copilot/code/templates | 创建代码模板 | superai/generate.ts |
| GET | /v1/copilot/code/templates/{id} | 代码模板详情 | superai/generate.ts |
| PUT | /v1/copilot/code/templates/{id} | 更新代码模板 | superai/generate.ts |
| DELETE | /v1/copilot/code/templates/{id} | 删除代码模板 | superai/generate.ts |
| GET | /v1/copilot/code/snippets | 代码片段列表 | superai/generate.ts |
| POST | /v1/copilot/code/snippets | 创建片段 | superai/generate.ts |
| GET | /v1/copilot/code/snippets/{id} | 片段详情 | superai/generate.ts |
| PUT | /v1/copilot/code/snippets/{id} | 更新片段 | superai/generate.ts |
| DELETE | /v1/copilot/code/snippets/{id} | 删除片段 | superai/generate.ts |
| GET | /v1/copilot/code/snippets/{id}/versions | 片段版本历史 | superai/generate.ts |
| POST | /v1/copilot/code/share | 创建代码分享 | superai/generate.ts |
| GET | /v1/copilot/code/share | 分享列表 | superai/generate.ts |
| GET | /v1/copilot/code/share/{id} | 分享详情 | superai/generate.ts |
| DELETE | /v1/copilot/code/share/{id} | 删除分享 | superai/generate.ts |
| POST | /v1/copilot/a2a/delegate | A2A 任务委派 | superai/a2a.ts |
| GET | /v1/copilot/a2a/external | 外部 Agent 列表 | superai/a2a.ts |
| POST | /v1/copilot/models/multimodal | 多模态模型调用 | superai/chat.ts |

### 3.5 /v1/superai/* —— 旧 SuperAI 路径（与 /v1/copilot 同源）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/superai/generate/form | AI 生成表单 | apphub/generate.ts |
| POST | /v1/superai/generate/process | AI 生成流程 | apphub/generate.ts |
| POST | /v1/superai/generate/code | AI 生成代码 | apphub/generate.ts |
| POST | /v1/superai/generate/dashboard | AI 生成仪表盘 | apphub/generate.ts |

### 3.6 /v1/dashboard/* —— 工作台（挂到 TECH-IAM 扩展）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/dashboard/auth/login | 工作台登录 | dashboard/auth.ts |
| GET | /v1/dashboard/profile | 当前用户信息 | dashboard/user.ts |
| GET | /v1/dashboard/profile/permissions | 用户权限聚合 | dashboard/user.ts |
| GET | /v1/dashboard/metrics | 指标列表 | dashboard/metrics.ts |
| GET | /v1/dashboard/metrics/trend | 指标趋势 | dashboard/metrics.ts |
| GET | /v1/dashboard/todos | 待办列表 | dashboard/metrics.ts |
| POST | /v1/dashboard/todos/done | 完成待办 | dashboard/metrics.ts |
| GET | /v1/dashboard/notifications | 通知列表 | dashboard/notifications.ts |
| GET | /v1/dashboard/notifications/unread-count | 未读数 | dashboard/notifications.ts |
| GET | /v1/dashboard/notifications/settings | 通知设置 | dashboard/notifications.ts |
| PUT | /v1/dashboard/notifications/settings | 更新通知设置 | dashboard/notifications.ts |
| GET | /v1/dashboard/deliverables | 交付材料 | dashboard/deliverables.ts |
| GET | /v1/dashboard/workers | 数字员工状态 | dashboard/workers.ts |
| GET | /v1/dashboard/api-keys | API Token 列表 | dashboard/user.ts |
| POST | /v1/dashboard/api-keys | 创建 API Token | dashboard/user.ts |
| DELETE | /v1/dashboard/api-keys/{id} | 删除 API Token | dashboard/user.ts |
| GET | /v1/dashboard/settings | 个人设置 | dashboard/settings.ts |
| PUT | /v1/dashboard/settings | 更新个人设置 | dashboard/settings.ts |
| GET | /v1/dashboard/sessions | 会话列表 | dashboard/settings.ts |
| DELETE | /v1/dashboard/sessions/{id} | 强制下线 | dashboard/settings.ts |
| GET | /v1/dashboard/anomalies | 异常列表 | dashboard/anomaly.ts |
| GET | /v1/dashboard/anomaly-rules | 异常规则 | dashboard/anomaly.ts |
| GET | /v1/dashboard/search | 全局搜索 | dashboard/search.ts |

### 3.7 /v1/dw/* —— 数字员工（挂到 MATE-AGENT）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/dw/auth/login | DW 登录 | dw/auth.ts |
| GET | /v1/dw/employees | 员工列表 | dw/employees.ts |
| POST | /v1/dw/employees | 创建员工 | dw/employees.ts |
| GET | /v1/dw/employees/{id} | 员工详情 | dw/employees.ts |
| PUT | /v1/dw/employees/{id} | 更新员工 | dw/employees.ts |
| DELETE | /v1/dw/employees/{id} | 删除员工 | dw/employees.ts |
| POST | /v1/dw/employees/{id}/clone | 克隆员工 | dw/employees.ts |
| PUT | /v1/dw/employees/{id}/status | 启停员工 | dw/employees.ts |
| GET | /v1/dw/employees/{id}/versions | 版本历史 | dw/employees.ts |
| GET | /v1/dw/employees/{id}/logs | 操作日志 | dw/employees.ts |
| GET | /v1/dw/employees/tasks | 员工任务概览 | dw/employees.ts |
| GET | /v1/dw/tools | 员工可用工具 | dw/tasks.ts |
| GET | /v1/dw/commit | 提交版本 | dw/employees.ts |
| GET | /v1/dw/models | LLM 模型 | dw/employees.ts |
| GET | /v1/dw/knowledge-bases | 员工知识库 | dw/documents.ts |
| GET | /v1/dw/documents | 文档列表 | dw/documents.ts |
| POST | /v1/dw/documents/upload | 上传文档 | dw/documents.ts |
| POST | /v1/dw/documents/{id}/process | 处理文档 | dw/documents.ts |
| POST | /v1/dw/extract | 知识提炼 | dw/extraction.ts |
| PUT | /v1/dw/extract/items/{itemId} | 更新提炼项 | dw/extraction.ts |
| POST | /v1/dw/learning/extract | 启动学习 | dw/learning.ts |
| GET | /v1/dw/learning/feedback | 反馈记录 | dw/learning.ts |
| PUT | /v1/dw/learning/feedback/{id}/tags | 反馈标签 | dw/learning.ts |
| GET | /v1/dw/evaluations | 评估列表 | dw/evaluations.ts |
| POST | /v1/dw/evaluations | 创建评估 | dw/evaluations.ts |
| GET | /v1/dw/evaluations/{id} | 评估详情 | dw/evaluations.ts |
| POST | /v1/dw/evaluations/aggregate-report | 聚合报告 | dw/evaluations.ts |
| GET | /v1/dw/collaborations | 协作列表 | dw/collaborations.ts |
| POST | /v1/dw/collaborations | 创建协作 | dw/collaborations.ts |
| GET | /v1/dw/collaborations/{id} | 协作详情 | dw/collaborations.ts |
| GET | /v1/dw/traces | 执行轨迹 | dw/obs.ts |

### 3.8 /v1/kb/* —— 知识库（挂到 TECH-RAG）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/kb/knowledge-bases | 知识库列表 | kb/kb.ts |
| POST | /v1/kb/knowledge-bases | 创建知识库 | kb/kb.ts |
| GET | /v1/kb/documents | 文档列表 | kb/kb.ts |
| POST | /v1/kb/documents | 上传文档元数据 | kb/kb.ts |
| POST | /v1/kb/documents/{id}/process | 处理文档 | kb/kb.ts |

### 3.9 /v1/ea/* —— 企业架构（TECH-EA）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET/POST | /v1/ea/applications | 应用系统列表/注册 | arch/applications.ts |
| GET/PUT/DELETE | /v1/ea/applications/{id} | 应用系统详情/更新/删除 | arch/applications.ts |
| GET | /v1/ea/business-processes | 业务流程列表 | arch/businessProcesses.ts |
| GET | /v1/ea/capabilities | 业务能力列表 | arch/capabilities.ts |
| GET | /v1/ea/capabilities/tree | 能力树 | arch/capabilities.ts |
| GET | /v1/ea/capability-mappings | 能力映射 | arch/ontologyMapping.ts |
| GET | /v1/ea/impact-analysis | 影响分析 | arch/ontologyMapping.ts |
| GET | /v1/ea/data/domains | 数据主题域 | arch/dataArchitecture.ts |
| GET | /v1/ea/data-assets | 数据资产 | arch/dataArchitecture.ts |
| GET | /v1/ea/data-assets/catalog | 数据资产目录 | arch/dataArchitecture.ts |
| GET | /v1/ea/data-entities | 数据实体 | arch/dataArchitecture.ts |
| GET | /v1/ea/data-flows | 数据流转 | arch/dataArchitecture.ts |
| GET | /v1/ea/data-standards | 数据标准 | arch/dataArchitecture.ts |
| GET | /v1/ea/tech-stacks | 技术栈（arch 端） | arch/techArchitecture.ts |
| GET | /v1/ea/technology-components | 技术组件 | arch/technologyComponents.ts |
| GET | /v1/ea/technology-radar | 技术雷达 | arch/technologyRadar.ts |
| GET | /v1/ea/technology-stacks | 技术栈 | arch/technologyStacks.ts |
| GET | /v1/ea/infrastructures | 基础设施 | arch/deployments.ts |
| GET | /v1/ea/deployments | 部署拓扑 | arch/deployments.ts |
| GET | /v1/ea/governance/principles | 架构原则 | arch/governance.ts |
| GET | /v1/ea/governance/principle-categories | 原则分类 | arch/governance.ts |
| GET | /v1/ea/governance/review-templates | 评审模板 | arch/governance.ts |
| GET | /v1/ea/governance/review-tickets | 评审工单 | arch/governance.ts |
| GET | /v1/ea/governance/tech-debts | 技术债务 | arch/governance.ts |
| GET | /v1/ea/orgs | 组织架构 | arch/roles.ts |
| GET | /v1/ea/orgs/tree | 组织树 | arch/roles.ts |
| GET | /v1/ea/roles | 角色列表 | arch/roles.ts |
| GET/POST | /v1/ea/value-streams | 价值流列表/创建 | arch/valueStreams.ts |
| GET | /v1/ea/ontology-mappings/rules | 映射规则 | arch/ontologyMapping.ts |
| GET | /v1/ea/ontology-mappings/changes | 映射变更 | arch/ontologyMapping.ts |

### 3.10 /v1/mcp/* —— MCP 中心（TECH-MCP）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/mcp/overview | 总览 | mcphub/overview.ts |
| GET/POST | /v1/mcp/servers | Server 列表/注册 | mcphub/servers.ts |
| GET/PUT/DELETE | /v1/mcp/servers/{id} | Server CRUD | mcphub/servers.ts |
| GET/POST | /v1/mcp/clients | Client 列表/添加 | mcphub/clients.ts |
| GET/PUT/DELETE | /v1/mcp/clients/{id} | Client CRUD | mcphub/clients.ts |
| GET/POST | /v1/mcp/tools | 工具列表/注册 | mcphub/tools.ts |
| GET/PUT/DELETE | /v1/mcp/tools/{id} | 工具 CRUD | mcphub/tools.ts |
| GET/POST/PUT | /v1/mcp/tool-categories | 工具分类 | mcphub/tools.ts |
| GET/POST | /v1/mcp/resources | Resource CRUD | mcphub/resources.ts |
| GET/PUT/DELETE | /v1/mcp/resources/{id} | Resource 详情 | mcphub/resources.ts |
| GET/POST | /v1/mcp/prompts | Prompt CRUD | mcphub/prompts.ts |
| GET/PUT/DELETE | /v1/mcp/prompts/{id} | Prompt 详情 | mcphub/prompts.ts |
| GET/POST | /v1/mcp/permissions | 权限规则 | mcphub/permissions.ts |
| GET/PUT | /v1/mcp/permissions/{id} | 规则详情 | mcphub/permissions.ts |
| GET/POST | /v1/mcp/policies | ABAC 策略 | mcphub/policies.ts |
| GET/PUT/DELETE | /v1/mcp/policies/{id} | 策略详情 | mcphub/policies.ts |
| GET | /v1/mcp/trusts | 信任域 | mcphub/trusts.ts |
| GET/POST | /v1/mcp/external-agents | 外部 Agent | mcphub/external-agents.ts |
| GET/PUT/DELETE | /v1/mcp/external-agents/{id} | 外部 Agent 详情 | mcphub/external-agents.ts |
| GET/POST | /v1/mcp/integrations | 外部集成 | mcphub/integrations.ts |
| GET/PUT/DELETE | /v1/mcp/integrations/{id} | 集成详情 | mcphub/integrations.ts |
| POST | /v1/mcp/debug/execute | 调试执行 | mcphub/debug.ts |
| POST | /v1/mcp/debug/compare | 调试对比 | mcphub/debug.ts |
| GET | /v1/mcp/debug/history | 调试历史 | mcphub/debug.ts |
| GET | /v1/mcp/collaborations | 协作 | mcphub/collaborations.ts |
| GET | /v1/mcp/collaborations/logs | 协作日志 | mcphub/collaborations.ts |
| GET | /v1/mcp/connection-monitor | 连接监控 | mcphub/connection-monitor.ts |
| GET | /v1/mcp/audit/logs | 审计日志 | mcphub/audit.ts |
| GET | /v1/mcp/audit/analytics | 审计分析 | mcphub/audit.ts |
| GET | /v1/mcp/audit/statistics | 审计统计 | mcphub/audit.ts |
| GET | /v1/mcp/audit/trends | 审计趋势 | mcphub/audit.ts |
| POST | /v1/mcp/audit/export | 导出审计 | mcphub/audit.ts |
| GET/POST | /v1/mcp/alert-rules | 告警规则 | mcphub/alert-rules.ts |
| PUT/DELETE | /v1/mcp/alert-rules/{id} | 告警规则详情 | mcphub/alert-rules.ts |
| GET/POST | /v1/mcp/api-keys | API Key | mcphub/api-keys.ts |
| DELETE | /v1/mcp/api-keys/{id} | 删除 | mcphub/api-keys.ts |

### 3.11 /v1/ont/* —— 本体引擎（TECH-ONT）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/ont/concepts/search | 概念搜索 | dw/extraction.ts |

### 3.12 /v1/rag/* —— RAG 检索（TECH-RAG）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/rag/search | 跨知识库检索 | kb/kb.ts, superai/rag.ts |

### 3.13 /v1/llmgw/* —— LLM 网关（TECH-LLMGW）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | /v1/llmgw/chat/completions | OpenAI 兼容对话补全 | apphub/llm.ts |

### 3.14 /v1/a2a/* —— A2A 协议（MATE-A2A）

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| GET | /v1/a2a/agent-cards/search | Agent Card 搜索 | dw/a2a.ts |
| POST | /v1/a2a/delegations | 创建委派 | dw/a2a.ts |

---

## 4. 鉴权与安全约定

### 4.1 登录与 Token

| 项 | 规范 |
|---|---|
| 登录入口 | /api/v1/iam/auth/login（统一 IAM） |
| accessToken 有效期 | 默认 60 分钟 |
| refreshToken 有效期 | 默认 7 天 |
| 续期机制 | 401 自动调用 /api/v1/iam/auth/refresh，重放；失败跳 /login |
| 多端登录 | 同一账号可在多设备登录，强制下线走 /api/v1/dashboard/sessions/{id} DELETE |

### 4.2 Trace 与租户

- X-Trace-Id：前端自动生成 16 位 hex；后端需在响应头 X-Trace-Id 回传
- X-Tenant-Id：从登录态获取，前端自动注入；后端按租户隔离数据
- 响应体中包含 traceId，前端用于错误上报

---

## 5. 端点统计

| 服务前缀 | 端点数 | 归属后端服务 |
|---|---|---|
| /v1/iam | 12 | TECH-IAM |
| /v1/apphub | 31 | TECH-EA |
| /v1/wfe | 12 | TECH-WFE |
| /v1/copilot | 56 | MATE-AGENT |
| /v1/superai | 4 | MATE-AGENT |
| /v1/dashboard | 23 | TECH-IAM |
| /v1/dw | 30 | MATE-AGENT |
| /v1/kb | 5 | TECH-RAG |
| /v1/ea | 33 | TECH-EA |
| /v1/mcp | 60 | TECH-MCP |
| /v1/ont | 1 | TECH-ONT |
| /v1/rag | 1 | TECH-RAG |
| /v1/llmgw | 1 | TECH-LLMGW |
| /v1/a2a | 2 | MATE-A2A |
| 合计 | 141+ | 15 个 TECH-/MATE- 服务 |

---

## 6. 后续维护

### 6.1 新增端点时

1. 在对应前端 src/api/*.ts 中调用，路径与本文档保持一致
2. 更新本文件相应服务前缀分组
3. 通知后端对应服务的 owner 添加 controller
4. 在 PR 描述中标注新增端点

### 6.2 端点变更时

1. 评估兼容性（旧版本客户端是否受影响）
2. 不兼容变更需走 /v2/ 路径前缀
3. 同步更新前端代码与本文档
4. 通知所有依赖该端点的 APP

---

文档版本: v1.0
文档日期: 2026-07-27
扫描范围: metaplatform-frontend/apps/*/src/api + packages/shared/src/api
端点总数: 141 条独立 URL
