# ADR-0044 · Cowork / Code 双轨分支与三阶段 Loop

> 状态：**Superseded by ADR-0045** · 原始日期：2026-08-20
> 取代依据：v2.0 三段线性框架违背 ADR-0043 升格后的 composition kernel 语义。
> 后续依据：`docs/active/decisions/ADR-0045-loop-as-composition-kernel-application.md`
>
> 本 ADR 仅作历史参考；新设计请看 ADR-0045 + v3.0 prompt。
>
> ---
>
> 原始 ADR-0044 内容保留如下（折叠）：
> 决策者：项目负责人
> 影响范围：所有未来 BATCH 的执行流程；不破坏现有 v3.0 GA / v3.1 / v4 主线。

---

## 背景

MatePlatform 已交付 8 核心 Batch + v3.1 M1~M3 = 20/20 Batch Accepted，进入"持续迭代"阶段。痛点：

1. **历史债干扰新 BATCH 的 CI**：13 硬规则 4 项 🟡（ga-007/009/010/013）；FOLLOW-UP-BOARD 67 个未收口测试失败；21 个 Python 服务未覆盖 NetworkPolicy。
2. **AI 接力 prompt 散落**：`2026-07-30-ai-launch-prompt-batch*.md` 共 9 份，无统一 PRD/ACCEPTANCE 骨架。
3. **PRD / 实现 / 验收三阶段责任糊掉**：单一会话跑全流程时 review 困难。

## 决策

采用 **双轨分支 + 三阶段 Loop** 模式。

### 分支策略

| 前缀 | 触发 CI | 用途 |
|---|---|---|
| `main` | 全 ga-acceptance 13 门禁 | 生产 |
| `codex/<batch>` | 全 ga-acceptance 13 门禁 | 正式实现 PR（gate） |
| **`cowork/<batch>-prd`** | **仅 cowork-prd-ci.yml** | **PRD / ACCEPTANCE 本地迭代** |
| **`cowork/<batch>`** | **仅 cowork-prd-ci.yml** | **Code 本地迭代（可选）** |

### 三阶段 Loop

```
Phase A · Cowork · PRD
   ↓ 产出：<date>-<BATCH>-prd.md + integration-checklist.md + <BATCH>-ACCEPTANCE.md 骨架
Phase B · Code · Implementation（codex/<batch>）
   ↓ 产出：ADR + contract + tests + feature + infra + ACCEPTANCE.md 填 ✅
Phase C · Cowork · Acceptance
   ↓ 产出：13 门禁 + AC-* 覆盖度 + checklist 全对账的 review
回到 Phase B（缺项回填） / 启下一个 BATCH
```

### 强制约束

1. **三阶段每次都是独立 Claude 会话** —— 责任边界清晰。
2. **每个 BATCH 必须有 ADR 引用** —— 不允许"裸实现"。
3. **每个 BATCH 必须有 FR / AC / NFR 编号** —— 不允许"自由发挥"。
4. **每个 BATCH 必须有 ACCEPTANCE.md 13 门禁逐项 ✅** —— 不允许"做完了再说"。
5. **Cowork / Code 永远不交叉**：PRD 不写代码，Code 不写 PRD，Acceptance 只评论。

## 后果

### 正面

- 历史债不再干扰新 BATCH 的 CI（`cowork/**` 走轻量 CI）。
- PRD / Code / Acceptance 责任分清，review 可对账。
- 三份 ai-launch prompt 模板化复用。

### 负面 / 风险

- **多一份 workflow 维护成本**：cowork-prd-ci.yml 是新增 workflow，需 GOVERN-12 收口。
- **新会话接力**：每个 BATCH 需 3 次"读文档 + 写对话"仪式成本。
- **ADR 编号占用**：每个 BATCH 占 1 个 ADR 编号。

### 缓解

- cowork-prd-ci.yml 走 GA-ACCEPTANCE 同款 pre-commit 静态校验。
- 三份 ai-launch prompt 已落地，复用手册化。

## 关联

- **ADR-0043**：all-in-one 集成核心（cordis 范式升格）—— 本 ADR 是其工程层补足。
- **ADR-0042**：composition kernel（MP-COMP-01）—— 范式同源。
- **HARD-RULES-MATRIX**：13 硬规则保持不变，cowork-prd-ci 不替代 ga-acceptance。
- 接力 prompt：
  - `docs/active/specs/2026-08-20-ai-launch-prompt-cowork-prd.md`
  - `docs/active/specs/2026-08-20-ai-launch-prompt-code-batch.md`
  - `docs/active/specs/2026-08-20-ai-launch-prompt-cowork-acceptance.md`

## 收口（= ACCEPTANCE 完整 ✅ 后）

- [ ] cowork-prd-ci.yml 在 main 跑过一次绿灯
- [ ] check_prd_skeleton.py 在 sample PRD 上验证通过
- [ ] LOOP-ROLLOUT-01-ACCEPTANCE.md 13 门禁全 ✅
- [ ] PROGRAM-BOARD.md 追加 LOOP-ROLLOUT-01 行