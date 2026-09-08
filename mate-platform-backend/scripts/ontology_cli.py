"""ONT-G11 ontology-cli — Ontology 网关命令行客户端。

四个子命令（全部走 API 网关，Bearer token + X-Tenant-Id）：

  python scripts/ontology_cli.py list-classes [--limit 20]
  python scripts/ontology_cli.py get-type <rid>
  python scripts/ontology_cli.py query --source <rid> [--limit 10] [--body JSON]
  python scripts/ontology_cli.py export <rid> [--out bundle.json]

公共选项：--gateway（默认 http://localhost:8100）、--tenant（默认
tenant-default）、--token（缺省自动用 admin/admin123 走 iam login）。
仅依赖标准库（urllib），可在任意装有 Python 的机器上直接运行。
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

# 绕过系统代理（Windows 开发机代理会间歇拦截 localhost 调用）
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
urllib.request.install_opener(_opener)

DEFAULT_GATEWAY = "http://localhost:8100"
DEFAULT_TENANT = "tenant-default"
DEFAULT_USER = "admin"
DEFAULT_PASS = "admin123"


class OntCliError(RuntimeError):
    """Raised on transport / HTTP failures; main() maps it to exit code 1."""


def login(gateway: str, username: str, password: str, timeout: float = 30.0) -> str:
    """POST /api/v1/iam/auth/login → accessToken。"""
    data = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        gateway + "/api/v1/iam/auth/login",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read())
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        raise OntCliError(f"login failed: {exc}") from exc
    token = str(payload.get("accessToken") or "")
    if not token:
        raise OntCliError("login response has no accessToken")
    return token


def _request(
    method: str,
    gateway: str,
    path: str,
    *,
    token: str,
    tenant: str,
    payload: dict | None = None,
    timeout: float = 30.0,
) -> tuple[int, object]:
    """One authenticated gateway call → (status, parsed-json-or-raw-bytes)。"""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        gateway.rstrip("/") + path,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": tenant,
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except (urllib.error.URLError, OSError) as exc:
        raise OntCliError(f"{method} {path} failed: {exc}") from exc
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def build_query_body(source: str, limit: int, extra: dict | None = None) -> dict:
    """构造 ObjectQueryV2 IR；``extra`` 为完整请求体时优先生效。"""
    if extra is not None:
        return extra
    return {"source": source, "paging_limit": max(1, limit)}


def cmd_list_classes(args: argparse.Namespace) -> int:
    status, body = _request(
        "GET",
        args.gateway,
        f"/api/v1/ont/v2/object-types?limit={args.limit}&offset=0",
        token=args.token,
        tenant=args.tenant,
    )
    _raise_on_status(status, "list-classes")
    # 网关返回裸数组或 {items,total} 包络，两种都接受。
    if isinstance(body, list):
        items, total = body, len(body)
    elif isinstance(body, dict):
        items = body.get("items", [])
        total = body.get("total", len(items))
    else:
        items, total = [], 0
    if args.json:
        print(json.dumps(body, ensure_ascii=False, indent=2))
        return 0
    print(f"total: {total}")
    for item in items:
        rid = item.get("rid", "") if isinstance(item, dict) else str(item)
        name = item.get("display_name", "") if isinstance(item, dict) else ""
        print(f"  {rid}  {name}")
    return 0


def cmd_get_type(args: argparse.Namespace) -> int:
    status, body = _request(
        "GET",
        args.gateway,
        f"/api/v1/ont/v2/object-types/{args.rid}",
        token=args.token,
        tenant=args.tenant,
    )
    _raise_on_status(status, f"get-type {args.rid}")
    print(json.dumps(body, ensure_ascii=False, indent=2))
    return 0


def cmd_query(args: argparse.Namespace) -> int:
    extra: dict | None = None
    if args.body:
        try:
            extra = json.loads(args.body)
        except json.JSONDecodeError as exc:
            raise OntCliError(f"--body is not valid JSON: {exc}") from exc
        if not isinstance(extra, dict):
            raise OntCliError("--body must be a JSON object")
    payload = build_query_body(args.source, args.limit, extra)
    status, body = _request(
        "POST",
        args.gateway,
        "/api/v1/ont/v2/object-query",
        token=args.token,
        tenant=args.tenant,
        payload=payload,
    )
    _raise_on_status(status, "query")
    print(json.dumps(body, ensure_ascii=False, indent=2))
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    status, body = _request(
        "GET",
        args.gateway,
        f"/api/v1/ont/v2/object-types/{args.rid}/export",
        token=args.token,
        tenant=args.tenant,
    )
    _raise_on_status(status, f"export {args.rid}")
    raw = json.dumps(body, ensure_ascii=False, indent=2).encode() if not isinstance(body, bytes) else body
    if args.out:
        with open(args.out, "wb") as fh:
            fh.write(raw)
        print(f"bundle written: {args.out} ({len(raw)} bytes)")
    else:
        sys.stdout.buffer.write(raw)
        sys.stdout.buffer.write(b"\n")
    return 0


def _raise_on_status(status: int, what: str) -> None:
    if status >= 400:
        raise OntCliError(f"{what}: HTTP {status}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ontology_cli", description=__doc__)
    parser.add_argument("--gateway", default=DEFAULT_GATEWAY)
    parser.add_argument("--tenant", default=DEFAULT_TENANT)
    parser.add_argument("--token", default="", help="缺省自动登录")
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list-classes", help="GET /ont/v2/object-types")
    p_list.add_argument("--limit", type=int, default=20)
    p_list.add_argument("--json", action="store_true")
    p_list.set_defaults(func=cmd_list_classes)

    p_get = sub.add_parser("get-type", help="GET /ont/v2/object-types/{rid}")
    p_get.add_argument("rid")
    p_get.set_defaults(func=cmd_get_type)

    p_query = sub.add_parser("query", help="POST /ont/v2/object-query")
    p_query.add_argument("--source", required=True, help="本体类型 rid")
    p_query.add_argument("--limit", type=int, default=10)
    p_query.add_argument("--body", default="", help="完整 ObjectQueryV2 JSON（覆盖 --source/--limit）")
    p_query.set_defaults(func=cmd_query)

    p_export = sub.add_parser("export", help="GET /ont/v2/object-types/{rid}/export")
    p_export.add_argument("rid")
    p_export.add_argument("--out", default="", help="写入文件（缺省 stdout）")
    p_export.set_defaults(func=cmd_export)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.token:
        try:
            args.token = login(args.gateway, DEFAULT_USER, DEFAULT_PASS)
        except OntCliError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
    try:
        return args.func(args)
    except OntCliError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
