# ADR-0042: Composition Kernel（组合内核 · cordis 范式自建）

> 状态：**Accepted v1.0** · 日期：2026-08-17 · 决策人：MetaPlatform Architecture Council（cordis 引入评估 A 案，调研报告 `.tmp-research/cordis/cordis-analysis.html`）
>
> 签字：`__/__________`
>
> 上游：cordiverse/paper《A Programming Paradigm for Spatiotemporal Composability》（preprint 2026-08-13，88 页）
> 关联：MP-COMP-01 / ADR-0021 / ADR-0040 / ADR-0041

## 1. 背景

**调研结论（2026-08-17）**：Cordis（cordiverse/cordis，MIT，TypeScript，4,555⭐）把 Koishi 4 年生产验证的插件内核形式化为「时空可组合性」范式——**revertible effects**（每个上下文变换携带逆函数，卸载即 LIFO 完全回滚）+ **reactive coeffects**（声明式依赖 + 变更反应式重解析）。该范式与平台三个痛点直接同构：

1. **AI proposal 回滚** = 论文 §6.1 的 withheld emission / compensation；
2. **三层沙箱权限** = §6.3 的 capability（inject 声明）+ intercept 策略 + bridge 衰减；
3. **数字员工自进化** = §1.2.2 动机原题（会话内热挂载/可逆卸载能力）。

**不直接引入 cordis 组件**：TS-only 与 Python 主后端错配；编排平面引入 Node 运行时违反「agent 编排自研」决策；v4.0.0-rc.8 / preprint / bus factor≈1。处理方式与 Palantir 组件一致（自建原则 v0.4）：**学范式、自建 Python 子集**。论文 §6.4 点名 Python 满足实现条件（async generator 即 effect iterator；lazy scheduling 需显式 create_task）。

**现状缺口（试点动机）**：`mate-tech-orchestrator` 的 `RoleRegistry.register/unregister` 是纯 dict 变更；MCP 工具从 MCP center 注销后，绑定该 capability 的 role 无感知，dispatch 静默失败。

## 2. 决策

### 2.1 自建内核五机制（对齐论文 Algorithm 1–5 + Table 1 十规则）

| # | 机制 | 论文对应 |
|---|---|---|
| 1 | **effect 单原语**：callback 为 sync/async 生成器，每次 yield 一个 disposer；LIFO 复合；guard 在 yield 边界可中断（保留已产出逆） | Alg 1 |
| 2 | **coeffect**：`set(key, value)` 本身是 effect（装订+通知，逆=摘除+通知）；`get` 两层解析 key→realm→store；`isolate(key, realm)` 多实例隔离 | Alg 2–3 |
| 3 | **fiber 惰性生命周期**：Component = (name, inject, provide, apply)；六态 PENDING→LOADING→ACTIVE\|FAILED / UNLOADING→DISPOSED；转换跑完再核对 target，变了链式反向切换 | Alg 4–5, §4.3.3 |
| 4 | **target 视图**：依赖不满足→None；否则 inject key→provider fiber id。provider **身份**变即 reload，纯 value 变不 reload | Def 46 |
| 5 | **保序卸载**：provider 先标 UNLOADING（停止 provide）→ 等全部依赖者达终态 → 再跑自身逆 | Thm 63, Alg 5 L25 |

**不做**（明确出范围）：intercept/policy、Proxy 属性访问糖、声明式 YAML loader、HMR、logger/events 服务。

### 2.2 四条形式化不变量 = 验收断言

| ID | 不变量 | 论文定理 |
|---|---|---|
| I1 | 恢复：任意 load→unload 序列后 coeffect store 回到观测等价态 | Thm 7（up to ≃） |
| I2 | 保序：provider 卸载时依赖者全部先达终态，再执行 provider 任何逆 | Thm 63 |
| I3 | 环活性：依赖环上的 fiber 永不 ACTIVE，use() 时检测报告（可预测，非死锁） | Thm 66 |
| I4 | 惰性：转换中 target 翻转正确链式切换，无双发、无半态 | §4.3.3 |

### 2.3 试点语义（orchestrator 能力反应式运行时）

- capability 可用性成为 coeffect key：`capability:{tenant}:{name}`，由 provider fiber（apply = `ctx.set(key, ref)`）承载；
- role 激活成为 fiber：inject 其 MCP capability keys —— 工具消失 → role fiber 失活（其挂载效果全部逆回收）；工具回归 → 自动复激活；
- dispatch 先查激活 overlay，runtime 缺席或能力未跟踪时行为与现状逐字节一致（回退硬门槛：现有 conftest 不触发 lifespan）；
- **边界**：`RoleRegistry` 仍是角色数据与持久化唯一事实源，fiber 不存角色副本。

### 2.4 并发模型

单事件循环协同式，无锁无队列。fiber 状态只在该 fiber 唯一 `_drive` task 内变更；永不 cancel task（惰性靠「跑完核对再链式」）；级联等待图是 DAG（环上永不 ACTIVE）故无死锁。

## 3. 跟既有决策的关系

| 决策 | 关系 |
|---|---|
| ADR-0021（Kernel 12 基元） | 正交：12 基元是语义层（类型/实例），组合内核是运行时机制层（组件/效果如何组合）；均自建，不混包 |
| ADR-0040/0041（沙箱） | 互补：内核管进程内效果可逆性；沙箱管进程/容器边界外隔离（论文 §6.3 bridge 模式是两者的接缝，后续 Batch） |
| 自建原则 v0.4 | 同款处理：不引入 cordis TS 包，fork 仅作差分测试参考（MIT 允许） |
| BUSINESS-SLICES / DATA-D0-D8 | 无扰动：17 域业务服务不动 |

## 4. 跟 13 硬规则对位

| 硬规则 | 承担 |
|---|---|
| ① Swagger 没有接口不写 route | 新端点 `POST/DELETE /api/v1/orchestrator/capabilities` 进 OpenAPI 契约 |
| ⑥ 静态检查失败不合并 | 内核 pyright-strict + ruff 干净（零新依赖） |
| ⑦ 跳过测试不标记 Accepted | I1–I4 不变量测试全绿为验收前提 |
| ⑩ 状态以验收证据为准 | `evidence/MP-COMP-01-ACCEPTANCE.md` 落档 |

## 5. 验收

- 内核：`packages/mate-platform/tests/composition/` I1–I4 + effect scope + coeffects 全绿
- 试点：工具注销→role 失活 / 重注册→复激活 / 失活时效果逆回收 / runtime 缺席回退 四场景测试
- 既有 orchestrator 测试（roles/dispatch/plan）零回归
- pyright-strict + ruff 对新增文件干净

## 6. 影响

- `mate-platform` 新子包 `composition/`（~750 行，零 I/O）
- `mate-tech-orchestrator`：`scheduler/capability_runtime.py` + `api/capabilities.py` + main.py lifespan + dispatcher overlay
- **后续项（出 pilot 范围）**：MCP center → orchestrator 能力通知接线；intercept/policy（Marketplace 权限）；ActionType proposal 状态机用 acquisition/emission 词汇重写；Session discard 用 ≃ 语义收紧
- 开放问题：同 key 多 ACTIVE provider 的仲裁策略；FAILED fiber 的重试策略（当前仅手动 reload）

## 7. 替代方案与拒绝理由

- **直接引入 cordis npm 包**：被拒——跨语言（TS/Node vs Python 主后端）、违反编排自研决策、v4-RC/preprint 成熟度、bus factor≈1
- **asyncio 取消式生命周期**（task.cancel 驱动卸载）——被拒：破坏惰性与 I2 保序，无法满足论文 Thm 63 的顺序保证
- **纯事件总线（无效果跟踪/回滚）**：被拒——只有空间维度没有时间维度，不满足 I1
- **等社区出 Python port 再用**：被拒——截至 2026-08-17 不存在；且范式核心仅 ~53KB TS，自建成本 2–3 人周可控、可控性强
