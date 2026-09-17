"""A-4 / `MP-AGENT-SANDBOX-ISOLATION-01`：外部 Runtime 的**环境变量白名单**。

判据（本文件逐条断言）：

1. 子进程 env **不含** DB DSN / Service Secret / Keycloak 配置——按名字断言，
   也按**值**断言（换个名字也漏不出去）。
2. `{**os.environ, ...}` 这个构造**在源码里被替换**了（AST 级断言，不是 grep 注释）。
3. 白名单是"进白名单才下放"，不是"黑名单剔除"：没在名单里的一律不下放。
4. 凭据类名字**不能**经任何途径下放：运维追加白名单、显式 `env=` 都不行，且**报错**
   而不是静默丢弃。
5. 运维仍可为非敏感名字开洞（例：CLI 需要 `ANTHROPIC_BASE_URL`）。

桩 CLI 把收到的 `os.environ` 原样落进工作区，于是"子进程到底看到了什么"可断言。
"""

from __future__ import annotations

import ast
import json
import pathlib
import sys
import textwrap
from typing import Any

import pytest
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry
from mate_tech_agent_team.runtimes import (
    ALLOWLIST_ENV,
    ClaudeCodeRuntime,
    build_child_env,
    configured_allowlist,
    is_sensitive_name,
)
from mate_tech_agent_team.state import SubTask

# ── 桩 CLI：把子进程看到的整个 env 落盘，再回一份合法 JSON ────────────────

_STUB = textwrap.dedent(
    """
    import json, os

    with open("_stub_env.json", "w", encoding="utf-8") as fh:
        json.dump(dict(os.environ), fh, ensure_ascii=False)

    print(json.dumps({"type": "result", "is_error": False, "num_turns": 1,
                      "result": "[stub] ok"}, ensure_ascii=False))
    """
).strip()


@pytest.fixture
def stub_cli(tmp_path: pathlib.Path) -> list[str]:
    script = tmp_path / "env_stub.py"
    script.write_text(_STUB, encoding="utf-8")
    return [sys.executable, str(script)]


# ── 替身：租户作用域的名册 + 固定员工 ─────────────────────────────────────


class _Store:
    def __init__(self, rows: dict[tuple[str, str], EmployeeProfile]) -> None:
        self._rows = dict(rows)

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self._rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (t, _), p in self._rows.items() if t == tenant_id]


_PROFILE = EmployeeProfile(
    profile_id="EMP-EXT",
    name="外部执行面核对员",
    base_role="ontology",
    system_prompt="你是外部执行面核对员。",
    skills=(),
    tools=("ont_list_classes",),
    model="glm-5.3-flash",
)


def _runtime(cli: list[str], tmp_path: pathlib.Path, **kwargs: Any) -> ClaudeCodeRuntime:
    store = _Store({("tenant-acme", "EMP-EXT"): _PROFILE})
    return ClaudeCodeRuntime(
        registry=kwargs.pop("registry", ProfileRegistry([], store=store)),
        cli_command=cli,
        working_root=tmp_path / "runtimes",
        **kwargs,
    )


def _subtask() -> SubTask:
    return SubTask(
        task_id="t1",
        team_task_id="run-env00001-t1",
        profile_id="EMP-EXT",
        instruction="核对一下",
        depends_on=[],
    )


# ── 注入宿主的凭据样貌（只用**探针值**，不是真凭据）─────────────────────────

HOST_DSN = "postgresql://probe:probe@127.0.0.1:5432/hostdb"
HOST_SERVICE_SECRET = "probe" + "-service-" + "secret-0123456789"
HOST_LLM_KEY = "probe" + "-llm-" + "key-0123456789"
HOST_KEYCLOAK = "http://probe-keycloak.invalid/realms/probe"

#: 必须一条都不下放的宿主变量（名字）
CREDENTIAL_NAMES = (
    "MATE_AGENT_TEAM_DSN",
    "MATE_AGENT_TEAM_ADMIN_DSN",
    "SERVICE_CLIENT_SECRET",
    "KEYCLOAK_URL",
    "KEYCLOAK_CLIENT_SECRET",
    "ANTHROPIC_API_KEY",
    "MCP_API_KEY",
)
CREDENTIAL_VALUES = (HOST_DSN, HOST_SERVICE_SECRET, HOST_LLM_KEY, HOST_KEYCLOAK)


def _plant_host_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_AGENT_TEAM_DSN", HOST_DSN)
    monkeypatch.setenv("MATE_AGENT_TEAM_ADMIN_DSN", HOST_DSN)
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", HOST_SERVICE_SECRET)
    monkeypatch.setenv("KEYCLOAK_CLIENT_SECRET", HOST_SERVICE_SECRET)
    monkeypatch.setenv("KEYCLOAK_URL", HOST_KEYCLOAK)
    monkeypatch.setenv("ANTHROPIC_API_KEY", HOST_LLM_KEY)
    monkeypatch.setenv("MCP_API_KEY", HOST_LLM_KEY)
    monkeypatch.setenv("PROBE_HOST_ONLY", "host-only-not-allowlisted")


# ── 判据 1 + 3：白名单构造，凭据不下放 ───────────────────────────────────


def test_child_env_is_allowlisted_not_inherited(monkeypatch: pytest.MonkeyPatch) -> None:
    """宿主 env 里**只有**白名单命中的那些会下放；其余（含全部凭据）一律剔除。"""
    _plant_host_credentials(monkeypatch)
    child = build_child_env()

    # 白名单里该有的还在（否则子进程根本起不来）
    assert child.get("PATH"), "PATH 必须下放，否则 CLI 起不来"

    for name in CREDENTIAL_NAMES:
        assert name not in child, f"凭据类变量下放了：{name}"
    assert "PROBE_HOST_ONLY" not in child, "不在白名单里的一律不下放"

    blob = json.dumps(child, ensure_ascii=False)
    for value in CREDENTIAL_VALUES:
        assert value not in blob, "凭据**值**经别的名字漏出去了"


def test_sensitive_name_detection_covers_the_host_credential_families() -> None:
    for name in CREDENTIAL_NAMES:
        assert is_sensitive_name(name), name
    assert is_sensitive_name("SOME_NEW_ADMIN_DSN")
    assert is_sensitive_name("SSH_AUTH_SOCK")
    assert not is_sensitive_name("PATH")
    assert not is_sensitive_name("TMPDIR")
    assert not is_sensitive_name("ANTHROPIC_BASE_URL")


def test_sensitive_names_cannot_be_opted_in(monkeypatch: pytest.MonkeyPatch) -> None:
    """凭据类名字**不能**经任何途径下放——配了就是配置错误，报错不是静默丢弃。"""
    with pytest.raises(ValueError, match="凭据类名字"):
        build_child_env(allow=["ANTHROPIC_API_KEY"])
    with pytest.raises(ValueError, match="凭据类"):
        build_child_env(explicit={"SERVICE_CLIENT_SECRET": "x"})
    with pytest.raises(ValueError, match="凭据类名字"):
        configured_allowlist("ANTHROPIC_API_KEY,MATE_AGENT_TEAM_DSN")


# ── 判据 5：运维可为非敏感名字开洞 ──────────────────────────────────────


def test_operator_can_extend_the_allowlist_for_benign_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://llm.internal.example")
    default_child = build_child_env()
    assert "ANTHROPIC_BASE_URL" not in default_child

    extended = build_child_env(allow=configured_allowlist("anthropic_base_url"))
    assert extended["ANTHROPIC_BASE_URL"] == "https://llm.internal.example"


# ── 判据 2：源码里那个构造真的被替换了（AST 级，不靠 grep 注释）─────────


def _merges_os_environ(source: str) -> bool:
    """源码里是否还存在 ``{**os.environ, ...}`` 这种字典解包合并。"""
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Dict):
            continue
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None and isinstance(value, ast.Attribute) and value.attr == "environment":
                return True
    return False


def test_the_runtime_no_longer_merges_the_host_environment() -> None:
    from mate_tech_agent_team.runtimes import claude_code

    source = pathlib.Path(claude_code.__file__).read_text(encoding="utf-8")
    assert not _merges_os_environ(source), "仍有 {**os.environ, ...} 之类的合并"
    assert "self.child_env()" in source, "子进程 env 必须经 child_env() 构造"


# ── 判据 1（端到端）：真起一次子进程，看它到底看到了什么 ────────────────


@pytest.mark.asyncio
async def test_the_cli_subprocess_sees_no_host_credentials(
    stub_cli: list[str], tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _plant_host_credentials(monkeypatch)
    runtime = _runtime(stub_cli, tmp_path)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")
    assert result["status"] == "ok", result

    seen = json.loads(
        (tmp_path / "runtimes" / "tenant-acme" / "run-env00001-t1" / "_stub_env.json").read_text(
            encoding="utf-8"
        )
    )
    assert seen.get("PATH"), "子进程连 PATH 都没有 = 白名单构造把该给的也砍了"
    for name in CREDENTIAL_NAMES:
        assert name not in seen, f"子进程看到了宿主凭据变量：{name}"
    blob = json.dumps(seen, ensure_ascii=False)
    for value in CREDENTIAL_VALUES:
        assert value not in blob, "宿主凭据**值**出现在子进程 env 里"


@pytest.mark.asyncio
async def test_operator_allowlist_extension_reaches_the_subprocess(
    stub_cli: list[str], tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://llm.internal.example")
    monkeypatch.setenv(ALLOWLIST_ENV, "anthropic_base_url")
    runtime = _runtime(stub_cli, tmp_path)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")
    assert result["status"] == "ok", result

    seen = json.loads(
        (tmp_path / "runtimes" / "tenant-acme" / "run-env00001-t1" / "_stub_env.json").read_text(
            encoding="utf-8"
        )
    )
    assert seen["ANTHROPIC_BASE_URL"] == "https://llm.internal.example"


@pytest.mark.asyncio
async def test_explicit_credential_injection_is_refused_and_nothing_runs(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """显式 `env=` 里塞凭据 → **报错**，且 CLI 一次都没起过（没有产出）。"""
    runtime = _runtime(stub_cli, tmp_path, env={"SERVICE_CLIENT_SECRET": HOST_SERVICE_SECRET})
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["status"] == "error", result
    assert result["output"] == ""
    assert "凭据" in result["error"], result["error"]
    assert not (
        tmp_path / "runtimes" / "tenant-acme" / "run-env00001-t1" / "_stub_env.json"
    ).exists()


@pytest.mark.asyncio
async def test_explicit_non_credential_values_still_get_through(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """显式注入的**非**凭据值是运维的正当手段，不该被这条规则误伤。"""
    runtime = _runtime(stub_cli, tmp_path, env={"PROBE_EXPLICIT": "explicit-ok"})
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")
    assert result["status"] == "ok", result

    seen = json.loads(
        (tmp_path / "runtimes" / "tenant-acme" / "run-env00001-t1" / "_stub_env.json").read_text(
            encoding="utf-8"
        )
    )
    assert seen["PROBE_EXPLICIT"] == "explicit-ok"
