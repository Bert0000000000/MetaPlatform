#!/usr/bin/env python3
"""check_prd_skeleton.py — PRD + ACCEPTANCE 骨架校验

用途：Cowork Phase A 产出的文档必须满足以下最小骨架，否则 CI 红。
退出码：0 = 通过；非 0 = 失败（仅在 --strict 下生效；默认仅打印）。
依赖：仅 Python 标准库。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# 必需节（PRD §0~§6，与 LOOP-ROLLOUT-01 PRD 模板对齐）
REQUIRED_PRD_SECTIONS: tuple[str, ...] = (
    "## §0",  # 背景 & 目标
    "## §1",  # 范围 / 非范围
    "## §2",  # 功能需求
    "## §3",  # 非功能需求
    "## §4",  # 验收标准
    "## §5",  # 依赖
    "## §6",  # 风险与未决
)

# ACCEPTANCE 必须出现的 13 个 ga-* job（与 ga-acceptance.yml 对齐）
REQUIRED_GA_JOBS: tuple[str, ...] = (
    "ga-001", "ga-002", "ga-003", "ga-004", "ga-005", "ga-006",
    "ga-007", "ga-008", "ga-009", "ga-010", "ga-011", "ga-012", "ga-013",
)

# 编译正则
_RE_PRD_FILE = re.compile(r".*-prd\.md$", re.IGNORECASE)
_RE_ACCEPTANCE_FILE = re.compile(r".*-ACCEPTANCE\.md$", re.IGNORECASE)
_RE_FR = re.compile(r"\bFR-\d+\b")
_RE_AC = re.compile(r"\bAC-\d+\b")
_RE_NFR = re.compile(r"\bNFR-\d+\b")
_RE_ADR = re.compile(r"\bADR-\d{4}\b")


def check_prd_file(path: Path, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    missing = [s for s in REQUIRED_PRD_SECTIONS if s not in text]
    if missing:
        errors.append(f"{path.name}: 缺节 {missing}")
    if not _RE_FR.search(text):
        errors.append(f"{path.name}: 未发现 FR-* 编号")
    if not _RE_AC.search(text):
        errors.append(f"{path.name}: 未发现 AC-* 编号")
    if not _RE_NFR.search(text):
        errors.append(f"{path.name}: 未发现 NFR-* 编号")
    if not _RE_ADR.search(text):
        errors.append(f"{path.name}: 未引用任何 ADR-xxxx")


def check_acceptance_file(path: Path, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    missing = [g for g in REQUIRED_GA_JOBS if g not in text]
    if missing:
        errors.append(f"{path.name}: 缺 ga-* 字段 {missing}")
    if "证据" not in text:
        errors.append(f"{path.name}: 缺「证据」字段")
    if "命令" not in text:
        errors.append(f"{path.name}: 缺「命令」字段")
    if "commit" not in text.lower():
        errors.append(f"{path.name}: 缺「commit」字段")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--prd-dir",
        default="docs/active/specs",
        type=Path,
        help="PRD 文件目录",
    )
    parser.add_argument(
        "--evidence-dir",
        default="docs/active/delivery/evidence",
        type=Path,
        help="ACCEPTANCE 文件目录",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="严格模式：失败即非 0 退出（CI 默认开启）",
    )
    args = parser.parse_args()

    errors: list[str] = []

    prd_files = [p for p in args.prd_dir.glob("*-prd.md") if _RE_PRD_FILE.search(p.name)]
    if not prd_files:
        errors.append(f"未发现 PRD 文件（{args.prd_dir}/**/*-prd.md）")

    for p in prd_files:
        check_prd_file(p, errors)

    acceptance_files = [
        p for p in args.evidence_dir.glob("*-ACCEPTANCE.md")
        if _RE_ACCEPTANCE_FILE.search(p.name)
    ]
    if not acceptance_files:
        errors.append(f"未发现 ACCEPTANCE 文件（{args.evidence_dir}/**/*-ACCEPTANCE.md）")

    for p in acceptance_files:
        check_acceptance_file(p, errors)

    if errors:
        print("❌ PRD 骨架校验失败：")
        for e in errors:
            print(f"  - {e}")
        return 1 if args.strict else 0

    print(
        f"✅ PRD 骨架校验通过 "
        f"（{len(prd_files)} PRD + {len(acceptance_files)} ACCEPTANCE）"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())