# ADR-0067：运行期委托身份 —— AuthorizationSnapshot 与 IAM Token Exchange

> **状态**：**Accepted**（2026-09-17；决议依据与签字位见 §10）
> **日期**：2026-09-17
> **作者**：Claude + 用户协作
> **关联 ADR**：ADR-0011（SEC-IAM-01 Keycloak JWT + 服务身份）、ADR-0012（SEC-TENANT-01 五层隔离）、ADR-0013（PLATFORM-EVENT-01 Outbox）、ADR-0062（MCP 长期 API Key）、ADR-0066（Agent Team 角色配置与任务作用域子 agent，§3.3 包络 / §5.8 执行面）
> **关联硬规则**：硬规则 3（无 tenant 上下文不访问 repository）、硬规则 4（外部系统必须有 ACL Client）、硬规则 5（production profile 禁 fallback）、硬规则 9（审计/指标/trace）、硬规则 12（Secret 不进 git）
> **关联批次**：**`MP-RUN-DELEGATED-IDENTITY-01`**（平台计划 S2 工作项 1/2/8）+ 2.1-A / A-2
> **上游依据**：`docs/active/specs/MetaPlatform-调整优化方案执行计划-2026-09-17.md` §5.3、§7 Sprint 2；2.0 边界表 **B-1「要做的条件」**（`AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3.1）
> **触发**：2.0 的 B-1 写明「动 llmgw / MCP 协议面**之前要先有 ADR**」。本 ADR 就是那份 ADR；在它被接受之前，不允许改这两处的鉴权路径。

**命名约定**：`N1–N4` 指 §3 的四条**不变量**；`S1–S3` 指 §6 的实施切片。

---

## 1. 背景

### 1.1 问题（2.0 的 B-1，原文）

> **续跑没有用户令牌**：上游按令牌解析租户的那几处（llmgw / MCP 协议面）仍走服务身份。
> 1.9 只解决了「派活授权的链根」，没解决「上游鉴权面的身份」——把用户令牌落库会破坏
> 「原始 Bearer 一个字节不落库」这条硬约束。
> 要做的条件：需要一条**不经落库的令牌传递**通道（如运行期内存态 + 重启后重新协商），
> 或让 llmgw / MCP 协议面接受 per-run 派活授权作为身份。**动这两处之前要先有 ADR**。

### 1.2 现状（2026-09-17 实测，逐条核到代码）

| # | 事实 | 位置 |
| --- | --- | --- |
| 1 | 1.9 的 per-run 派活授权只解决**链根**：它带 `run_id / granted_by / envelope / expires_at`，**没有凭据** | `delegation.py:55-139` |
| 2 | 续跑的上下文里 `user_token` **刻意留空**，代码自己写明「本批只解决链根，不假装解决了上游身份」 | `brain.py:254-267` |
| 3 | llmgw 与 MCP 协议面按**调用方令牌**解析租户与权限；没有用户令牌就退回**服务身份** | `wiring.py:379-393`（协议面）、`wiring.py:318-340`（provider 配置取数） |
| 4 | 服务身份 token 在宿主上取不到可用 `iss`（与网关校验地址不一致必 401），且**不带 tenant claim** | 环境事实卡 §3 |
| 5 | 「原始 Bearer 一个字节不落库」是 1.9 立下的硬约束，有全量历史快照断言 | `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §1（1.9 行） |

### 1.3 不解决的后果

重启续跑那一波：派活能过闸门了（1.9），但**员工调 llmgw / MCP 时没有用户身份**——
上游要么按服务身份处理（租户/权限失真），要么直接拒绝。表现为"续跑能跑，但跑出来的东西
不是以发起用户的名义做出来的"。

---

## 2. 决策

**一句话**：把「谁授权了这轮、授权了什么」做成一份**不含凭据**的 `AuthorizationSnapshot`
随 run 落库；续跑时由 **IAM 用 Keycloak token exchange 现签一份 per-run 短期委托令牌**，
只存在内存里，用完即弃；**每一次重新签发都按当前权限重算**，所以权限撤销当场生效。

四条不变量（§3）、一个可插拔的签发面（§4）、一个向后兼容的快照形状（§5）。

---

## 3. 不变量

| # | 不变量 | 落地形态 | 判定方式 |
| --- | --- | --- | --- |
| **N1** | **不落原始 Bearer** | 落库的只有快照四样（`run_id / granted_by / envelope / expires_at`）+ 归属字段；委托令牌只活在 `RunContext` 内存里 | 全量历史快照断言：数据库、检查点、审计账本、产出物里搜不到发起时的令牌串 |
| **N2** | **委托 ⊆ 快照包络 ⊆ 当前权限** | 签发时用快照包络**收窄** exchange 请求；拿到令牌后**解出它实际带的包络**，若不 ⊆ 快照包络则**拒签** | 单元：exchange 返回一个更大的包络 → 拒绝；集成：撤销一个工具后，新一轮委托里就没有它 |
| **N3** | **每次重新评估** | 委托令牌**寿命短**（默认 300s）且**只在需要时现签**；不缓存到 run 结束 | 撤销用户权限后再续跑 → 新签的那份缩小；若把权限撤空 → 签不出可用令牌，走 fail-closed |
| **N4** | **签不出就不假装** | 没有可用的 exchange 配置 / 换不到令牌 / 令牌超出包络 → `user_token` 保持空，**绝不退回服务身份冒充用户** | 单元：未配置 issuer / exchange 报错 → 上下文里的 `user_token` 为空且带 `denial_reason` |

> **N4 是本 ADR 与"顺手把服务身份接上去"的分界线**。ADR-0066 §3.3 立的规矩是
> 「SuperAI 只是代用户行事，不是超级用户」——退回服务身份等于把链根换成平台自己。

---

## 4. 签发面（接口）

```text
AuthorizationSnapshot            # 落库的那一份，无凭据
├─ run_id / tenant_id
├─ subject_id          (= 发起用户 sub)
├─ granted_by
├─ envelope            (tools / action_rids / kb_ids / markings)
├─ policy_version
├─ issued_at / expires_at
└─ revocation_version

DelegatedCredential              # 只在内存里活，永不落库
├─ token               (短期)
├─ expires_at
├─ subject_id
├─ envelope            (从换回的令牌里解出来的**实际**权限)
└─ source              ("keycloak-token-exchange" / "none")

DelegationIssuer (Protocol)
└─ async issue(snapshot, *, now) -> DelegatedCredential | None
```

**默认实现**：`KeycloakTokenExchangeIssuer` —— RFC 8693 的
`grant_type=urn:ietf:params:oauth:grant-type:token-exchange`，走 realm 的
`/protocol/openid-connect/token`。**不自造签名服务**（平台已跑着 Keycloak）。

**未配置时**：`UnconfiguredIssuer` —— `issue()` 返回 `None`。行为与 2.0 逐字一致
（续跑 `user_token=""`），只是**多一条可读的拒绝原因**，不是静默退化。

---

## 5. 数据模型与兼容

快照仍是**图状态里的一个键**（`DELEGATION_STATE_KEY`，决策 D-5：状态键必须声明）。
本 ADR 在其上追加字段，**不新增表、不新增存储**：

| 字段 | 本 ADR 前 | 本 ADR 后 | 兼容性 |
| --- | --- | --- | --- |
| `run_id` / `granted_by` / `envelope` / `expires_at` | 有 | 保留（语义不变） | — |
| `tenant_id` / `subject_id` / `policy_version` / `issued_at` / `revocation_version` | 无 | 追加 | 老检查点读不到 → 取默认值；**不改变**既有判定结果 |

> 读侧一律 fail-closed：认不出来的形态 = 「没有授权」（`RunDelegation.of_state` 已有此语义）。

---

## 6. 实施切片

| 切片 | 内容 | 判据 |
| --- | --- | --- |
| **S1** | 快照追加字段 + 衰减/重评估的**纯函数**（`attenuate`）+ 单元 | `委托 ⊆ 快照 ⊆ 当前`；任一环被打破都能在纯函数层断言 |
| **S2** | `DelegationIssuer` 协议 + `KeycloakTokenExchangeIssuer` + `UnconfiguredIssuer`；续跑路径接线（`_context_from_delegation` 变 async） | 有 issuer 时续跑的 `user_token` 是**换来的短期令牌**；没有时为空且带拒绝原因 |
| **S3** | 零落库断言（全量快照搜索）+ 撤销用例 | token 串在库/检查点/审计/产出物里零命中；撤销后新委托不含被撤维度 |

**本 ADR 不做**（各自有归属，别在这里夹带）：

- MCP 共享 Client 的 `tenant_switch_enabled` 复核 → **`MP-MCP-TENANT-SECURITY-01`**（S2）。
  但 A-2 动了 MCP 协议面的取数路径，**动之前必须连带复核 B-10**（见 §8）。
- Admin DSN 移出运行 Pod → **`MP-RUNTIME-DB-POOL-01`**（2.1-B / B-4）。
- 连接池 → 同上（B-5）。
- 真正的多副本租约与心跳 → **`MP-RUN-LEASE-01`**（2.1-B / B-1）。

---

## 7. 验收标准

1. **重启续跑以用户身份通过上游**：续跑期间 llmgw / MCP 的调用带的是**换来的**短期令牌
   （不是服务身份、不是空）。
2. **权限撤销后不能扩权**：撤销用户的一个能力后再续跑，新一轮委托的包络**不含**该能力；
   撤空则签不出令牌，续跑 fail-closed（转待授权提案），**不退回服务身份**。
3. **原始 Bearer 零落库**：全量历史快照（库 + 检查点 + 审计 + 产出物）里搜不到发起令牌串。
4. **不假装**：没有 exchange 配置时，行为与 2.0 逐字一致，且拒绝原因是可读的。

---

## 8. 影响与边界

| 项 | 影响 |
| --- | --- |
| llmgw / MCP 协议面 | **取数路径改了**（令牌来源从"调用方令牌"扩到"调用方令牌或委托令牌"）。协议形状**不变**，无新 operationId |
| 契约 | 无新增 HTTP 面 → `REQUIREMENT-MATRIX.yaml` 不需要动（硬规则 #1 只对新增面生效） |
| 审计 | 委托的签发与拒绝都落审计行（硬规则 #9）：`decision` 记 `issued` / `denied`，`policy_version` 记口径版本 |
| **B-10 连带复核** | A-2 动 MCP 协议面取数 → **必须连带复核 `tenant_switch_enabled`**（2.0 的 B-10）。结论写进本批验收文件；不通过则按 `MP-MCP-TENANT-SECURITY-01` 的路线改专用 Client / Token Exchange |
| 密钥 | Keycloak client secret 仍走既有密钥通道（硬规则 #12），不进 git、不进日志 |

---

## 9. 备选方案

| 方案 | 为什么否 |
| --- | --- |
| **把用户令牌加密后落库，续跑解密** | 破 N1。密钥轮换/备份/日志三条路都会把明文漏出去；「加密」只是把风险挪到密钥管理上 |
| **续跑直接用服务身份** | 破 N4：链根从用户换成平台，ADR-0066 §3.3 作废；且服务身份没有 tenant claim，行为失真 |
| **自造签名服务（平台自己签短期令牌）** | 破「不自研」原则（用户 2026-09-16 定）：Keycloak 已在栈里，token exchange 是标准动作 |
| **让 llmgw / MCP 直接接受 per-run 派活授权当身份** | 等于把"授权"与"认证"混成一件事：授权是**我们**的判定，认证必须是 IdP 的。且要给两个上游各写一套新协议 |
| **长寿命委托令牌 + 撤销列表** | 撤销列表本身要落库、要广播，复杂度高于"短寿命 + 现签"；而 N3 的现签在 token exchange 下是零成本 |

---

## 10. 评审记录（2026-09-17）

**决议项的来源**（本 ADR 不新立设计，只把已定的事写清并落成接口）：

| # | 决议 | 依据 |
| --- | --- | --- |
| 1 | 不持久化原始 Bearer；用 `AuthorizationSnapshot` | 平台计划 §5.3 已定；1.9 已立的硬约束 |
| 2 | 由 IAM / Token Exchange 基于 Snapshot 重新签发短时委托令牌 | 平台计划 §5.3 原文 |
| 3 | MCP 使用独立 Client 或 Token Exchange，不让共享 Client 具备任意租户切换 | 平台计划 §5.3 原文（承接 2.0 的 B-10） |
| 4 | 优先用 Keycloak token exchange，不自造签名服务 | 平台计划 §6「复用既有能力，别自研」 |
| 5 | 本批只做 A-2 的 `DelegationIssuer` + 续跑接线；租约/连接池/Admin DSN 归 2.1-B | `2026-09-17-agent-product-layer-2.1-roadmap.md` §3、§5 依赖顺序 |

**签字位**：架构（`agent-product-layer` owner）／安全（`MP-MCP-TENANT-SECURITY-01` 的连带复核项，见 §8）。两处状态在 A-2 的验收文件里如实登记（做到哪、没做到哪）。

**与 ADR-0065 的关系**：无关。ADR-0065（页面上下文感知）**仍是 Proposed**，本 ADR 不引用也不升格它。

---

## 11. 参考

- `docs/active/specs/MetaPlatform-调整优化方案执行计划-2026-09-17.md` §5.3、§7 Sprint 2、§12 风险表（「委托身份设计不安全 → 极高」）
- `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3.1 B-1、§3.3 B-10
- `docs/active/decisions/ADR-0066-...md` §3.3（包络）/ §5.8（执行面）
- RFC 8693（OAuth 2.0 Token Exchange）
- 代码：`delegation.py`、`brain.py:233-267`、`wiring.py:318-393`
