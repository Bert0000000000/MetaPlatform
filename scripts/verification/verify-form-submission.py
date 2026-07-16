import requests
import json
import time
import sys

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
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main():
    headers = login()

    # 1. 从 Node 平台取第一个应用 slug
    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    if not apps:
        raise RuntimeError("没有可用应用")
    app = apps[0]
    app_slug = app.get("app_slug") or app.get("slug") or app["id"]
    print(f"using app: {app_slug}")

    # 2. 在 Java 后端创建对象（含多类型字段）
    obj_code = f"plan_object_{int(time.time())}"
    obj_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/objects",
        headers=headers,
        json={
            "code": obj_code,
            "name": "端到端验证对象",
            "description": "Phase 2 表单提交端到端验证",
            "fields": [
                {"code": "plan_name", "name": "计划名称", "type": "text", "required": True, "unique": True},
                {"code": "plan_budget", "name": "预算", "type": "number", "required": False},
                {"code": "plan_start", "name": "开始日期", "type": "date", "required": True},
                {"code": "plan_active", "name": "是否启用", "type": "boolean", "required": False},
                {"code": "plan_type", "name": "计划类型", "type": "select", "required": False},
            ],
        },
        timeout=5,
    ).json()
    print("create object:", json.dumps(obj_resp, ensure_ascii=False))
    if not obj_resp.get("success"):
        raise RuntimeError(f"创建对象失败: {obj_resp}")
    object_id = obj_resp["data"]["id"]
    print(f"created object id={object_id} code={obj_code}")

    # 3. 创建表单（schema 使用 DesignerState 结构）
    form_code = f"form_page_e2e_{int(time.time())}"
    schema = {
        "version": 1,
        "pageName": "端到端表单",
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
                    {"id": "f_type", "fieldKey": "plan_type", "label": "计划类型", "widget": "select", "boundObject": str(object_id), "boundProperty": "plan_type"},
                ],
            }
        ],
    }
    form_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms",
        headers=headers,
        json={"objectId": object_id, "code": form_code, "name": "端到端表单", "schema": schema},
        timeout=5,
    ).json()
    print("create form:", json.dumps(form_resp, ensure_ascii=False))
    if not form_resp.get("success"):
        raise RuntimeError(f"创建表单失败: {form_resp}")
    form_id = form_resp["data"]["id"]
    print(f"created form id={form_id}")

    # 4. 发布表单
    pub_resp = requests.post(
        f"{APP_SERVICE_BASE}/apps/{app_slug}/forms/{form_id}/publish",
        headers=headers,
        timeout=5,
    ).json()
    print("publish form:", json.dumps(pub_resp, ensure_ascii=False))
    if not pub_resp.get("success"):
        raise RuntimeError(f"发布表单失败: {pub_resp}")

    # 5. 拉取公开表单 schema 确认可访问
    public_schema = requests.get(f"{APP_SERVICE_BASE}/public/forms/{form_id}", timeout=5).json()
    print("public schema:", json.dumps(public_schema, ensure_ascii=False))
    if not public_schema.get("success"):
        raise RuntimeError(f"拉取公开表单失败: {public_schema}")

    # 6. 公开提交
    submit_body = {
        "values": {
            "plan_name": f"端到端测试计划 {int(time.time())}",
            "plan_budget": "120000",
            "plan_start": "2026-07-13",
            "plan_active": "true",
            "plan_type": "年度",
        },
        "submitterName": "自动化测试",
        "submitterEmail": "test@example.com",
    }
    submit_resp = requests.post(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/submit",
        headers={"Content-Type": "application/json"},
        json=submit_body,
        timeout=5,
    ).json()
    print("submit:", json.dumps(submit_resp, ensure_ascii=False))
    if not submit_resp.get("success"):
        raise RuntimeError(f"表单提交失败: {submit_resp}")
    row_id = submit_resp["data"]["id"]
    print(f"submitted row id={row_id}")

    # 7. 校验必填失败
    bad_resp = requests.post(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/submit",
        headers={"Content-Type": "application/json"},
        json={"values": {"plan_budget": "not-a-number"}},
        timeout=5,
    ).json()
    print("required check:", json.dumps(bad_resp, ensure_ascii=False))
    if bad_resp.get("success"):
        raise RuntimeError("必填校验应当失败，但返回了 success")
    assert "不能为空" in (bad_resp.get("error") or ""), "错误提示不含中文必填信息"

    # 8. 校验唯一失败
    dup_resp = requests.post(
        f"{APP_SERVICE_BASE}/public/forms/{form_id}/submit",
        headers={"Content-Type": "application/json"},
        json=submit_body,
        timeout=5,
    ).json()
    print("unique check:", json.dumps(dup_resp, ensure_ascii=False))
    if dup_resp.get("success"):
        raise RuntimeError("唯一校验应当失败，但返回了 success")
    assert "已存在" in (dup_resp.get("error") or ""), "错误提示不含中文唯一信息"

    print("OK: form submission e2e verified")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
