import json
import urllib.request
import urllib.error

GW_URL = "http://localhost:8000"

ADMIN = {
    "username": "admin",
    "password": "Meta@12345",
    "tenantId": "default",
}

ROUTES = [
    ("GET", "/api/v1/ont/concepts", "TECH-ONT"),
    ("GET", "/api/v1/rule/decision-tables", "TECH-RULE"),
    ("GET", "/api/v1/data/datasources", "TECH-DATA"),
    ("GET", "/api/v1/agent/evaluations/conversations", "TECH-AGENT"),
    ("GET", "/api/v1/mcp/servers", "TECH-MCP"),
    ("GET", "/api/v1/ea/data-domains", "TECH-EA"),
    ("GET", "/api/v1/a2a/.well-known/agent.json", "TECH-A2A"),
    ("GET", "/api/v1/rag/knowledge-bases", "TECH-RAG"),
    ("GET", "/api/v1/llmgw/health", "TECH-LLMGW"),
    ("GET", "/api/v1/action/definitions", "TECH-ACTION"),
]


def get_token():
    req = urllib.request.Request(
        f"{GW_URL}/api/v1/iam/auth/login",
        data=json.dumps(ADMIN).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["data"]["accessToken"]


def check_route(token, method, path, service):
    req = urllib.request.Request(
        f"{GW_URL}{path}",
        method=method,
    )
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8")
            try:
                data = json.loads(body)
                code = data.get("code", 0)
                return code == 0, f"code={code}"
            except Exception:
                return True, f"status={resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)


def main():
    token = get_token()
    print(f"{'Service':15} {'Method':6} {'Path':40} {'Status'}")
    print("-" * 80)
    ok = 0
    for method, path, service in ROUTES:
        success, detail = check_route(token, method, path, service)
        status = "OK" if success else f"FAIL ({detail})"
        print(f"{service:15} {method:6} {path:40} {status}")
        if success:
            ok += 1
    print("-" * 80)
    print(f"Routes: {ok}/{len(ROUTES)} OK")


if __name__ == "__main__":
    main()
