# ADR-0040: 数字员工 / SuperAI 沙箱架构

> 状态：**Accepted v1.1** · 日期：2026-08-06（签字）/ 2026-08-07（GOVERN-01 治理收口）/ **2026-09-17（v1.1 修订：§2.1 分层键由「厂商身份」改为「代码来源」，见 §2.1 修订说明）** · 决策人：MatePlatform Architecture Council（v3.1 Ontology 子计划启动会决议）
>
> 签字：`__/__________` （决策人已授权，落档于 `ADR-REVIEW-2026-08-06.md`；留空签字位为纸质档填写位）
>
> 上游：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §4 §6
> 关联：MP-SANDBOX-01 / MP-SANDBOX-02 / MP-ONT-ACTION-03 / MP-SUPER-COPILOT-01 / GOVERN-05（Function 调度实接 / dev 与 prod 双轨）

## 1. 背景

MetaPlatform v3.0 已有 5 层隔离 + RLS + OTel，但**没有针对 Function/Agent 代码执行的沙箱**。蓝图 v0.4 要求把 7 类数字员工 + SuperAI 全部装在沙箱里；Function Runtime 默认 K8s Pod，Marketplace 第三方 Agent 强制 MicroVM。会话级沙箱由 ADR-0041 独立规定。

## 2. 决策

### 2.1 三级沙箱分级

| 等级           | 实现                                               | 隔离强度                                          |
| -------------- | -------------------------------------------------- | ------------------------------------------------- |
| **L1 进程**    | Python subprocess + seccomp/AppArmor + 命名空间    | 弱（dev/test 用；无 cgroup / namespace 独占）     |
| **L2 容器**    | K8s Job/Pod + sidecar 注入租户身份 + NetworkPolicy | 中（runc 容器：命名空间 + rlimit + default-deny） |
| **L3 MicroVM** | Firecracker / gVisor / Kata                        | **最强（独立内核，逃逸面最小）**                  |

#### 2.1 修订说明（v1.1，2026-09-17）：分层键 = **代码来源**，不是厂商身份

**原文（v1.0）**：按「谁出品的」分层——内置员工 → L2，Marketplace 第三方 → L3。
**修订后**：按「**这段代码是哪来的**」分层，见下表。

**理由（v1.0 是安全缺陷）**：

1. **出品方与代码可信度无关。** 内置员工的 prompt 里完全可以长出**模型现场生成的
   代码**（Function 提议、脚本片段、工具参数拼出的可执行体）；第三方 Marketplace 的
   Agent 也可以是人审过的静态代码。按出品方分层，等于给"平台自己出的"发了一张
   免检通行证——而恰恰是**模型生成**这条路径最不可信。
2. **ATT&CK 面在代码来源上，不在组织边界上。** 提示注入 / 工具返回投毒 / 子员工
   转交的代码，攻击者都落在"这段代码是谁写的、有没有人看过"这一维上。
3. **可判定。** 代码来源是代码进入沙箱时**当场可判**的元数据；"出品方"要么需要
   一张可信表，要么退化成调用方自称。

**分层键（本 ADR 的规范性内容）**：

| 代码来源 (`CodeOrigin`) | 含义                                             | 沙箱等级    | 隔离要求                                                       |
| ----------------------- | ------------------------------------------------ | ----------- | -------------------------------------------------------------- |
| `model_generated`       | LLM 现场生成（Function 提议 / 脚本 / 拼装代码）  | **L3**      | 最强：独立内核运行时 + 非 root + 只读根 + 禁网 + drop 全部能力 |
| `subagent`              | 子员工执行期装配 / 转交给下游的代码              | **L3**      | 同上（子员工不可信，与父级身份无关）                           |
| `external`              | 外部 / Marketplace 引入、未经本平台校验          | **L3**      | 同上（v1.0 的"第三方强制 L3"由此条承接）                       |
| `human_reviewed`        | 人工编写且入参已按 schema 校验                   | **L2**      | 中：容器 + rlimit + default-deny，网络按显式 allowlist         |

**不变量**：等级由 `origin` 唯一决定；调用方**不能**降级（声明一个低于来源要求的
等级 → 拒绝执行，不是静默升级）。厂商身份降级为**标签**，只用于展示与统计。

**与 v1.0 §2.1 默认映射（决策点 B1）的对照**：

| v1.0 适用对象                | v1.1 后                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| Function Runtime → L2        | 按**该 Function 的来源**：人审 → L2；模型生成 → **L3**        |
| 6 类内置 Agent → L2          | 内置 Agent 的**自身代码**仍 L2；它**生成/转交的代码** → L3    |
| SuperAI → L2（独占 Pod）     | 同上：编排器自身 L2，编排器产出物按来源定级                   |
| Marketplace 第三方 → L3（强制） | `external` → **L3**（结论不变，理由换成代码来源）           |
| OBS Agent → L1（内置只读）   | 保持 L1（`human_reviewed` + 只读 + 不对用户暴露）             |

#### 默认映射（决策点 B1，v1.1 修订）

- 人审 Function（`human_reviewed`） → L2
- 模型生成 / 子员工转交的代码 → **L3**（v1.0 定的是 L2，这是本次修订的实质变化）
- SuperAI 编排器自身 → L2（独占 Pod）；其产出物按来源定级
- Marketplace 第三方（`external`） → L3（强制）
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

### 2.5.1 Dev profile 与 Prod profile 双轨（GOVERN-01 治理收口补登，2026-08-07）

> 适用版本：v4 RUNTIME-MVP-02 已落地（`evidence/RUNTIME-MVP-02-ACCEPTANCE.md`）。本条与 §2.5 配套，但区分 dev / prod 两套实现。

| 维度                  | dev profile（默认）                                                           | prod profile（lock）                                          |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Function Runtime 后端 | `subprocess` + `win32` JobObject 资源守卫                                     | K8s Job/Pod（**唯一允许**）                                   |
| 配置开关              | `SANDBOX_BACKEND=subprocess` 默认                                             | `SANDBOX_BACKEND=k8s` 强制                                    |
| 适用环境              | `infra/helm/values/{dev,smoke}.yaml`                                          | `infra/helm/values/{staging,production}.yaml`                 |
| NetworkPolicy         | `infra/helm/charts/network-policies/templates/default-deny.yaml` + allow-list | 同上，且 `function-runtime` sub-chart 默认 deny-egress        |
| 资源配额              | CPU/Mem/Time 三元组 `FunctionResourceLimits`，超时即 kill                     | 同左；外加 OTel `function.apply` span 强制                    |
| 风险                  | **subprocess ≠ 容器**，无 cgroup/namespace 隔离                               | K8s Job/Pod 全部 13 硬规则对位                                |
| 何时降级              | dev / smoke / 本地 pytest                                                     | **绝不降级**；CI 在 prod profile 下断言 `SANDBOX_BACKEND=k8s` |

**升级路径**：dev profile 仅用于 `infra/helm/values/{dev,smoke}.yaml` 与本地 pytest；production 部署必须显式 `SANDBOX_BACKEND=k8s` 并由 GOVERN-09 的 `infra/tests/test_subcharts_required.py` 与 `scripts/ci/check_otl_np_coverage.py` 守门。

**降级告警**：subprocess 后端必须在 OTel span `function.apply` 上加 `meta.sandbox_backend=subprocess` 属性 + `WARN` 日志，便于 SRE 在 staging 环境检出"误用 dev profile"。

### 2.6 L3 = Firecracker（暂定）

- 选 Firecracker 而非 gVisor：与 K8s 集成更轻、启动更快（<125ms）
- 第三方 Agent 部署走 `infra/helm/firecracker-runtime` sub-chart
- MP-SANDBOX-02 落地（6 周，M3 内）

## 3. 跟 OWASP LLM Top 10 对位

| 风险                        | 沙箱承担                                                |
| --------------------------- | ------------------------------------------------------- |
| LLM01 Prompt Injection      | Function 入参 schema 校验，LLM 文本不绕过 Property 类型 |
| LLM02 Insecure Output       | ActionType `submission_criteria` 显式校验 LLM 输出      |
| LLM06 Excessive Agency      | 每 Agent `tools[]` 来自 Interface 白名单                |
| LLM07 System Prompt Leakage | 日志禁记 system prompt 全文，只记 hash + 长度           |

## 4. 跟 13 硬规则对位

| 硬规则                       | 沙箱承担                                          |
| ---------------------------- | ------------------------------------------------- |
| ④ 外部系统没有 ACL Client    | 沙箱内禁裸 httpx；只走 `mate-clients.*`           |
| ⑨ 没有审计/指标/trace        | sandbox span 全 OTel                              |
| ⑫ Secret 不进 git            | 沙箱禁读明文 env secret；只走 `mate-platform.kms` |
| ⑬ NetworkPolicy default-deny | 沙箱专用 NetworkProfile                           |

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
