"""1.1 任务 5 · 深度闸门（``max_depth``，默认 3）。

嵌套派活必须有上限，否则一次"帮我查一下"可以无限裂变。默认 3 对齐
Codex 的 ``agents.max_depth`` 与 Claude Code 的默认 3 层。

计数约定：根任务 ``depth=0``；它的子员工 ``depth=1``。**请求的 depth 就是
子任务自己的层号**，判定是 ``depth <= max_depth`` —— 于是 depth=3 放行、
depth=4 被拒（"第 4 层被拒、第 3 层放行"的判据）。

深度闸门在**派活入口**判定，不是靠子员工自觉：子员工默认也拿不到 spawn 工具
（ADR-0066 R3），两道一起才拦得住。
"""

from __future__ import annotations

import pytest
from mate_tech_agent_team.authority import Envelope
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileNotFound
from mate_tech_agent_team.team_bus import DepthExceeded, SpawnRequest, TeamBus

TENANT = "tenant-acme"
USER_ENVELOPE = Envelope(
    tools=frozenset({"ont_object_query", "read_skill"}),
    action_rids=frozenset(),
    kb_ids=frozenset({"kb-orders"}),
    markings=frozenset({"internal"}),
)


class _Registry:
    def __init__(self) -> None:
        self._profile = EmployeeProfile(
            profile_id="EMP-CHILD",
            name="子员工",
            base_role="ontology",
            system_prompt="你是子员工。",
            tools=("ont_object_query",),
            kb_ids=("kb-orders",),
            markings=("internal",),
        )

    async def get(self, profile_id: str, tenant_id: str = "") -> EmployeeProfile:
        if profile_id != self._profile.profile_id or tenant_id != TENANT:
            raise ProfileNotFound(profile_id)
        return self._profile

    async def list(self, tenant_id: str = "") -> list[EmployeeProfile]:
        return [self._profile] if tenant_id == TENANT else []


def _request(depth: int, **overrides: object) -> SpawnRequest:
    base: dict[str, object] = {
        "tenant_id": TENANT,
        "profile_id": "EMP-CHILD",
        "initiator_envelope": USER_ENVELOPE,
        "instruction": "继续细分",
        "depth": depth,
    }
    base.update(overrides)
    return SpawnRequest(**base)  # type: ignore[arg-type]


# ── 默认 3 ───────────────────────────────────────────────────────────────


def test_default_max_depth_is_three() -> None:
    assert TeamBus(registry=_Registry()).max_depth == 3


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.asyncio
async def test_depths_up_to_the_limit_are_allowed(depth: int) -> None:
    outcome = await TeamBus(registry=_Registry()).spawn(_request(depth))
    assert outcome.depth == depth
    assert outcome.requires_approval is False


@pytest.mark.asyncio
async def test_the_fourth_level_is_rejected() -> None:
    with pytest.raises(DepthExceeded) as excinfo:
        await TeamBus(registry=_Registry()).spawn(_request(4))
    assert excinfo.value.depth == 4
    assert excinfo.value.max_depth == 3


@pytest.mark.asyncio
async def test_depth_check_runs_before_the_envelope_check() -> None:
    """深度超限就是超限，不该被"顺便也算扩权"掩盖成 proposal。"""
    with pytest.raises(DepthExceeded):
        await TeamBus(registry=_Registry()).spawn(_request(9))


@pytest.mark.asyncio
async def test_zero_depth_is_the_root_task() -> None:
    """根任务（depth=0）本身不受闸门限制——它还没"派"出去。"""
    outcome = await TeamBus(registry=_Registry()).spawn(_request(0))
    assert outcome.depth == 0


# ── 可配置上限 ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_limit_is_configurable() -> None:
    bus = TeamBus(registry=_Registry(), max_depth=1)
    assert (await bus.spawn(_request(1))).depth == 1
    with pytest.raises(DepthExceeded):
        await bus.spawn(_request(2))


def test_max_depth_must_be_non_negative() -> None:
    with pytest.raises(ValueError):
        TeamBus(registry=_Registry(), max_depth=-1)


# ── 闸门拒绝时不留痕 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rejected_spawn_produces_no_task() -> None:
    bus = TeamBus(registry=_Registry())
    with pytest.raises(DepthExceeded):
        await bus.spawn(_request(4))
    assert bus.task_ids() == []


@pytest.mark.asyncio
async def test_allowed_spawn_registers_the_task() -> None:
    bus = TeamBus(registry=_Registry())
    outcome = await bus.spawn(_request(2))
    assert outcome.task_id in bus.task_ids()
