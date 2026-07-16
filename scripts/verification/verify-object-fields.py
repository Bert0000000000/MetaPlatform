import requests
import json
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
APP_SERVICE_BASE = "http://localhost:8092/api"


def main():
    # 登录（复用 Node 平台的认证）
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@metaplatform.com", "password": "admin123"},
        timeout=5,
    ).json()
    token = r["data"]["token"]
    user = r["data"]["user"]
    headers = {"Authorization": f"Bearer {token}"}

    # 从 Node 平台取第一个应用（slug）
    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    app_id = apps[0]["id"]
    app_slug = apps[0].get("app_slug") or apps[0].get("slug") or app_id

    # 通过 Java app-service API 创建对象（避免 UI 表单依赖）
    obj_name = f"plan_object_{int(time.time())}"
    obj_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/objects",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "code": obj_name,
            "name": "PlanObject",
            "description": "测试对象字段管理",
        },
        timeout=5,
    ).json()
    print("obj_resp:", obj_resp)
    if not obj_resp.get("success"):
        raise RuntimeError(f"创建对象失败: {obj_resp}")
    object_id = obj_resp["data"]["id"]
    print(f"created object: {object_id} / {obj_name} under app {app_slug}")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:5173/login")
        page.evaluate(
            f"() => {{ localStorage.setItem('metaplatform_token', '{token}'); "
            f"localStorage.setItem('metaplatform_user', '{json.dumps(user)}'); }}"
        )
        page.goto(f"http://localhost:5173/apps/{app_slug}/datamodeling")
        page.wait_for_timeout(1500)

        # 打开刚创建对象的字段面板
        page.locator(f'tr:has-text("{obj_name}") button[title="字段"]').click()
        page.wait_for_selector("input#field-name", state="visible", timeout=5000)
        page.wait_for_timeout(500)

        # 添加字段
        page.locator("input#field-name").click()
        page.keyboard.type("plan_name")
        page.locator("input#field-label").click()
        page.keyboard.type("计划名称")
        page.click('button:has-text("添加字段")')
        page.wait_for_timeout(800)

        # 截图
        page.screenshot(
            path="d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/verify-object-fields.png",
            full_page=False,
        )

        # 校验字段出现在列表
        assert page.locator('td:has-text("plan_name")').count() > 0, "字段未保存"
        browser.close()
        print("OK: object field management verified")


if __name__ == "__main__":
    main()
