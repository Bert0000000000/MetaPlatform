# ADR 评审记录：ADR-0021 / ADR-0040 / ADR-0041

> 日期：2026-08-06 · 评审会：v3.1 Ontology 子计划启动会
>
> 关联：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
> 状态：**Pending Review**（3 份草稿等决策人签字）

## 评审范围

| ADR | 主题 | 落档路径 |
|---|---|---|
| ADR-0021 | Ontology Kernel 12 基元冻结 | `docs/active/decisions/ADR-0021-kernel-12-primitives.md` |
| ADR-0040 | 数字员工/SuperAI 沙箱架构 | `docs/active/decisions/ADR-0040-sandbox-architecture.md` |
| ADR-0041 | Session Sandbox（用户级） | `docs/active/decisions/ADR-0041-session-sandbox.md` |

## 决议项

### ADR-0021

- ✅ 12 基元 API 签名冻结方案通过
- ✅ OWL 兼容层 L1 策略（直接迁移 v2，旧表 deprecate）通过
- ✅ 双租户上下文统一方案通过
- ⏳ 等待决策人签字：`__/__________`
- 评审要求：12 个基元每个 ≥3 单测；OWL 迁移回滚窗口 7 天

### ADR-0040

- ✅ 三级沙箱分级方案通过（L1 进程 / L2 容器 / L3 MicroVM）
- ✅ Function Sandbox 6 条硬要求通过
- ✅ 凭证模型（会话级短期 token）通过
- ✅ HITL 强制（每次 ≥1 暂停）通过
- ✅ L2 = K8s Job/Pod 锁死（最佳实践）通过
- ⏳ 等待决策人签字：`__/__________`
- 评审要求：OWASP LLM Top 10 4 类风险各 ≥1 攻防测试

### ADR-0041

- ✅ Session Sandbox 7 条硬要求通过
- ✅ 4 个决策点（C1-C4）收口通过
- ✅ 多设备同步（C4）方案通过
- ✅ Plan 状态机（planning → awaiting_user → running → completed/aborted）通过
- ⏳ 等待决策人签字：`__/__________`
- 评审要求：跨用户 negative 测试 ≥20 条；多设备同步压测 ≥100 并发

## 跨 ADR 一致性

| 项 | 一致性 |
|---|---|
| Function Sandbox 不能拿原始 JWT | ADR-0040 §2.3 + ADR-0041 §3 一致 |
| Plan 状态机 `awaiting_user` | ADR-0040 §2.4 + ADR-0041 §2.5 一致 |
| 沙箱 NetworkPolicy default-deny | ADR-0040 §4 + ADR-0041 §4 + 13 硬规则 ⑬ 一致 |
| OTel 主题 `session.*` / `sandbox.*` | ADR-0040 §5 + ADR-0041 §4 一致 |

## 风险登记

| 风险 | 缓解 |
|---|---|
| KERNEL-01 工期 8 周偏紧 | 拆分：M1 第 1-4 周 12 基元骨架 + 单测；M1 第 5-8 周 OWL 迁移 + 双租户统一 |
| SANDBOX-01 与 SESSION-01 凭证流耦合 | 同步启动；短期 token 颁发在 SESSION-01，SANDBOX-01 消费 |
| MicroVM 选型未定 | MP-SANDBOX-02（M3）再决；本评审不强约束 |

## 下一步

1. 决策人签字后，3 份 ADR 升为 **Accepted**，写入 `PROGRAM-BOARD.md`
2. 起 worktree `refactor/mp-ont-kernel-01` 已就绪（基于 main，分支创建于 2026-08-06）
3. 在 worktree 内起草 MP-ONT-KERNEL-01 启动包（12 基元 Protocol/dataclass + 60 tests 列表）
4. 蓝图 v0.5：补抓 Palantir 官方 7 个核心页正文，替换"可证伪"行
