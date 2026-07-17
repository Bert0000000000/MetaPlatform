"""Phase-2 R3 M2-VERIFY-05：TECH-MCP /api/v1/mcp/jsonrpc E2E。

验证三个内置 Tool 调用：
- ont_query_concepts
- rag_search
- action_execute
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

import httpx

MCP_BASE = "http://localhost:8502"
JSONRPC = f"{MCP_BASE}/api/v1/mcp/jsonrpc"
OUT_DIR = Path("d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/docs/006-TMP")


def call(client: httpx.Client, method: str, params: dict | None = None, trace: str | None = None) -> dict:
    body = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": method,
    }
    if params is not None:
        body["params"] = params
    headers = {"X-Trace-Id": trace or f"trace-r3-m2v05-{uuid.uuid4().hex[:8]}"}
    r = client.post(JSONRPC, json=body, headers=headers, timeout=20.0)
    return {"trace": trace, "status": r.status_code, "body": r.json()}


def main() -> int:
    artifacts = {}
    with httpx.Client() as client:
        # 1) initialize
        init = call(client, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "phase2-r3-acceptance", "version": "1.0"},
        }, "trace-r3-m2v05-init")
        artifacts["initialize"] = init
        print("=== initialize ===", json.dumps(init, ensure_ascii=False, indent=2))

        # 2) tools/list
        lst = call(client, "tools/list", {}, "trace-r3-m2v05-tools")
        artifacts["tools_list"] = lst
        print("=== tools/list ===", json.dumps({
            "status": lst["status"],
            "trace": lst["trace"],
            "tool_codes": [t.get("name") for t in lst["body"]["result"]["tools"]],
        }, ensure_ascii=False, indent=2))

        # 3) tools/call ontology_query (mapped to ont_query_concepts)
        ont = call(client, "tools/call", {
            "name": "ont_query_concepts",
            "arguments": {"page": 1, "size": 5},
        }, "trace-r3-m2v05-ont")
        artifacts["ontology_query"] = ont
        print("=== ontology_query (ont_query_concepts) ===", json.dumps({
            "status": ont["status"],
            "trace": ont["trace"],
            "isError": ont["body"]["result"]["isError"],
            "content": ont["body"]["result"]["content"][0]["text"][:300],
        }, ensure_ascii=False, indent=2))

        # 4) tools/call rag_search
        rag = call(client, "tools/call", {
            "name": "rag_search",
            "arguments": {"query": "MetaPlatform architecture", "topK": 3},
        }, "trace-r3-m2v05-rag")
        artifacts["rag_search"] = rag
        print("=== rag_search ===", json.dumps({
            "status": rag["status"],
            "trace": rag["trace"],
            "isError": rag["body"]["result"]["isError"],
            "content": rag["body"]["result"]["content"][0]["text"][:300],
        }, ensure_ascii=False, indent=2))

        # 5) tools/call action_execute
        act = call(client, "tools/call", {
            "name": "action_execute",
            "arguments": {"actionCode": "echo", "params": {"message": "phase2-r3"}},
        }, "trace-r3-m2v05-action")
        artifacts["action_execute"] = act
        print("=== action_execute ===", json.dumps({
            "status": act["status"],
            "trace": act["trace"],
            "isError": act["body"]["result"]["isError"],
            "content": act["body"]["result"]["content"][0]["text"][:300],
        }, ensure_ascii=False, indent=2))

    # Save artifacts
    out_file = OUT_DIR / "r3_m2v05_mcp.jsonrpc.json"
    out_file.write_text(json.dumps(artifacts, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved: {out_file}")

    # Final verdict
    codes = [t.get("name") for t in artifacts["tools_list"]["body"]["result"]["tools"]]
    print(f"\n=== verdict ===")
    print(f"tools/list available: {len(codes)} ({sorted(codes)})")
    print(f"ontology_query: HTTP={artifacts['ontology_query']['status']} isError={artifacts['ontology_query']['body']['result']['isError']}")
    print(f"rag_search:      HTTP={artifacts['rag_search']['status']} isError={artifacts['rag_search']['body']['result']['isError']}")
    print(f"action_execute:  HTTP={artifacts['action_execute']['status']} isError={artifacts['action_execute']['body']['result']['isError']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())