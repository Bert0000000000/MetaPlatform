import requests
import json
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"


def main():
    # 登录
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@metaplatform.com", "password": "admin123"},
        timeout=5,
    ).json()
    token = r["data"]["token"]
    user = r["data"]["user"]

    headers = {"Authorization": f"Bearer {token}"}
    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    app_id = apps[0]["id"]

    # 通过 API 创建对象（避免 UI 表单对 icon 的依赖）
    obj_name = f"PlanObject_{int(time.time())}"
    obj_resp = requests.post(
        f"{BASE}/api/ontology/objects",
        headers=headers,
        json={
            "app_id": app_id,
            "name": obj_name,
            "label": "计划对象",
            "icon": "Box",
            "description": "测试对象字段管理",
        },
        timeout=5,
    ).json()
    object_id = obj_resp["data"]["id"]
    print(f"created object: {object_id} / {obj_name}")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:5173/login")
        page.evaluate(
            f"() => {{ localStorage.setItem('metaplatform_token', '{token}'); "
            f"localStorage.setItem('metaplatform_user', '{json.dumps(user)}'); }}"
        )
        page.goto(f"http://localhost:5173/apps/{app_id}/datamodeling")
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
