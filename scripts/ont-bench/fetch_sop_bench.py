"""SOP-Bench (amazon-science/SOP-Bench) 数据抓取器。

从 GitHub 拉取指定 benchmark 域的数据文件到本地缓存（默认 .tmp/sop-bench/<domain>/）。
git 直连不通的环境下走 gh api 通道。

数据许可：CC BY-NC 4.0（非商业）。仅限内部引擎验证使用，勿随产品分发。

用法：
    python fetch_sop_bench.py dangerous_goods
    python fetch_sop_bench.py patient_intake know_your_business
    python fetch_sop_bench.py --list
"""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

REPO = "amazon-science/SOP-Bench"
DATA_DIR = "src/amazon_sop_bench/benchmarks/data"
DEFAULT_OUT = Path(".tmp/sop-bench")

FILES = (
    "sop.txt",
    "toolspecs.json",
    "tools.py",
    "test_set_without_outputs.csv",
    "test_set_with_outputs.csv",
    "metadata.json",
    "croissant.json",
)


def gh_api(path: str) -> bytes:
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/{path}", "--jq", ".content"],
        capture_output=True,
        text=True,
        check=True,
    )
    return base64.b64decode(out.stdout)


def list_domains() -> list[str]:
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/{DATA_DIR}", "--jq", ".[].name"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip() for line in out.stdout.splitlines() if line.strip()]


def fetch_domain(domain: str, out_root: Path) -> Path:
    dest = out_root / domain
    dest.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        target = dest / name
        if target.exists() and target.stat().st_size > 0:
            print(f"  = {name} (cached)")
            continue
        try:
            payload = gh_api(f"{DATA_DIR}/{domain}/{name}")
        except subprocess.CalledProcessError as e:
            print(f"  ! {name}: gh api failed: {e.stderr.strip()}", file=sys.stderr)
            continue
        target.write_bytes(payload)
        print(f"  + {name} ({len(payload)} bytes)")
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("domains", nargs="*", help="benchmark 域名，如 dangerous_goods")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--list", action="store_true", help="列出全部可用域")
    args = ap.parse_args()

    if args.list:
        for d in list_domains():
            print(d)
        return 0
    if not args.domains:
        ap.error("至少给一个域名，或 --list")

    for domain in args.domains:
        print(f"[{domain}]")
        dest = fetch_domain(domain, args.out)
        meta = dest / "metadata.json"
        if meta.exists():
            info = json.loads(meta.read_text(encoding="utf-8"))
            print(
                f"  inputs={info.get('input_columns')} outputs={info.get('output_columns')}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
