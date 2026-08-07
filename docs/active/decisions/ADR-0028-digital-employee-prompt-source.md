# ADR-0028: 数字员工 system prompt 单一数据源

> 状态：**Accepted v1.0** · 日期：2026-08-07 · 决策人：MatePlatform Architecture Council
>
> 签字：`__/__________` （纸质档填写位）
>
> 上游：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §4.1（7+1 数字员工体系）
> 关联：MP-AGENT-ONT-01 / MP-AGENT-WF-01 / MP-AGENT-APP-01 / MP-AGENT-DATA-01 / MP-AGENT-OBS-01 / MP-AGENT-SEC-01 / MP-AGENT-KB-01 / SUPER-COPILOT-01

## 1. 背景

蓝图 v0.4 §4.1 定义 7+1 类数字员工（Ontology / Workflow / App / Data Product / OBS / Security / Knowledge + SuperAI COPILOT），每类员工有独立身份与能力边界。v3.1 增量期间，`mate-tech-dw` 为了让详情页"现在"显示 system prompt，被塞入了一份**内联副本** `_BUILTIN_SYSTEM_PROMPTS`（6 份业务/架构混合 prompt），导致：

1. **双数据源**：kernel `SYSTEM_PROMPTS` 与 DW `_BUILTIN_SYSTEM_PROMPTS` 文本重复
2. **概念混淆**：kernel AgentRole 是"架构定义"，DW 业务角色（CS_AGENT / SALES / ANALYST / OPS）是"stub 阶段自造"，两套身份并行
3. **未来 LLM 接通的入口不清晰**：`mate-tech-agent`（M3 / TD-6 接 AIP-GATEWAY-01 后）若再各自定义 prompt，文本将进一步漂移

## 2. 决策

冻结单一数据源：

- 所有数字员工 system prompt 的权威定义位于 `mate_kernel/agent/prompts.py:SYSTEM_PROMPTS`，类型 `dict[AgentRole, str]`
- 当前覆盖 **8 个角色**：7 类 AgentRole（`ONTOLOGY` / `WORKFLOW` / `APP` / `DATA_PRODUCT` / `OBS` / `SECURITY` / `KNOWLEDGE`）+ `SUPERAI`（COPILOT 编排平面）
- 每条 prompt 五段式：**使命 / 职责 / 输入契约 / 输出契约 / 边界**；边界段含 rid 前缀规约（`ont.<tenant>...` / `wfe.<tenant>...` / `kb.<>...` 等）
- 官方封装入口：`mate_kernel.agent.copilot.IntentRouter.prompt(role)`（`copilot.py`），供内部调用方使用

**强约束**：

1. **禁止再创建内联副本**。任何包（DW / agent / app-arch / 等）需要数字员工 prompt，必须 `from mate_kernel.agent.prompts import SYSTEM_PROMPTS` 取值
2. **AgentRole 是权威枚举**。新增数字员工类型必须先在 `mate_kernel/agent/orchestrator.py:AgentRole` 扩展，再在 `SYSTEM_PROMPTS` 里补 prompt
3. **消费方契约**：消费方拿到的 prompt 是不可变 `str`，按 system message 注入 LLM 即可；禁止再次拼接、改写
4. **DW 的旧 `_BUILTIN_SYSTEM_PROMPTS` 必须删除**（本 ADR 落地时一次性清理）

## 3. 实施细节

### 3.1 Kernel 侧

`mate_kernel/agent/prompts.py`：

```python
SYSTEM_PROMPTS: dict[AgentRole, str] = {
    AgentRole.ONTOLOGY: "你是 Mate Platform 的「本体员工」...【使命】...【边界】...",
    AgentRole.WORKFLOW: "你是 Mate Platform 的「工作流员工」...【边界】...",
    AgentRole.APP:      "你是 Mate Platform 的「应用员工」...【边界】...",
    AgentRole.DATA_PRODUCT: "你是 Mate Platform 的「数据产品员工」...【边界】...",
    AgentRole.OBS:      "你是 Mate Platform 的「可观测员工」...【边界】...",
    AgentRole.SECURITY: "你是 Mate Platform 的「安全员工」...【边界】...",
    AgentRole.KNOWLEDGE:"你是 Mate Platform 的「知识库员工」...【边界】...",
    AgentRole.SUPERAI:  "你是 Mate Platform 的「SuperAI Copilot」...【边界】...",
}
```

`mate_kernel/agent/copilot.py`：

```python
class IntentRouter:
    def prompt(self, role: AgentRole) -> str:
        return SYSTEM_PROMPTS[role]
```

### 3.2 DW 侧（已落地）

- `pyproject.toml` 加 `mate-kernel` 依赖；`Dockerfile` cp `mate_kernel`
- `_serialize_employee` 用 `_system_prompt_for(emp)` 取值
- `_system_prompt_for` 语义：
  1. 用户显式保存的非空 `system_prompt` 优先（自定义员工）
  2. 否则 `AgentRole(emp.role)` 命中 kernel 7 类时取 `SYSTEM_PROMPTS[role]`
  3. 未知 role 兜底空串
- `_BUILTIN_SYSTEM_PROMPTS` 内联副本已删除
- seed 7 个内置员工严格对齐 7 类 AgentRole（`role` 字段即 kernel slug），prompt 从 kernel 唯一取

### 3.3 Agent 侧（TD-6 待接通）

`mate-tech-agent` 暂未消费 SYSTEM_PROMPTS（其 S1-S4 场景是通用 chat/reason 流程）。TD-6 时：

- ChatRequest 新增"员工人格"字段（可选）
- LLM 调用前从 kernel 取该 role 的 prompt 注入 system message
- 这保证 agent 服务执行时与 DW 展示时的"身份定义"一致

## 4. 验收

- pytest：kernel `test_agent_prompts.py` 覆盖 8 个 role + 身份标识 + prompt 互不相同；kernel 全量 ≥ 100 passed
- 容器：DW 容器 cp `mate_kernel` 后 import 成功，`GET /api/v1/dw/employees` 返回 7 个员工，每个 systemPrompt 596-853 字且互不相同
- 端到端：详情页 `EMP-ONT-001` 渲染"系统提示词"含 kernel 边界标识（如 "ObjectSet"）

## 6. 影响

- **正向**：DW 详情页能立即展示身份 prompt；M3 agent 服务的 LLM 注入路径清晰；未来新增角色成本低（只动 kernel）
- **负面**：DW 包因此依赖 kernel（pyproject + Dockerfile cp）；独立部署 DW 时需打包 kernel（已加依赖，无新增成本）
- **风险**：kernel prompt 文本变更需走 ADR 流程；本 ADR 不为 prompt 文本本身背书，仅规定"权威位置"

## 7. 备选方案

- **A. 让每个包自己定义 prompt**（拒绝：违背单一数据源，文本漂移在所 难免）
- **B. 抽到独立 `mate-prompt` 包**（暂缓：增加包边界成本，kernel 已具备 Protocol/dataclass 抽象，足够承载）
- **C. 走 OpenAPI 集中服务**（拒绝：增加运行时依赖，与 kernel 单一可执行单元不符；与"自建原则"冲突）

## 8. 参考

- `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` §4.1 / §8
- `mate_kernel/agent/prompts.py`
- `mate_kernel/agent/copilot.py:134-136`
- `mate-tech-dw/src/mate_tech_dw/api/app.py:_system_prompt_for`
- `docs/active/specs/2026-08-07-agent-role-prompts.md`（设计背景）