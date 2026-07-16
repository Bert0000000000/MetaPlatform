"""
验证 v1.0.1 US-203：列表页（分页 / 排序 / 过滤 / CSV 导出）
"""
import requests
import csv
import io
import sys
import time

BASE = "http://localhost:3001"
APP_SERVICE_BASE = "http://localhost:8092/api"


def login():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@metaplatform.com", "password": "admin123"},
        timeout=5,
    ).json()
    if not r.get("success"):
        raise RuntimeError(f"登录失败: {r}")
    token = r["data"]["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, token


def main():
    headers, token = login()

    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    if not apps:
        raise RuntimeError("没有可用应用")
    app = apps[0]
    app_id = app["id"]
    app_slug = app.get("app_slug") or app.get("slug") or app_id

    ts = int(time.time())
    obj_code = f"list_obj_{ts}"

    # 1. 创建对象（带不同字段类型）
    obj_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/objects",
        headers=headers,
        json={
            "code": obj_code,
            "name": "列表验证对象",
            "description": "验证列表页功能",
            "fields": [
                {"code": "name", "name": "姓名", "type": "text", "required": True, "unique": False},
                {"code": "amount", "name": "金额", "type": "number", "required": True, "unique": False},
                {"code": "status", "name": "状态", "type": "text", "required": False, "unique": False},
            ],
        },
        timeout=5,
    ).json()
    if not obj_resp.get("success"):
        raise RuntimeError(f"创建对象失败: {obj_resp}")
    object_id = obj_resp["data"]["id"]

    # 2. 创建并发布表单
    form_code = f"list_form_{ts}"
    schema = {
        "version": 1,
        "pageName": "列表验证表单",
        "pageType": "form",
        "boundObjectId": str(object_id),
        "sections": [
            {
                "id": f"sec_{ts}",
                "title": "基本信息",
                "columns": 2,
                "collapsed": False,
                "fields": [
                    {"id": "f_name", "fieldKey": "name", "label": "姓名", "widget": "input", "required": True, "boundObject": str(object_id), "boundProperty": "name"},
                    {"id": "f_amount", "fieldKey": "amount", "label": "金额", "widget": "input", "required": True, "boundObject": str(object_id), "boundProperty": "amount"},
                    {"id": "f_status", "fieldKey": "status", "label": "状态", "widget": "input", "required": False, "boundObject": str(object_id), "boundProperty": "status"},
                ],
            }
        ],
    }
    form_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms",
        headers=headers,
        json={"objectId": object_id, "code": form_code, "name": "列表验证表单", "schema": schema},
        timeout=5,
    ).json()
    if not form_resp.get("success"):
        raise RuntimeError(f"创建表单失败: {form_resp}")
    form_id = form_resp["data"]["id"]

    pub_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms/{form_id}/publish",
        headers=headers,
        timeout=5,
    ).json()
    if not pub_resp.get("success"):
        raise RuntimeError(f"发布表单失败: {pub_resp}")

    # 3. 公开提交 5 条数据
    submissions = [
        {"name": "Alice", "amount": 1000, "status": "pending"},
        {"name": "Bob", "amount": 2000, "status": "approved"},
        {"name": "Carol", "amount": 3000, "status": "approved"},
        {"name": "Dave", "amount": 1500, "status": "rejected"},
        {"name": "Eve", "amount": 2500, "status": "approved"},
    ]
    for v in submissions:
        r = requests.post(
            f"{APP_SERVICE_BASE}/public/forms/{form_id}/submit",
            json={"values": v},
            timeout=5,
        ).json()
        if not r.get("success"):
            raise RuntimeError(f"提交失败: {r}")

    # 4. 验证公开列表查询（分页）
    page1 = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data?page=1&size=2",
        timeout=5,
    ).json()
    assert page1.get("success"), f"列表查询失败: {page1}"
    data1 = page1["data"]
    assert data1["total"] == 5, f"total 应为 5: {data1['total']}"
    assert len(data1["rows"]) == 2, f"page1 size 应为 2: {len(data1['rows'])}"
    assert data1["page"] == 1, f"page 应为 1: {data1['page']}"

    page2 = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data?page=2&size=2",
        timeout=5,
    ).json()["data"]
    assert len(page2["rows"]) == 2, f"page2 size 应为 2: {len(page2['rows'])}"
    assert page2["rows"][0]["id"] != data1["rows"][0]["id"], "分页应返回不同行"

    page3 = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data?page=3&size=2",
        timeout=5,
    ).json()["data"]
    assert len(page3["rows"]) == 1, f"page3 size 应为 1: {len(page3['rows'])}"

    # 5. 验证排序（按 amount 降序）
    sorted_desc = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data?sort=-amount",
        timeout=5,
    ).json()["data"]
    amounts = [int(r["amount"]) for r in sorted_desc["rows"]]
    assert amounts == sorted(amounts, reverse=True), f"降序结果异常: {amounts}"

    sorted_asc = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data?sort=amount",
        timeout=5,
    ).json()["data"]
    amounts_asc = [int(r["amount"]) for r in sorted_asc["rows"]]
    assert amounts_asc == sorted(amounts_asc), f"升序结果异常: {amounts_asc}"

    # 6. 验证过滤
    filtered = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data",
        params={"status": "approved"},
        timeout=5,
    ).json()["data"]
    assert len(filtered["rows"]) == 3, f" approved 应为 3 条: {len(filtered['rows'])}"
    for r in filtered["rows"]:
        assert r["status"] == "approved", f"过滤结果异常: {r}"

    gt2000 = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data",
        params={"amount": ">2000"},
        timeout=5,
    ).json()["data"]
    assert len(gt2000["rows"]) == 2, f"amount>2000 应为 2 条: {len(gt2000['rows'])}"
    for r in gt2000["rows"]:
        assert int(r["amount"]) > 2000, f"过滤结果异常: {r}"

    fuzzy = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data",
        params={"name": "~A"},
        timeout=5,
    ).json()["data"]
    assert len(fuzzy["rows"]) == 1, f"name~A 应为 1 条: {len(fuzzy['rows'])}"
    assert "A" in fuzzy["rows"][0]["name"]

    # 7. 验证 CSV 导出
    csv_resp = requests.get(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/data.csv",
        params={"status": "approved"},
        timeout=10,
    )
    csv_resp.raise_for_status()
    content = csv_resp.content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    csv_rows = list(reader)
    assert len(csv_rows) == 3, f"CSV 行数应为 3: {len(csv_rows)}"
    for r in csv_rows:
        assert r["status"] == "approved"

    # 8. 验证需要 JWT 的管理端列表接口
    authed = requests.get(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms/{form_id}/data",
        headers=headers,
        timeout=5,
    ).json()
    assert authed.get("success"), f"管理端列表失败: {authed}"
    assert authed["data"]["total"] == 5

    print("OK: 列表页功能验证通过")
    print(f"  - 应用: {app_slug}")
    print(f"  - 对象: {obj_code} (id={object_id})")
    print(f"  - 表单: {form_code} (id={form_id})")
    print(f"  - 提交记录: 5 条")
    print(f"  - 分页/排序/过滤/CSV 全部通过")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
