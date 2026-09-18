"""评测报告的组装与渲染（MP-EVAL-GOLDEN-01 / C-6）。

机器可读的 JSON 是**主交付**（CI / 看板消费它），人读摘要只是它的一个视图。
两者都从同一个 :class:`~.scorer.ScoreReport` 出来，避免"给人看的"和"给机器看的"
各说各话。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .dataset import GoldenDataset
from .scorer import ScoreReport

#: 报告格式版本——消费方据此知道字段怎么读。
REPORT_VERSION = "golden-report/v1"


@dataclass(frozen=True, slots=True)
class EvalReport:
    dataset_version: str
    dataset_created_at: str
    tenant_id: str
    started_at: str
    finished_at: str
    provider_probe: dict[str, Any]
    score: ScoreReport
    #: 假回执（回显 / 零模型调用）的整轮检出记录——非空即代表本次评测**不可信**。
    fake_receipts: tuple[str, ...]
    notes: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "report_version": REPORT_VERSION,
            "dataset": {
                "version": self.dataset_version,
                "created_at": self.dataset_created_at,
                "tenant_id": self.tenant_id,
            },
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "provider_probe": self.provider_probe,
            "fake_receipts": list(self.fake_receipts),
            "valid": not self.fake_receipts,
            "metrics": self.score.as_dict()["metrics"],
            "per_task": self.score.per_task,
            "notes": list(self.notes),
        }

    def to_json(self) -> str:
        return json.dumps(self.as_dict(), ensure_ascii=False, indent=2, sort_keys=False)

    def write(self, path: str | Path) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.to_json() + "\n", encoding="utf-8")
        return target

    def summary_lines(self) -> list[str]:
        """人读摘要（表格）。算不出的指标显式打 ``not_computed`` + 原因。"""
        lines = [
            f"Golden Evaluation ({self.dataset_version}) · 租户 {self.tenant_id}",
            f"  起止：{self.started_at} → {self.finished_at}",
            f"  provider 探活：{self.provider_probe.get('summary', '')}",
        ]
        if self.fake_receipts:
            lines.append(f"  ⚠ 检出假回执 {len(self.fake_receipts)} 条 —— 本次结果**不可信**")
            for item in self.fake_receipts:
                lines.append(f"      - {item}")
        lines.append("")
        lines.append(f"  {'指标':<22} {'值':>12}  {'状态':<14} 说明")
        for metric in self.score.metrics:
            if metric.status == "computed":
                value = f"{metric.value}"
                reason = ""
            else:
                value = "—"
                reason = f"未计算：{metric.reason}"
            lines.append(f"  {metric.label:<20} {value:>12}  {metric.status:<14} {reason}")
        if self.notes:
            lines.append("")
            for note in self.notes:
                lines.append(f"  注：{note}")
        return lines


def build_report(
    *,
    dataset: GoldenDataset,
    score: ScoreReport,
    provider_probe: dict[str, Any],
    started_at: str,
    finished_at: str,
    fake_receipts: list[str],
    notes: list[str] | None = None,
) -> EvalReport:
    return EvalReport(
        dataset_version=dataset.version,
        dataset_created_at=dataset.created_at,
        tenant_id=dataset.tenant_id,
        started_at=started_at,
        finished_at=finished_at,
        provider_probe=provider_probe,
        score=score,
        fake_receipts=tuple(fake_receipts),
        notes=tuple(notes or []),
    )


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


__all__ = ["EvalReport", "REPORT_VERSION", "build_report", "now_iso"]
