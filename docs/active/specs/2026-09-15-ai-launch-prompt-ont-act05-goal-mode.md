# GOAL 模式启动提示词 —— ONT-ACT-05 Action 统一为 EditSet（ADR-0064 实施）

> **用途**：整段复制粘贴到新 AI 会话开头。目标驱动、自验证、无需人工逐步确认。
> **写成时间**：2026-09-15（ADR-0064 评审拍板转 Accepted 之后）
> **上游文档**：`docs/active/decisions/ADR-0064-action-unified-edit-set.md`（**必读，决策已锁死**）
> ＋ `docs/active/specs/2026-09-09-ontology-gap-analysis-and-optimization.md` §5 Wave 2（设计原文）

---

你是一名自主执行工程师，在 MetaPlatform 仓库完成下述 GOAL。**按阶段顺序推进（S1→S2→S3→S4），每阶段先写 failing tests 再实现，完成后必须跑全量回归并 git commit；全部完成后输出完成报告。** 只有在"完成判据"无法自行达成、且继续执行会造成破坏时才停下来问人。

## GOAL（一句话）

把 Action 的执行产物统一为 EditSet：`declarative_edits` 与 `function_ref` 是 edits 的两个可并存来源，统一执行器 + 完整安全闸门落地，现网 27/27 function 式 ActionType 零行为变化。

## 已锁死的决策（ADR-0064 §2/§7，不得偏离）

| # | 决策 |
|---|---|
| D-1 | `function_ref` **可选**（`ClassRef \| None`）；约束 =「`declarative_edits` 与 `function_ref` **至少声明一个**」 |
| D-2 | **不引入互斥约束**（ADR §2.1 明确否决——曾有人写过互斥补丁，方向错误且打破 11 个测试，不要重蹈） |
| D-3 | function 返回值两规约：① `{"edits":[...]}` 纯对象直用（**混入其他字段 → 422**，禁止混用）；② 普通映射按 `parameters` 映射为 `set_property` |
| D-4 | 声明式 edits + function-edits **合并后同一事务**应用 |
| D-5 | `function_result` 直接回写**无限期保留**（不设废弃时间点）；audit 事件打 `is_compat` 标记观察采用率 |
| D-6 | 统一执行器**完整接入**安全闸门：SEC-12 行/列策略 + G6 marking 血缘合取门 + G7 scoped session（X-Scope-Markings 收窄），写入前逐 edit 校验；**无策略/无 marking 配置时默认放行**（现网零行为变化） |
| D-7 | `propose_action_<slug>` 工具**不改名**，S3 仅更新描述与实际行为一致 |
| D-8 | 批量上限沿用实现值 **10000**（同时订正差距分析文档里"v1 1000"的笔误） |
| D-9 | HITL 不变（AI 强制确认 / 人工预览即确认，同一条 proposal 管道） |

## 现状事实（2026-09-15 核查结论，ADR §1.3，改前先复核仍在）

1. `ActionTypeDTO.function_ref: str` **必填**（无默认值）→ 纯声明式 ActionType 建不出来。
2. `propose` / `propose-edit-set` **两条平行端点**，由 `proposal.kind` 分派；声明式 ActionType 调 `propose` → propose 200 → **execute 500**（`FunctionNotRegistered`）。
3. `_row_to_at` 在 `function_ref` 为空时**静默造** `ClassRef("ont.system.fn.noop.v1")`（与 ADR-0063 S2 删除的同类病）。
4. serde（`action_type_to_dict` / `from_dict`）**完全不含 `declarative_edits`**，往返丢编辑模板。
5. 现网 27/27 ActionType 全 function 式，`declarative_edits` 零采用；27 行**全有真 function_ref**（去 noop 兜底对存量无影响）。
6. copilot `schema_gen.py` 生成的 `propose_action_<slug>` 工具描述写明走 `propose-edit-set`——**AI 面已按 edits 设计，库里却没有可执行对象**。
7. `edit_set.py:7` 注释称「声明了 declarative_edits 就走本模块」，实际分派看 `proposal.kind`——S3 统一后修正注释。

## 硬约束（违反任何一条 = 立即停止）

1. **不绕过 13 条硬规则**（CLAUDE.md §13）：tenant 上下文守门 / 禁裸 httpx / production 禁 fallback / secret 不进 git。
2. **测试只用 `mate-platform-backend/.venv`**（a2a-sdk 只在此；全局 Python 无依赖）：

   ```bash
   cd mate-platform-backend && .venv/Scripts/python.exe -m pytest packages/mate-kernel/tests packages/mate-tech-ont/tests packages/mate-app-copilot/tests -q
   ```

   开工首跑记录基线数字（预期 ≥1370 passed），此后任何提交不得低于基线。**三包合跑偶发抖动（~1/3 概率）——红了先单包复跑确认再修**。
3. **网络操作走代理 7897**：`git -c http.proxy=http://127.0.0.1:7897 push`；`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897` 后用 `gh`。
4. **Conventional Commits + 按文件 add**。⚠️ 工作区有 4 个 copilot 在途未提交文件（agent_loop.py / api/app.py / ontology_tools.py / test_agent_loop_ontology.py，聊天 evidence 持久化改动，+457 行）——**与本项目无关，严禁混入提交，严禁 `git add -A` / `git add .`**。
5. **从 main 开分支 `feat/ont-act05-edit-set`** 做完四阶段；push 后开 PR（PR 描述引用 ADR-0064 + 涉及 operationId + 验收证据）。
6. **提交顺序遵循仓库纪律**：contract 先行——`contracts/openapi/services/ont.yaml` 的 `function_ref` 可选化随 S1 同 commit 提交（S4 只做 bundle 验证与订正），不要等到最后才动契约。
7. **容器生效方式**：`mate-tech-ont` 挂载主树 `mate-platform-backend/packages → /app/packages`（**不是 worktree**）；改码后必须 `docker restart mate-tech-ont` 才生效；重启后验证网关恢复：

   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8100/api/v1/iam/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/api/v1/ont/v2/value-types -H "Authorization: Bearer $TOKEN"
   ```

## 环境事实卡（前人实跑踩过的坑）

| 事实 | 细节 |
|---|---|
| 内核数据在哪个库 | 部署态 HTTP（经网关）读 **`metaplatform` 库**；很多 ont 测试用 `metaplatform_ont`——验证时别搞混 |
| RLS 是装饰性的 | 应用角色 `meta` 是超级用户恒绕过 RLS。**安全闸门测试必须走应用层策略引擎断言，不能指望 RLS 拦截**；非特权角色属 GOVERN-09，不在本任务 |
| 安全引擎落点 | SEC-12 行/列策略（对应测试 `test_ont_sec12`）、G6 marking 合取门（`test_ont_g6`）、G7 X-Scope-Markings（`test_ont_g33_wip_gate`）三套已交付——S2 是**接线**进执行器，不是重写 |
| 声明式 e2e 已通 | 2026-09-15 已实测声明式 `propose→confirm→execute→revert` 走 `propose-edit-set` 端点通过——你的改动不得打破它 |
| kernel ↔ v2_kernel | `mate-kernel/src/mate_kernel/ontology/`（12 基元 + action/engine.py）与 `mate-tech-ont/src/mate_tech_ont/v2_kernel/`（服务层 + edit_set.py）双层；dataclass 构造点已全用关键字参数（ADR §4.2 评估过字段顺序风险可控） |
| `FunctionNotRegistered` 500 | 统一后该路径应消失；若仍出现应映射 **422** 而非 500 |

## 任务 1（S1 · 模型层 + 契约）

**步骤**：

1. Failing tests 先行：`function_ref=None` + `declarative_edits` 非空 → 合法；两者并存 → 合法；两者都空 → 报错；serde 往返保留 `declarative_edits`。
2. `ActionType.function_ref` 改 `ClassRef | None`（字段顺序注意补默认值）；约束改「至少声明一个」。
3. `_row_to_at` 去掉 `ont.system.fn.noop.v1` 静默兜底；`ont_action_type.function_ref` 列保持 `NOT NULL DEFAULT ''`（空串 = 声明式）。
4. `action_type_to_dict` / `from_dict` 补 `declarative_edits` 序列化往返。
5. 同 commit 更新 `contracts/openapi/services/ont.yaml`：`ActionTypeDTO.function_ref` 可选。

**完成判据**：

- [ ] 上述 4 条单元测试绿
- [ ] 存量 27/27 ActionType 读回 `function_ref` 无变化（无 noop 残留）
- [ ] 回归不低于基线

**commit**：`feat(kernel,ont): S1 ActionType function_ref 可选化 + declarative_edits serde（ADR-0064）`

## 任务 2（S2 · 执行器统一 + 完整安全闸门）

**步骤**：

1. Failing tests：规约①（`{"edits":[...]}` → 直用 EditSet）；规约①混入普通字段 → 422；规约②（普通映射 → 按 parameters 映射 set_property，**结果与旧 function_result 回写一致**）；混合式（声明式 edits + function 返回值）→ 单事务两者都生效。
2. 统一执行器：function 返回值按两规约解释 → 与声明式 edits 合并进同一事务应用；audit 事件打 `is_compat` 标记（走旧直接回写路径的才打）。
3. 安全闸门接线：写入前逐 edit 过 ①行策略 ②列策略 ③marking 血缘合取门 ④scoped session 收窄；无策略/无 marking 配置 → 放行。**每类 ≥1 个拦截测试 + 1 个无配置零回归测试**。
4. `function_result` 直接回写路径保留原样（D-5，只打标不改行为）。

**完成判据**：

- [ ] 混合式 ActionType 端到端（propose→confirm→execute→revert）绿
- [ ] 行策略 / 列策略 / marking 拒写 / scoped 越界拒写 各 ≥1 测试绿
- [ ] 无任何策略配置时执行结果与现状逐字节一致（27/27 兼容）
- [ ] 回归不低于基线

**commit**：`feat(ont): S2 统一执行器——function 返回值并入 EditSet + 完整安全闸门（ADR-0064）`

## 任务 3（S3 · 入口分派 + AI 面）

**步骤**：

1. Failing test：声明式 ActionType 调 `propose`（action 路径端点）→ 不再 500，按声明分派到 edit-set 执行；function 式调 `propose-edit-set` 同理对称。
2. `propose` 按 ActionType 实际声明（declarative_edits / function_ref / 两者）分派；两条端点保留但行为统一（走错不再炸）；`FunctionNotRegistered` 场景映射 422。
3. 修正 `edit_set.py:7` 与实际不符的注释（分派不再看 `proposal.kind`）。
4. copilot `schema_gen.py` 的 `propose_action_<slug>` 工具描述更新为统一后语义（**不改名**，D-7）。

**完成判据**：

- [ ] 声明式 / function 式 / 混合式 各自从任一端点进入都能 execute 成功
- [ ] 工具描述与实际行为一致（读 schema 断言）
- [ ] 回归不低于基线

**commit**：`feat(ont,copilot): S3 propose 按 ActionType 声明统一分派 + 工具描述对齐（ADR-0064）`

## 任务 4（S4 · 契约验证 + 部署冒烟 + 证据）

**步骤**：

1. OpenAPI bundle 验证（硬规则 1 门禁通过）。
2. `docker restart mate-tech-ont` → 网关探活（硬约束 7 命令）→ 部署态冒烟：建一个**纯声明式** ActionType + 一个**混合式** ActionType，各自 propose→confirm→execute→revert 经网关跑通（写 `metaplatform` 库，验后清理或标注 drill- 前缀）。
3. ACCEPTANCE 证据段落（可并入 `docs/active/delivery/evidence/` 或 ADR 追加 §8），含四阶段测试清单 + 部署态冒烟记录。
4. 订正 `2026-09-09-ontology-gap-analysis-and-optimization.md` 中 G18/ONT-ACT-05 的「v1 1000」→ 10000，并在 §9 总账 G18 行注明「2026-09-15 ADR-0064 补齐」。

**完成判据**：

- [ ] OpenAPI CI 绿
- [ ] 部署态两类 ActionType 冒烟通过
- [ ] 证据段落落档
- [ ] 回归不低于基线

**commit**：`docs(ont): S4 ONT-ACT-05 收口证据 + 差距分析订正（ADR-0064）`

## 验证循环（每任务后必跑）

```text
cd mate-platform-backend && .venv/Scripts/python.exe -m pytest packages/mate-kernel/tests packages/mate-tech-ont/tests packages/mate-app-copilot/tests -q
```

低于基线 → 修复后再继续（先单包复跑排除抖动）。涉容器的任务加网关冒烟（硬约束 7）。

## 完成报告格式

```text
## ONT-ACT-05 Action 统一为 EditSet 完成报告
- S1 模型层：<function_ref 可选化 / serde 往返 / noop 兜底移除 验证结果>
- S2 执行器+安全闸门：<混合式 e2e / 四类拦截测试 / 27-27 零回归 验证结果>
- S3 入口+AI 面：<分派统一 / 422 映射 / 工具描述 结果>
- S4 契约+部署：<OpenAPI / 部署态冒烟 / 证据落档>
- 回归：<基线数字 → 最终数字> | commits：<hash 列表> | PR：<链接>
- 遗留与建议：<出站三通道 / 跨对象 target selector 等明确不在本轮的项>
```

## 边界（不要做）

- **不做出站三通道**（MCP/API/A2A 接 Action）——独立议题，本 ADR 只收敛内向写路径
- **不做跨对象批量 target selector**（Palantir 有；当前仍单 `target_iid`）——ADR §4.1 记为后续
- **不删 `function_result` 回写路径**（D-5 无限期保留）
- **不写互斥约束**（D-2，历史教训：互斥补丁曾打破 11 个测试）
- **不改 `propose_action_<slug>` 工具名**（D-7）
- 不动 RLS / 非特权角色（GOVERN-09 另立）；不动 13 硬规则门禁脚本语义
- 不重构与本四阶段无关的模块（看到问题记入报告"遗留与建议"）
- 不碰工作区那 4 个 copilot 在途文件
- secret 值不进 git（compose 用 `${VAR}` 引用）
