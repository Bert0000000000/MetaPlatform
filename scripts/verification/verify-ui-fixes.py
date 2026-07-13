"""
验证 Phase 2 收尾的两个 UI 修复：
1. ObjectFieldPanel 中「唯一」列正确显示「是/否」
2. 页面编辑器 toolbar 的「发布」按钮在 form 页面且已关联 form_id 时可用，点击后能发布表单
"""
import requests
import time
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
APP_SERVICE_BASE = "http://localhost:8092/api"
FRONTEND = "http://localhost:5173"
SCREENSHOT_DIR = "d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/scripts/verification"


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
    obj_code = f"unique_obj_{ts}"

    # 1. 在 Java 后端创建一个带 unique 字段的对象（Java 用 slug 解析应用）
    obj_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/objects",
        headers=headers,
        json={
            "code": obj_code,
            "name": "唯一验证对象",
            "description": "验证 ObjectFieldPanel 唯一列显示",
            "fields": [
                {"code": "email", "name": "邮箱", "type": "email", "required": True, "unique": True},
                {"code": "nickname", "name": "昵称", "type": "text", "required": False, "unique": False},
            ],
        },
        timeout=5,
    ).json()
    if not obj_resp.get("success"):
        raise RuntimeError(f"创建对象失败: {obj_resp}")
    object_id = obj_resp["data"]["id"]

    # 2. 创建一个表单并关联到该对象
    form_code = f"form_ui_{ts}"
    schema = {
        "version": 1,
        "pageName": "UI验证表单",
        "pageType": "form",
        "boundObjectId": str(object_id),
        "sections": [
            {
                "id": f"sec_{ts}",
                "title": "基本信息",
                "columns": 2,
                "collapsed": False,
                "fields": [
                    {"id": "f_email", "fieldKey": "email", "label": "邮箱", "widget": "input", "required": True, "boundObject": str(object_id), "boundProperty": "email"},
                    {"id": "f_nickname", "fieldKey": "nickname", "label": "昵称", "widget": "input", "required": False, "boundObject": str(object_id), "boundProperty": "nickname"},
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

    # 3. 在 Node 后端创建一个 type=form 的 page，并关联 form_id（Node 用 UUID 解析应用）
    page_resp = requests.post(
        f"{BASE}/api/apps/{app_id}/pages",
        headers=headers,
        json={"name": "UI验证表单页", "type": "form", "status": "draft", "icon": "📝", "form_id": str(form_id)},
        timeout=5,
    ).json()
    if not page_resp.get("success"):
        raise RuntimeError(f"创建页面失败: {page_resp}")
    page_id = page_resp["data"]["id"]

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda msg: print(f"[console {msg.type}] {msg.text}"))

        def log_response(response):
            url = response.url
            if "publish" in url or "forms" in url:
                print(f"[network] {response.status} {url}")
        page.on("response", log_response)

        # 登录态写入 localStorage
        page.goto(FRONTEND)
        page.evaluate(f"localStorage.setItem('mp_token', '{token}')")
        page.reload()

        # ---------- 验证 1：对象字段面板「唯一」列 ----------
        page.goto(f"{FRONTEND}/apps/{app_id}/datamodeling")
        page.wait_for_selector("text=业务数据建模", state="visible", timeout=10000)
        # 等待对象行出现
        page.wait_for_selector(f"text={obj_code}", state="visible", timeout=10000)
        # 点击该对象行中的字段按钮
        page.locator(f'tr:has-text("{obj_code}") button[title="字段"]').click()
        page.wait_for_selector("text=对象字段：唯一验证对象", state="visible", timeout=10000)

        # email 行唯一列应为「是」，nickname 行唯一列应为「否」
        unique_email = page.locator(f'table tbody tr:has-text("email") td:nth-child(5)')
        unique_nickname = page.locator(f'table tbody tr:has-text("nickname") td:nth-child(5)')
        unique_email.wait_for(state="visible", timeout=5000)
        unique_nickname.wait_for(state="visible", timeout=5000)
        assert unique_email.inner_text().strip() == "是", f"email 唯一列显示异常: {unique_email.inner_text()}"
        assert unique_nickname.inner_text().strip() == "否", f"nickname 唯一列显示异常: {unique_nickname.inner_text()}"

        page.screenshot(path=f"{SCREENSHOT_DIR}/verify-ui-object-field-panel.png", full_page=False)

        # 关闭字段面板
        page.click('button:has-text("关闭")')

        # ---------- 验证 2：页面编辑器「发布」按钮 ----------
        page.goto(f"{FRONTEND}/apps/{app_id}/page-editor?pageId={page_id}")
        publish_btn = page.locator('button:has-text("发布")')
        try:
            publish_btn.wait_for(state="visible", timeout=15000)
        except Exception:
            page.screenshot(path=f"{SCREENSHOT_DIR}/verify-ui-page-editor-error.png", full_page=False)
            raise RuntimeError("页面编辑器未在 15s 内加载出发布按钮，已保存错误截图")
        assert publish_btn.is_enabled(), "发布按钮应当可用，但当前被禁用"

        publish_btn.click()
        try:
            page.wait_for_selector("text=表单已发布", state="visible", timeout=5000)
        except Exception:
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/verify-ui-publish-toast.png", full_page=False)
            # 如果失败也允许继续截图，但会抛出更清晰的错误
            body_text = page.locator("body").inner_text()
            if "表单已发布" in body_text:
                pass
            else:
                raise RuntimeError(f"未检测到发布成功提示。当前页面文本片段: {body_text[:300]}")

        page.screenshot(path=f"{SCREENSHOT_DIR}/verify-ui-publish-button.png", full_page=False)

        browser.close()

    print("OK: UI 修复验证通过")
    print(f"  - 对象字段面板截图: {SCREENSHOT_DIR}/verify-ui-object-field-panel.png")
    print(f"  - 发布按钮截图: {SCREENSHOT_DIR}/verify-ui-publish-button.png")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
