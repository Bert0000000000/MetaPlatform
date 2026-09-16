"""1.1 任务 4 · 权限包络衰减（ADR-0066 §3.3 是设计原文）。

包络 = ``(tools, action_rids, kb_ids, markings)``（四类集合的并）。不变量：

```
用户权限包络 ⊇ 子 agent 包络
```

链的**根是发起用户**，不是父 agent —— SuperAI 只是代用户行事，不是超级用户。
所以判定一律对着 ``initiator_envelope`` 做，而不是对着"父 agent 当时拿到了
什么"做。

审批档位（§3.4 / R5）：**不扩权即免审，扩权才审**；提权授权只作用于**本次任务**，
不落成 blanket grant。

本文件是这条安全关键路径的 negative 矩阵——逐维越权、多维越权、跨租户、
收窄放行、授权作用域，一条不落。
"""

from __future__ import annotations

import pytest
from mate_tech_agent_team.authority import (
    DepthExceeded,
    Envelope,
)
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry
from mate_tech_agent_team.team_bus import SpawnRequest, TeamBus

TENANT = "tenant-acme"

#: 发起用户（链根）能碰的东西。
USER_ENVELOPE = Envelope(
    tools=frozenset({"ont_list_classes", "ont_object_query", "read_skill"}),
    action_rids=frozenset({"ont.create_link"}),
    kb_ids=frozenset({"kb-orders", "kb-handbook"}),
    markings=frozenset({"internal"}),
)


def _profile(profile_id: str = "EMP-CHILD", **overrides: object) -> EmployeeProfile:
    base: dict[str, object] = {
        "profile_id": profile_id,
        "name": "子员工",
        "base_role": "ontology",
        "system_prompt": "你是子员工。",
        "tools": ("ont_object_query",),
        "action_rids": (),
        "kb_ids": ("kb-orders",),
        "markings": ("internal",),
    }
    base.update(overrides)
    return EmployeeProfile(**base)  # type: ignore[arg-type]


class _Registry:
    """按租户回名册的替身：``profiles`` 指定哪个租户能看见哪些员工。"""

    def __init__(self, by_tenant: dict[str, list[EmployeeProfile]]) -> None:
        self._by_tenant = by_tenant

    async def get(self, profile_id: str, tenant_id: str = "") -> EmployeeProfile:
        for p in self._by_tenant.get(tenant_id, []):
            if p.profile_id == profile_id:
                return p
        raise ProfileNotFound(profile_id)

    async def list(self, tenant_id: str = "") -> list[EmployeeProfile]:
        return list(self._by_tenant.get(tenant_id, []))


def _bus(**kwargs: object) -> TeamBus:
    registry = kwargs.pop("registry", None) or _Registry({TENANT: [_profile()]})
    return TeamBus(registry=registry, **kwargs)  # type: ignore[arg-type]


def _request(**overrides: object) -> SpawnRequest:
    base: dict[str, object] = {
        "tenant_id": TENANT,
        "profile_id": "EMP-CHILD",
        "initiator_envelope": USER_ENVELOPE,
        "instruction": "核对本月差异项",
        "depth": 1,
    }
    base.update(overrides)
    return SpawnRequest(**base)  # type: ignore[arg-type]


# ── 包络本身 ─────────────────────────────────────────────────────────────


def test_envelope_subset_is_set_arithmetic() -> None:
    narrow = Envelope(tools=frozenset({"ont_object_query"}))
    assert narrow.is_subset_of(USER_ENVELOPE)
    assert not USER_ENVELOPE.is_subset_of(narrow)
    assert USER_ENVELOPE.escalations_over(USER_ENVELOPE) == ()


def test_envelope_reports_the_escalating_dimension() -> None:
    wider = Envelope(tools=frozenset({"ont_object_query"}), action_rids=frozenset({"ont.delete"}))
    assert wider.escalations_over(USER_ENVELOPE) == ("action_rids",)


def test_envelope_narrows_tools_by_intersection() -> None:
    narrowed = USER_ENVELOPE.narrow_tools(["ont_object_query", "not_held"])
    assert narrowed.tools == frozenset({"ont_object_query"})
    assert narrowed.action_rids == USER_ENVELOPE.action_rids


# ── 只收窄 → 放行且不产 proposal ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_narrower_child_is_granted_without_a_proposal() -> None:
    outcome = await _bus().spawn(_request())
    assert outcome.requires_approval is False
    assert outcome.proposal is None
    assert outcome.envelope.tools == frozenset({"ont_object_query"})
    assert outcome.envelope.is_subset_of(USER_ENVELOPE)


@pytest.mark.asyncio
async def test_identical_envelope_is_not_an_escalation() -> None:
    """等于上级不算扩权——子集判定是 ⊆，不是 ⊂。"""
    registry = _Registry({TENANT: [_profile(tools=tuple(USER_ENVELOPE.tools))]})
    bus = _bus(registry=registry)
    child = _profile(
        "EMP-EQ",
        tools=tuple(USER_ENVELOPE.tools),
        action_rids=tuple(USER_ENVELOPE.action_rids),
        kb_ids=tuple(USER_ENVELOPE.kb_ids),
        markings=tuple(USER_ENVELOPE.markings),
    )
    registry._by_tenant[TENANT] = [child]
    outcome = await bus.spawn(_request(profile_id="EMP-EQ"))
    assert outcome.requires_approval is False


@pytest.mark.asyncio
async def test_tool_scope_can_only_narrow() -> None:
    """``tool_scope`` 是收窄通道——写进一个上级没有的工具不会因此拿到它。"""
    outcome = await _bus().spawn(_request(tool_scope=("ont_object_query", "ont_merge_objects")))
    assert outcome.requires_approval is False
    assert outcome.envelope.tools == frozenset({"ont_object_query"})
    assert "ont_merge_objects" not in outcome.envelope.tools


# ── 扩权 → proposal 人审（不是 403）──────────────────────────────────────
# 选 proposal 而不是 403 的理由见模块尾注：D-4「扩权才审」，403 会把
# "需要授权"与"根本不允许"混成同一种失败。


@pytest.mark.asyncio
async def test_tool_escalation_requires_approval() -> None:
    registry = _Registry({TENANT: [_profile(tools=("ont_object_query", "ont_merge_objects"))]})
    outcome = await _bus(registry=registry).spawn(_request())

    assert outcome.requires_approval is True
    assert outcome.proposal is not None
    assert outcome.envelope.tools == frozenset()  # 未批准前不产出可用包络
    assert outcome.escalations == ("tools",)


@pytest.mark.asyncio
async def test_action_rid_escalation_requires_approval() -> None:
    registry = _Registry({TENANT: [_profile(action_rids=("ont.delete_link",))]})
    outcome = await _bus(registry=registry).spawn(_request())
    assert outcome.requires_approval is True
    assert outcome.escalations == ("action_rids",)


@pytest.mark.asyncio
async def test_kb_escalation_requires_approval() -> None:
    registry = _Registry({TENANT: [_profile(kb_ids=("kb-orders", "kb-salaries"))]})
    outcome = await _bus(registry=registry).spawn(_request())
    assert outcome.requires_approval is True
    assert outcome.escalations == ("kb_ids",)


@pytest.mark.asyncio
async def test_marking_escalation_requires_approval() -> None:
    registry = _Registry({TENANT: [_profile(markings=("internal", "confidential"))]})
    outcome = await _bus(registry=registry).spawn(_request())
    assert outcome.requires_approval is True
    assert outcome.escalations == ("markings",)


@pytest.mark.asyncio
async def test_multi_dimension_escalation_lists_every_dimension() -> None:
    registry = _Registry(
        {TENANT: [_profile(tools=("ont_merge_objects",), kb_ids=("kb-salaries",))]}
    )
    outcome = await _bus(registry=registry).spawn(_request())
    assert outcome.requires_approval is True
    assert set(outcome.escalations) == {"tools", "kb_ids"}


# ── 链根是用户，不是父 agent（D-3）──────────────────────────────────────
@pytest.mark.asyncio
async def test_ceiling_is_the_user_even_when_a_parent_holds_more() -> None:
    """父 agent 手里有更大的包络也不能把它传下去。"""
    registry = _Registry({TENANT: [_profile(tools=("ont_merge_objects",))]})
    bus = _bus(registry=registry)
    # 父 agent 自己是扩权拿到的（未经用户批准），子员工不能因此被放行。
    outcome = await bus.spawn(_request(parent_task_id="task-parent-out-of-band"))
    assert outcome.requires_approval is True
    assert outcome.escalations == ("tools",)


# ── 提权授权只限本次任务（R5）───────────────────────────────────────────
@pytest.mark.asyncio
async def test_grant_is_scoped_to_one_task() -> None:
    registry = _Registry({TENANT: [_profile(tools=("ont_object_query", "ont_merge_objects"))]})
    bus = _bus(registry=registry)

    pending = await bus.spawn(_request())
    assert pending.requires_approval is True

    await bus.grant(pending.task_id)
    granted = bus.envelope_for(pending.task_id)
    assert granted.tools == frozenset({"ont_object_query", "ont_merge_objects"})

    # 另一次派活**不**继承这次授权
    other = await bus.spawn(_request())
    assert other.requires_approval is True
    assert bus.envelope_for(other.task_id).tools == frozenset()


@pytest.mark.asyncio
async def test_revoke_takes_the_grant_back() -> None:
    registry = _Registry({TENANT: [_profile(tools=("ont_merge_objects",))]})
    bus = _bus(registry=registry)
    pending = await bus.spawn(_request())
    await bus.grant(pending.task_id)
    assert bus.envelope_for(pending.task_id).tools == frozenset({"ont_merge_objects"})
    bus.revoke(pending.task_id)
    assert bus.envelope_for(pending.task_id).tools == frozenset()


@pytest.mark.asyncio
async def test_grant_is_not_persisted_to_the_registry() -> None:
    """提权授权不是改员工定义——库里的 profile 一个字节都不动。"""
    profile = _profile(tools=("ont_object_query", "ont_merge_objects"))
    registry = _Registry({TENANT: [profile]})
    bus = _bus(registry=registry)
    pending = await bus.spawn(_request())
    await bus.grant(pending.task_id)
    assert (await registry.get("EMP-CHILD", TENANT)).tools == (
        "ont_object_query",
        "ont_merge_objects",
    )


# ── 跨租户负例 ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_profile_from_another_tenant_is_not_found() -> None:
    registry = _Registry({"tenant-other": [_profile("EMP-THEIRS")]})
    bus = TeamBus(registry=registry)
    with pytest.raises(ProfileNotFound):
        await bus.spawn(_request(profile_id="EMP-THEIRS"))


@pytest.mark.asyncio
async def test_tenant_id_is_required() -> None:
    with pytest.raises(ValueError):
        await _bus().spawn(_request(tenant_id=""))


# ── 真实 registry（含落库行）也守同一条不变量 ───────────────────────────
@pytest.mark.asyncio
async def test_works_against_the_real_registry_interface() -> None:
    registry = ProfileRegistry([_profile()])
    bus = TeamBus(registry=registry)
    outcome = await bus.spawn(_request(tenant_id="tenant-acme"))
    assert outcome.requires_approval is False


def test_depth_exceeded_is_exported_for_callers() -> None:
    """深度闸门（任务 5）与包络同属派活闸门，错误类型一并从这里出。"""
    assert issubclass(DepthExceeded, Exception)
