"""Test that POST /:id/restore rolls the live runtime back to an
archived publication without rebuilding any container.

Steps:
  1. create a fresh CRM template app
  2. publish v1 (becomes production)
  3. publish v2 (v1 archived, v2 production)
  4. capture each publication's container port via /runtime
  5. POST /restore with publicationId=v1
  6. verify alias switched back: /app/<baseSlug> now resolves to v1's container
  7. cleanup
"""
import json
import sys
import time
import urllib.error
import urllib.request

API = "http://127.0.0.1:3001"


def call(method, path, body=None, token=None, timeout=20):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json",
                 **({"Authorization": "Bearer " + token} if token else {})},
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=timeout).read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        sys.stderr.write(f"HTTP {e.code} {path}: {body}\n")
        raise


def main():
    tok = call("POST", "/api/auth/login",
               {"email": "admin@metaplatform.com", "password": "admin123"})["data"]["token"]
    name = "rollback demo " + str(int(time.time()))
    created = call("POST", "/api/apps",
                   {"name": name, "description": "restore test",
                    "category": "CRM", "icon": "Users", "template": "crm"}, tok)
    app_id = created["data"]["id"]

    # Publish twice so we have a history.
    pub1 = call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    pub1_slug = pub1["data"]["app_slug"]
    pub1_hist = pub1["data"]["runtime"]["historical_slug"]
    pub1_port = pub1["data"]["runtime"]["port"]
    print(f"v1: base={pub1_slug} historical={pub1_hist} port={pub1_port}")

    pub2 = call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    pub2_hist = pub2["data"]["runtime"]["historical_slug"]
    pub2_port = pub2["data"]["runtime"]["port"]
    print(f"v2: historical={pub2_hist} port={pub2_port}")

    pubs = call("GET", f"/api/apps/{app_id}/publications", token=tok)["data"]
    archived_v1 = next(p for p in pubs if p["slug"] == pub1_hist)
    live_v2 = next(p for p in pubs if p["slug"] == pub2_hist)
    print(f"listings: live={live_v2['slug']} archived={archived_v1['slug']}")

    # Live now points at v2.
    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print(f"runtime state before restore: {rt['data']['runtime']['state']} port={rt['data']['runtime'].get('port')}")
    assert rt["data"]["runtime"]["port"] == pub2_port, "expected live runtime port == v2 port"

    # Restore v1
    r = call("POST", f"/api/apps/{app_id}/restore", {"publicationId": archived_v1["id"]}, tok)
    print("restore:", r["success"], r.get("data", {}).get("restored_from"))

    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print(f"runtime state after restore: {rt['data']['runtime']['state']} port={rt['data']['runtime'].get('port')}")
    assert rt["data"]["runtime"]["port"] == pub1_port, (
        f"expected live runtime port == v1 port ({pub1_port}) after restore, got {rt['data']['runtime']['port']}"
    )

    # And the /app/<baseSlug>/app/slug/<baseSlug> proxy should hit v1
    r = call("GET", f"/app/{pub1_slug}/app/slug/{pub1_slug}", token=tok)
    print(f"proxied through {pub1_slug}: app_name = {r['data']['name']}")

    # cleanup
    call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)
    print("OK")


if __name__ == "__main__":
    main()