# BUSINESS-SLICES 17 域接入进度（更新版）

> 版本：v1.2 · 2026-07-30
> 关联：ADR-0014 17 域集成模式
> 配套：docs/active/specs/2026-07-30-per-app-integration-checklist.md
> 本次更新：P2 wave 1 落地（ont — 唯一有包代码的 P2 域）

---

## 1. 进度总览（v1.2）

| P | 域 | 状态 | 5 步完成 | 接入 commit |
|---|---|---|---|---|
| **P0** | `kb` (mate-app-kb) | ✅ Done | 5 / 5 | 7fa52dc8 (TECH-SERVICES) |
| **P0** | `iam` (mate-tech-iam) | 🟡 Deprecated | n/a | 标记 deprecated |
| **P1** | `msg` (mate-tech-msg) | ✅ Done | 5 / 5 | 5f53524a |
| **P1** | `obs` (mate-tech-obs) | ✅ Done | 5 / 5 | 5f53524a |
| **P1** | `agent` (mate-tech-agent) | ✅ Done | 5 / 5 | b85d8c89 |
| **P1** | `llmgw` (mate-tech-llmgw) | ✅ Done | 5 / 5 | b85d8c89 |
| **P1** | `rag` (mate-tech-rag) | ✅ Done | 5 / 5 | 41bef84d |
| **P1** | `mcp` (mate-tech-mcp) | ✅ Done | 5 / 5 | 41bef84d |
| **P2** | `ont` (mate-tech-ont) | ✅ Done | 5 / 5 | (this batch) |
| P2 | `apphub` `arch` `copilot` `dashboard` `dw` `data` `a2a` `wfe` | ⏳ 需建包 | — | (8 域 OpenAPI 合约在,无包代码) |

**已接入**: 8 / 17
**P0 + P1 完成**: 8 / 8 ✅
**P2 待接入**: 8(需先建包代码)

---

## 2. 8 域 P2 wave 状态说明

8 个 P2 域(`apphub` / `arch` / `copilot` / `dashboard` / `dw` / `data` / `a2a` / `wfe`)的
OpenAPI service 合约在 `mate-platform-backend/contracts/openapi/services/`,**但代码包
尚未建立**(没有 `mate-platform-backend/packages/<app>-*/src/`)。

按 ADR-0014 5 步 checklist,这些域需先建包代码(类似 mate-app-kb 的 4 src files),
然后再套用 install_auth + require_tenant 5 步。

**后续 sub-batch 计划**:
- `apphub` `arch` `copilot` `dashboard`: 业务侧 batch 1
- `dw` `data`: 数据应用 batch 2(可与 DATA-D0-D8 D1 同步)
- `a2a` `wfe`: 协议 / 引擎侧 batch 3

每 4 域 1 sub-batch,沿用本次模式(charts + tests + acceptance)。

---

## 3. 累计测试

| Suite | Pass |
|---|---|
| mate-platform | 117 |
| mate-app-kb | 12 |
| mate-tech-ont | 7 (new) |
| 之前 P1 (msg, obs, agent, llmgw, rag, mcp) | 7 × 6 = 42 |
| infra (PLATFORM-K8S-01 + GA) | 152 |
| **Total on main** | **330+** |