# ADR-0043: ObjectSet 结构化 IR 与 Ontology 工具化（MP-SAL-01）

> 状态：**Accepted v1.0** · 日期：2026-08-17 · 决策人：MetaPlatform Architecture Council（MP-SAL-01 规划会话，五决策点逐项裁定）
>
> 上游：`docs/active/specs/2026-08-17-semantic-layer-ai-landing-plan.md` v0.2（G1+G2 差距 + 4-agent 代码审计）
> 对标：Palantir AIP Chatbot Studio Tools Overview（Object Query Tool 官方文档，2026-08-17 检索确认）
> 关联：ADR-0021（12 基元）/ ADR-0025~0027（MCP 注册）/ ADR-0040~0042 / G7 markings（审计逆转项）

## 1. 背景

**差距（spec §3 G1+G2，P0）**：AI 消费侧缺两条腿——

1. **查询算子缺**：ObjectSet DSL 仅 filter（正则逐条匹配的字符串表达式）+ sort（仅取第一个键）+ paging；无聚合、无 link 遍历、无多键排序。InMemory 与 PG（pg_repo）**两套独立实现**，语义对齐靠人肉。
2. **建模即工具缺位**：全后端无「基元 → tool schema」生成器。mate-tech-mcp 手工注册 3 个写死工具；ontology 只以只读 MCP resource 暴露；copilot 唯一工具是硬编码 `DISPATCH_TOOL_SCHEMA`。

**审计确认的既有资产**：markings 机制已在（`Individual.marking` + `agent/security.py` required_markings 强制 + `PropertyFormat.MARKING`）；MCP 动态注册函数、per-tenant rate limiter、federation 均在。

**Palantir 对标基线**：Object Query Tool 官方设计为**绑定 object types + 指定可访问 properties**，明确以 token 效率为设计目标；四操作 = filter / aggregate / inspect / traverse；无「通用工具带 class 参数」形态。

## 2. 决策

### 2.1 ObjectSet v2 = 结构化 JSON IR（D1）

```python
@dataclass(frozen=True, slots=True)
class ObjectSetQuery:
    source: ClassRef
    filters: tuple[Condition, ...]        # {field, op, value}，op 枚举与现 filter_expr 对齐
    aggregation: Aggregation | None       # group_by + [sum/count/avg/min/max]
    traversal: tuple[TraversalStep, ...]  # {link_type_rid, direction} 链式遍历
    sort: tuple[SortKey, ...]             # 多键一等（修复现仅取 sort[0] 限制）
    paging: Paging
```

- **filter_expr 降为前端糖**：字符串表达式单向编译进 `filters`（向后兼容现有调用/前端页面），不再扩展语法。
- **双后端消费同一 IR**：InMemory 执行器与 PG（pg_repo SQL 生成）都从 IR 编译，消除两套语义漂移；PG 侧产出参数化 SQL（GROUP BY / JOIN）。
- **无解析器**：参数即结构，schema 校验即语法校验。

### 2.2 结果信封与 inspect 独立（D1b/D1c）

- 执行器协议放宽：`{kind: "objects"|"aggregates", rows}`——聚合结果是行集（group 键 + 度量值），不是 Individual。
- **inspect 不进查询 DSL**：`inspect_class(class_rid)` 作为独立元数据工具（属性/格式/marking/link/action 内省），它是 schema_gen 自身的元数据源。

### 2.3 schema_gen：mate-kernel 内、协议无关（D2a）

新增 `mate_kernel/tooling/schema_gen.py`：从 `ObjectType/Function/ActionType` 定义生成**纯数据**（tool name / description / params JSON Schema / result_schema）。两个消费者各挂各的：mate-tech-mcp 注册（对外）+ copilot `agent_loop` 注入（对内 LLM FC 工具）。不绑死 MCP 协议。

### 2.4 工具粒度：每类型专用工具（D2b，对齐 Palantir）

- 发布的每个 ObjectType 生成 `query_<slug>` 专用工具：字段（含枚举值）直接进参数 schema，LLM 选择直观、token 效率高——即 Palantir Object Query Tool 的绑定形态。
- **实现约束：专用工具是 IR 之上的薄外壳**——参数 schema 从 ObjectType 定义生成，执行时编译进同一 `ObjectSetQuery` IR 走同一执行器。不另立代码路径。
- 配套 `list_classes`（类型发现）+ `inspect_class`（元数据）两个固定辅助工具。

### 2.5 虚拟注册表：零同步生命周期（D2c）

工具清单**不落 push 事件管线**：`tools/list` 时从 `ont_object_types` 实时计算（按可见性过滤 + 短 TTL 缓存）。「发布即生效」由查询时实时校验元数据天然保证；outbox 联动留作将来清单量大后的缓存失效优化。

### 2.6 工具白名单 = markings 上抬一级（D3）

- `ObjectType` 增加 `marking` 字段（建模期打标）；agent 沿用已有 `required_markings`。
- **可见工具 = 类型 marking ⊆ agent required_markings**；查询执行时同规则二次校验（工具可见 ≠ 数据全可见，实例级 marking 继续独立强制）。
- 与 5 层租户隔离正交；域级批量发标（如 `domain:finance`）一次配置全域生效。agent profile 显式清单仅作将来个别授权的补充，不在本批。
- 属性级可见（Palantir "accessible properties"）**出范围**：`PropertyFormat.MARKING` 已在，将来细化时机制现成。

### 2.7 返回侧 schema 描述，typed client 留 05（D4）

`object_query` 响应携带 `result_schema`（字段→类型→来源 Property rid 映射），调用方可机器校验返回结构。生成式 typed SDK 是 MP-SAL-05（OSDK 等价物）范围，不掺入本批。

## 3. 跟既有决策的关系

| 决策 | 关系 |
|---|---|
| ADR-0021（12 基元） | `ObjectSet` 基元自身演进为结构化 IR；rid 体系与其余 11 基元不动 |
| ADR-0025~0027（MCP 注册） | 生成器喂给既有 MCP 注册面；per-tenant rate limiter / federation 直接复用 |
| G7 markings（spec v0.2 审计逆转） | 本 ADR 将其从对象级上抬到类型级，成为工具治理基座 |
| ADR-0042（组合内核） | 无直接耦合；工具清单虚拟化不触发 capability fiber（fiber 跟踪的是 MCP 注销事件，本批无 push） |
| 自建原则 v0.4 | 沿用：对标 Palantir 机制，全部自建 |

## 4. 跟 13 硬规则对位

| 硬规则 | 承担 |
|---|---|
| ① Swagger 没有接口不写 route | 新端点（object_query v2 / inspect / 工具清单）进 `contracts/openapi/services/ont.yaml` |
| ③ tenant 上下文 | 查询/工具清单全链路 tenant 透传，PG 侧走既有 db_filter |
| ④ 外部系统 ACL Client | MCP center 转调 tech-ont 走 mate-clients BearerAuth 封装（forbid_bare_httpx 覆盖） |
| ⑥ 静态检查 | 新文件 pyright-strict + ruff 干净 |
| ⑦ 跳过测试不 Accepted | 双后端算子单测 + e2e 全绿为验收前提 |
| ⑩ 验收证据 | 独立 `MP-SAL-01-ACCEPTANCE.md`（spec §5.5：不合并档） |

## 5. 验收

- **copilot e2e（核心）**：发布 ObjectType → copilot 工具清单出现 `query_<slug>` → 模拟 FC 调用查询 → 断言结构化结果 + `result_schema`；marking 不可见 negative 测试（agent 缺标记时工具不出现且直调被拒）。
- **算子单测**：aggregate / traverse / 多键 sort 在 InMemory 与 PG **双后端**各断言同一结果（IR 一致性的直接证明）。
- **kitchen sink**：`examples/01_kitchen_sink.py` 追加「发布类型→生成工具→查询」一步。
- 既有测试零回归；pyright-strict + ruff 干净。

## 6. 风险与对冲

| 风险 | 对冲 |
|---|---|
| 工具数随类型线性增长（17 域接入后爆炸） | 三重对冲已内置：IR 内核不重复实现 / 虚拟注册表零同步 / markings 域级批量可见性控制。接入纪律：每域只对 AI 暴露「热」类型 |
| Palantir 尚有属性级可见与 retrieval context 配对 | 前者机制已在（PropertyFormat.MARKING）将来细化；后者 = MP-SAL-02（OAG）紧随本批 |
| filter_expr 糖与 IR 的能力差 | 糖只降级不删除；新算子仅 IR 可表达（文档明示），前端页面逐步迁移 |
