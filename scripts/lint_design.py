#!/usr/bin/env python3
"""
lint_design.py — MetaPlatform 设计规范静态检查器

设计规范源: .design_library/metaplatform/components/*.json + colors_and_type.css

扫描 src/**/*.tsx? 文件, 检测违规模式:
  1. 任意字号: text-[10px] / text-[11px] / text-[13px] 等 (应用 token: xs/sm/base)
  2. 任意圆角: rounded-[3px] / rounded-[7px] 等 (应用 token: sm/md/lg/full)
  3. 任意阴影: shadow-[0_4px_8px] (应用 token: sm/md/lg/float)
  4. 渐变: bg-gradient-to-* (违规 — 应用纯色)
  5. 禁止的多彩: bg-amber-* / bg-violet-* (除 emerald state 外, 都用主色或中性)
  6. 自定义彩色 badge: bg-blue-50 + text-primary 组合 (violates badge.json)

退出码:
  0 = 全部通过
  1 = 有违规

用法:
  python scripts/lint_design.py
  python scripts/lint_design.py --fix   # 自动修复部分违规
  python scripts/lint_design.py --strict  # 任何违规都报错
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Tuple, Dict

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src"

# ─── 违规规则 ──────────────────────────────────────────────────────────
# 每条规则: (name, regex, severity, fix_function 或 None, message)

RULES: List[Dict] = [
    # 1. 任意字号 — 用 token (xs/sm/base/lg/xl/2xl)
    {
        "name": "arbitrary-font-size",
        "regex": re.compile(r"text-\[(\d+(?:\.\d+)?)px\]"),
        "severity": "error",
        "message": "用 text token (text-xs/text-sm/text-base) 而非 text-[Npx]",
        "fix_to": {
            9: "text-xs", 10: "text-xs", 11: "text-xs", 12: "text-xs",
            13: "text-sm", 14: "text-sm", 15: "text-base", 16: "text-base",
            18: "text-lg", 20: "text-xl", 22: "text-2xl", 24: "text-2xl",
        },
    },
    # 2. 任意圆角 — 用 token (sm/md/lg/full)
    # 例外: rounded-[2px] 用作三角箭头 (shadcn tooltip/popover), 不修正
    {
        "name": "arbitrary-radius",
        "regex": re.compile(r"rounded-\[(\d+(?:\.\d+)?)px\]"),
        "severity": "error",
        "message": "用 rounded token (rounded-sm/md/lg/full) 而非 rounded-[Npx]",
        "fix_to": {
            3: "rounded-sm", 4: "rounded-md", 6: "rounded-lg", 8: "rounded-lg",
            2: "rounded-[2px]",  # arrow tip
        },
    },
    # 3. 任意阴影 — inset 阴影用作 tab 下划线指示器是合规的 (例如 shadow-[inset_0_-2px_0_0_hsl(var(--primary))])
    {
        "name": "arbitrary-shadow",
        "regex": re.compile(r"shadow-\[[^\]]+\]"),
        "severity": "warning",
        "message": "用 shadow token (shadow-sm/md/lg) 而非 shadow-[custom] (inset 用于 tab underline 可豁免)",
        "fix_to": None,
    },
    # 4. 渐变 — 规范只用纯色
    {
        "name": "gradient-bg",
        "regex": re.compile(r"\bbg-gradient-to-[a-z]+(?:\s+from-\S+(?:\s+to-\S+)?)?|\bbg-gradient-to-[a-z]+\b"),
        "severity": "error",
        "message": "规范不用渐变, 用单色 (bg-primary / bg-card)",
        "fix_to": "bg-primary",
    },
    # 5. 违规彩色 (violet/amber/orange/cyan/pink/fuchsia/indigo)
    # 注意: yellow/orange 是 state-warning 允许的 (参见 design tokens --state-warning)
    {
        "name": "off-palette-color",
        "regex": re.compile(
            r"\bbg-(amber|violet|orange|cyan|pink|fuchsia|indigo|sky|teal|rose)-(\d{2,3})\b"
        ),
        "severity": "error",
        "message": "违规彩色 — 用主色 (bg-primary) 或中性 (bg-muted/bg-card) 或 state (--state-warning = yellow)",
        "fix_to": "bg-primary",
    },
    # 6. 自定义彩色 badge (violates badge.json doNotInvent colored-type-badges)
    {
        "name": "colored-badge",
        "regex": re.compile(
            r"rounded-full bg-(blue|amber|violet)-(\d{2,3})\s+text-(primary|blue|amber|violet)-(\d{2,3})"
        ),
        "severity": "error",
        "message": "badge 默认用中性 (rounded-full bg-muted text-muted-foreground), 不用主色组合",
        "fix_to": None,
    },
    # 7. hover:shadow-lg (规范只用 shadow-sm 默认 + shadow-md hover)
    {
        "name": "shadow-lg-overuse",
        "regex": re.compile(r"\bhover:shadow-(lg|xl|2xl)\b"),
        "severity": "warning",
        "message": "hover 阴影只用 shadow-sm/md, 不用 lg/xl/2xl",
        "fix_to": None,
    },
    # 8. 任意 border-color
    {
        "name": "arbitrary-border-color",
        "regex": re.compile(r"\bborder-\[(#[0-9a-fA-F]{3,6}|rgb[^\]]+)\]"),
        "severity": "error",
        "message": "用 border-border token 而非 border-[#hex]",
        "fix_to": "border-border",
    },
    # 9. 任意 text-color
    {
        "name": "arbitrary-text-color",
        "regex": re.compile(r"\btext-\[(#[0-9a-fA-F]{3,6}|rgb[^\]]+)\]"),
        "severity": "error",
        "message": "用 text token 而非 text-[#hex]",
        "fix_to": "text-foreground",
    },
    # 10. 任意 bg-color
    {
        "name": "arbitrary-bg-color",
        "regex": re.compile(r"\bbg-\[(#[0-9a-fA-F]{3,6}|rgb[^\]]+)\]"),
        "severity": "error",
        "message": "用 bg token 而非 bg-[#hex]",
        "fix_to": "bg-card",
    },
]


def find_tsx_files() -> List[Path]:
    """找 src/ 下所有 .tsx/.ts/.jsx/.js 文件 (排除 node_modules/dist)"""
    files = []
    for ext in ("**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"):
        for p in SRC_DIR.glob(ext):
            # 排除 generated / node_modules / shadcn ui 基础组件
            rel = str(p.relative_to(ROOT))
            if "node_modules" in str(p) or "/dist/" in str(p):
                continue
            if rel.startswith(".design_library"):
                continue
            # shadcn/ui 基础组件 (input/button/...) — 不审
            if rel.startswith("src/components/ui/"):
                continue
            files.append(p)
    return sorted(files)


def lint_file(path: Path) -> List[Dict]:
    """扫描单文件, 返回违规列表"""
    violations = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return violations

    lines = text.splitlines()
    for lineno, line in enumerate(lines, start=1):
        # 跳过纯注释行
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue
        # 跳过显式豁免的注释标记: // design-allow arbitrary-radius
        if "// design-allow" in line:
            continue

        for rule in RULES:
            for match in rule["regex"].finditer(line):
                # 检查 fix_to 是否会变成 no-op (例如 rounded-[2px] -> rounded-[2px])
                ft = rule["fix_to"]
                if isinstance(ft, dict) and rule["name"] in ("arbitrary-font-size", "arbitrary-radius"):
                    try:
                        num = int(match.group(1))
                        replacement = ft.get(num)
                        if replacement == match.group(0):
                            continue  # 无意义的违规, 跳过
                    except (ValueError, IndexError):
                        pass

                violations.append({
                    "file": str(path.relative_to(ROOT)),
                    "line": lineno,
                    "rule": rule["name"],
                    "severity": rule["severity"],
                    "match": match.group(0),
                    "message": rule["message"],
                    "raw": line.rstrip(),
                })

    return violations


def format_violations(violations: List[Dict]) -> str:
    if not violations:
        return ""
    out = []
    by_file = {}
    for v in violations:
        by_file.setdefault(v["file"], []).append(v)

    for file, vs in sorted(by_file.items()):
        out.append(f"\n{'─' * 78}")
        out.append(f"  📄 {file}")
        out.append(f"{'─' * 78}")
        for v in vs:
            icon = "❌" if v["severity"] == "error" else "⚠️ "
            out.append(f"  {icon} L{v['line']:>4}  [{v['rule']}]")
            out.append(f"           match: {v['match']}")
            out.append(f"           {v['message']}")
            out.append(f"           > {v['raw'][:120]}{'…' if len(v['raw']) > 120 else ''}")
    return "\n".join(out)


def try_fix(violations: List[Dict]) -> int:
    """自动修复可修复的违规"""
    fixed = 0
    by_file = {}
    for v in violations:
        # 这 7 类可以自动修复
        if v["rule"] in (
            "arbitrary-font-size",
            "arbitrary-radius",
            "gradient-bg",
            "off-palette-color",
            "arbitrary-text-color",
            "arbitrary-border-color",
            "arbitrary-bg-color",
        ):
            by_file.setdefault(v["file"], []).append(v)

    for file, vs in by_file.items():
        path = ROOT / file
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()
        changed = False
        for v in vs:
            rule = next(r for r in RULES if r["name"] == v["rule"])
            ft = rule["fix_to"]
            if not ft:
                continue

            if v["rule"] in ("arbitrary-font-size", "arbitrary-radius"):
                m = rule["regex"].search(v["raw"])
                if not m:
                    continue
                num = int(m.group(1))
                replacement = ft.get(num) if isinstance(ft, dict) else ft
                if not replacement:
                    continue
                # 如果替换值与原值相同 (例如 rounded-[2px] -> rounded-[2px]), 跳过不计数
                if replacement == m.group(0):
                    continue
                lines[v["line"] - 1] = rule["regex"].sub(replacement, v["raw"], count=1)
            elif v["rule"] == "gradient-bg":
                # 把 bg-gradient-to-* (含 from-* to-*) 整段换成 bg-primary
                lines[v["line"] - 1] = re.sub(
                    r"\bbg-gradient-to-[a-z]+(?:\s+from-\S+)?(?:\s+via-\S+)?(?:\s+to-\S+)?",
                    ft,
                    v["raw"],
                    count=1,
                )
            elif v["rule"] == "off-palette-color":
                # bg-violet-50 -> bg-primary (简化替换)
                lines[v["line"] - 1] = rule["regex"].sub(ft, v["raw"], count=1)
            elif v["rule"] in ("arbitrary-text-color", "arbitrary-border-color", "arbitrary-bg-color"):
                # text-[#xxx] -> text-foreground / border-border / bg-card
                lines[v["line"] - 1] = rule["regex"].sub(ft, v["raw"], count=1)

            fixed += 1
            changed = True
        if changed:
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return fixed


def main():
    parser = argparse.ArgumentParser(description="MetaPlatform 设计规范 lint")
    parser.add_argument("--fix", action="store_true", help="自动修复可修复违规")
    parser.add_argument("--strict", action="store_true", help="严格模式 — 任何违规都报错")
    parser.add_argument("--quiet", action="store_true", help="只输出汇总, 不列细节")
    args = parser.parse_args()

    print(f"🔍 扫描 {SRC_DIR.relative_to(ROOT)}/ 下的 .tsx/.ts/.jsx/.js 文件…")
    files = find_tsx_files()
    print(f"   找到 {len(files)} 个文件")

    all_violations: List[Dict] = []
    for f in files:
        all_violations.extend(lint_file(f))

    errors = [v for v in all_violations if v["severity"] == "error"]
    warnings = [v for v in all_violations if v["severity"] == "warning"]

    print(f"\n📊 结果:")
    print(f"   ❌ 错误: {len(errors)}")
    print(f"   ⚠️  警告: {len(warnings)}")

    if all_violations and not args.quiet:
        print(format_violations(all_violations))

    if args.fix and errors:
        print(f"\n🔧 自动修复中…")
        fixed = try_fix(errors)
        print(f"   修复了 {fixed} 处 (text-[Npx] → text-xs/sm/base, rounded-[Npx] → rounded-sm/md/lg)")
        # 重新扫描
        all_violations = []
        for f in files:
            all_violations.extend(lint_file(f))
        errors = [v for v in all_violations if v["severity"] == "error"]
        warnings = [v for v in all_violations if v["severity"] == "warning"]
        print(f"\n📊 修复后:")
        print(f"   ❌ 错误: {len(errors)}")
        print(f"   ⚠️  警告: {len(warnings)}")

    if not all_violations:
        print(f"\n✅ 全部通过 — 设计规范 100% 合规!")
        return 0

    if errors and args.strict:
        print(f"\n💥 严格模式: 有 {len(errors)} 个错误, 退出码 1")
        return 1

    if errors:
        print(f"\n💥 有 {len(errors)} 个错误, 退出码 1")
        return 1

    print(f"\n✅ 没有错误, 只有警告")
    return 0


if __name__ == "__main__":
    sys.exit(main())