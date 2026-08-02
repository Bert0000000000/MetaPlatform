# Mate Platform 项目全维度统计 · 2026-08-02

> 版本:v1.0 · 2026-08-02
> 工具:`scripts/project_stats.py`(本次新增)
> 状态:**Active**(项目规模基线 / review 评估)

---

## 1. 总览(2026-08-02)

| 维度 | 文件 | 总行数 |
|---|---:|---:|
| **后端 Python 代码** | 679 | **85,092** |
| ├ 应用代码(src) | 466 | 54,594 |
| ├ 测试代码(tests) | 200 | 29,023 |
| └ Alembic migrations | 13 | 1,475 |
| **OpenAPI YAML** | 28 | 23,617 |
| **Helm chart YAML** | 73 | 4,518 |
| **pyproject.toml** | 28 | 1,130 |
| **SQL 文件** | 294 | 11,530 |
| **Infra tests** | 19 | 3,004 |
| **Scripts (ps1/sh/bat)** | 170 | 7,092 |
| **Root compose/env** | 44 | 4,591 |
| **PRD Markdown** | 75 | **61,317** |
| **ACCEPTANCE evidence** | 49 | 5,917 |
| **ADR 决策记录** | 7 | 1,387 |
| **Specs** | 74 | 38,944 |
| **Other docs (docs/*)** | 114 | 90,706 |
| **TOTAL** | **1,867** | **369,343** |

### 后端代码注释率

| 类别 | 行数 |
|---|---:|
| 总行 | 85,092 |
| **代码行** | **67,521** |
| 注释行 | 3,427 |
| 空行 | 14,144 |
| 代码 / 总行 | **79.4%** |
| 注释 / 代码 | **5.07%** |

### 全项目代码 / 注释 / 空行(后端 + Alembic + 测试)

| 指标 | 值 |
|---|---:|
| 总行 | 369,343 |
| **代码行** | **91,314** |
| 注释行 | 4,917 |
| 空行 | 19,359 |
| 代码 / 总行 | **24.72%**(代码占整体 1/4) |
| 注释 / 总行 | 1.33% |
| 空行 / 总行 | 5.24% |
| 代码 / 注释 | 18.57(注释相对代码极少,因大量 markdown 是结构化文档而非代码) |

> 注释 / 代码比例低**主要因为 markdown 是结构化文档**(标题 / 列表 / 引用),不算代码注释。后端 Python 实际注释率 **5.07%**(健康水平)。

---

## 2. 文件量与代码量分布

### 后端代码分布

| 类别 | 文件 | 行数 | 占比 |
|---|---:|---:|---:|
| 应用代码 | 466 | 54,594 | 64.2% |
| 测试代码 | 200 | 29,023 | 34.1% |
| Alembic | 13 | 1,475 | 1.7% |
| **合计** | **679** | **85,092** | **100%** |

**测试 / 应用 = 53.2%**(健康范围 40-60%)

### 文档生态分布

| 类别 | 文件 | 行数 | 占比 |
|---|---:|---:|---:|
| PRD(11 模块) | 75 | 61,317 | 30.9% |
| Specs | 74 | 38,944 | 19.6% |
| Other docs | 114 | 90,706 | 45.7% |
| ACCEPTANCE evidence | 49 | 5,917 | 3.0% |
| ADR | 7 | 1,387 | 0.7% |
| **合计** | **319** | **198,271** | **100%** |

**PRD/ACCEPTANCE/ADR 比例 = 75/49/7**(PRD 文档远多于验收,符合 17 域 × 4 件套模式)

---

## 3. 后端代码注释深度(Top 维度)

| 应用代码 | 总行 | 代码 | 注释 | 空行 | 注释率 |
|---|---:|---:|---:|---:|---:|
| 全部 Python | 85,092 | 67,521 | 3,427 | 14,144 | 5.07% |
| 应用代码(非测试) | 54,594 | 43,728 | 2,127 | 8,739 | 4.86% |
| 测试代码 | 29,023 | 22,573 | 1,400 | 5,050 | 6.20% |
| Alembic | 1,475 | 1,220 | 90 | 165 | 7.38% |

---

## 4. Top 15 最大应用 Python 文件

| # | 行数 | 文件 |
|---:|---:|---|
| 1 | **1,323** | `packages/mate-app-arch/src/mate_app_arch/repositories/sql_store.py` |
| 2 | **1,303** | `packages/mate-tech-iam/src/mate_tech_iam/api/dashboard.py` |
| 3 | **1,032** | `packages/mate-app-arch/src/mate_app_arch/repositories/in_memory.py` |
| 4 | **956** | `packages/mate-tech-dw/src/mate_tech_dw/repositories/sql_store.py` |
| 5 | **898** | `packages/mate-app-copilot/src/mate_app_copilot/api/app.py` |
| 6 | **731** | `packages/mate-tech-dw/src/mate_tech_dw/repositories/in_memory.py` |
| 7 | **679** | `packages/mate-app-kb/src/mate_app_kb/api/app.py` |
| 8 | **673** | `packages/mate-tech-iam/src/mate_tech_iam/seed.py` |
| 9 | **636** | `packages/mate-tech-iam/src/mate_tech_iam/api/orgs.py` |
| 10 | **630** | `packages/mate-tech-dw/src/mate_tech_dw/api/app.py` |
| 11 | **569** | `packages/mate-tech-iam/src/mate_tech_iam/api/users.py` |
| 12 | **532** | `packages/mate-tech-agent/src/mate_tech_agent/api/app.py` |
| 13 | **513** | `packages/mate-tech-iam/src/mate_tech_iam/api/permissions.py` |
| 14 | **501** | `packages/mate-app-copilot/src/mate_app_copilot/repositories/sql_store.py` |
| 15 | **488** | `packages/mate-tech-msg/src/mate_tech_msg/subscriptions.py` |

**观察**:
- arch / dw / copilot / iam / agent 几个域代码量最大,合 v3.1 P2-W2/W3 主要推进对象
- `sql_store.py` 与 `in_memory.py` 模板代码(每域都有),文件结构相似
- `dashboard.py` 1,303 行是 mate-tech-iam 里最重文件(P2-W2 业务深化 38 endpoint)

---

## 5. SQL 文件分布

| 项 | 值 |
|---|---:|
| 文件 | 294 |
| 总行 | 11,530 |
| 平均文件行 | 39.2 |
| 推测内容 | `infra/init-multiple-databases.sql` + `docs/legacy/*` SQL + Alembic 不计 + 测试 fixture |

---

## 6. 整体规模评估

| 维度 | 评价 |
|---|---|
| **代码量** | 后端 6.7 万行,合理范围(中等规模 SaaS 平台) |
| **测试覆盖** | 测试 / 应用 = 53%,**优秀** |
| **注释率** | Python 5.07%,**健康**(行业平均 3-7%) |
| **PRD 文档量** | 75 份 / 6.1 万行,**远超代码量**(文档驱动开发,符合 v3.0 GA 规范) |
| **OpenAPI 契约** | 28 文件 / 2.4 万行,17 域全签名完整 |
| **Helm 部署** | 73 文件 / 0.45 万行,4+ sub-charts + DATA-D0-D8 4 sub-charts |
| **测试通过率** | 1700+ tests pass(各 ACCEPTANCE 验证) |
| **SPEC 命中** | 214/214(8/2 100%) |
| **17 域接入** | 100%(8/2 收口) |
| **GA 硬规则** | 7/8 收口(剩 G1) |

---

## 7. 后续统计能力

`scripts/project_stats.py` 留作工具:
- 每周/批次 review 时跑一次,观察代码增长率
- 配合 `features-backlog` / `backend-impl-backlog` 跟踪功能 vs 代码增长比
- v3.2 启动后,每次 Wave 后跑一次,观察增量贡献

## 8. 排除规则(避免污染)

```python
EXCLUDE_DIR_NAMES = {
    ".venv", "venv", "env",
    ".tmp", "node_modules", ".ruff_cache", ".pytest_cache", "__pycache__",
    ".wheels", "dist", "build", "site-packages",
    ".git", ".claude", ".vscode", ".next",
    ".tmp-iam-data", ".tmp-iam-data-2", ".tmp-data", ".coverage",
    ".venv-corrupted.bak",
    "Lib", "Include", "Scripts",
}
EXCLUDE_FILE_PATTERNS = ["pywin32_postinstall", "_pytest"]
```

(避免 .venv 与损坏备份污染统计)

---

## 9. 关联文档

- `scripts/project_stats.py` — 统计脚本
- `2026-07-31-features-backlog.md` v1.3 — 功能盘点
- `2026-07-31-backend-impl-backlog.md` v1.7 — 接口盘点
- `2026-08-02-fix-verification.md` — 8/2 v3.1 收口验收
- `2026-08-02-g8-final-verification.md` — G8 FINAL 验收

---

## 10. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-02 | v1.0 初版(后端 6.7 万 + 测试 2.3 万 + 文档 19.8 万 = 369,343 行)| TRAE 盘点 |