"""Test the baseSlug → historical-slug alias works end-to-end."""

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
    created = call("POST", "/api/apps", {"name": name, "description": "alias demo", "category": "CRM", "icon": "Users", "template": "crm"}, tok)
    app_id = created["data"]["id"]
    slug = created["data"]["app_slug"]
    print(f"CREATE app_id = {app_id}, slug = {slug}")

    pub1 = call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    slug = pub1["data"]["app_slug"]
    print(f"PUBLISH 1: app_slug = {slug}, container port =", pub1["data"]["runtime"]["port"], "historical_slug =", pub1["data"]["runtime"]["historical_slug"])

    proxy_url = f"/app/{slug}/app/slug/{slug}"
    r = call("GET", proxy_url, token=tok)
    print(f"PROXY {proxy_url}: name = {r.get('data', {}).get('name')}")

    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print("RUNTIME after first publish:", rt["data"]["runtime"]["state"], "running =", rt["data"]["runtime"].get("running"))

    pubs = call("GET", f"/api/apps/{app_id}/publications", token=tok)
    for p in pubs["data"]:
        print("  PUB:", p["slug"], p["environment"], "isLive =", p["isLive"])

    call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)
    pub2 = call("POST", f"/api/apps/{app_id}/publish", {"pages": [], "config": {}}, tok)
    print("PUBLISH 2: container port =", pub2["data"]["runtime"]["port"], "historical_slug =", pub2["data"]["runtime"]["historical_slug"])

    pubs = call("GET", f"/api/apps/{app_id}/publications", token=tok)
    for p in pubs["data"]:
        print("  PUB:", p["slug"], p["environment"], "isLive =", p["isLive"])

    rt = call("GET", f"/api/apps/{app_id}/runtime", token=tok)
    print("RUNTIME after second publish:", rt["data"]["runtime"]["state"], "running =", rt["data"]["runtime"].get("running"))

    call("POST", f"/api/apps/{app_id}/unpublish", {}, tok)


if __name__ == "__main__":
    main()