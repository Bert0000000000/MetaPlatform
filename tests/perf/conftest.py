"""Performance baseline test fixtures (V11-12).

Reuses the in-memory ASGI app builders from ``tests/e2e/conftest.py`` to
keep TECH-DATA / TECH-AGENT real app instances and Java-service Mock apps
identical to E2E setup. This file adds perf-specific:

- ``perf_report``: a shared ``PerfReport`` that accumulates ``PerfStats``
  across all perf tests and prints a unified table at session end.
- ``perf_iterations``: number of calls per API (default 20, override via
  ``--perf-iterations=N``).
- Thin wrappers around the data/agent/rule/wfe clients that reset the
  in-memory state once per test so measurements are not polluted by
  prior tests' data (deterministic P95).

Independent of tests/e2e/ — running ``pytest tests/perf/`` works in
isolation because the parent conftest is loaded explicitly via file path.
"""

from __future__ import annotations

import importlib.util
import sys
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

# -------------------------------------------------- 复用 e2e 的 app builders

_REPO_ROOT = Path(__file__).resolve().parents[2]
_E2E_CONFTEST = _REPO_ROOT / "tests" / "e2e" / "conftest.py"

# 确保 tests/perf/ 在 sys.path 中，使 perf_stats 可直接导入（不依赖 pytest
# 的 import mode）。这对 conftest 加载顺序很关键。
_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)


def _load_e2e_conftest():
    """Load tests/e2e/conftest.py as a module so we can reuse its app builders.

    The file is normally not importable because conftest.py is not a package
    module. We load it explicitly by file path.
    """
    spec = importlib.util.spec_from_file_location(
        "metaplatform_e2e_conftest", str(_E2E_CONFTEST)
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Insert into sys.modules so any ``from metaplatform_e2e_conftest import x``
    # would work, and so the module's pytest fixtures are registered.
    sys.modules["metaplatform_e2e_conftest"] = module
    spec.loader.exec_module(module)
    return module


_e2e = _load_e2e_conftest()

# Re-export the builders we need
_switch_service = _e2e._switch_service
_build_data_app = _e2e._build_data_app
_build_agent_app = _e2e._build_agent_app
_build_java_mock_app = _e2e._build_java_mock_app
_APP_CACHE = _e2e._APP_CACHE
TENANT_ID = _e2e.TENANT_ID
_agent_create_token = _e2e._agent_create_token


# -------------------------------------------------- 命令行选项


def pytest_addoption(parser):
    """Add ``--perf-iterations`` to override default iteration count."""
    group = parser.getgroup("perf", "V11-12 性能基线测试")
    group.addoption(
        "--perf-iterations",
        action="store",
        default=20,
        type=int,
        help="每个 API 调用次数（默认 20，断言 P95 < 500ms）",
    )


@pytest.fixture(scope="session")
def perf_iterations(request) -> int:
    return int(request.config.getoption("--perf-iterations"))


# -------------------------------------------------- 认证头


@pytest.fixture
def trace_id() -> str:
    return f"perf-{uuid.uuid4().hex[:12]}"


@pytest.fixture
def tenant_headers(trace_id: str) -> dict[str, str]:
    claims = {
        "sub": "user-perf",
        "username": "perf-user",
        "tenantId": TENANT_ID,
        "roles": ["user"],
        "type": "access",
    }
    token = _agent_create_token(claims, expires_in_seconds=3600)
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Trace-Id": trace_id,
        "Authorization": f"Bearer {token}",
    }


# -------------------------------------------------- 共享 PerfReport


from perf_stats import PerfReport, PerfStats  # noqa: E402


# module-level session cache for perf_report so sessionfinish hook can access
_SESSION_PERF_REPORT: PerfReport | None = None


@pytest.fixture(scope="session")
def perf_report() -> PerfReport:
    global _SESSION_PERF_REPORT
    if _SESSION_PERF_REPORT is None:
        _SESSION_PERF_REPORT = PerfReport()
    return _SESSION_PERF_REPORT


def pytest_sessionfinish(session, exitstatus):
    """在 session 结束时打印统一的性能报告表。"""
    reporter = session.config.pluginmanager.getplugin("terminalreporter")
    perf_report_obj = _SESSION_PERF_REPORT
    if perf_report_obj is not None and perf_report_obj.stats:
        out = perf_report_obj.format_table()
        if reporter is not None:
            reporter.write_line(out)
        else:
            print(out)


@pytest.fixture
def perf_report_session_scoped(perf_report: PerfReport) -> PerfReport:
    """Per-test accessor that ensures the session report is shared."""
    return perf_report


# -------------------------------------------------- ASGI clients


def _reset_data_state() -> None:
    """重置 TECH-DATA app 的内存状态（避免之前测试的数据影响 timing）。"""
    if "data" not in _APP_CACHE:
        return
    reg = _APP_CACHE["data"].state.registry
    reg.reset()
    qs = reg.quality_service
    qs._rules.clear()
    qs._results.clear()
    qs._issues.clear()
    qs._last_run.clear()
    qs._jobs.clear()


def _reset_agent_state() -> None:
    """重置 TECH-AGENT app 的内存状态。"""
    if "agent" not in _APP_CACHE:
        return
    _APP_CACHE["agent"].state.registry.reset()


@pytest.fixture(autouse=True)
def _reset_in_memory_state():
    """每个 perf test 之前清空 in-memory app 状态。"""
    _reset_data_state()
    _reset_agent_state()
    yield


@pytest.fixture
async def data_client() -> AsyncClient:
    if "data" not in _APP_CACHE:
        _APP_CACHE["data"] = _build_data_app()
    app = _APP_CACHE["data"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://data.test") as ac:
        yield ac


@pytest.fixture
async def agent_client() -> AsyncClient:
    if "agent" not in _APP_CACHE:
        _APP_CACHE["agent"] = _build_agent_app()
    app = _APP_CACHE["agent"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://agent.test") as ac:
        yield ac


# -------------------------------------------------- Mock Java services


class _NullCallLog:
    """Perf tests 不关心 mock 调用顺序，提供空对象满足 _build_java_mock_app 签名。"""

    def reset(self) -> None:
        pass

    def record(self, *args, **kwargs) -> None:
        pass

    @property
    def calls(self) -> list:
        return []

    @property
    def paths(self) -> list:
        return []


@pytest.fixture
async def rule_client() -> AsyncClient:
    app = _build_java_mock_app("TECH-RULE-PERF", _NullCallLog())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://rule.test") as ac:
        yield ac


@pytest.fixture
async def wfe_client() -> AsyncClient:
    app = _build_java_mock_app("TECH-WFE-PERF", _NullCallLog())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://wfe.test") as ac:
        yield ac


# -------------------------------------------------- 共享：累积 PerfStats


@pytest.fixture
def make_stats(perf_report_session_scoped: PerfReport):
    """返回一个工厂：创建 PerfStats 并注册到 session 报告。"""

    def _factory(name: str) -> PerfStats:
        stat = PerfStats(name=name)
        perf_report_session_scoped.add(stat)
        return stat

    return _factory
