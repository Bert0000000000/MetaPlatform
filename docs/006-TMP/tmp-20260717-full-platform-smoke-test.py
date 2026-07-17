"""Full platform frontend smoke test for Mate Platform."""

import json
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_DIR = r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP'
RESULT_FILE = f'{BASE_DIR}\\smoke-result.json'

APPS = [
    {
        'name': 'ONTSTUDIO',
        'port': 9101,
        'title': 'Ontology Studio',
        'home': '/concepts',
        'check_login_btn': 'button[type="submit"]',
        'check_logged_in': 'button:has-text("创建概念")',
    },
    {
        'name': 'APPHUB',
        'port': 9201,
        'title': '应用中心',
        'home': '/apps',
        'check_login_btn': 'button[type="submit"]',
        'check_logged_in': 'button:has-text("创建应用")',
    },
    {
        'name': 'SUPERAI',
        'port': 9301,
        'title': 'SuperAI',
        'home': '/chat',
        'check_login_btn': 'button[type="submit"]',
        'check_logged_in': '.ant-sender',
    },
    {
        'name': 'DW',
        'port': 9401,
        'title': '数字员工工作台',
        'home': '/dw',
        'check_login_btn': 'button[type="submit"]',
        'check_logged_in': 'button:has-text("创建数字员工")',
    },
]


def inject_auth(page):
    page.evaluate('''() => {
        localStorage.setItem('mate_platform_token', 'mock-token');
        localStorage.setItem('mate_platform_user', JSON.stringify({
            id: 'admin', username: 'admin', tenantId: 'default', roles: ['admin']
        }));
    }''')


def smoke_app(page, app):
    print(f'\n=== {app["name"]} Smoke Test ===')
    base = f'http://localhost:{app["port"]}'

    try:
        # 1. Login page
        page.goto(base)
        page.wait_for_load_state('networkidle')
    except Exception as e:
        print(f'ERROR: {app["name"]} login page unreachable: {e}')
        return False
    page.screenshot(path=f'{BASE_DIR}\\tmp-20260717-{app["name"].lower()}-login.png', full_page=True)

    login_btn = page.locator(app['check_login_btn'])
    if login_btn.count() == 0:
        print(f'ERROR: {app["name"]} login button not found')
        return False
    if app['title'] not in page.content():
        print(f'ERROR: {app["name"]} title "{app["title"]}" not found')
        return False
    print(f'{app["name"]} login page renders correctly')

    try:
        # 2. Authenticated page
        inject_auth(page)
        page.goto(base + app['home'])
        page.wait_for_load_state('networkidle')
    except Exception as e:
        print(f'ERROR: {app["name"]} authenticated home page unreachable: {e}')
        return False
    page.screenshot(path=f'{BASE_DIR}\\tmp-20260717-{app["name"].lower()}-home.png', full_page=True)

    check = page.locator(app['check_logged_in']).first
    if check.count() == 0:
        print(f'ERROR: {app["name"]} authenticated home page missing key element: {app["check_logged_in"]}')
        return False
    print(f'{app["name"]} authenticated home page renders correctly')
    return True


def write_report(results, errors):
    all_ok = all(r['ok'] for r in results)
    report = {
        'timestamp': datetime.now().isoformat(),
        'allPassed': all_ok,
        'results': results,
        'errors': errors,
    }
    with open(RESULT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return all_ok


def run():
    results = []
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            page.set_default_timeout(15000)
            try:
                for app in APPS:
                    try:
                        ok = smoke_app(page, app)
                        results.append({'name': app['name'], 'ok': ok})
                    except Exception as e:
                        errors.append({'name': app['name'], 'error': str(e)})
                        results.append({'name': app['name'], 'ok': False})
            finally:
                browser.close()
    except Exception as e:
        errors.append({'name': 'framework', 'error': str(e)})
    finally:
        all_ok = write_report(results, errors)

    return 0 if all_ok else 1


if __name__ == '__main__':
    sys.exit(run())
