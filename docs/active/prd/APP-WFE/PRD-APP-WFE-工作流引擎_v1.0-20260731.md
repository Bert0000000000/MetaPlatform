# PRD-APP-WFE 工作流引擎(总 PRD)

> 版本:v1.0 · 2026-07-31
> 关联:`PRD-APP-WFE-工作流引擎-详细规范_v1.0-20260731.md`(详细规范)+ `PRD-APP-WFE-工作流引擎-按钮操作手册_v1.0-20260731.md`(按钮手册)
> 关联:`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` §1.2(Flowable 8.0 集成)+ `production-readiness-design.md` §13
> 配套:`contracts/openapi/services/wfe.yaml`(OpenAPI 契约源)
> 状态:**Active**(P2-W4 启动参考)

---

## 1. 范围与定位

工作流引擎(WorkFlow Engine,WFE)是 Mate Platform 中供业务用户**编排 + 执行 + 监控业务流程**的能力。它基于 Flowable 8.0 开源引擎,提供 BPMN 2.0 标准的业务流程建模、试运行、校验能力。

### 1.1 设计目标

- **业务流程可视化建模**:业务人员可以通过 web 工具(前端 WFE Designer)拖拽节点 / 网关 / 事件,生成 BPMN XML。
- **试运行不副作用**:用户在 Designer 中可以"试运行"流程,不实际触发外部副作用(发邮件 / 调 API),只验证流程逻辑。
- **流程校验**:提交流程定义前先做 schema 校验,确保 Flowable 引擎能解析 + 不会运行时挂。
- **租户隔离**:每个租户的流程定义独立存储,不能跨租户复用。

### 1.2 与已有 PRD 的关系

| 文档 | 关系 |
|---|---|
| `PRD-APP-COPILOT_v2.3` §3.7 | copilot 用 wfe 做"任务调度" |
| `PRD-APP-DW-数字员工_v2.4` | DW 域可以嵌入 WFE 流程作为审批节点 |
| `architecture-implementation.md` §1.2 + §3.2 | 架构基线已部署 Flowable 8.0 |
| **本文** | WFE 业务规范(用户场景 + API + 数据) |
| `PRD-APP-WFE-工作流引擎-详细规范_v1.0-20260731.md` | 技术实现细节 |
| `PRD-APP-WFE-工作流引擎-按钮操作手册_v1.0-20260731.md` | 用户操作手册 |

---

## 2. 用户场景

### 2.1 场景 A — 业务人员建模

> **角色**:业务分析师(王经理)
> **目标**:为"采购申请"业务建模一个 BPMN 流程

1. 打开 WFE Designer
2. 选择"新建流程",填写流程名 `purchase-request`
3. 拖拽节点:
   - 开始 → 申请人填写表单 → 部门经理审批 → 财务复核 → 结束
   - 中间插入并行网关(部门经理审批 + 部门预算校验并行)
4. 配置每个节点的:
   - 审批人(来自 RBAC:role=department_manager)
   - 表单字段(申请人 / 金额 / 备注)
   - 超时(部门经理 24h)
5. 点击 **试运行** → 系统调用 `/api/v1/wfe/flows/test` → 模拟数据走完流程,展示各节点结果
6. 试运行没问题 → 点击 **校验** → `/api/v1/wfe/flows/validate` → 返回 schema OK
7. 点击 **发布** → 流程定义存储到 Flowable engine + 我们的 PG 元数据表

### 2.2 场景 B — copilot 自动调度

> **角色**:copilot /scheduling/plan/generate handler
> **目标**:把一个长任务编排为 BPMN 流程

1. copilot 生成 `[{action: "validate-purchase", deps: []}, {action: "approve", deps: ["validate"]}, ...]`
2. copilot 调用 `POST /api/v1/wfe/flows/test` 试运行,确认逻辑
3. copilot 调用 `POST /api/v1/wfe/flows/validate` 校验 BPMN
4. copilot 内部使用(不发布到 Flowable engine,只做 plan 生成)

### 2.3 场景 C — 业务运行时

> **角色**:最终用户(普通员工)
> **目标**:发起一个"请假申请"流程

1. 打开 web → 点击"请假申请"
2. 自动加载最新版本的 `leave-request` 流程定义
3. 填表 → 提交 → 进入"直属上级审批"节点
4. 直属上级收到通知 → 在 WFE 工作台审批 → 进入"HR 备案"节点
5. HR 备案 → 流程结束
6. 用户收到通知,可在"我的申请"中查看流程状态

---

## 3. 功能清单

### 3.1 P0(本批必做)

| 功能 | 说明 |
|---|---|
| 流程试运行 | `POST /api/v1/wfe/flows/test` |
| 流程校验 | `GET /api/v1/wfe/flows/validate` |
| 流程定义 CRUD | 写 / 列表 / 删除(留给后续 batch) |
| 流程实例启动 / 推进 | 写 / 列表 / 详情(留给后续 batch) |
| 任务认领 / 完成 | write(留给后续 batch) |

### 3.2 P1(后续 batch)

- Designer web UI(前端工作流设计器)
- 表单设计器
- 流程版本管理
- 流程统计 / 报表
- 流程导入 / 导出(BPMN XML)

### 3.3 P2(可选)

- 子流程 / 调用活动
- 定时器事件
- 信号事件
- 多实例任务
- 流程图执行高亮

---

## 4. 数据模型

### 4.1 Process Definition

```yaml
ProcessDefinition:
  id: string              # UUID
  tenant_id: string        # 强制 tenant 隔离
  key: string              # 业务主键,如 "purchase-request"
  name: string
  description: string
  version: int             # 1, 2, 3...
  bpmn_xml: text           # 完整 BPMN XML
  status:
    - draft               # 草稿,未发布
    - published           # 已发布,可在运行时启动
    - archived            # 归档,不可启动新实例
  created_by: string
  created_at: datetime
  published_at: datetime
```

### 4.2 Process Instance(运行时,Flowable engine 内部表)

```yaml
ProcessInstance:
  id: string              # Flowable 内部 ID
  process_definition_id: string
  tenant_id: string
  business_key: string     # 业务主键,如采购单号 PR-2026-0001
  status:
    - running
    - completed
    - suspended
    - failed
  start_user_id: string
  started_at: datetime
  ended_at: datetime
  variables: object        # 流程变量(申请金额 / 审批人等)
```

### 4.3 Task(用户任务)

```yaml
Task:
  id: string
  process_instance_id: string
  tenant_id: string
  name: string
  assignee: string         # 当前处理人
  candidate_groups: [string] # 候选组(role)
  form_data: object
  status:
    - pending
    - in_progress
    - completed
    - rejected
  due_at: datetime
  created_at: datetime
  completed_at: datetime
```

---

## 5. 接口规范(详细见 OpenAPI)

| Method | Path | 功能 | 5 步合规 |
|---|---|---|---|
| POST | `/api/v1/wfe/flows/test` | 试运行(无副作用) | 必装 |
| GET | `/api/v1/wfe/flows/validate` | 校验 BPMN schema | 必装 |
| POST | `/api/v1/wfe/flows` | 创建流程定义 | 后续 |
| GET | `/api/v1/wfe/flows` | 列表流程定义 | 后续 |
| GET | `/api/v1/wfe/flows/{key}/versions` | 列出某流程所有版本 | 后续 |
| POST | `/api/v1/wfe/instances` | 启动流程实例 | 后续 |
| GET | `/api/v1/wfe/instances/{id}` | 流程实例详情 | 后续 |
| GET | `/api/v1/wfe/tasks` | 当前用户的待办任务 | 后续 |
| POST | `/api/v1/wfe/tasks/{id}/complete` | 完成任务 | 后续 |

> 当前 P2-W4 优先级:**只做 `flows/test` + `flows/validate` 2 endpoint**(P0)。其他 endpoint 留后续 batch。

---

## 6. 关键业务规则

### 6.1 流程定义规则

- **每个流程定义必须含 1 个开始节点 + 至少 1 个结束节点**,否则试运行拒绝。
- **同一 `key` 可以有多个版本**,但只有 1 个 `published` 状态。
- **流程定义不允许修改已发布版本**,必须新建版本(版本号 +1)。
- **流程定义变更需要 audit**(谁 / 何时 / 改了什么)。

### 6.2 试运行规则(本批核心)

- **试运行不写入 Flowable engine 历史表**(走 dry-run 模式,内存模拟)。
- **试运行超时限流 1000 次/小时**(避免被滥用为压力测试)。
- **试运行结果保留 24 小时**(超出自动清理)。
- **试运行不允许触发外部副作用**:即使流程中配了邮件节点,试运行时也只 mock 不真发。

### 6.3 校验规则

- **校验 5 项**:
  1. BPMN XML schema 合法性(用 Flowable BPMN parser)
  2. 开始 / 结束节点存在
  3. 所有节点 ID 唯一
  4. 所有 sequence flow 有源 / 目标
  5. 表达式合法性(`${...}` JUEL 表达式语法)
- **校验失败必须返回精确错误位置**(节点 ID + 行号)。

### 6.4 租户隔离

- **每个 tenant 的流程定义独立**,不能引用其他 tenant 的流程。
- **流程实例变量强制走 tenant 上下文**,无 tenant 直接拒绝(§13 硬规则 3)。
- **跨租户 admin 通道**(cross_tenant_admin) 可看所有 tenant 流程,用于运维。

### 6.5 性能

| 操作 | P95 目标 |
|---|---|
| 试运行 | < 5s |
| 校验 | < 1s |
| 启动流程实例 | < 500ms |
| 完成任务 | < 300ms |

---

## 7. 异常与错误

| Code | HTTP | 说明 |
|---|---|---|
| `E_FLOW_NOT_FOUND` | 404 | key 不存在 |
| `E_FLOW_INVALID_XML` | 400 | BPMN XML schema 非法 |
| `E_FLOW_NO_START_END` | 400 | 缺开始 / 结束节点 |
| `E_FLOW_DUPLICATE_NODE_ID` | 400 | 节点 ID 不唯一 |
| `E_FLOW_DRY_RUN_LIMIT` | 429 | 试运行限流 |
| `E_TASK_NOT_ASSIGNED` | 403 | 当前用户不是任务 assignee |

---

## 8. 安全与合规

- **认证**:走 Keycloak JWT,§13 硬规则 4。
- **租户**:§13 硬规则 3,`require_tenant(ctx)`。
- **BPMN XML 注入防护**:XML 解析前做大小限制(最大 1MB),禁止外部实体(XXE 防护)。
- **审计**:每次试运行 / 校验 / 启动实例都写到 audit log。

---

## 9. P2-W4 落地清单

| 任务 | 工作量 | 备注 |
|---|---|---|
| 新建 `mate-app-wfe` 包代码 | 1 周 | 4 src files(`api/app.py` + `clients.py` + `main.py` + tests) |
| 5 步 checklist 完整 | 包含 | install_auth + require_tenant + outbox + BearerAuth + 跨租户 tests |
| Flowable 8.0 BPMN parser 集成 | 包含 | dry-run 模式 |
| 跨租户 negative tests ≥ 3 | 包含 | wrong tenant / missing scope / no tenant |
| ruff + pyright | 包含 | CI 通过 |
| pyproject.toml + workspace 注册 | 0.5 天 | 加入 `[tool.uv.workspace.members]` |

---

## 10. 关联文档

- `PRD-APP-WFE-工作流引擎-详细规范_v1.0-20260731.md` — 技术实现
- `PRD-APP-WFE-工作流引擎-按钮操作手册_v1.0-20260731.md` — 用户操作
- `PRD-APP-COPILOT_v2.3-20260727.md` §3.7 — copilot 用 wfe
- `PRD-APP-DW-数字员工_v2.4-20260727.md` — DW 集成 WFE
- `architecture-implementation.md` §1.2 / §3.2 — 架构基线
- `contracts/openapi/services/wfe.yaml` — OpenAPI 契约源
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` — 5 步模式

---

## 11. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(总 PRD + 3 件套) | TRAE 补 PRD |