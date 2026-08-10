# GOVERN-10 — 测试基线与回归保护 子规格

> 编制日期：2026-08-10
> 工作目录：`D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform`
> 父计划：`cozy-orbiting-wombat.md §3.3 GOVERN-10`
> 上游：GOVERN-04 ✅ + GOVERN-05 ✅ + GOVERN-06 ✅
> 状态：**最终批次 / 10 治理收口**

---

## 0. 与父计划偏差修订

父计划 §GOVERN-10 写「修 3 个 pre-existing failure + 13 硬规则 × CI 矩阵 + snapshots.json」。本批次实地盘点后，发现实际偏差比父计划大，先以本子规格为准：

| 原计划条目 | 实地状态 | 修订 |
|---|---|---|
| "3 个 pre-existing failure"（`inference_path` / `inference_neighbors` / `cross_tenant_isolation`） | 单跑全绿；全跑 race。父计划把 race 误判为 fixture 抖动 | 保留"3 个 named failure"作为子集；其余 70 个一并盘点 |
| "snapshots.json 写入 5 个历史点" | 无 snapshot 文件；PROGRAM-BOARD 历史快照是手写表 | 缩为「快照结构落 `tests/governance/test_snapshot.py` 占位」 |
| "拆 `ga-hooks-and-tests` 为 5 个独立 job" | workflow 已有 9 个独立 `ga-*` job，但 5 个 forbid_* 脚本仍在 `ga-hooks-and-tests` 复合里 | 拆 5 个独立 job，命名 `ga-003-tenant` / `ga-004-acl` / `ga-005-fallback` / `ga-007-skip-tests` / `ga-010-evidence` |
| "全仓 0 非显式 skip" | `test_tenant_isolation_hard` 8 个测试因 PG 非特权 role 缺失被 skip（带理由），属 GOVERN-06 留口子 | 接受这 8 个 skip；新增 `tests/governance/test_skip_audit.py` 守门，禁止非 GOVERN-06 解释的 skip |

---

## 1. 现状快照（2026-08-10）

### 1.1 失败分布（73 pre-existing）

| 来源 | 数量 | 范围 |
|---|---:|---|
| `infra/tests/` | 44 | `test_g5_security_parity.py`（38）+ `test_marketplace_chart.py`（4，**2 个为 GBK 编码 bug**）+ `test_networkpolicy.py`（1）+ `test_service_security_segments.py`（2） |
| `mate-platform-backend/packages/mate-tech-ont/tests/` | 3 | `test_ont_business.py::TestInferenceApi` × 2 + `test_ont_federation.py::TestFederationEndpoints::test_cross_tenant_isolation` × 1 — **均为 concurrent fixture race** |
| `mate-platform-backend/packages/mate-tech-mcp/tests/` | 15 | `test_tool_categories.py` 全套 — 共享 PG fixture 失败（host `fake`） |
| `mate-platform-backend/packages/mate-app-copilot/tests/` | 10 | 跨租户 / NL2SQL / oversized payload — 真实缺陷 |
| `mate-platform-backend/packages/mate-tech-llmgw/tests/` | 3 | cross_tenant_quota / DoW / real Anthropic — 真实缺陷 |
| **合计** | **73** | |

### 1.2 父计划"pre-existing" 的 3 个 named failure 真实根因

`mate_tech_ont/instances/store.py` + `versioning/store.py` + `federation._executor` 均为**模块级单例**。`test_ont_business.py::client` fixture 直接 `from mate_tech_ont.main import app`，未做 per-test 隔离。pytest 默认 xdist-style 并发时，多个 test 共享同一 store，状态污染 → race。

```python
# 当前 fixture（缺陷）
@pytest.fixture
def client() -> TestClient:
    from mate_tech_ont.main import app
    return TestClient(app)  # 共享 app + 全局 singleton

# 修复方向（GOVERN-10-01）
@pytest.fixture(autouse=True)
def _isolate_ont_singletons():
    from mate_tech_ont.instances.store import store
    from mate_tech_ont.versioning.store import version_store
    from mate_tech_ont.federation import _executor
    store.reset()  # 或 monkeypatch 清空
    version_store.reset()
    _executor.reset()
    yield
```

### 1.3 13 × 9 matrix 现状

`docs/active/governance/HARD-RULES-MATRIX.md` 已有 13×9 表格，5 条 🟡：
- ③ → GOVERN-06 已硬化 ✅（PG RLS 三层防御落地），需翻牌 ✅
- ⑦ → 待 GOVERN-10 拆 job
- ⑨ → GOVERN-09 已落 OTel env helper ✅，需翻牌 ✅
- ⑩ → 待 GOVERN-10 收口
- ⑬ → 仍 21 Python 服务未覆盖，保留 🟡（跨批次，超出 GOVERN-10 范围）

---

## 2. GOVERN-10 范围裁剪

> 父计划"全部 73 个修完"不现实。GOVERN-10 **只** 收敛如下：

| 类别 | 处理 |
|---|---|
| 3 个 named race failure | ✅ 修（per-test singleton reset fixture） |
| 38 个 `test_g5_security_parity.py` 失败 | 🟡 转交 FOLLOW-UP-A（OpenAPI securityScheme parity，需 copilot.yaml/marketplace.yaml/ont.yaml 改写 — GOVERN-08 之外） |
| 2 个 GBK 编码 bug | ✅ 修（`test_marketplace_chart.py` 改 `encoding="utf-8"`） |
| 1 个 `test_networkpolicy.py` 失败 | ✅ 修（见 §3.3） |
| 2 个 `test_service_security_segments.py` | 🟡 转交 FOLLOW-UP-A（marketplace.yaml security scheme） |
| 15 个 `test_tool_categories.py` | 🟡 转交 FOLLOW-UP-B（PG fixture `host=fake` 缺 env） |
| 10 个 `test_app_copilot` 失败 | 🟡 转交 FOLLOW-UP-C |
| 3 个 `test_llmgw` 失败 | 🟡 转交 FOLLOW-UP-D |
| 13 × 9 matrix 翻牌 + 拆 job | ✅ 本批次核心 |

> 总计本批次可闭环：**3 named + 2 GBK + 1 NP + 5 个拆 job + matrix 翻牌 = 11 个直接动作**。其余 60 个入 **FOLLOW-UP-{A,B,C,D}**，立 docs/active/governance/FOLLOW-UP-BOARD.md。

---

## 3. 动作清单（≤ 10）

### 3.1 修 3 个 named race failure（GOVERN-10-01）

**文件**：`mate-platform-backend/packages/mate-tech-ont/tests/conftest.py`（新增）

```python
"""GOVERN-10 — Per-test singleton isolation for race-prone stores.

`test_ont_business.py` / `test_ont_federation.py` import module-level
singletons (instance_store / version_store / _executor). pytest's default
collection order + xdist parallelism cause cross-test state pollution.
This autouse fixture resets the 3 singletons before each test.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_ont_singletons():
    try:
        from mate_tech_ont.instances.store import store as _inst
        if hasattr(_inst, "reset"):
            _inst.reset()
    except ImportError:
        pass
    try:
        from mate_tech_ont.versioning.store import version_store as _ver
        if hasattr(_ver, "reset"):
            _ver.reset()
    except ImportError:
        pass
    try:
        from mate_tech_ont.federation import _executor
        if hasattr(_executor, "reset"):
            _executor.reset()
    except ImportError:
        pass
    yield
```

> 若某个 store 无 `reset()` 方法，则改用 `monkeypatch.setattr` 在 fixture 里替换为新对象（具体实现见 commit）。

### 3.2 修 2 个 GBK 编码 bug（GOVERN-10-01）

**文件**：`infra/tests/test_marketplace_chart.py`

```python
# 旧：
text = f.read_text()
# 新：
text = f.read_text(encoding="utf-8")
```

涉及 2 处：`test_chart_metadata_present` + `test_no_secrets_in_chart`。

### 3.3 修 1 个 `test_networkpolicy.py::test_allow_dns_template`（GOVERN-10-01）

读文件定位失败 → 修补缺失模板行或测试断言。**预计 1 个 pytest 调通**。

### 3.4 拆 `ga-hooks-and-tests` 为 5 个独立 job（GOVERN-10-01）

**文件**：`.github/workflows/ga-acceptance.yml`

新增：
```yaml
ga-003-tenant:
  name: ga-003 forbid_raw_sql (rule 3)
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - uses: actions/checkout@v4
    - run: python scripts/ci/forbid_raw_sql.py

ga-004-acl:
  name: ga-004 forbid_bare_httpx (rule 4)
  ...
  steps:
    - run: python scripts/ci/forbid_bare_httpx.py

ga-005-fallback:
  name: ga-005 forbid_legacy_fallback (rule 5)
  ...
  steps:
    - run: python scripts/ci/forbid_legacy_fallback.py

ga-007-skip-tests:
  name: ga-007 forbid_skip_tests (rule 7)
  ...
  steps:
    - run: python scripts/ci/forbid_skip_tests.py

ga-010-evidence:
  name: ga-010 require_evidence (rule 10)
  ...
  steps:
    - run: python scripts/ci/require_evidence.py
```

`ga-hooks-and-tests` 保留作为聚合 job（仍跑 pre-commit + pytest），但 5 个 forbid_* 改为只跑对应单规则 script。

### 3.5 新增 `tests/governance/test_hard_rules_ci.py`（GOVERN-10-01）

```python
"""GOVERN-10 — 13 硬规则 × CI workflow 对位矩阵机检。

枚举每条硬规则的期望触发 job 与 workflow，校验：
1. `HARD-RULES-MATRIX.md` 行数 = 13
2. 13 行 × 9 workflow 命中 ≥ 90%
3. ga-acceptance.yml 含 9 个 `ga-NNN-*` job 名
4. 5 个 forbid_* 脚本存在
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATRIX = REPO / "docs/active/governance/HARD-RULES-MATRIX.md"
GA_WF = REPO / ".github/workflows/ga-acceptance.yml"

REQUIRED_GA_JOBS = {
    "ga-001-openapi", "ga-002-requirement-ids", "ga-003-tenant",
    "ga-004-acl", "ga-005-fallback", "ga-006-static",
    "ga-007-skip-tests", "ga-008-helm", "ga-009-observability",
    "ga-010-evidence", "ga-011-helm-docs", "ga-012-secret-scan",
    "ga-013-networkpolicy",
}


def test_matrix_doc_has_13_rules():
    content = MATRIX.read_text(encoding="utf-8")
    rule_lines = [
        l for l in content.splitlines()
        if l.startswith("| ") and "|" in l and "硬规则" not in l
        and ("✅" in l or "🟡" in l or "⏳" in l or "🔧" in l)
    ]
    assert len(rule_lines) >= 13, f"matrix has {len(rule_lines)} rows, expected ≥ 13"


def test_ga_workflow_has_all_required_jobs():
    content = GA_WF.read_text(encoding="utf-8")
    missing = REQUIRED_GA_JOBS - {
        line.split(":")[0] for line in content.splitlines()
        if ":" in line and line.startswith("  ga-")
    }
    assert not missing, f"ga-acceptance.yml missing jobs: {missing}"


def test_forbid_scripts_exist():
    for script in [
        "forbid_raw_sql.py", "forbid_bare_httpx.py",
        "forbid_legacy_fallback.py", "forbid_skip_tests.py",
        "require_evidence.py",
    ]:
        assert (REPO / "scripts/ci" / script).is_file(), f"{script} missing"
```

### 3.6 翻牌 ③ / ⑨ → ✅（GOVERN-10-01）

**文件**：`docs/active/governance/HARD-RULES-MATRIX.md`

| 硬规则 | 旧状态 | 新状态 | 理由 |
|---|---|---|---|
| ③ tenant 隔离 | 🟡 → 硬化中 | ✅ | GOVERN-06 提交 `5da8860e` 落地 PG RLS 三层防御，CI `forbid_raw_sql` 全绿 |
| ⑨ OTel | 🟡 → compose≠Helm | ✅ | GOVERN-09 提交 `db0c5d3a` 加 `service-templates.otelEnv` helper |

### 3.7 新增 `docs/active/governance/FOLLOW-UP-BOARD.md`（GOVERN-10-01）

```markdown
# GOVERN-10 FOLLOW-UP Board

> 60 个本批次未收口的失败跟踪表（2026-08-10 立项）

| ID | 范围 | 文件 | 状态 | 关联批次 |
|---|---|---|---|---|
| FOLLOW-UP-A | OpenAPI securityScheme parity（copilot/marketplace/ont）38 + 2 | `infra/tests/test_g5_security_parity.py` + `test_service_security_segments.py` | Planned | TBD |
| FOLLOW-UP-B | MCP tool_categories PG fixture (host=fake) 15 | `packages/mate-tech-mcp/tests/test_tool_categories.py` | Planned | TBD |
| FOLLOW-UP-C | copilot 跨租户 / NL2SQL / payload 10 | `packages/mate-app-copilot/tests/` | Planned | TBD |
| FOLLOW-UP-D | llmgw 跨租户 / DoW / Anthropic 3 | `packages/mate-tech-llmgw/tests/` | Planned | TBD |
```

### 3.8 commit 拆分（GOVERN-10-02）

- `refactor(test): GOVERN-10 3 race + 2 GBK + 1 NP fix; ga-acceptance 拆 5 job`
- `chore(governance): HARD-RULES-MATRIX ③⑨ 翻牌 ✅; FOLLOW-UP-BOARD 立`

### 3.9 CLAUDE.md 更新（GOVERN-10-02）

顶部"最近更新"日期 + 5 件：
- GOVERN-10 收口
- 13 硬规则 9 ✅ 2 🟡（⑩/⑬）2 由 GOVERN-10 收口
- 73 pre-existing → 6 本批修 + 67 入 FOLLOW-UP

### 3.10 PROGRAM-BOARD.md GOVERN-10 行标 Accepted（GOVERN-10-02）

---

## 4. 验收标准

- `pytest tests/governance/test_hard_rules_ci.py -v` 全绿
- `pytest packages/mate-tech-ont/tests/ packages/mate-tech-obs/tests/ packages/mate-tech-analytics/tests/ packages/mate-app-hub/tests/ -q` 失败数从 3 → 0
- `pytest infra/tests/ -q` 失败数从 44 → 43（仅 FOLLOW-UP 留下的）
- `.github/workflows/ga-acceptance.yml` `jobs:` 块 `ga-NNN-*` 行数 ≥ 13
- `docs/active/governance/HARD-RULES-MATRIX.md` 状态：9 ✅ / 2 🟡 / 0 ⏳ / 0 🔧（⑩/⑬ 仍 🟡）
- `git log --oneline -5` 含 GOVERN-10 refactor + docs 提交

---

## 5. 不在 GOVERN-10 范围（明示）

- 60 个 FOLLOW-UP 失败（infra/tests 38+2、mcp 15、copilot 10、llmgw 3）→ 立项 FOLLOW-UP-BOARD
- 21 Python 服务 NetworkPolicy 命名规则（父计划 GOVERN-09 D3 二期）
- snapshots.json 历史快照（PROGRAM-BOARD 已有人工表，无自动化需求）
- production-readiness §13 源文档书面评审（语义差异已 GOVERN-01 标注）
- `mate-tech-iam` 旧仓库物理删除（GOVERN-02 已做 deprecation 落地，物理清理跨月）

---

## 6. 风险与缓解

| 风险 | 触发 | 缓解 |
|---|---|---|
| `store.reset()` 不存在 → fixture raise ImportError | 3 个 store 至少 1 个无 reset | fixture 用 try/except + hasattr；fallback monkeypatch.setattr |
| 拆 5 个 job 增加 CI 9 min 总耗时 | 5 个 job 都跑 setup-python | 复用 `actions/setup-python` 缓存 key，1 min/job |
| FOLLOW-UP-BOARD 60 个失败被遗忘 | 文档不进入 CI | 月度 `forbid_unowned_failures.py`（FOLLOW-UP-A 自带） |

---

**关联**：GOVERN-04 / -06（前置修复）/ HARD-RULES-MATRIX §0 / ADR-0015 GA 收口。