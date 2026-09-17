"""Golden Dataset 加载与校验（MP-EVAL-GOLDEN-01 / C-6）。

守两类东西：**包内那份数据集本身**是合法的（否则评测从第一步就不可信），
以及**加载器真的会挡住**写坏的数据集（期望角色不在名册 / 期望 RID 不在真值
快照 / 重复 id / 拆解下界）。
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
from mate_tech_agent_team.eval.dataset import (
    DatasetError,
    default_dataset_path,
    load_dataset,
)


def _write(tmp_path: Path, body: str) -> Path:
    target = tmp_path / "dataset.yaml"
    target.write_text(textwrap.dedent(body), encoding="utf-8")
    return target


_MINIMAL = """
    version: "test/v1"
    created_at: "2026-09-18"
    tenant_id: "t-1"
    roster: ["EMP-ANALYST", "EMP-AUDITOR"]
    sensitive_tools: ["ont_propose_instance"]
    known_rids:
      - "ont.t-1.obj.order.v1"
    tasks:
      - id: "T-1"
        goal: "查订单"
        expected_roles: ["EMP-ANALYST"]
        required_aspects: ["订单"]
        expected_tools: ["ont_list_classes"]
        expected_rids: ["ont.t-1.obj.order.v1"]
        min_subtasks: 2
"""


# ── 包内那份数据集 ──────────────────────────────────────────────────────


def test_shipped_dataset_loads_and_is_self_consistent() -> None:
    dataset = load_dataset()
    assert dataset.version == "golden/v1"
    assert dataset.tenant_id == "tenant-default"
    # 4 个任务足够覆盖四类真实本体数据；RID 真值快照来自部署态本体。
    assert len(dataset.tasks) == 4
    assert len(dataset.known_rids) >= 40
    ids = [t.id for t in dataset.tasks]
    assert len(ids) == len(set(ids))
    # 每个任务的期望 RID 都必须在真值快照里（load_dataset 已校验，这里再钉死）。
    shipped = {r for t in dataset.tasks for r in t.expected_rids}
    assert shipped <= set(dataset.known_rids)
    # 每个任务的期望角色都必须在名册里。
    assert {r for t in dataset.tasks for r in t.expected_roles} <= set(dataset.roster)


def test_default_dataset_path_points_at_the_packaged_file() -> None:
    path = default_dataset_path()
    assert path.name == "golden_dataset.yaml"
    assert path.is_file(), f"包内数据集不在预期位置：{path}"


# ── 加载器的守门 ────────────────────────────────────────────────────────


def test_minimal_dataset_round_trips(tmp_path: Path) -> None:
    dataset = load_dataset(_write(tmp_path, _MINIMAL))
    assert dataset.tasks[0].id == "T-1"
    assert dataset.tasks[0].expected_rids == ("ont.t-1.obj.order.v1",)
    assert dataset.sensitive_tools == ("ont_propose_instance",)


def test_expected_role_outside_roster_is_refused(tmp_path: Path) -> None:
    """期望一个名册里没有的员工 = 判据凭空造出来的，必须挡下。"""
    body = _MINIMAL.replace('expected_roles: ["EMP-ANALYST"]', 'expected_roles: ["EMP-GHOST"]')
    with pytest.raises(DatasetError, match="名册"):
        load_dataset(_write(tmp_path, body))


def test_expected_rid_outside_truth_snapshot_is_refused(tmp_path: Path) -> None:
    """这是本模块最想守的一条：期望的 RID 必须是本体真值里真的有的。"""
    body = _MINIMAL.replace(
        'expected_rids: ["ont.t-1.obj.order.v1"]',
        'expected_rids: ["ont.t-1.obj.payment-not-exist.v9"]',
    )
    with pytest.raises(DatasetError, match="known_rids"):
        load_dataset(_write(tmp_path, body))


_DUPLICATE_ID = """
version: "test/v1"
created_at: "2026-09-18"
tenant_id: "t-1"
roster: ["EMP-ANALYST"]
sensitive_tools: ["ont_propose_instance"]
known_rids:
  - "ont.t-1.obj.order.v1"
tasks:
  - id: "T-1"
    goal: "查订单"
    expected_roles: ["EMP-ANALYST"]
    required_aspects: ["订单"]
    expected_tools: ["ont_list_classes"]
    expected_rids: ["ont.t-1.obj.order.v1"]
  - id: "T-1"
    goal: "重复 id"
    expected_roles: ["EMP-ANALYST"]
    required_aspects: ["订单"]
    expected_tools: ["ont_list_classes"]
    expected_rids: ["ont.t-1.obj.order.v1"]
"""


def test_duplicate_task_id_is_refused(tmp_path: Path) -> None:
    with pytest.raises(DatasetError, match="重复"):
        load_dataset(_write(tmp_path, _DUPLICATE_ID))


def test_min_subtasks_below_two_is_refused(tmp_path: Path) -> None:
    """与 LlmPlanner 同一条下界：拆出 1 件不叫"拆解"。"""
    body = _MINIMAL.replace("min_subtasks: 2", "min_subtasks: 1")
    with pytest.raises(DatasetError, match="至少是 2"):
        load_dataset(_write(tmp_path, body))


def test_empty_known_rids_is_refused(tmp_path: Path) -> None:
    """没有真值快照，RID 正确率无从判起——宁可加载失败。"""
    body = _MINIMAL.replace(
        '    known_rids:\n      - "ont.t-1.obj.order.v1"\n', "    known_rids: []\n"
    )
    with pytest.raises(DatasetError, match="known_rids 不能为空"):
        load_dataset(_write(tmp_path, body))


def test_missing_file_is_refused(tmp_path: Path) -> None:
    with pytest.raises(DatasetError, match="不存在"):
        load_dataset(tmp_path / "nope.yaml")
