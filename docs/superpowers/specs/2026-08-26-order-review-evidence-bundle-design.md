# 订单复核证据链扩展设计

## 状态

Proposed，等待产品与技术评审。

## 1. 背景

当前订单复核页面能够展示订单金额、支付状态、建议理由和来源引用，并能在人工确认后完成订单写回和跟进单创建。但建议展示仍然是“文字建议 + 引用地址”的平面结构，审核人员无法在同一个上下文中核对：

1. 该订单在业务 Ontology 中属于什么对象、具有什么语义关系、允许触发什么动作；
2. 交易系统当前保存的订单事实是什么；
3. 系统如何从事实推导出行动建议。

如果前端自行调用当前通用 Ontology 图接口再拼接订单数据，会得到一个视觉上完整但语义上不可靠的结果：当前通用图接口主要返回能力树和数据资产，查询条件不会生成订单实例关系；当前 Ontology 目录也没有可直接复用的订单复核 ActionType。因此本次改造必须统一证据来源与推导契约，禁止页面把通用图、模拟数据或静默 fallback 当作订单证据。

## 2. 目标与非目标

### 2.1 目标

- 在订单复核建议中扩展展示 Ontology 语义证据、交易事实证据、推导过程和行动建议。
- 让审核人员在确认副作用前，能够逐项核对事实、关系和推导条件。
- 让后端成为证据包的唯一组装方，前端只负责展示和交互，不自行推断或拼装证据。
- 证据包在提案创建时形成不可变快照，并随提案查询、审计和验收证据关联。
- 证据缺失、租户不匹配、模型版本不一致或依赖故障时失败关闭，不返回伪造建议，也不允许确认。
- 保持现有订单复核确认事务、幂等、乐观锁、Outbox 和审计语义不被削弱。

### 2.2 非目标

- 本次不实现 Customer、Payment、Product 等所有业务对象的完整 Ontology Individual 同步。
- 本次不把当前订单交易表改造成 Ontology 的事实源；订单交易事实仍以 PostgreSQL 订单域为准。
- 本次不迁移既有验收数据；staging/prod 使用迁移脚本和版本化种子重建。
- 本次不保留旧 REST 双轨，不让前端同时维护一套旧的证据接口。
- 本次不采用 Copilot 通用 `/ontology/graph/query` 作为订单证据 fallback。

## 3. 决策摘要

采用“后端证据链扩展”方案。

订单复核服务在创建 ReviewCase/ActionProposal 时，读取同一租户下的订单交易事实，解析当前版本的规范 Ontology 模型，并生成一份带版本号的 `EvidenceBundle`。提案查询直接返回该快照。页面以固定的证据链布局呈现：

```text
Ontology 语义模型与关系
          +
订单交易事实
          ↓
条件推导与事实引用
          ↓
行动建议
          ↓
人工确认 / 拒绝
```

实现层使用一个 `EvidenceBundle` 承载四类证据，由同一次提案快照绑定；这只是接口封装，不代表把交易表、Ontology 和 LLM 的职责混成一个数据源：

- Ontology 负责业务对象、属性和可执行动作的语义定义；
- PostgreSQL 负责订单金额、支付状态、复核状态和版本等交易事实；
- 推导器负责确定性条件计算，并引用事实 ID；
- LLM/RAG 可以提供解释文本和政策来源，但不能覆盖交易事实或确定性资格判断。

## 4. 方案比较

### 方案 A：前端适配现有接口

前端同时请求订单 API 和现有通用 Ontology 图 API，再在页面拼装。

- 优点：改动最少，首屏实现快。
- 缺点：当前图接口不是订单实例查询；无法保证图与订单属于同一租户、同一版本；推导逻辑会散落在页面；确认前无法形成一致快照。
- 结论：不采用。视觉效果不能替代证据真实性。

### 方案 B：订单复核后端生成扩展证据包

由订单复核服务读取订单事实，并从规范 Ontology 模型/动作契约生成订单复核证据图，再把确定性推导和行动建议绑定到同一提案。

- 优点：证据一致、可审计、前端简单；能在不做全域 Ontology 实例同步的情况下支持真实订单复核。
- 缺点：需要新增后端契约、证据构建器、模型解析和前端证据展示；需补齐订单复核的规范 ActionType/动作契约种子。
- 结论：采用，作为 v1 订单闭环的落地方案。

### 方案 C：全量 Ontology 实例同步

订单创建时同步创建/更新 Order、Customer、Payment、Product 等 Ontology Individual 和 Link，并用 Ontology ActionType 直接执行复核动作。

- 优点：语义完整，长期可扩展性最好。
- 缺点：需要跨服务事务补偿、事件重放、实例版本管理、历史数据重建和大量迁移验证；无法作为当前订单复核页面优化的最小交付范围。
- 结论：作为后续 GA 能力演进，不阻塞本次证据链扩展，但本次会为实例同步保留稳定锚点和版本字段。

## 5. 证据模型

### 5.1 顶层契约

提案详情接口新增顶层 `evidence` 字段；现有 `suggestion` 和 `source_refs` 保留，以兼容现有客户端和审计记录。

```json
{
  "schema_version": "order-review-evidence.v1",
  "status": "complete",
  "proposal_id": "proposal-123",
  "order_id": "order-123",
  "tenant_id": "tenant-default",
  "order_version": 1,
  "captured_at": "2026-08-26T10:00:00Z",
  "ontology": {},
  "data": {},
  "derivation": [],
  "recommendation": {}
}
```

字段约束：

- `schema_version` 是前后端和审计识别证据格式的稳定版本，不与平台对外版本号混用。
- `status` 只有 `complete` 和 `unavailable`。不存在部分完成后仍允许确认的状态。
- `tenant_id`、`order_id`、`order_version` 必须与提案和订单读取结果一致。
- `captured_at` 使用 UTC RFC 3339；证据包创建后不可被后续页面刷新隐式改写。
- `recommendation` 必须是基于本证据包的建议，不能由前端重新计算。

### 5.2 Ontology 语义证据

Ontology 图应明确区分正式模型节点、动作契约节点和交易事实锚点。v1 不伪称订单已成为 Ontology 持久化 Individual：

```json
{
  "ontology": {
    "source": "ontology_kernel",
    "model_rid": "ont.tenant-default.obj.crm.order.v1",
    "action_rid": "ont.tenant-default.act.order-review-confirm.v1",
    "graph": {
      "nodes": [
        {
          "id": "order-fact-anchor:order-123",
          "label": "订单 order-123",
          "type": "transaction_anchor",
          "properties": {
            "order_id": "order-123",
            "source": "order_review_orders",
            "version": 1
          }
        },
        {
          "id": "object-type:ont.tenant-default.obj.crm.order.v1",
          "label": "订单",
          "type": "object_type",
          "properties": {
            "rid": "ont.tenant-default.obj.crm.order.v1",
            "version": "v1"
          }
        },
        {
          "id": "action-type:ont.tenant-default.act.order-review-confirm.v1",
          "label": "订单复核确认",
          "type": "action_type",
          "properties": {
            "rid": "ont.tenant-default.act.order-review-confirm.v1",
            "action_type": "order_review_confirm"
          }
        }
      ],
      "edges": [
        {
          "id": "order-instance-of-model",
          "source": "order-fact-anchor:order-123",
          "target": "object-type:ont.tenant-default.obj.crm.order.v1",
          "label": "符合对象模型"
        },
        {
          "id": "model-supports-action",
          "source": "object-type:ont.tenant-default.obj.crm.order.v1",
          "target": "action-type:ont.tenant-default.act.order-review-confirm.v1",
          "label": "支持动作"
        }
      ]
    },
    "legend": {
      "transaction_anchor": "订单交易事实的语义锚点，不是已持久化的 Ontology Individual",
      "object_type": "来自 Ontology Kernel 的正式对象模型",
      "action_type": "来自 Ontology Kernel 的订单复核动作定义"
    }
  }
}
```

实现要求：

- `object_type` 必须来自当前租户可见且已发布的规范 `Order` ObjectType；禁止从重复的临时 `order<timestamp>` 类型中猜选。
- `action_type` 必须由版本化种子或 Ontology Kernel 正式注册；在注册完成前，证据状态为 `unavailable`，不得以普通字符串节点冒充 Ontology ActionType。
- `transaction_anchor` 只表示交易事实与语义模型的明确映射，必须有 `source`、`order_id` 和 `order_version`。
- 图节点和边应携带稳定 ID，避免前端用 label 推断关系；节点属性只返回审核所需的最小信息。
- v1 的图范围固定为订单事实锚点、Order ObjectType 和订单复核 ActionType，后续实例同步可以增加 Customer/Payment/Product 节点而不破坏顶层契约。

### 5.3 交易事实证据

交易事实从订单复核 PostgreSQL 事务域读取，不能从 LLM 输出、RAG 文本或前端状态读取。

```json
{
  "data": {
    "source": "order_review_orders",
    "captured_at": "2026-08-26T10:00:00Z",
    "facts": [
      {
        "id": "fact.amount_cents",
        "field": "amount_cents",
        "label": "订单金额",
        "value": 250000,
        "display_value": "¥2,500.00",
        "source": "order_review_orders.amount_cents"
      },
      {
        "id": "fact.payment_status",
        "field": "payment_status",
        "label": "支付状态",
        "value": "unpaid",
        "display_value": "未支付",
        "source": "order_review_orders.payment_status"
      },
      {
        "id": "fact.review_status",
        "field": "review_status",
        "label": "复核状态",
        "value": "pending",
        "display_value": "待复核",
        "source": "order_review_orders.review_status"
      },
      {
        "id": "fact.version",
        "field": "version",
        "label": "订单版本",
        "value": 1,
        "display_value": "v1",
        "source": "order_review_orders.version"
      }
    ]
  }
}
```

事实规则：

- 金额内部统一使用整数分；显示层负责人民币格式化，禁止浮点金额参与资格判断。
- `review_status` 和 `version` 必须纳入快照，用于确认时的状态机和乐观锁检查。
- 每个推导条件必须引用一个或多个 `fact.id`；没有引用的自然语言理由不构成证明。
- 只返回当前租户和当前订单的最小必要字段，禁止借证据接口扩大客户或支付敏感数据暴露面。

### 5.4 确定性推导

推导结果是可重放的结构化条件，不是 LLM 的自由文本判断。

```json
{
  "derivation": [
    {
      "id": "threshold",
      "label": "订单金额 ≥ ¥1,000.00",
      "passed": true,
      "fact_refs": ["fact.amount_cents"],
      "details": {"operator": ">=", "expected_cents": 100000}
    },
    {
      "id": "unpaid",
      "label": "支付状态 = 未支付",
      "passed": true,
      "fact_refs": ["fact.payment_status"],
      "details": {"operator": "=", "expected": "unpaid"}
    },
    {
      "id": "eligible",
      "label": "满足订单复核条件",
      "passed": true,
      "fact_refs": ["threshold", "unpaid"]
    }
  ]
}
```

v1 的最低资格条件为金额达到配置阈值且支付状态为 `unpaid`。阈值必须来自版本化策略配置，并在证据中记录实际比较值；不能把阈值硬编码在 React 页面中。

LLM/RAG 的职责限于生成可读的解释和政策引用。若 LLM/RAG 不可用，后端不得伪造理由；确定性事实和推导可以保留，但没有完整建议时提案仍不可确认。

### 5.5 行动建议

```json
{
  "recommendation": {
    "action": "follow_up_payment",
    "title": "创建回款跟进单",
    "reason": "订单金额达到复核阈值且当前未支付，建议人工确认后创建回款跟进单。",
    "confidence": 0.94,
    "requires_confirmation": true,
    "derivation_refs": ["eligible"],
    "source_refs": [
      "ontology://object-type/ont.tenant-default.obj.crm.order.v1",
      "ontology://action-type/ont.tenant-default.act.order-review-confirm.v1",
      "policy://payment-follow-up-policy"
    ]
  }
}
```

行动建议必须绑定 `derivation_refs`。确认接口仍然以服务端提案、订单版本、租户和幂等键为准，不信任前端提交的建议文本、金额或事实。

## 6. 后端接口与持久化

### 6.1 接口

公共接口继续使用订单复核现有 v1 路径：

- `POST /api/v1/review-cases`：传入订单 ID、可选解释请求和来源上下文；服务端读取订单并生成扩展证据包。
- `GET /api/v1/action-proposals/{proposal_id}`：返回现有提案字段，并新增顶层 `evidence`。
- `POST /api/v1/action-proposals/{proposal_id}:confirm`：只允许 `evidence.status=complete` 且提案未过期、订单版本匹配时执行。
- `POST /api/v1/action-proposals/{proposal_id}:reject`：记录人工拒绝和证据快照关联，不执行订单副作用。

提案创建成功的响应和提案查询响应使用同一 `EvidenceBundle` 快照。页面不需要为“图”“数据”“建议”发起多个可能产生版本漂移的请求。

### 6.2 持久化策略

v1 复用现有 `ReviewCaseORM.suggestion` JSON 文本字段，把规范化证据包存储在 `evidence_bundle` 键中，并在 API 层提升为 `evidence` 字段。这样可以避免在当前迭代引入双写列和旧迁移分支，同时保证既有 `suggestion` 客户端仍可读取。

存储结构示意：

```json
{
  "action": "follow_up_payment",
  "reason": "...",
  "confidence": 0.94,
  "evidence_bundle": {
    "schema_version": "order-review-evidence.v1",
    "...": "immutable snapshot"
  }
}
```

持久化和审计要求：

- 创建提案时，在同一事务边界内保存证据快照与提案元数据；不能在查询时重新生成。
- Outbox/Audit 事件至少包含 `evidence_schema_version`、`fact_ids`、`graph_node_ids`、`order_version` 和 `proposal_id`。完整快照通过提案 ID 关联，避免事件 payload 无界膨胀。
- 确认事务仍原子完成订单复核更新、跟进单创建、幂等记录、Outbox 和审计；证据引用必须指向确认前的提案快照。
- 旧提案若没有 `evidence_bundle`，页面显示“历史提案无证据快照”，确认按钮禁用；不对历史验收数据做隐式回填。

### 6.3 依赖与失败关闭

证据构建依赖 Ontology Kernel、订单交易库和动作契约。以下情况不得生成可确认提案：

- 当前租户无法解析规范 Order ObjectType；
- 订单复核 ActionType 未注册、已下线或版本不匹配；
- 订单不存在、已支付、已完成复核或租户不匹配；
- 事实快照字段缺失或订单版本在读取过程中不稳定；
- LLM/RAG 被配置为建议必需依赖但不可用；
- 任何跨租户访问、权限检查或依赖调用失败。

推荐行为是提案创建返回结构化错误（HTTP 4xx/5xx 按失败原因分类），而不是创建一个 `unavailable` 且仍可继续确认的提案。`unavailable` 主要用于已有提案详情的可诊断展示和兼容历史数据；前端在任何情况下都不得启用确认。

## 7. 前端展示

### 7.1 信息架构

订单复核建议卡改为一条完整证据链，顺序固定：

1. **复核证据**：显示证据状态、提案 ID、订单版本和采集时间。
2. **Ontology 关系图**：显示交易事实锚点、Order ObjectType、订单复核 ActionType，以及“符合对象模型”“支持动作”关系；图例标明节点来源。
3. **订单事实数据**：以表格展示金额、支付状态、复核状态、订单版本和事实来源。
4. **推导过程**：逐条显示条件、通过/不通过状态、事实引用；点击条件可定位右侧事实。
5. **行动建议**：显示动作标题、理由、置信度、政策来源和人工确认提示。
6. **确认/拒绝**：仅在证据完成、提案有效、权限允许且当前状态可操作时启用。

桌面端使用“左图右数据、下方推导和建议”的布局；窄屏改为上下堆叠，但不隐藏推导或事实来源。

### 7.2 组件和契约

- `OrderReviewPage` 只消费 `ActionProposal.evidence`，不重复请求 Ontology 图或在组件内构造建议。
- 复用现有 `KnowledgeGraph` 或 `SemiGraphCanvas` 时，适配层只做渲染数据转换，不改变节点/边语义。
- 图节点需要稳定 `data-testid` 或可访问名称，例如 `ontology-node-order-model`、`ontology-node-review-action`、`ontology-edge-supports-action`。
- 事实表、推导条件、建议区域分别提供稳定测试标识，便于系统级验收。
- 保留现有 `source_refs` 展示作为补充引用，但不再把它作为唯一证据展示。

### 7.3 状态和错误

- 加载中：显示证据包骨架，不允许确认。
- 完整：显示全部两类证据、推导和建议，按权限显示操作按钮。
- 不可用：显示缺失依赖/版本/权限的结构化错误，提供重新加载或返回列表；不显示伪造图或默认建议。
- 历史提案：显示历史提示和已有文字信息，明确“无证据快照”，确认禁用。
- 确认冲突：保留证据内容，提示订单版本已变化，需要重新生成复核提案；不自动覆盖新事实。

## 8. 安全、一致性和可审计性

- 所有订单、提案和 Ontology 模型查询都以 JWT 身份和经校验的 `X-Tenant-Id` 为范围；不能仅信任客户端传入租户头。
- 服务间调用使用 `client_credentials`；证据 API 不公开可跨租户猜测的模型或订单 ID。
- Graph 节点、事实 ID、策略版本和提案 ID 都必须保持同租户绑定；拒绝条件和越权访问写入审计。
- 证据快照在提案生命周期内不可编辑；确认和拒绝都引用同一 `proposal_id`、`order_version` 和 `schema_version`。
- 日志禁止输出完整敏感字段；使用 tenant、proposal、order 和 trace 关联排障。
- 审计消费者、搜索索引和湖仓可以最终一致；交易提交成功后下游失败进入重试/DLQ，不回滚订单事务。

## 9. 测试与验收

### 9.1 后端单元和集成

- 证据构建器生成稳定的 schema、节点、边、事实和推导引用。
- 金额阈值边界：低于、等于、高于阈值。
- 支付状态和复核状态矩阵：未支付/已支付、待复核/已复核。
- 订单版本在提案创建和确认之间变化时拒绝确认。
- ObjectType、ActionType 缺失或版本不匹配时失败关闭。
- 租户越权、提案越权和来源引用越权均被拒绝。
- 提案查询返回创建时快照，不随订单后续变更重算。
- 重复确认使用幂等键只产生一次订单写回、跟进单、Outbox 和审计。
- LLM/RAG 失败时不返回伪造建议；确定性故障和依赖错误可观测。

### 9.2 前端单元和契约

- 证据状态到 UI 状态的映射完整，`unavailable` 和历史提案确认按钮始终禁用。
- 金额、状态、事实来源和推导引用展示正确。
- 图节点/边的稳定 ID 和可访问标签正确。
- OpenAPI/TypeScript/Python schema 对 `evidence` 的字段和枚举一致。

### 9.3 Playwright 系统验收

黄金路径至少验证：

1. 从应用中心进入订单复核；
2. 创建一个高价值未支付订单并打开复核；
3. 页面同时出现 Ontology 关系图和订单事实数据；
4. 金额、未支付状态、订单模型和复核动作节点与当前订单一致；
5. 推导条件引用事实并得出“创建回款跟进单”；
6. 人工确认后订单状态、跟进单、Action 结果和审计可核对；
7. 全程无 4xx/5xx、无 mock/echo/fallback 响应；
8. 重复确认、版本冲突、越权和依赖不可用场景按预期失败。

验收证据必须绑定当前 Git SHA、提案 ID、订单版本和 trace ID。

## 10. 发布与迁移

1. 增加并发布规范 Order ObjectType 和 `order-review-confirm` ActionType 的版本化种子，验证租户可见性和权限。
2. 部署后端证据契约和前端展示，先在本地和 staging 运行订单复核完整回归。
3. 现有提案不迁移；新提案必须生成 v1 证据快照。旧提案只读展示且确认禁用。
4. 通过后再将通用页面展示从“建议理由优先”切换为“证据链优先”。
5. 记录 OpenAPI、事件、前端和验收证据的同一版本，避免只更新页面而遗漏 SDK、审计或 E2E。

## 11. 后续演进

后续可在不改变 `EvidenceBundle` 顶层契约的情况下增加：

- Customer/Payment/Product 的 Ontology Individual 与 Link；
- 订单实例同步的来源事件、同步状态和补偿记录；
- 多条候选建议及其比较证据；
- 证据图的时间线、变更 diff 和人工批注；
- 由 Temporal 承载的异步证据刷新和人工审批节点。

这些能力必须在具备实例生命周期、事件补偿和权限模型后单独评审，不能通过在当前页面增加未验证的节点来提前模拟。
