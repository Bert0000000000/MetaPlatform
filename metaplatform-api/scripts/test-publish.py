"""
End-to-end smoke for the isolated-runtime publish flow.

  - logs in as admin
  - creates a CRM app with template=crm
  - publishes it (the api will then either spawn a docker container
    OR return degraded if docker is unreachable)
  - opens the published URL via the platform's reverse proxy
  - inspects the runtime via /api/apps/:id/runtime
  - unpublishes
"""

import json, urllib.request, sys, time, urllib.error

API = "http://127.0.0.1:3001"


def call(method, path, body=None, token=None, timeout=30):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                  headers={"Content-Type": "application/json",
                                           **({"Authorization": "Bearer " + token} if token else {})})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=timeout).read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        sys.stderr.write(f"HTTP {e.code} {path}: {body}\n")
        raise


def main():
    tok = call("POST", "/api/auth/login", {"email": "admin@metaplatform.com", "password": "admin123"})["data"]["token"]
    name = "独立 CRM " + str(int(time.time()))
    create = call("POST", "/api/apps", {"name": name, "description": "独立环境 demo", "category": "CRM", "icon": "Users", "template": "crm"}, tok)
    app_id = create["data"]["id"]
    print("CREATE app_id =", app_id)

    pub = call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    rt_inline = pub["data"].get("runtime") or {}
    print("PUBLISH success =", pub["success"])
    print("  runtime =", json.dumps(rt_inline, ensure_ascii=False))

    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print("RUNTIME GET  =", json.dumps(rt.get("data", {}), ensure_ascii=False))

    slug = pub["data"].get("app_slug")
    if slug:
        # The platform's admin-slug endpoint just confirms slug set.
        sl = call("GET", f"/api/apps/slug/{slug}", token=tok)
        print(f"PLATFORM /api/apps/slug/{slug}: ok, name = {sl.get('data', {}).get('name')}")

        # The proxy endpoint should hit the runtime container.
        proxy_url = f"/app/{slug}/app/slug/{slug}"
        proxy_url_opps = f"/app/{slug}/ontology/objects?app_id={app_id}"
        for u in (proxy_url, proxy_url_opps):
            try:
                r = call("GET", u, token=tok)
                summary = list(r.get("data", {}) or []) if isinstance(r.get("data"), list) else list((r.get("data") or {}).keys())[:6]
                print(f"PROXY {u}: data_keys/len = {summary}")
            except Exception as e:
                print(f"PROXY {u} failed: {e}")

    un = call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)
    print("UNPUBLISH =", un["success"], "stopped =", un.get("runtime_stopped"))


if __name__ == "__main__":
    main()
