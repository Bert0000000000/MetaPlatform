"""Golden Evaluation（MP-EVAL-GOLDEN-01 / C-6）——在**真实 provider** 上评测
「模型能不能稳定完成企业任务」。

本子包只做评测，不参与运行期装配：

* :mod:`.dataset` —— 固定版本的 Golden Dataset 加载与校验；
* :mod:`.trace` —— 把 run 回执归一成可判分的轨迹，并守**假回执**的关口；
* :mod:`.scorer` —— 十一项指标的纯函数实现（确定性、可单测）；
* :mod:`.client` —— 走生产同一条链的真实 HTTP 客户端（探活失败即整轮退出）；
* :mod:`.report` —— 机读 JSON 报告 + 人读摘要；
* :mod:`.run_golden` —— CLI：``python -m mate_tech_agent_team.eval.run_golden``。

跑一次::

    python -m mate_tech_agent_team.eval.run_golden --out .tmp/golden-report.json
"""

from __future__ import annotations

from .client import AgentTeamClient, ProviderUnavailable, RunTimedOut, TimedRun
from .dataset import DatasetError, GoldenDataset, GoldenTask, load_dataset
from .report import EvalReport, build_report
from .scorer import Metric, ScoreReport, score
from .trace import (
    EmployeeResult,
    FakeReceiptError,
    RunTrace,
    assert_real_provider,
    parse_run_state,
)

__all__ = [
    "AgentTeamClient",
    "DatasetError",
    "EmployeeResult",
    "EvalReport",
    "FakeReceiptError",
    "GoldenDataset",
    "GoldenTask",
    "Metric",
    "ProviderUnavailable",
    "RunTimedOut",
    "RunTrace",
    "ScoreReport",
    "TimedRun",
    "assert_real_provider",
    "build_report",
    "load_dataset",
    "parse_run_state",
    "score",
]
