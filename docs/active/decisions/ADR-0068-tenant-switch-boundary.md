# ADR-0068：租户切换边界收口 —— 专用 runtime client 摘除共享 client 的越权面

> **状态**：Accepted（2026-09-18）
> **日期**：2026-09-18
> **作者**：Claude（Agent 产品层 2.1 closeout 批）
> **关联 ADR**：ADR-0067（运行期委托身份，本 ADR 的**基础**——优先级序列的 第一位）、
> ADR-0062（MCP 长期 API Key，`sk-mcp-*` 路径是本 ADR 改动的既有消费方）、
> ADR-0011（SEC-IAM-01 服务身份）、ADR-0012（SEC-TENANT-01 五层隔离）
> **关联硬规则**：硬规则 3（无 tenant 上下文不访问 repository）、硬规则 4（外部系统有 ACL
> Client）、硬规则 9（审计/指标/trace）、硬规则 12（Secret 不进 git）
> **关联批次**：`MP-MCP-TENANT-SECURITY-01`（平台 S2）+ Agent 产品层 2.1 closeout
> **触发**：2.0 边界 B-10 立的复核条件 + 2.1-C §3-A4 的**生产形态实证**——接管成功后续跑的
> llmgw 调用被 `403 tenant binding rejected … tenant switching is not enabled` 拒掉。

---

## 1. 背景

### 1.1 现状（逐条核到代码 / realm）

| # | 事实 | 位置 |
| --- | --- | --- |
| 1 | `tenant_switch_enabled` 是 realm 级 client scope，链接在**共享** client `metaplatform-backend` 的 `optionalClientScopes` 上 | `infra/keycloak/realm-mate.json` |
| 2 | **代价（B-10 原文）**：任何持有该共享密钥的服务，只要显式申请这个 scope，就能代任意租户行事——全部 19+ 服务与每个本地开发者都持有这把密钥 | 2.0 边界表 B-10 |
| 3 | 今天真实用它的是 MCP 的本体代理：`sk-mcp-*` 调用方没有用户 token 可透传，MCP 用共享 client 凭据申请该 scope 后以 `X-Tenant-Id` 代指名租户 | `mate_tech_mcp/tools/ontology_proxy.py:103-150` |
| 4 | agent-team 的 LLM 网关客户端在**没有用户令牌**时（无令牌起跑 / 接管后续跑且委托身份签不出）退回服务身份 + `X-Tenant-Id`——服务 token 没有 tenant claim，两头必不相等，llmgw 的租户绑定守卫**必然 403** | `mate_clients/llmgw/client.py` + `mate_platform/auth/tenant.py` |
| 5 | 403 的守卫**是对的**：它挡的正是"持服务密钥者指名别人的租户"。错的是客户端在拿共享密钥去撞一条守卫明确要拒绝的路 | 2.1-C §5.7 实测 |
| 6 | 2.1-A 的 A-2 已实现 token exchange 签发面（ADR-0067 全套），但 Keycloak 侧未配该 client 的 exchange 权限（未收尾清单 E2）——**"续跑以用户身份过上游"在本环境签不出令牌** | `delegated_identity.py` / E2 |

### 1.2 要同时成立的两件事

1. **「接管 → 续跑到底」**（2.1 closeout 的 GOAL）：接管后恢复出来的调用要能过 llmgw / MCP /
   provider 配置取数，跑完这一轮。
2. **「共享密钥不能代任意租户」**（B-10 的负例）：收口后，持有共享密钥者**申请不到**
   `tenant_switch_enabled`。

这两件事在当前结构下互相顶死：修 1 不能靠给共享 client 发 scope（那就毁了 2）；修 2 直接
掐断 MCP 既有路径与 agent-team 的服务身份回退路。

---

## 2. 决策

**一句话**：把"代租户行事"的能力从**共享** client 上摘下来，发给**两个专用** client；
agent-team 的上游身份按 **委托身份（ADR-0067）→ 专用 runtime client → 如实失败** 的顺序取。

| # | 决策 | 内容 |
| --- | --- | --- |
| **D1** | **共享 client 摘除切换 scope** | `metaplatform-backend` 的 `optionalClientScopes` 不再链接 `tenant_switch_enabled`。此后持共享密钥者申请该 scope 拿不到（token 的 `scope` claim 里没有），所有装了 `mate_platform.auth` 守卫的服务（llmgw / MCP / ONT / 网关…）对"共享密钥 + X-Tenant-Id"一律 403 |
| **D2** | **两个专用 client，各自持密** | `mcp-tenant-proxy`（MCP 本体代理的代租户跳）与 `agent-team-runtime`（agent-team 无用户令牌时的上游跳）。`tenant_switch_enabled` 是它们的 **defaultClientScope**（不需要显式申请）；两者都带 `aud=metaplatform-backend` 的 audience mapper（下游校验不变）。密钥只进各自服务的 Secret / env，**不与任何其它服务共享** |
| **D3** | **身份优先级序列（agent-team）** | ① `user_token`（请求带来的用户令牌，或 ADR-0067 换来的委托令牌——配置了 exchange 的部署仍然是**第一位**）；② 委托签不出时才用 `agent-team-runtime`（带切换 scope，绑定本轮 `ctx.tenant_id`）；③ 没配 runtime client 的部署保持 2.1-C 之前的形态（服务身份撞 403，如实失败）。**永远不**拿 runtime client 冒充用户：它的 `sub` 是服务账号，llmgw 计量按 service 身份 + 切换租户记录，与用户可区分 |
| **D4** | **MCP 既有路径同步迁移** | `sk-mcp-*` → ONT 的代租户跳从共享 client 改指 `mcp-tenant-proxy`（`TECH_ONT_CLIENT_ID` / `TECH_ONT_TOKEN` 换新值）。**与 D1 同一批落地**——先摘 scope后换 client 会让这条路径静默断掉 |
| **D5** | **存量栈的迁移通道** | 运行中的 Keycloak 不会重导 realm JSON（import 只发生在 realm 首建），交付幂等的 `scripts/keycloak/apply_tenant_boundary.py`（Admin API：建两个专用 client + 链 scope + 摘共享 client 的 optional 链接）。新栈直接走 realm import |

### 2.1 为什么这样切（与 B-10 三个候选的对位）

| 候选 | 结论 |
| --- | --- |
| ② token exchange 短时令牌 | **身份上的正解**（ADR-0067 全套已在），但它要 Keycloak 侧配 exchange 权限——那是环境条件（未收尾清单 E2），本批无法靠它闭环"续跑到底"。**保留为第一优先级**：配好的部署自动回到"以用户身份过上游" |
| ① 专用 client + Secret | **本批采纳**（D2/D4）。它把"能代任意租户"的密钥持有面从"19+ 服务 + 所有本地开发者"收窄到"两个服务的 Secret"。残差风险（这两个 secret 本身仍可代任意租户）在 §4 如实登记 |
| ③ 维持共享 client | 否——负例（§1.2-2）不成立，B-10 的复核结论就是"不通过" |

### 2.2 明确不做的

- **不给共享 client 的服务账号补 tenant 属性**：那会把服务令牌绑死在单一租户上，
  多租户调用全部变成"换了种形态的 403"，且改的是全体服务的令牌语义。
- **不在 llmgw / MCP 侧放松守卫**：`resolve_tenant` 的两条拒绝（无 scope / 有 scope 才许切换）
  一行不动。本 ADR 只动**谁拿得到 scope**，不动**守卫怎么判**。
- **不给 runtime client 配 token exchange 权限**：那是 ② 的轨道（E2），配好时走的也是
  ADR-0067 的委托身份，不需要 runtime client 参与。

---

## 3. 不变量

| # | 不变量 | 判定方式 |
| --- | --- | --- |
| **N1** | **共享密钥申请不到切换 scope** | 以共享 client 凭据请求 `scope=openid tenant_switch_enabled`，token 的 `scope` claim 里没有它；带 `X-Tenant-Id` 调 llmgw → 403 |
| **N2** | **切换 scope 只在两个专用 client 上** | realm 结构断言：`metaplatform-backend` 的 default/optional scopes 均不含它；两个专用 client 的 defaultClientScopes 含它 |
| **N3** | **runtime client 不冒充用户** | 用它过 llmgw 时 `auth_method=service`、`sub=service-account-agent-team-runtime`、`tenant_switched=true`——计量与审计里可与用户调用区分；agent-team 侧委托审计行如实记 `denied` + 原因 |
| **N4** | **用户令牌永远优先** | 有 `user_token`（含换来的委托令牌）时，runtime client 完全不参与（`auth=` 只在 `user_token` 为空时生效） |

---

## 4. 影响与残差风险

| 项 | 影响 |
| --- | --- |
| llmgw / MCP / ONT 守卫 | **零改动**（见 2.2）。对它们来说只是"能通过切换判的令牌变少了、且来自两个已知 client" |
| agent-team 接管续跑 | 委托签不出时上游调用以 `agent-team-runtime` 身份过（租户 = 本轮 `ctx.tenant_id`，来自检查点，受 RLS 约束的那一份）——「接管 → 续跑到底」在**未配 exchange 的环境**也成立 |
| MCP `sk-mcp-*` → ONT | 改用 `mcp-tenant-proxy`，行为不变（代调用方指名租户） |
| **残差风险 1** | 持有 `agent-team-runtime` / `mcp-tenant-proxy` 任一 secret 者仍可代任意租户——收窄的是**持有面**（各一个服务的 Secret），不是能力本身。缓解：secret 不进 git（硬规则 12）、不与其它服务共享、llmgw 计量按 service+switched 可审计 |
| **残差风险 2** | agent-team 容器被攻破 = 拿到 runtime secret。这与"被攻破 = 拿到共享 secret（更糟，19+ 服务同把）"相比是单向收窄；彻底消除要等 ②（exchange）在所有环境铺开 |
| 审计 | 委托审计行（`AUDIT_DELEGATION`）在 fallback 时仍记 `denied` + 原因（N3）；llmgw 侧每次调用按其计量面记录租户与身份类别 |

---

## 5. 实施切片（closeout 批）

| 切片 | 内容 | 判据 |
| --- | --- | --- |
| **S1** | realm-mate.json：摘 `metaplatform-backend.optionalClientScopes`；建 `mcp-tenant-proxy` / `agent-team-runtime`（service account + audience mapper + defaultClientScopes=[tenant_switch_enabled]） | realm 结构断言（N1/N2） |
| **S2** | `scripts/keycloak/apply_tenant_boundary.py`：对运行中 Keycloak 幂等应用 S1 | 对活栈跑两遍，第二遍零变更 |
| **S3** | agent-team wiring：`_runtime_bearer()`（envs `MATE_AGENT_TEAM_RUNTIME_CLIENT_ID/SECRET`，配一半启动失败）；无 `user_token` 时 llmgw / MCP 工具 / provider 取数三处改用 runtime 身份 | 单测：三处出站构造；`user_token` 存在时 runtime 完全不参与（N4） |
| **S4** | compose / chart：MCP 两 env 换新 client；agent-team chart 的 secretRef 增 `runtimeClientSecret` 键；两个 kind 脚本随迁 | 多副本脚本在活栈上重跑通过 |
| **S5** | ⑧ 复跑（§5.7 脚本）：接管后续跑**到底**（不再 403） | run 终态 `completed`；负例（共享密钥 + X-Tenant-Id → 403）同场可验 |

---

## 6. 验收标准

1. ⑧：pod-kill 接管后 run 跑到终态 `completed`，llmgw 全程无 403；
2. 负例：共享 client 凭据 + `X-Tenant-Id=别的租户` 调 llmgw → 403（scope 申请不到）；
3. realm 结构：N1/N2 的静态断言进测试；
4. MCP `sk-mcp-*` 路径在换 client 后行为不变（回归用例）。

---

## 7. 参考

- `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.1-C-ACCEPTANCE.md` §3-A4 / §5.7（实证输入）
- `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3.3 B-10（三个候选）
- `docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.1-OPEN-ITEMS.md` §1（最优先登记）
- `docs/active/specs/2026-09-16-agent-product-layer-env-facts.md` §3（服务 token 无 tenant claim / iss 实测）
- RFC 8693（OAuth 2.0 Token Exchange；② 轨道的协议基础）
