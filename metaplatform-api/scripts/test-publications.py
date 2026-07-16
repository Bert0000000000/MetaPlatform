"""Smoke test for /:id/publications and /:id/runtime. Publishes a fresh CRM
app to ensure we have at least one published record, then exercises the
publications endpoint."""

import json, urllib.request, urllib.error, sys, time

API = "http://127.0.0.1:3001"


def call(method, path, body=None, token=None, timeout=20):
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
    name = "环境链接 Demo " + str(int(time.time()))
    created = call("POST", "/api/apps", {"name": name, "description": "links demo", "category": "CRM", "icon": "Users", "template": "crm"}, tok)
    app_id = created["data"]["id"]
    print("CREATE app_id =", app_id)

    # Publish TWICE so the list shows two environment rows.
    call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)
    call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)

    pubs = call("GET", f"/api/apps/{app_id}/publications", token=tok)
    print("PUBLICATIONS count =", len(pubs["data"]))
    for p in pubs["data"]:
        print("  -", json.dumps(p, ensure_ascii=False))

    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print("RUNTIME =", json.dumps(rt["data"], ensure_ascii=False))

    # Cleanup
    call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)


if __name__ == "__main__":
    main()