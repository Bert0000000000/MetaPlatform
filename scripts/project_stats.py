"""Mate Platform 8/2 全维度统计(最终版,严格排除 .venv 与备份)。"""
from __future__ import annotations
import os, re

ROOT = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform"

EXCLUDE_DIR_NAMES = {
    ".venv", "venv", "env",
    ".tmp", "node_modules", ".ruff_cache", ".pytest_cache", "__pycache__",
    ".wheels", "dist", "build", "site-packages",
    ".git", ".claude", ".vscode", ".next",
    ".tmp-iam-data", ".tmp-iam-data-2", ".tmp-data", ".coverage",
    ".venv-corrupted.bak",  # 损坏的 venv 备份
    "Lib", "Include", "Scripts",  # 损坏 venv 内部子目录
}

EXCLUDE_FILE_PATTERNS = ["pywin32_postinstall", "_pytest"]


def should_skip_dir(path: str) -> bool:
    parts = path.replace("/", "\\").split("\\")
    return any(p in EXCLUDE_DIR_NAMES for p in parts)


def walk_files(root: str, exts: tuple) -> list:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIR_NAMES]
        if should_skip_dir(dirpath):
            continue
        for fn in filenames:
            if fn.endswith(exts):
                fp = os.path.join(dirpath, fn)
                # 额外排除文件
                if any(p in fn for p in EXCLUDE_FILE_PATTERNS):
                    continue
                out.append(fp)
    return out


def count_lines(files: list) -> dict:
    total_lines = total_blank = total_comments = total_code = 0
    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception:
            continue
        lines = content.split("\n")
        n = len(lines)
        blank = sum(1 for l in lines if not l.strip())
        if fp.endswith((".py", ".sh")):
            comment = sum(1 for l in lines if re.match(r"^\s*#", l))
        elif fp.endswith((".yaml", ".yml")):
            comment = sum(1 for l in lines if re.match(r"^\s*#", l))
        elif fp.endswith((".md",)):
            comment = sum(1 for l in lines if re.match(r"^\s*[#>\-\*\d\.]", l))
        elif fp.endswith((".ts", ".tsx", ".js", ".jsx")):
            comment = sum(1 for l in lines if re.match(r"^\s*(//|/\*|\*)", l))
        elif fp.endswith((".toml",)):
            comment = sum(1 for l in lines if re.match(r"^\s*#", l))
        elif fp.endswith((".sql",)):
            comment = sum(1 for l in lines if re.match(r"^\s*--", l))
        else:
            comment = 0
        code = max(0, n - blank - comment)
        total_lines += n
        total_blank += blank
        total_comments += comment
        total_code += code
    return {"files": len(files), "lines": total_lines, "blank": total_blank,
            "comments": total_comments, "code": total_code}


# === 后端 Python ===
backend_py = walk_files(os.path.join(ROOT, "mate-platform-backend"), (".py",))
bs = count_lines(backend_py)

# === 测试 Python ===
test_py = [f for f in backend_py if "\\tests\\" in f.replace("/", "\\") or "\\test_" in os.path.basename(f).lower()]
ts = count_lines(test_py)

# === Alembic ===
alembic_files = walk_files(os.path.join(ROOT, "mate-platform-backend/alembic"), (".py",))
alembic_s = count_lines(alembic_files)

# === OpenAPI YAML ===
oas_files = walk_files(os.path.join(ROOT, "mate-platform-backend/contracts"), (".yaml", ".yml"))
oas_s = count_lines(oas_files)

# === Helm YAML ===
helm_files = walk_files(os.path.join(ROOT, "infra/helm"), (".yaml", ".yml"))
helm_s = count_lines(helm_files)

# === pyproject / 配置 TOML ===
toml_files = walk_files(os.path.join(ROOT, "mate-platform-backend"), (".toml",))
toml_s = count_lines(toml_files)

# === 文档分类统计 ===
prd_files = walk_files(os.path.join(ROOT, "docs/active/prd"), (".md",))
prd_s = count_lines(prd_files)

ac_files = walk_files(os.path.join(ROOT, "docs/active/delivery/evidence"), (".md",))
ac_s = count_lines(ac_files)

adr_files = walk_files(os.path.join(ROOT, "docs/active/decisions"), (".md",))
adr_s = count_lines(adr_files)

spec_files = walk_files(os.path.join(ROOT, "docs/active/specs"), (".md",))
spec_s = count_lines(spec_files)

# Other docs(不含 prd / evidence / decisions / specs)
all_md_files = walk_files(ROOT, (".md",))
other_md = [f for f in all_md_files if "\\docs\\active\\prd\\" not in f.replace("/", "\\")
            and "\\docs\\active\\delivery\\evidence\\" not in f.replace("/", "\\")
            and "\\docs\\active\\decisions\\" not in f.replace("/", "\\")
            and "\\docs\\active\\specs\\" not in f.replace("/", "\\")
            and "\\docs\\" in f.replace("/", "\\")]
other_s = count_lines(other_md)

# === Infra tests ===
infra_test_files = walk_files(os.path.join(ROOT, "infra/tests"), (".py",))
infra_test_s = count_lines(infra_test_files)

# === Scripts ===
script_files = []
for ext in (".ps1", ".sh", ".bat", ".py"):
    script_files.extend(walk_files(ROOT, (ext,)))
script_files = [f for f in script_files
                if "\\scripts\\" in f.replace("/", "\\")
                or "\\start-" in os.path.basename(f).lower()
                or "\\build-" in os.path.basename(f).lower()
                or "\\.git\\" not in f.replace("/", "\\")
                and ("build-" in os.path.basename(f) or "start-" in os.path.basename(f))]
script_s = count_lines(script_files)

# === Root compose / shell ===
root_yaml = walk_files(ROOT, (".yml", ".yaml", ".env", ".sh"))
root_yaml = [f for f in root_yaml if "\\infra\\" not in f.replace("/", "\\")
             and "\\mate-platform-backend\\" not in f.replace("/", "\\")
             and "\\metaplatform-frontend\\" not in f.replace("/", "\\")
             and "\\docs\\" not in f.replace("/", "\\")
             and "\\.venv" not in f.replace("/", "\\")]
root_s = count_lines(root_yaml)

# === SQL ===
sql_files = walk_files(ROOT, (".sql",))
sql_s = count_lines(sql_files)

# === 输出 ===
total_lines = (bs['lines'] + ts['lines'] + alembic_s['lines'] + oas_s['lines'] +
               helm_s['lines'] + toml_s['lines'] + prd_s['lines'] + ac_s['lines'] +
               adr_s['lines'] + spec_s['lines'] + other_s['lines'] +
               infra_test_s['lines'] + script_s['lines'] + root_s['lines'] + sql_s['lines'])
total_code = (bs['code'] + ts['code'] + alembic_s['code'])
total_comments = (bs['comments'] + ts['comments'] + alembic_s['comments'])
total_blank = (bs['blank'] + ts['blank'] + alembic_s['blank'])
total_files = (bs['files'] + ts['files'] + alembic_s['files'] + oas_s['files'] +
                helm_s['files'] + toml_s['files'] + prd_s['files'] + ac_s['files'] +
                adr_s['files'] + spec_s['files'] + other_s['files'] +
                infra_test_s['files'] + script_s['files'] + root_s['files'] + sql_s['files'])

print("=" * 70)
print("Mate Platform 项目全维度统计 · 2026-08-02")
print("=" * 70)
print()
print(f"{'维度':<28} {'文件':>6} {'总行':>10} {'代码行':>10} {'注释':>7} {'空行':>7}")
print("-" * 70)
print(f"{'后端 Python 代码':<28} {bs['files']:>6} {bs['lines']:>10,} {bs['code']:>10,} {bs['comments']:>7,} {bs['blank']:>7,}")
print(f"{'├ 应用代码(src)':<28} {bs['files']-ts['files']-alembic_s['files']:>6} {(bs['lines']-ts['lines']-alembic_s['lines']):>10,} {(bs['code']-ts['code']-alembic_s['code']):>10,}")
print(f"{'├ 测试代码(tests)':<28} {ts['files']:>6} {ts['lines']:>10,} {ts['code']:>10,} {ts['comments']:>7,} {ts['blank']:>7,}")
print(f"{'└ Alembic migrations':<28} {alembic_s['files']:>6} {alembic_s['lines']:>10,} {alembic_s['code']:>10,} {alembic_s['comments']:>7,} {alembic_s['blank']:>7,}")
print()
print(f"{'OpenAPI YAML':<28} {oas_s['files']:>6} {oas_s['lines']:>10,}")
print(f"{'Helm chart YAML':<28} {helm_s['files']:>6} {helm_s['lines']:>10,}")
print(f"{'pyproject.toml':<28} {toml_s['files']:>6} {toml_s['lines']:>10,}")
print(f"{'SQL':<28} {sql_s['files']:>6} {sql_s['lines']:>10,}")
print(f"{'Infra tests':<28} {infra_test_s['files']:>6} {infra_test_s['lines']:>10,}")
print(f"{'Scripts (ps1/sh/bat)':<28} {script_s['files']:>6} {script_s['lines']:>10,}")
print(f"{'Root compose/env':<28} {root_s['files']:>6} {root_s['lines']:>10,}")
print()
print(f"{'PRD Markdown':<28} {prd_s['files']:>6} {prd_s['lines']:>10,}")
print(f"{'ACCEPTANCE evidence':<28} {ac_s['files']:>6} {ac_s['lines']:>10,}")
print(f"{'ADR 决策记录':<28} {adr_s['files']:>6} {adr_s['lines']:>10,}")
print(f"{'Specs':<28} {spec_s['files']:>6} {spec_s['lines']:>10,}")
print(f"{'Other docs (docs/*)':<28} {other_s['files']:>6} {other_s['lines']:>10,}")
print()
print("=" * 70)
print(f"{'TOTAL':<28} {total_files:>6} {total_lines:>10,}")
print(f"{'  其中代码行':<28} {'':>6} {total_code:>10,}")
print(f"{'  其中注释行':<28} {'':>6} {total_comments:>10,}")
print(f"{'  其中空行':<28} {'':>6} {total_blank:>10,}")
print()
print(f"代码 / 总行: {total_code * 100 / total_lines:.2f}%")
print(f"注释 / 总行: {total_comments * 100 / total_lines:.2f}%")
print(f"空行 / 总行: {total_blank * 100 / total_lines:.2f}%")
print(f"代码 / 注释: {total_code * 100 / total_comments:.2f}%")
print("=" * 70)

# Top 15 largest Python files(应用代码,排除测试与 backup)
app_py = [f for f in backend_py if "\\tests\\" not in f.replace("/", "\\")
         and "\\.venv" not in f.replace("/", "\\")]
app_py_stats = [(f, count_lines([f])["lines"]) for f in app_py]
print("\nTop 15 largest 应用 Python 文件(排除测试与 venv):")
for fp, n in sorted(app_py_stats, key=lambda x: -x[1])[:15]:
    print(f"  {n:>6,}  {fp.replace(ROOT + chr(92), '')}")