"""任务 6 · 技能渐进加载的验收用例。

判据：给一个员工挂 20 个技能，提示词仍在预算内。

"在预算内"是可断言的：清单只出 ``名字 + 一句话描述``，正文一律不进提示词；
超预算时**丢条目**，绝不退化成贴正文。第二层靠 ``read_skill`` 现拉。
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    EmployeeProfile,
    LlmEmployeeRuntime,
    ProfileRegistry,
    SkillCatalog,
    SkillToolbox,
    ToolNotAllowed,
)
from mate_tech_agent_team.api.app import set_profile_registry, set_skill_catalog
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.ontology_toolbox import CompositeToolbox
from mate_tech_agent_team.skills import MANIFEST_BUDGET_CHARS

LONG_BODY = "正文：先取上月同期基线，再按仓维度算偏离，超过 3σ 记异常。" * 200


@dataclass
class _Skill:
    id: str
    name: str
    description: str
    content: str


class FakeStore:
    def __init__(self, skills: list[_Skill]) -> None:
        self._list = skills
        self._by_id = {s.id: s for s in skills}

    def get(self, skill_id: str) -> _Skill | None:
        return self._by_id.get(skill_id)

    def list(self, tenant_id: str) -> list[_Skill]:
        del tenant_id
        return list(self._list)


def _twenty_skills() -> list[_Skill]:
    return [
        _Skill(
            id=f"sk-{i:02d}",
            name=f"技能{i:02d}",
            description=f"第 {i} 个技能的用途说明（一句话）",
            content=LONG_BODY,
        )
        for i in range(20)
    ]


def _catalog(skills: list[_Skill] | None = None) -> SkillCatalog:
    return SkillCatalog(FakeStore(skills or _twenty_skills()))


class _EchoLlm:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "tools": tools})
        return {"content": "done", "tool_calls": []}


# ── 判据：20 个技能，提示词仍在预算内 ────────────────────────────────────


def test_manifest_with_twenty_skills_stays_within_budget() -> None:
    ids = [s.id for s in _twenty_skills()]
    catalog = _catalog()
    rendered = catalog.render(ids)
    assert len(rendered) <= MANIFEST_BUDGET_CHARS, f"清单 {len(rendered)} 字符超预算"
    assert catalog.manifest_size(ids) <= MANIFEST_BUDGET_CHARS
    # 20 个都在（一条一行，远没到 8000）
    assert all(skill_id in rendered for skill_id in ids)


@pytest.mark.asyncio
async def test_twenty_skills_enter_the_prompt_as_a_list_only() -> None:
    """挂着 20 个技能的员工，提示词里只有清单，没有一份正文。"""
    profile = EmployeeProfile(
        profile_id="EMP-20",
        name="加载重员工",
        base_role="ontology",
        system_prompt="你是测试员工。",
        skills=tuple(s.id for s in _twenty_skills()),
        tools=(),
    )
    llm = _EchoLlm()
    runtime = LlmEmployeeRuntime(
        registry=ProfileRegistry([profile]),
        llm_factory=lambda _t: llm,
        toolbox_factory=lambda _t: CompositeToolbox(ontology=None, mcp=None),
        skills=_catalog(),
    )
    await runtime.run(
        subtask={"task_id": "t1", "profile_id": "EMP-20", "instruction": "随便做点什么"},
        tenant_id="tenant-a",
    )
    system = llm.calls[0]["messages"][0]["content"]
    assert len(system) <= MANIFEST_BUDGET_CHARS + 400, f"提示词被撑到 {len(system)} 字符"
    assert "sk-00" in system and "sk-19" in system
    assert "先取上月同期基线" not in system, "技能正文不该常驻提示词"


def test_over_budget_manifest_drops_entries_rather_than_leaking_content() -> None:
    """预算塞不下时**丢条目**（并说明丢了几个），绝不改成贴正文。"""
    catalog = SkillCatalog(FakeStore(_twenty_skills()), budget_chars=120)
    rendered = catalog.render([s.id for s in _twenty_skills()])
    assert len(rendered) <= 120
    assert "未列出" in rendered
    assert "先取上月同期基线" not in rendered


# ── 第 2 层：选中才读正文 ────────────────────────────────────────────────


def test_read_returns_the_full_body_on_demand() -> None:
    catalog = _catalog()
    assert "先取上月同期基线" in catalog.read("sk-03")


@pytest.mark.asyncio
async def test_read_skill_tool_returns_content() -> None:
    toolbox = SkillToolbox(_catalog(), tenant_id="tenant-a")
    result = await toolbox.invoke(
        name="read_skill", arguments={"skill_id": "sk-03"}, allowed=("read_skill",)
    )
    assert result["skill_id"] == "sk-03"
    assert "先取上月同期基线" in result["content"]


@pytest.mark.asyncio
async def test_search_skill_returns_entries_not_bodies() -> None:
    toolbox = SkillToolbox(_catalog(), tenant_id="tenant-a")
    result = await toolbox.invoke(
        name="search_skill", arguments={"query": "技能0"}, allowed=("search_skill",)
    )
    assert result["entries"], "关键词该命中若干技能"
    assert all("content" not in entry for entry in result["entries"])


@pytest.mark.asyncio
async def test_skill_tool_respects_the_whitelist() -> None:
    toolbox = SkillToolbox(_catalog(), tenant_id="tenant-a")
    with pytest.raises(ToolNotAllowed) as excinfo:
        await toolbox.invoke(
            name="read_skill", arguments={"skill_id": "sk-01"}, allowed=("search_skill",)
        )
    assert excinfo.value.reason == "not_in_employee_tool_whitelist"


# ── HTTP 面 ─────────────────────────────────────────────────────────────


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    set_profile_registry(ProfileRegistry(_profiles()))
    set_skill_catalog(_catalog())
    return TestClient(app)


def _profiles() -> list[EmployeeProfile]:
    return [
        EmployeeProfile(
            profile_id="EMP-20",
            name="加载重员工",
            base_role="ontology",
            system_prompt="你是测试员工。",
            skills=tuple(s.id for s in _twenty_skills()),
        )
    ]


def test_skill_manifest_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/agent-team/profiles/EMP-20/skills", headers=_auth())
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["entries"]) == 20
    assert body["manifest_chars"] <= body["budget_chars"]
    assert all("content" not in entry for entry in body["entries"])


def test_skill_content_endpoint_reads_the_body(client: TestClient) -> None:
    response = client.get("/api/v1/agent-team/profiles/EMP-20/skills/sk-07", headers=_auth())
    assert response.status_code == 200, response.text
    assert "先取上月同期基线" in response.json()["content"]


def test_skill_not_bound_to_profile_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/agent-team/profiles/EMP-20/skills/sk-not-mine", headers=_auth())
    assert response.status_code == 404


def _auth() -> dict[str, str]:
    import time

    import jwt as pyjwt

    now = int(time.time())
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": ["tenant-acme"]},
            "tenant_id": "tenant-acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
