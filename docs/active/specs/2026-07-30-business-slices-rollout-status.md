# BUSINESS-SLICES 17 域接入进度(更新版)

> 版本:v1.3 · 2026-07-31
> 关联:ADR-0014 17 域集成模式
> 配套:`docs/active/specs/2026-07-30-per-app-integration-checklist.md`
> 配套:`docs/active/specs/2026-07-31-features-backlog.md` v1.1(功能维度盘点)
> 配套:`docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.1(接口维度详单)
> 本次更新:P0-CLOSE(7/30 收尾)+ P2-W2(7/31)落地 4 域,17 域进度 8/17 → 11/17

---

## 1. 进度总览(v1.3)

| P | 域 | 状态 | 5 步完成 | 接入 commit / 证据 |
|---|---|---|---|---|
| **P0** | `kb` (mate-app-kb) | ✅ Done | 5 / 5 | 7fa52dc8 (TECH-SERVICES) + P0-CLOSE PR#1(路径对齐) |
| **P0** | `iam` (mate-tech-iam) | 🟡 Deprecated | n/a | 标记 deprecated;admin + dashboard 仍在用 |
| **P1** | `msg` (mate-tech-msg) | ✅ Done | 5 / 5 | 5f53524a |
| **P1** | `obs` (mate-tech-obs) | ✅ Done | 5 / 5 | 5f53524a |
| **P1** | `agent` (mate-tech-agent) | ✅ Done | 5 / 5 | b85d8c89 |
| **P1** | `llmgw` (mate-tech-llmgw) | ✅ Done | 5 / 5 | b85d8c89 + P0-CLOSE PR#2(路径对齐) |
| **P1** | `rag` (mate-tech-rag) | ✅ Done | 5 / 5 | 41bef84d |
| **P1** | `mcp` (mate-tech-mcp) | ✅ Done | 5 / 5 | 41bef84d + P0-CLOSE PR#3(main.py 修复 + 5 endpoint 真正挂载) |
| **P2** | `ont` (mate-tech-ont) | ✅ Done | 5 / 5 | (上批) |
| **P2** | `dashboard` (mate-tech-iam) | ✅ Done | 5 / 5 | P2-W2 PR#11(7/31):9 个 PUT 补齐 + OutboxWriter 真实集成 |
| **P2** | `apphub` (mate-app-hub) | ✅ Done | 5 / 5 | P2-W2 PR#12(7/31):新建包 + 5 endpoint + in-memory 仓库 |
| **P2** | `arch` (mate-app-arch) | 🟡 27/29 | 5 / 5 | P2-W2 PR#13(7/31):新建包 + 27 endpoint + BFS 影响分析;**剩 2 endpoint 待补** |
| **P2** | `copilot` (mate-app-copilot) | 🟡 32/35 | 5 / 5 | P2-W2 PR#14(7/31):新建包 + 32 endpoint + SQL/代码/NLQ/调度/Action;**剩 3 endpoint + A2A 真实 + LLM 真实 stub** |
| P2 | `dw` | ⏳ 待建包 | — | 15 GET endpoint |
| P2 | `data / etl / metrics / scheduler` | ⏳ 数据平台控制面挂载 | — | DATA-D0-D8 已落地,30 endpoint 待挂 |
| P2 | `a2a` | 🟡 部分 | — | `/api/v1/a2a/*` 2 endpoint 独立未做;`copilot/a2a/*` 已 stub |
| P2 | `wfe` | ⏳ 待建包 | — | 2 endpoint |

**已接入**: 11 / 17
**5 步完整合规**: 9 / 17(kb/msg/obs/agent/llmgw/rag/mcp/ont/dashboard;apphub/arch/copilot 是 P2-W2 接合规,但 arch/copilot 仍有 endpoint 待补)
**P2 待接入 / 补齐**: 6 域(dw / data / etl / metrics / scheduler / wfe)+ arch 2 endpoint + copilot 3 endpoint + a2a 2 endpoint

---

## 2. 7/31 P2-W2 落地详情

| 域 | PR | endpoint | 代码 | 测试 |
|---|---|---|---|---|
| dashboard | PR#11 | 38(29→38) | mate-tech-iam/api/dashboard.py install_auth + JWT iss/aud 统一 + InMemoryOutboxWriter | 6 happy-path + 5 tenant |
| apphub | PR#12 | 5 | 新建 `packages/mate-app-hub/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`) | 9(in-memory 种子 + 4 tenant)|
| arch | PR#13 | 27 | 新建 `packages/mate-app-arch/`(同上结构 + BFS 影响分析) | 9 + 4 tenant |
| copilot | PR#14 | 32(27 GET + 5 POST 含 SQL Copilot / 代码 / NLQ / 调度 / Action / 多模态) | 新建 `packages/mate-app-copilot/`(同上 + `llm/stub_provider.py` + sqlparse) | 13 + 5 tenant(含 a2a 501) |
| **Σ** | 4 | **99+ 净增** | **~6,200 行** | **93 passed, 0 failed** |

---

## 3. 8 域 P2 wave 状态(7/31)

| 域 | 包代码 | HTTP 路由 | 5 步合规 | 备注 |
|---|---|---|---|---|
| `apphub` | ✅ | ✅ 5/5 | ✅ | P2-W2 完整 |
| `arch` | ✅ | 🟡 27/29 | ✅ | P2-W2 落地;2 endpoint 待补 |
| `copilot` | ✅ | 🟡 32/35 | ✅ | P2-W2 落地;3 endpoint + A2A + LLM 真实 stub 待 P2-W3 / P2-W5 |
| `dashboard` | ✅ | ✅ 38/38 | ✅ | P2-W2 完整 |
| `dw` | ⏳ | 🔴 | ⏳ | 15 GET;待 P1 启动 |
| `data` | 🟡 模块在 | 🔴 HTTP 未挂 | ⏳ | DATA-D0-D8 落地;待数据平台控制面挂载 |
| `etl / metrics / scheduler` | 🟡 模块在 | 🔴 HTTP 未挂 | ⏳ | 同上 |
| `a2a` | ⏳ | 🔴 独立域 | ⏳ | copilot 内 stub 501;独立包待 P2-W3 |
| `wfe` | ⏳ | 🔴 | ⏳ | 2 endpoint;待 P2 启动 |

**后续 sub-batch 计划**:
- `P2-W3`:**arch 补 2 + copilot 补 3 + a2a 真实** + TD-1~TD-3 技术债
- `P2-W4`:`dw` 15 endpoint(新建 `mate-tech-dw`)+ `wfe` 2 endpoint(新建 `mate-app-wfe`)+ TD-4(TenantAccessError 400)
- `P2-W5`:`data / etl / metrics / scheduler` 30 endpoint 挂 DATA-D0-D8 + TD-6(LLM provider 真实)+ TD-5(in-memory → PG)
- `P2-W6`:A2A / LLM 真实接入 + 13 硬规则最终收口

每 4 域 1 sub-batch,沿用本次模式(charts + tests + acceptance)。

---

## 4. 累计测试(7/31)

| Suite | Pass |
|---|---|
| mate-platform | 117 |
| mate-app-kb | 12 + 10(path-alias,P0-CLOSE) |
| mate-tech-msg | 7 |
| mate-tech-obs | 7 |
| mate-tech-agent | 7 |
| mate-tech-llmgw | 7 + 7(path-alias,P0-CLOSE) |
| mate-tech-rag | 7 |
| mate-tech-mcp | 7 + 7(http,P0-CLOSE) |
| mate-tech-ont | 7 |
| mate-app-hub | 9(P2-W2 新) |
| mate-app-arch | 9(P2-W2 新) |
| mate-app-copilot | 13(P2-W2 新) |
| mate-tech-iam(dashboard) | 62 dashboard tests(P2-W2 新) |
| infra (PLATFORM-K8S-01 + GA) | 152 |
| **Total on main** | **440+**(从 330+ → 440+) |

---

## 5. 关联文档

- `docs/active/specs/2026-07-31-features-backlog.md` v1.1 — 功能维度盘点
- `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.1 — 接口维度详单
- `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` v1.3 — 主 Roadmap(附录 B)
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md`(7/30 收尾)
- `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`(7/31 主推进)
- `docs/active/decisions/ADR-0014-tech-services-integration.md`

---

## 6. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | v1.0 初版(8/17 已接入) | TRAE 盘点 |
| 2026-07-30 | v1.1 P1 wave 1(msg + obs) | TRAE 盘点 |
| 2026-07-30 | v1.2 P2 wave 1(ont,唯一有包代码的 P2 域) | TRAE 盘点 |
| **2026-07-31** | **v1.3**:**P0-CLOSE + P2-W2 落地**:11/17 接入;新增 4 域(arch/copilot/dashboard/apphub)已建包;累计测试 440+ | TRAE 盘点 |