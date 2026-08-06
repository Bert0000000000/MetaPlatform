# ADR-0040: 数字员工 / SuperAI 沙箱架构

> 状态：Draft v0.1 · 日期：2026-08-06 · 决策人：TBD
>
> 上游：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §4 §6
> 关联：MP-SANDBOX-01 / MP-SANDBOX-02 / MP-ONT-ACTION-03 / MP-SUPER-COPILOT-01

## 1. 背景

MetaPlatform v3.0 已有 5 层隔离 + RLS + OTel，但**没有针对 Function/Agent 代码执行的沙箱**。蓝图 v0.4 要求把 7 类数字员工 + SuperAI 全部装在沙箱里；Function Runtime 默认 K8s Pod，Marketplace 第三方 Agent 强制 MicroVM。会话级沙箱由 ADR-0041 独立规定。

## 2. 决策

### 2.1 三级沙箱分级

| 等级 | 实现 | 适用 |
|---|---|---|
| **L1 进程** | Python subprocess + seccomp/AppArmor + 命名空间 | 简单只读 Agent（OBS / Knowledge） |
| **L2 容器** | K8s Job/Pod + sidecar 注入租户身份 + NetworkPolicy | Function Runtime、6 类内置 Agent、SuperAI |
| **L3 MicroVM** | Firecracker / gVisor / Kata | Marketplace 第三方 Agent（不信任） |

**默认映射**（决策点 B1）：
- Function Runtime → L2
- 6 类内置 Agent → L2
- SuperAI → L2（独占 Pod）
- Marketplace 第三方 → L3（强制）
- OBS Agent → L1（内置只读，**不对用户暴露**）

### 2.2 Function Sandbox 6 条硬要求

1. **每次调用一个独立实例** —— 防止横向污染
2. **沙箱间默认零网络** —— K8s NetworkPolicy default-deny + 显式 allowlist（`metaplatform.llmgw / metaplatform.ont / metaplatform.kms`）
3. **租户身份继承 + 不可伪造** —— 沙箱启动时由 `mate-platform` 注入 `RequestContext`，Function 入参校验
4. **Outbox 出口白名单** —— 沙箱只能向 `metaplatform.*.v1` topic 发事件，不能直接写 PG/Redis/MinIO
5. **审计全留痕** —— OTel span `sandbox.start / sandbox.function / sandbox.end` + ADS 事件 `sandbox.executed`
6. **超时/资源配额** —— CPU/Mem/Time/Egress 可配；超限 kill（呼应 ADR-0018 cost ceiling）

### 2.3 凭证模型（决策点 B2）

Function **不能**直接拿用户 JWT；改用**会话级短期 token**：

```
用户登录 → JWT
  → 创建 Session（30 分钟，可配 24h）
       → Session 颁发 session_token（绑定 user_id+tenant_id+session_id）
            → Function Sandbox 拿 service-to-service 凭证（30 分钟，scoped）
                 → 调 ActionType.apply，凭证由 mate-platform 验签
```

短期凭证存于 `mate-platform/auth/session.py` 颁发表；Function Runtime 在 SANDBOX-01 内实现。

### 2.4 HITL 强制（决策点 B3）

Orchestrator 每次 multi-step plan **必须 ≥1 个 HITL 暂停点**：

- Plan 状态机：`planning → awaiting_user → running → completed | aborted`
- `awaiting_user` 期间 plan 不下发到 Function Sandbox
- 暂停点 = "ActionType.apply 前 / 跨域写操作前 / 涉及 marking 变更前" 之一
- 强制由 `mate-tech-orchestrator` 状态机实现，CI 校验

### 2.5 L2 = K8s Job/Pod（锁死问题 L2 最佳实践）

- 拒绝 Python 进程池：跨租户 RCE 风险
- K8s Job 天然受 NetworkPolicy / ResourceQuota / PodSecurityStandards 约束
- 复用 PLATFORM-K8S-01 既有 helm chart，新增 `function-runtime` sub-chart

### 2.6 L3 = Firecracker（暂定）

- 选 Firecracker 而非 gVisor：与 K8s 集成更轻、启动更快（<125ms）
- 第三方 Agent 部署走 `infra/helm/firecracker-runtime` sub-chart
- MP-SANDBOX-02 落地（6 周，M3 内）

## 3. 跟 OWASP LLM Top 10 对位

| 风险 | 沙箱承担 |
|---|---|
| LLM01 Prompt Injection | Function 入参 schema 校验，LLM 文本不绕过 Property 类型 |
| LLM02 Insecure Output | ActionType `submission_criteria` 显式校验 LLM 输出 |
| LLM06 Excessive Agency | 每 Agent `tools[]` 来自 Interface 白名单 |
| LLM07 System Prompt Leakage | 日志禁记 system prompt 全文，只记 hash + 长度 |

## 4. 跟 13 硬规则对位

| 硬规则 | 沙箱承担 |
|---|---|
| ④ 外部系统没有 ACL Client | 沙箱内禁裸 httpx；只走 `mate-clients.*` |
| ⑨ 没有审计/指标/trace | sandbox span 全 OTel |
| ⑫ Secret 不进 git | 沙箱禁读明文 env secret；只走 `mate-platform.kms` |
| ⑬ NetworkPolicy default-deny | 沙箱专用 NetworkProfile |

## 5. 验收

- MP-SANDBOX-01 / MP-SANDBOX-02 / MP-ONT-ACTION-03 / MP-SUPER-COPILOT-01 各自 ACCEPTANCE.md
- Function Sandbox 6 条硬要求各 ≥1 集成测试
- OWASP 4 类风险各 ≥1 攻防测试
- 13 硬规则对位（脚本化）
- 跨租户 negative 测试 ≥20 条

## 6. 影响

- `mate-platform/auth` 新增 `session.py`（颁发表）
- `mate-tech-llmgw` 增加 `sandbox/quota.py`（per-session 配额）
- `infra/helm` 新增 `function-runtime` + `firecracker-runtime` sub-charts
- 5 个 CI 脚本新增/扩展
