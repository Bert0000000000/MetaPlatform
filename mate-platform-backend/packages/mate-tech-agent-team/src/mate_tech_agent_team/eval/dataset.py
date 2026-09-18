"""Golden Dataset 的加载与校验（MP-EVAL-GOLDEN-01 / C-6）。

数据集是**固定版本、随包冻结**的一份判据清单：每个任务写明「一个合格答案必须
具备什么」。加载器只做两件事——把 YAML 变成不可变的 dataclass，并在**加载期**
就把写坏的数据集挡下来（重复 task id、期望角色不在名册里、RID 不在真值快照里、
`min_subtasks < 2`）。理由与 ``LlmPlanner._parse`` 同源：把"数据集本身写错了"
伪装成"模型答得不好"，是最贵的一种假信号。

**不编造平台事实**：``expected_rids`` 里的每个 RID 都必须落在 ``known_rids``
（部署态本体真值快照）内，否则加载即失败——防止有人往期望里塞一个本体根本没有
的对象，那会让"RID 正确率"从测量变成愿望。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


class DatasetError(ValueError):
    """数据集文件不合法（缺字段 / 自相矛盾 / 引用不存在的真值）。"""


#: 数据集的默认位置：包根下的 ``eval/golden_dataset.yaml``。
#: 从 ``.../mate-tech-agent-team/src/mate_tech_agent_team/eval/dataset.py`` 上溯
#: 三级到包根，再进 ``eval/``。刻意不放进 wheel 的 package-data：评测集是
#: **开发者/CI 工具**，不是运行期依赖，跟着仓库走比跟着镜像走更对。
def default_dataset_path() -> Path:
    return Path(__file__).resolve().parents[3] / "eval" / "golden_dataset.yaml"


@dataclass(frozen=True, slots=True)
class GoldenTask:
    """一个评测任务 + 它的判据。"""

    id: str
    title: str
    goal: str
    max_parallel: int
    min_subtasks: int
    expected_roles: tuple[str, ...]
    required_aspects: tuple[str, ...]
    expected_tools: tuple[str, ...]
    expected_rids: tuple[str, ...]
    min_evidence: int
    requires_approval: bool


@dataclass(frozen=True, slots=True)
class GoldenDataset:
    version: str
    created_at: str
    tenant_id: str
    roster: tuple[str, ...]
    sensitive_tools: tuple[str, ...]
    known_rids: frozenset[str]
    tasks: tuple[GoldenTask, ...]


def _require(mapping: dict[str, Any], key: str, where: str) -> Any:
    if key not in mapping or mapping[key] in (None, ""):
        raise DatasetError(f"{where} 缺少必填字段 {key!r}")
    return mapping[key]


def _str_tuple(mapping: dict[str, Any], key: str) -> tuple[str, ...]:
    raw = mapping.get(key) or []
    if not isinstance(raw, list):
        raise DatasetError(f"{key!r} 必须是列表，得到 {type(raw).__name__}")
    return tuple(str(x) for x in raw)


def _build_task(raw: dict[str, Any], *, roster: set[str], known_rids: frozenset[str]) -> GoldenTask:
    where = f"任务 {raw.get('id')!r}"
    task_id = str(_require(raw, "id", where))
    raw_roles = _str_tuple(raw, "expected_roles")
    unknown_roles = [r for r in raw_roles if r not in roster]
    if unknown_roles:
        raise DatasetError(f"{where} 期望的员工不在名册里：{'、'.join(unknown_roles)}")
    raw_rids = _str_tuple(raw, "expected_rids")
    unknown_rids = [r for r in raw_rids if r not in known_rids]
    if unknown_rids:
        # 这是本模块最想守的一条：期望的 RID 必须是本体真值里真的有的。
        raise DatasetError(
            f"{where} 期望的 RID 不在 known_rids 真值快照里（会凭空造出一个判据）："
            f"{'、'.join(unknown_rids)}"
        )
    min_subtasks = int(raw.get("min_subtasks", 2))
    if min_subtasks < 2:
        # 与 LlmPlanner 同一条下界：拆出 1 件不叫"拆解"。
        raise DatasetError(f"{where} 的 min_subtasks={min_subtasks}，拆解至少是 2 件")
    return GoldenTask(
        id=task_id,
        title=str(raw.get("title") or task_id),
        goal=str(_require(raw, "goal", where)),
        max_parallel=int(raw.get("max_parallel", 3)),
        min_subtasks=min_subtasks,
        expected_roles=raw_roles,
        required_aspects=_str_tuple(raw, "required_aspects"),
        expected_tools=_str_tuple(raw, "expected_tools"),
        expected_rids=raw_rids,
        min_evidence=int(raw.get("min_evidence", 0)),
        requires_approval=bool(raw.get("requires_approval", True)),
    )


def load_dataset(path: str | Path | None = None) -> GoldenDataset:
    """读入并校验数据集。任何不合法都抛 :class:`DatasetError`（不静默降级）。"""
    target = Path(path) if path is not None else default_dataset_path()
    if not target.is_file():
        raise DatasetError(f"数据集文件不存在：{target}")
    with target.open(encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)
    if not isinstance(payload, dict):
        raise DatasetError(f"数据集顶层必须是映射：{target}")

    known_rids = frozenset(_str_tuple(payload, "known_rids"))
    if not known_rids:
        raise DatasetError("known_rids 不能为空——没有真值快照，RID 正确率无从判起")
    roster = _str_tuple(payload, "roster")
    raw_tasks = payload.get("tasks")
    if not isinstance(raw_tasks, list) or not raw_tasks:
        raise DatasetError("tasks 必须是非空列表")

    tasks: list[GoldenTask] = []
    seen: set[str] = set()
    for raw in raw_tasks:
        if not isinstance(raw, dict):
            raise DatasetError("每个 task 必须是映射")
        task = _build_task(raw, roster=set(roster), known_rids=known_rids)
        if task.id in seen:
            raise DatasetError(f"task id 重复：{task.id}")
        seen.add(task.id)
        tasks.append(task)

    return GoldenDataset(
        version=str(payload.get("version") or "unknown"),
        created_at=str(payload.get("created_at") or ""),
        tenant_id=str(payload.get("tenant_id") or "tenant-default"),
        roster=roster,
        sensitive_tools=_str_tuple(payload, "sensitive_tools"),
        known_rids=known_rids,
        tasks=tuple(tasks),
    )


__all__ = [
    "DatasetError",
    "GoldenDataset",
    "GoldenTask",
    "default_dataset_path",
    "load_dataset",
]
