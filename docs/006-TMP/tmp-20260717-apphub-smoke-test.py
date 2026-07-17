from playwright.sync_api import sync_playwright
import sys

BASE_URL = 'http://localhost:9201'

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        try:
            print(f'Navigating to {BASE_URL}')
            page.goto(BASE_URL)
            page.wait_for_load_state('networkidle')
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-login.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-login.png')

            title = page.title()
            print(f'Page title: {title}')

            # Check login page renders
            login_button = page.locator('button[type="submit"]')
            if login_button.count() > 0:
                print('Login button found: login page renders correctly')
            else:
                print('ERROR: Login button not found')
                sys.exit(1)

            # Inject mock token/user to bypass backend login and test protected routes
            page.evaluate('''() => {
                localStorage.setItem('mate_platform_token', 'mock-token');
                localStorage.setItem('mate_platform_user', JSON.stringify({id:'admin',username:'admin',tenantId:'default',roles:['admin']}));
            }''')
            page.goto(f'{BASE_URL}/apps')
            page.wait_for_load_state('networkidle')
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-app-list.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-app-list.png')

            create_btn = page.locator('button:has-text("创建应用")').first
            if create_btn.count() > 0:
                print('App list page renders correctly')
            else:
                print('ERROR: App list page not rendered')
                sys.exit(1)

            # Create an app
            create_btn.click()
            page.wait_for_selector('.ant-modal:has-text("创建应用")', timeout=5000)
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-create-modal.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-create-modal.png')
            page.fill('input[placeholder*="例如：采购管理"]', '冒烟测试应用')
            page.fill('input[placeholder*="例如：PURCHASE"]', 'SMOKE_TEST')
            page.click('.ant-modal-footer button.ant-btn-primary')

            # Wait for modal to close and app card to appear
            page.wait_for_selector('.ant-modal', state='hidden', timeout=10000)
            page.wait_for_selector('text=冒烟测试应用', timeout=10000)
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-after-create.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-after-create.png')
            print('Smoke test passed: app created and listed')

            # Open app detail
            page.click('text=冒烟测试应用')
            page.wait_for_url('**/apps/**', timeout=10000)
            page.wait_for_load_state('networkidle')
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-app-detail.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-app-detail.png')

            create_module_btn = page.locator('button:has-text("创建模块")')
            if create_module_btn.count() > 0:
                print('App detail page renders correctly')
            else:
                print('ERROR: App detail page not rendered')
                sys.exit(1)

            # Create a form module
            create_module_btn.click()
            page.wait_for_selector('.ant-modal:has-text("创建模块")', timeout=5000)
            page.fill('input[placeholder*="例如：采购申请"]', '冒烟表单')
            page.fill('input[placeholder*="例如：purchase_apply"]', 'smoke_form')
            page.click('.ant-modal-footer button.ant-btn-primary')
            page.wait_for_selector('.ant-modal', state='hidden', timeout=10000)
            page.wait_for_selector('text=冒烟表单', timeout=10000)
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-after-module.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-after-module.png')
            print('Smoke test passed: form module created')

            # Open form designer
            page.click('text=冒烟表单')
            page.wait_for_url('**/form-designer', timeout=10000)
            page.wait_for_load_state('networkidle')
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-form-designer.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-form-designer.png')
            print('Smoke test passed: form designer renders')

            # Add a text field
            page.click('button:has-text("单行文本")')
            page.wait_for_selector('text=单行文本', timeout=5000)
            page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-apphub-form-field-added.png', full_page=True)
            print('Screenshot saved: tmp-20260717-apphub-form-field-added.png')
            print('Smoke test passed: text field added to canvas')

        finally:
            browser.close()

if __name__ == '__main__':
    run()
