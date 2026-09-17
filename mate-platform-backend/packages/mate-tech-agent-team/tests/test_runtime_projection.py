"""轨 2 · RuntimeKind 与 Projection Adapter 的验收用例（ADR-0066 §5.8 / R10）。

四条判据：

1. **`RuntimeKind` 是本仓枚举**，`EmployeeProfile` 默认含 `SUPERAI`——加这个字段
   不许打断任何既有调用方（既有构造点一个 `runtimes=` 都不传）。
2. **下投影真的是"下投影"**：`ProjectionAdapter.render` 把身份压成
   `RuntimeBundle`（instructions + skill **引用清单** + 工具面 + 工作目录/模型引用），
   工具面**只能收窄**；skill 只出 `id/name/一句话描述`，**正文不进 bundle**。
3. **bundle 只带引用、绝不带密钥**（硬规则 #12）——并且这个断言不能是空断言：
   另有一条"探针"用例证明扫描器真的能抓到植入的密钥。
4. **bundle 是本仓类型**（R10）：公开契约里不出现任何框架类型。
"""

from __future__ import annotations

import ast
import json
import pathlib
from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from mate_tech_agent_team.profiles import EmployeeProfile, RuntimeKind
from mate_tech_agent_team.runtimes import (
    ClaudeCodeProjection,
    ProjectionAdapter,
    RuntimeBundle,
    SkillRef,
    SuperAiProjection,
    scan_for_secrets,
)

# ── 替身 ────────────────────────────────────────────────────────────────


class _Skill:
    def __init__(self, skill_id: str, name: str, description: str, content: str) -> None:
        self.id = skill_id
        self.name = name
        self.description = description
        self.content = content


class FakeSkillStore:
    """SkillHub 读取侧的替身（只实现 `get`）。"""

    def __init__(self, skills: list[_Skill]) -> None:
        self._by_id = {s.id: s for s in skills}

    def get(self, skill_id: str) -> _Skill | None:
        return self._by_id.get(skill_id)


def _catalog(*skills: _Skill) -> Any:
    from mate_tech_agent_team.skills import SkillCatalog

    return SkillCatalog(FakeSkillStore(list(skills)))


_ANALYST = EmployeeProfile(
    profile_id="EMP-ANALYST",
    name="数据分析师",
    base_role="ontology",
    system_prompt="你是数据分析师。产出必须给出可核对的量化结论，禁止编造对象名或数字。",
    skills=("sk-order-anomaly",),
    tools=("ont_list_classes", "ont_object_query", "read_skill"),
    kb_ids=("kb-orders",),
    action_rids=("ont.create_link",),
    markings=("internal",),
    model="glm-5.3-flash",
)

_SKILLS = _catalog(
    _Skill(
        "sk-order-anomaly",
        "异常订单识别",
        "识别异常订单的口径与阈值",
        "正文：阈值 = 3σ，逐仓比对……" * 40,
    )
)

# ── 判据 1：RuntimeKind 与 EmployeeProfile.runtimes ─────────────────────


def test_runtime_kind_is_a_repo_native_str_enum() -> None:
    assert RuntimeKind.SUPERAI == "superai"
    assert RuntimeKind.CLAUDE_CODE == "claude_code"
    # StrEnum：能直接当字符串比较/序列化（进 JSON 不必 .value）
    assert isinstance(RuntimeKind.SUPERAI, str)


def test_profile_defaults_to_superai_and_stays_frozen() -> None:
    """既有调用方一个 `runtimes=` 都不传——默认必须是 SUPERAI，不能是空元组。

    空元组会让"没配 runtimes 的员工"变成**谁都跑不了**，而存量数据（库里已有的
    `dw_employees` 行、HTTP 建出来的员工）全都没传这个字段。
    """
    assert _ANALYST.runtimes == (RuntimeKind.SUPERAI,)
    explicit = EmployeeProfile(
        profile_id="EMP-CLAUDE",
        name="Claude 员工",
        base_role="ontology",
        system_prompt="x",
        runtimes=(RuntimeKind.SUPERAI, RuntimeKind.CLAUDE_CODE),
    )
    assert explicit.runtimes == (RuntimeKind.SUPERAI, RuntimeKind.CLAUDE_CODE)
    with pytest.raises(FrozenInstanceError):
        explicit.runtimes = (RuntimeKind.SUPERAI,)  # type: ignore[misc]


# ── 判据 2：下投影 ──────────────────────────────────────────────────────


def test_superai_projection_is_a_structural_projection_adapter() -> None:
    """`SuperAiProjection` 结构上满足 `ProjectionAdapter` 协议。"""
    assert isinstance(SuperAiProjection(skills=_SKILLS), ProjectionAdapter)


def test_superai_projection_carries_role_skill_refs_and_tool_face() -> None:
    bundle = SuperAiProjection(skills=_SKILLS).render(_ANALYST, tool_scope=())
    assert isinstance(bundle, RuntimeBundle)
    assert bundle.runtime_kind == RuntimeKind.SUPERAI
    assert "数据分析师" in bundle.instructions
    # skill 只出引用（id + 描述），正文不进 bundle
    assert bundle.skills == (
        SkillRef(
            skill_id="sk-order-anomaly",
            name="异常订单识别",
            description="识别异常订单的口径与阈值",
        ),
    )
    assert "阈值 = 3σ" not in bundle.instructions
    assert "阈值 = 3σ" not in json.dumps(bundle.to_manifest_dict(), ensure_ascii=False)
    # 工具面 = 员工白名单（没给 tool_scope 就是全集）
    assert bundle.tools == _ANALYST.tools
    assert bundle.model == "glm-5.3-flash"


def test_tool_scope_can_only_narrow_never_widen() -> None:
    """ADR-0066 §5.2：`tool_scope` 是**交集**，写一个员工没有的工具不会因此拿到它。"""
    narrowed = SuperAiProjection(skills=_SKILLS).render(
        _ANALYST, tool_scope=("ont_object_query", "kb_search")
    )
    assert narrowed.tools == ("ont_object_query",)


def test_claude_code_projection_renders_claude_md_style_instructions() -> None:
    bundle = ClaudeCodeProjection(skills=_SKILLS).render(_ANALYST, tool_scope=())
    assert bundle.runtime_kind == RuntimeKind.CLAUDE_CODE
    text = bundle.instructions
    # 角色 + 工具面 + skill 清单三样都在（这正是"下投影"而不是"黑箱调用"）
    assert "数据分析师" in text
    assert "ont_object_query" in text
    assert "sk-order-anomaly" in text
    assert "异常订单识别" in text
    # 正文不进投影（R6：清单只出 name + description）
    assert "阈值 = 3σ" not in text
    # 工具面同样只能收窄
    narrowed = ClaudeCodeProjection(skills=_SKILLS).render(_ANALYST, tool_scope=("read_skill",))
    assert narrowed.tools == ("read_skill",)


def test_bundle_manifest_is_references_only() -> None:
    """`to_manifest_dict()` 是**落盘给外部运行时的那份**，只能有引用。"""
    manifest = (
        ClaudeCodeProjection(skills=_SKILLS).render(_ANALYST, tool_scope=()).to_manifest_dict()
    )
    assert manifest["runtimeKind"] == "claude_code"
    assert manifest["tools"] == list(_ANALYST.tools)
    assert manifest["skills"] == [
        {
            "skillId": "sk-order-anomaly",
            "name": "异常订单识别",
            "description": "识别异常订单的口径与阈值",
        }
    ]
    # 键名是**引用名**，不是内容名——出现 content/body/prompt 之类就是漏了正文
    assert all(key in {"skillId", "name", "description"} for key in manifest["skills"][0])


# ── 判据 3：无密钥泄露（硬规则 #12）──────────────────────────────────────


def test_scan_for_secrets_is_not_vacuous() -> None:
    """探针：扫描器真的抓得到植入的密钥，否则下面的"没泄露"是空断言。

    **样本按片段拼出来，不以整段字面量出现在源码里**：写成一整条的话，
    ``ga-012 gitleaks`` 会把**本用例自己**当成一次泄漏（实测抓到过两条）。
    运行时拼出来的仍是真样本，源码里没有可匹配的形状——这比往 allowlist 里
    加白名单干净：白名单一开口子，真泄漏也能从同一道口子过。
    """
    planted = "sk-mcp-" + "abcdef123456"
    assert planted in "token=" + planted and scan_for_secrets("token=" + planted)
    assert scan_for_secrets("Authorization: Bearer " + "a1b2c3d4" * 6)
    assert scan_for_secrets("client_secret=" + "deadbeef" * 2)
    assert scan_for_secrets("AKIA" + "IOSFODNN7EXAMPLE")
    dashes = "-" * 5
    assert scan_for_secrets(f"{dashes}BEGIN RSA PRIVATE KEY{dashes}")
    # 正常引用不该被误判（skill id 的 sk- 前缀是**本仓技能命名**，不是密钥）
    assert scan_for_secrets("sk-order-anomaly") == []
    assert scan_for_secrets("ont_object_query kb-orders internal") == []


@pytest.mark.parametrize("projection_name", ["superai", "claude_code"])
def test_projected_bundle_carries_no_secret_material(projection_name: str) -> None:
    """下放产物里**只能有引用**：skill id / tool 名 / kb id，绝不内联密钥。"""
    factory = SuperAiProjection if projection_name == "superai" else ClaudeCodeProjection
    bundle = factory(skills=_SKILLS).render(_ANALYST, tool_scope=())
    payload = json.dumps(bundle.to_manifest_dict(), ensure_ascii=False) + bundle.instructions
    assert scan_for_secrets(payload) == []


# ── 判据 4：公开契约里零框架类型（R10）────────────────────────────────────


_FRAMEWORKS = {"langchain", "langchain_core", "langgraph", "openai_agents", "agents"}


def _imported_roots(path: pathlib.Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


@pytest.mark.parametrize("relative", ["runtimes/__init__.py", "a2a/__init__.py"])
def test_public_contract_imports_no_framework(relative: str) -> None:
    """R10：`RuntimeBundle` / A2A 出站契约是本仓类型，不许被框架塑形。"""
    import mate_tech_agent_team as pkg

    path = pathlib.Path(pkg.__file__).parent / relative
    assert path.exists(), f"{relative} 不存在？"
    leaked = _imported_roots(path) & _FRAMEWORKS
    assert not leaked, f"{relative} 渗漏了框架 import：{sorted(leaked)}"
