import requests
import time
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
APP_SERVICE_BASE = "http://localhost:8092/api"
FRONTEND = "http://localhost:5173"


def login():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@metaplatform.com", "password": "admin123"},
        timeout=5,
    ).json()
    if not r.get("success"):
        raise RuntimeError(f"登录失败: {r}")
    token = r["data"]["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main():
    headers = login()

    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    if not apps:
        raise RuntimeError("没有可用应用")
    app = apps[0]
    app_slug = app.get("app_slug") or app.get("slug") or app["id"]

    obj_code = f"ui_object_{int(time.time())}"
    obj_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/objects",
        headers=headers,
        json={
            "code": obj_code,
            "name": "UI验证对象",
            "description": "公开表单 UI 端到端验证",
            "fields": [
                {"code": "plan_name", "name": "计划名称", "type": "text", "required": True, "unique": True},
                {"code": "plan_budget", "name": "预算", "type": "number", "required": False},
                {"code": "plan_start", "name": "开始日期", "type": "date", "required": True},
                {"code": "plan_active", "name": "是否启用", "type": "boolean", "required": False},
            ],
        },
        timeout=5,
    ).json()
    if not obj_resp.get("success"):
        raise RuntimeError(f"创建对象失败: {obj_resp}")
    object_id = obj_resp["data"]["id"]

    form_code = f"form_page_ui_{int(time.time())}"
    schema = {
        "version": 1,
        "pageName": "UI验证表单",
        "pageType": "form",
        "boundObjectId": str(object_id),
        "sections": [
            {
                "id": f"sec_{int(time.time())}",
                "title": "基本信息",
                "columns": 2,
                "collapsed": False,
                "fields": [
                    {"id": "f_name", "fieldKey": "plan_name", "label": "计划名称", "widget": "input", "required": True, "boundObject": str(object_id), "boundProperty": "plan_name"},
                    {"id": "f_budget", "fieldKey": "plan_budget", "label": "预算", "widget": "number", "boundObject": str(object_id), "boundProperty": "plan_budget"},
                    {"id": "f_start", "fieldKey": "plan_start", "label": "开始日期", "widget": "datepicker", "required": True, "boundObject": str(object_id), "boundProperty": "plan_start"},
                    {"id": "f_active", "fieldKey": "plan_active", "label": "是否启用", "widget": "switch", "boundObject": str(object_id), "boundProperty": "plan_active"},
                ],
            }
        ],
    }
    form_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms",
        headers=headers,
        json={"objectId": object_id, "code": form_code, "name": "UI验证表单", "schema": schema},
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

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{FRONTEND}/public/form/{app_slug}?formId={form_id}")
        page.wait_for_selector("text=UI验证表单", state="visible", timeout=10000)

        # 填写字段
        page.fill('input[type="text"]', f"UI测试计划 {int(time.time())}")
        page.fill('input[type="number"]', "250000")
        # datepicker -> input[type="date"]
        page.fill('input[type="date"]', "2026-07-15")
        # switch -> checkbox
        page.check('input[type="checkbox"]')

        page.click('button:has-text("立即提交")')
        page.wait_for_selector("text=提交成功", state="visible", timeout=10000)

        page.screenshot(
            path="d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/verify-form-public-ui.png",
            full_page=False,
        )
        browser.close()

    print(f"OK: public form UI verified, form_id={form_id}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
