import json
import urllib.request
import urllib.error

GW_URL = "http://localhost:8000"

ADMIN = {
    "username": "admin",
    "email": "admin@metaplatform.local",
    "password": "Meta@12345",
    "tenantId": "default",
    "realName": "系统管理员",
}

ROUTES = [
    ("iam", "IAM Service", "http://localhost:8101", "/api/v1/iam/**"),
    ("ont", "Ontology Service", "http://localhost:8201", "/api/v1/ont/**"),
    ("rule", "Rule Service", "http://localhost:8501", "/api/v1/rule/**"),
    ("msg", "Message Service", "http://localhost:8601", "/api/v1/msg/**"),
    ("ea", "EA Service", "http://localhost:8106", "/api/v1/ea/**"),
    ("obs", "Observability Service", "http://localhost:8301", "/api/v1/obs/**"),
    ("llmgw", "LLM Gateway Service", "http://localhost:8401", "/api/v1/llmgw/**"),
    ("data", "Data Service", "http://localhost:8701", "/api/v1/data/**"),
    ("wfe", "Workflow Engine Service", "http://localhost:8801", "/api/v1/wfe/**"),
    ("action", "Action Engine Service", "http://localhost:8104", "/api/v1/action/**"),
    ("rag", "RAG Service", "http://localhost:8901", "/api/v1/rag/**"),
    ("agent", "Agent Service", "http://localhost:8511", "/api/v1/agent/**"),
    ("a2a", "A2A Service", "http://localhost:8502", "/api/v1/a2a/**"),
    ("mcp", "MCP Service", "http://localhost:8105", "/api/v1/mcp/**"),
]


def call(method, path, body=None, headers=None):
    url = f"{GW_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"code": e.code, "message": str(e.reason)}


def main():
    print("Getting admin token...")
    call("POST", "/api/v1/iam/auth/register", ADMIN)
    login_resp = call("POST", "/api/v1/iam/auth/login", {
        "username": ADMIN["username"],
        "password": ADMIN["password"],
        "tenantId": ADMIN["tenantId"],
    })
    token = login_resp.get("data", {}).get("accessToken")
    if not token:
        print("Login failed:", login_resp)
        return
    print("Token acquired.")

    auth_headers = {"Authorization": f"Bearer {token}"}
    print("Registering routes...")
    for route_id, name, uri, path in ROUTES:
        body = {
            "routeId": route_id,
            "name": name,
            "uri": uri,
            "predicates": [{"name": "Path", "args": {"pattern": path}}],
            "filters": [],
            "priority": 100,
            "enabled": True,
        }
        resp = call("POST", "/api/v1/gw/routes", body, auth_headers)
        code = resp.get("code", 0)
        if code == 0:
            print(f"OK {route_id} -> {uri}{path}")
        else:
            print(f"WARN {route_id}: {resp.get('message', resp)}")

    print("Refreshing gateway routes...")
    call("POST", "/api/v1/gw/routes/default/refresh", headers=auth_headers)
    print("Done.")


if __name__ == "__main__":
    main()
