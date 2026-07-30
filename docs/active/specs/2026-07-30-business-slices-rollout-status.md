# BUSINESS-SLICES 17 域接入进度（更新版）

> 版本：v1.1 · 2026-07-30
> 关联：ADR-0014 17 域集成模式
> 配套：docs/active/specs/2026-07-30-per-app-integration-checklist.md
> 本次更新：P1 wave 1 + wave 2 落地（msg / obs / agent / llmgw）

---

## 1. 进度总览（v1.1）

| P | 域 | 状态 | 5 步完成 | 接入 commit |
|---|---|---|---|---|
| **P0** | `kb` (mate-app-kb) | ✅ Done | 5 / 5 | 7fa52dc8 (TECH-SERVICES) |
| **P0** | `iam` (mate-tech-iam) | 🟡 Deprecated | n/a | 标记 deprecated,生产 profile 拒绝加载 |
| **P1** | `msg` (mate-tech-msg) | ✅ Done | 5 / 5 | 5f53524a (BUSINESS-SLICES wave 1) |
| **P1** | `obs` (mate-tech-obs) | ✅ Done | 5 / 5 | 5f53524a (BUSINESS-SLICES wave 1) |
| **P1** | `agent` (mate-tech-agent) | ✅ Done | 5 / 5 | b85d8c89 (BUSINESS-SLICES wave 2) |
| **P1** | `llmgw` (mate-tech-llmgw) | ✅ Done | 5 / 5 | b85d8c89 (BUSINESS-SLICES wave 2) |
| **P1** | `rag` (mate-tech-rag) | ⏳ Queued | 0 / 5 | — |
| **P1** | `mcp` (mate-tech-mcp) | ⏳ Queued | 0 / 5 | — |
| P2 | `apphub` | ⏳ Queued | 0 / 5 | — |
| P2 | `arch` | ⏳ Queued | 0 / 5 | — |
| P2 | `copilot` | ⏳ Queued | 0 / 5 | — |
| P2 | `dashboard` | ⏳ Queued | 0 / 5 | — |
| P2 | `dw` | ⏳ Queued | 0 / 5 | — |
| P2 | `data` | ⏳ Queued | 0 / 5 | — |
| P2 | `a2a` | ⏳ Queued | 0 / 5 | — |
| P2 | `ont` (mate-tech-ont) | ⏳ Queued | 0 / 5 | — |
| P2 | `wfe` | ⏳ Queued | 0 / 5 | — |

**已接入**: 5 / 17（kb + msg + obs + agent + llmgw）
**P1 完成**: 5 / 5（msg / obs / agent / llmgw / kb）— 剩 rag + mcp
**P2 完成**: 0 / 9

---

## 2. 累计测试

| Suite | Pass | 备注 |
|---|---|---|
| mate-platform | 117 | SEC-IAM-01 + SEC-TENANT-01 + PLATFORM-EVENT-01 |
| mate-app-kb | 12 | canonical |
| mate-tech-agent | 7 (new) + 24/26 (existing) | 2 pre-existing test 期望 200,实际 401(已上 auth,正确) |
| mate-tech-llmgw | 7 (new) | 无 pre-existing 干扰 |
| infra | 122 | PLATFORM-K8S-01 |
| **Total on main** | **265+ pass** | |

---

## 3. 基础设施修复(本批)

`mate-platform-backend/tests/conftest.py` 之前只加 `mate-common` + `mate-tech-rag`
到 sys.path。其他包(msg / obs / agent / llmgw / mcp / ont / app-kb)的
`tests/conftest.py` 跑 pytest 时会因找不到 `mate_tech_*` 报错。

本批给每个受影响的 conftest 加上：
```python
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in ("<pkg>", "mate-platform", "mate-clients", "mate-common"):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
```

无需 `pip install -e .`,pytest 直接可跑。

---

## 4. 后续接入顺序

| 顺序 | 域 | 原因 |
|---|---|---|
| 6 | `rag` (P1) | 29 src files,数据流最重,KB / agent 已用 |
| 7 | `mcp` (P1) | 20 src files,工具较少,适合快速接入 |
| 8 | `apphub` (P2) | 业务应用中心 |
| 9 | `arch` (P2) | 架构中心 |
| 10 | `copilot` (P2) | AI 助手 |
| 11 | `dashboard` (P2) | 工作台 |
| 12 | `dw` (P2) | 数字员工 |
| 13 | `data` (P2) | 数据应用 |
| 14 | `a2a` (P2) | 协议 |
| 15 | `ont` (P2) | 本体引擎 |
| 16 | `wfe` (P2) | 工作流引擎 |