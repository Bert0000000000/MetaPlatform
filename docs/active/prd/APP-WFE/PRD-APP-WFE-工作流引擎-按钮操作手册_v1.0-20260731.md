# PRD-APP-WFE 工作流引擎 按钮操作手册

> 版本:v1.0 · 2026-07-31
> 配套:`PRD-APP-WFE-工作流引擎_v1.0-20260731.md`(总 PRD)+ `PRD-APP-WFE-工作流引擎-详细规范_v1.0-20260731.md`
> 类型:**用户操作手册**(面向业务用户 + 开发者)
> 状态:**Active**

---

## 1. 给业务用户的操作手册

### 1.1 入口

- Web URL:`https://{your-domain}/wfe/designer`(前端入口)
- 菜单路径:左侧菜单 → "工作流" → "流程设计器"

### 1.2 按钮清单(Designer)

| 按钮 | 位置 | 快捷键 | 说明 |
|---|---|---|---|
| **新建流程** | 顶部工具栏 | `Ctrl+N` | 创建空白 BPMN 流程 |
| **打开** | 顶部工具栏 | `Ctrl+O` | 从流程库选择已有流程 |
| **保存为草稿** | 顶部工具栏 | `Ctrl+S` | 保存当前 BPMN XML,状态置为 draft |
| **试运行** | 顶部工具栏右侧 | `Ctrl+T` | dry-run,不触发副作用 |
| **校验** | 顶部工具栏右侧 | `Ctrl+V` | 校验 BPMN schema + 表达式 |
| **发布** | 顶部工具栏最右 | `Ctrl+P` | 发布当前版本(版本号自动 +1) |
| **撤销** | 工具栏 | `Ctrl+Z` | 撤销最近一次编辑 |
| **重做** | 工具栏 | `Ctrl+Y` | 重做撤销的编辑 |

### 1.3 节点库(左侧)

- **事件**(Event):开始 / 中间 / 结束
- **任务**(Task):用户任务 / 服务任务 / 脚本任务
- **网关**(Gateway):排他 / 并行 / 包容
- **子流程**(Sub-process)
- **连接**(Connecting Object):顺序流 / 消息流 / 关联

### 1.4 节点属性面板(右侧)

选中节点后,右侧面板显示该节点的属性:

| 字段 | 说明 |
|---|---|
| ID | 节点唯一标识 |
| 名称 | 节点显示名 |
| 审批人 | 用户任务的处理人(支持 user / role / expression) |
| 表单 | 关联的表单 ID |
| 超时 | 任务超时时间(默认 24h) |
| 失败策略 | timeout / error 时行为(retry / escalate / abort) |

### 1.5 典型操作流程

#### 流程 A — 新建模并发布

1. 点击 **新建流程** → 弹窗填流程名 `purchase-request` + 描述
2. 从左侧拖拽节点到画布:
   - 开始 → 申请人填写表单(userTask) → 部门经理审批(userTask) → 财务复核(userTask) → 结束
3. 连接节点:选中开始节点,拖到下一节点,自动画箭头
4. 点击 **保存为草稿** → 状态变为 draft
5. 点击 **试运行** → 弹窗填 mock 变量(申请人=alice / 金额=10000)→ 点击"开始试运行"
6. 试运行结果显示在右侧"试运行报告"面板:
   - 执行节点序列:开始 → 申请人填写表单 → 部门经理审批 → 财务复核 → 结束
   - 耗时:200ms
   - 副作用:已拦截(无邮件发送)
7. 点击 **校验** → 显示"通过,无错误"
8. 点击 **发布** → 弹窗确认"将创建 v2,旧版本 v1 标记为 archived" → 确定
9. 流程变为 published 状态,可在运行时启动

#### 流程 B — 修改已有流程

1. 点击 **打开** → 选择 `purchase-request` → 加载最新版本(v2)
2. 修改节点属性 → 点击 **保存为草稿**
3. 试运行 + 校验 → 发布为 v3

#### 流程 C — 协作编辑

1. Designer 实时同步(基于 WebSocket)
2. 其他用户编辑同一节点时,该节点加锁,其他用户只读
3. 保存后锁释放

### 1.6 错误提示

| 场景 | 提示文案 | 解决方法 |
|---|---|---|
| BPMN XML 解析失败 | "XML 第 X 行 Y 列:非法 token" | 检查 BPMN 是否从其他工具复制时有格式问题 |
| 缺开始节点 | "流程必须包含开始节点" | 从节点库拖"开始"事件 |
| 节点 ID 重复 | "节点 ID 'X' 重复,请修改其中之一" | 选中重复节点,改 ID |
| sequenceFlow 无目标 | "节点 X 的 sequenceFlow 无目标节点" | 确认箭头终点 |
| 表达式非法 | "JUEL 表达式 `${...}` 语法错误" | 用 `${variable == null}` 风格,避免中括号 |

---

## 2. 给开发者的 API 操作手册

### 2.1 试运行 API

```bash
# 请求
curl -X POST http://localhost:8200/api/v1/wfe/flows/test \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_key": "purchase-request",
    "bpmn_xml": "<bpmn:definitions ...>...</bpmn:definitions>",
    "mock_variables": {
      "applicant": "alice",
      "amount": 10000,
      "department": "engineering"
    }
  }'

# 响应(成功)
{
  "flow_key": "purchase-request",
  "executed_nodes": ["start", "userTask_1", "userTask_2", "userTask_3", "end"],
  "duration_ms": 200,
  "side_effects_blocked": true,
  "dry_run_id": "dr-2026-07-31-12345"
}
```

### 2.2 校验 API

```bash
# 请求
curl -X GET "http://localhost:8200/api/v1/wfe/flows/validate?bpmn_xml=$(cat flow.bpmn | jq -sRr @uri)" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Tenant-Id: tenant-001"

# 响应(成功)
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "node_id": "userTask_3",
      "code": "W_NO_DUE_DATE",
      "message": "节点 '财务复核' 未设置超时"
    }
  ],
  "stats": {
    "node_count": 5,
    "sequence_flow_count": 4,
    "expression_count": 2
  }
}

# 响应(失败)
{
  "valid": false,
  "errors": [
    {
      "code": "E_FLOW_NO_START_END",
      "node_id": null,
      "line": 12,
      "message": "缺少开始节点"
    }
  ]
}
```

### 2.3 常用调试命令

```bash
# 查看所有流程定义
curl -X GET http://localhost:8200/api/v1/wfe/flows \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# 启动流程实例(P1 后续 batch,先列出来)
curl -X POST http://localhost:8200/api/v1/wfe/instances \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{"flow_key": "purchase-request", "business_key": "PR-2026-0001", "variables": {...}}'
```

---

## 3. 给运维的故障排查手册

### 3.1 试运行超时

**症状**:`wfe.flow.test.duration_seconds P95 > 5s`

**排查**:
1. 看 Flowable engine 是否在:`curl http://flowable-engine:8080/flowable-rest/process-api`
2. 看 PG 表 `act_ru_execution`(Flowable 运行中)是否有积压
3. 看 audit log:是否有大量 `E_TASK_TIMEOUT`

### 3.2 Flowable engine 不可用

**症状**:试运行返回 `E_INTERNAL`

**排查**:
1. `docker ps | grep flowable`
2. 看 `flowable-engine` 日志:`docker logs flowable-engine`
3. 检查 PG:`psql -U flowable -d flowable -c "SELECT 1"`

### 3.3 BPMN XML 校验误报

**症状**:明明流程合法,校验却返回错误

**排查**:
1. 检查 XML 是否含 `<?xml version="1.0"?>` 头
2. 检查命名空间前缀是否正确:`xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"`
3. 检查 `<bpmn:definitions>` 是否有 `targetNamespace`

---

## 4. 关联文档

- `PRD-APP-WFE-工作流引擎_v1.0-20260731.md` — 总 PRD
- `PRD-APP-WFE-工作流引擎-详细规范_v1.0-20260731.md` — 详细规范
- `architecture-implementation.md` §1.2 + §3.2 — Flowable 集成
- `contracts/openapi/services/wfe.yaml` — OpenAPI 契约源

---

## 5. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(按钮清单 + 典型操作流程 + API 手册 + 故障排查) | TRAE 补 PRD |