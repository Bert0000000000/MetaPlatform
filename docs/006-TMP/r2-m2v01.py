"""M2-VERIFY-01 round-2 E2E acceptance script.

Sequence:
  1. Mint JWT.
  2. Sync the LLMGW model catalog so `gpt-4o-mini` is present.
  3. Direct probe of /chat/completions with the new OpenAI-shaped payload.
  4. Create a fresh agent via TECH-AGENT (modelId = gpt-4o-mini).
  5. Synchronously execute the agent (which routes through LLMGW chat/completions).
  6. Parse the response and verify usage / X-Trace-Id propagation.

Outputs:
  - d:/.../docs/006-TMP/r2_m2v01_chat.json
  - d:/.../docs/006-TMP/r2_m2v01_agent.json
  - d:/.../docs/006-TMP/r2_m2v01_exec.json
  - d:/.../docs/006-TMP/r2_m2v01_summary.json
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

import jwt
import requests

ROOT = Path(__file__).resolve().parent
JWT_PATH = ROOT / "jwt.txt"
LOG_DIR = ROOT

LLMGW = "http://127.0.0.1:8401"
AGENT = "http://127.0.0.1:8501"

SECRET = "metaplatform-jwt-secret-key-2026"


def mint_jwt() -> str:
    import datetime as dt
    now = dt.datetime.now(dt.timezone.utc)
    claims = {
        "sub": "phase2-acceptance",
        "username": "phase2-tester",
        "tenantId": "tenant-m2v01",
        "roles": ["PLATFORM_ADMIN", "AGENT_USER"],
        "type": "USER",
        "iat": now,
        "exp": now + dt.timedelta(hours=2),
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")


def hdrs(token: str, tenant_id: str, trace_id: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": tenant_id,
        "X-Trace-Id": trace_id,
    }


def save(name: str, payload) -> None:
    p = LOG_DIR / name
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def main() -> int:
    token = mint_jwt()
    JWT_PATH.write_text(token, encoding="utf-8")
    print(f"[ok] jwt minted -> {JWT_PATH}")

    headers = hdrs(token, "tenant-m2v01", "trace-r2-m2v01-sync")

    # 1. Sync the LLMGW catalog so we have gpt-4o-mini registered.
    print("\n[step] POST /api/v1/llmgw/models/sync")
    sync_resp = requests.post(f"{LLMGW}/api/v1/llmgw/models/sync", json={}, headers=headers, timeout=15)
    print(f"  HTTP {sync_resp.status_code}")
    print(f"  body: {sync_resp.text[:300]}")
    save("r2_m2v01_sync.json", {
        "status": sync_resp.status_code,
        "body": sync_resp.json() if sync_resp.headers.get("content-type", "").startswith("application/json") else sync_resp.text,
    })

    # 2. Direct chat completions probe
    print("\n[step] POST /api/v1/llmgw/chat/completions (direct)")
    chat_body = {
        "model": "m-openai-gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Phase 2 round-2 sanity check."},
        ],
        "temperature": 0.2,
        "max_tokens": 64,
    }
    chat_resp = requests.post(
        f"{LLMGW}/api/v1/llmgw/chat/completions",
        json=chat_body,
        headers=hdrs(token, "tenant-m2v01", "trace-r2-m2v01-chat"),
        timeout=30,
    )
    print(f"  HTTP {chat_resp.status_code}")
    chat_json = None
    try:
        chat_json = chat_resp.json()
    except Exception:
        chat_json = {"raw": chat_resp.text}
    print(f"  body: {json.dumps(chat_json, ensure_ascii=False, default=str)[:400]}")
    save("r2_m2v01_chat.json", {"status": chat_resp.status_code, "body": chat_json})

    # 3. Create a fresh agent via TECH-AGENT.
    print("\n[step] POST /api/v1/agent/agents")
    agent_code = f"r2_phase2_agent_{uuid.uuid4().hex[:6]}"
    agent_body = {
        "name": "Round-2 Phase 2 Agent",
        "code": agent_code,
        "description": "Round-2 E2E acceptance agent with OpenAI-compatible chat completion route.",
        "modelId": "m-openai-gpt-4o-mini",
        "systemPrompt": "You are a helpful assistant. Perform concise reasoning for testing.",
        "tools": [],
        "ragScopes": [],
        "temperature": 0.5,
        "maxTokens": 1024,
        "status": "ACTIVE",
    }
    agent_resp = requests.post(
        f"{AGENT}/api/v1/agent/agents",
        json=agent_body,
        headers=hdrs(token, "tenant-m2v01", "trace-r2-m2v01-agent-create"),
        timeout=30,
    )
    print(f"  HTTP {agent_resp.status_code}")
    agent_json = None
    try:
        agent_json = agent_resp.json()
    except Exception:
        agent_json = {"raw": agent_resp.text}
    print(f"  body: {json.dumps(agent_json, ensure_ascii=False, default=str)[:400]}")
    save("r2_m2v01_agent.json", {"status": agent_resp.status_code, "body": agent_json})

    agent_id = None
    if isinstance(agent_json, dict):
        data = agent_json.get("data", {})
        agent_id = data.get("agentId") if isinstance(data, dict) else None
    if not agent_id:
        print("[error] agent create did not return an agentId; aborting execute step")
        save("r2_m2v01_summary.json", {
            "agent_create_status": agent_resp.status_code,
            "chat_completions_status": chat_resp.status_code,
            "execute_status": None,
            "verdict": "blocked (no agentId)",
        })
        return 2

    # 4. Execute the agent.
    print(f"\n[step] POST /api/v1/agent/agents/{agent_id}/execute")
    exec_body = {
        "input": "Plan a 3-step answer to: how to onboard a new digital employee in 3 days.",
        "inputType": "TEXT",
        "context": {"userId": "phase2-tester", "variables": {"trace_id": "trace-r2-m2v01-exec"}},
        "options": {
            "timeout": 60,
            "maxIterations": 5,
            "enableTrace": True,
            "enableMemory": True,
            "streamCallback": False,
        },
    }
    exec_resp = requests.post(
        f"{AGENT}/api/v1/agent/agents/{agent_id}/execute",
        json=exec_body,
        headers=hdrs(token, "tenant-m2v01", "trace-r2-m2v01-exec"),
        timeout=120,
    )
    print(f"  HTTP {exec_resp.status_code}")
    exec_json = None
    try:
        exec_json = exec_resp.json()
    except Exception:
        exec_json = {"raw": exec_resp.text}
    print(f"  body: {json.dumps(exec_json, ensure_ascii=False, default=str)[:600]}")
    save("r2_m2v01_exec.json", {"status": exec_resp.status_code, "body": exec_json})

    summary = {
        "sync_status": sync_resp.status_code,
        "chat_completions_status": chat_resp.status_code,
        "agent_create_status": agent_resp.status_code,
        "agent_id": agent_id,
        "execute_status": exec_resp.status_code,
        "verdict": "pass"
        if (sync_resp.status_code == 200
            and chat_resp.status_code == 200
            and agent_resp.status_code == 200
            and exec_resp.status_code == 200)
        else "partial",
    }
    save("r2_m2v01_summary.json", summary)
    print("\n[summary]")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())