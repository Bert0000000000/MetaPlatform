from playwright.sync_api import sync_playwright
import sys

def smoke_superai(page):
    print('\n=== SUPERAI Smoke Test ===')
    page.goto('http://localhost:9301')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-superai-login.png', full_page=True)
    print('Screenshot saved: tmp-20260717-superai-login.png')

    login_btn = page.locator('button[type="submit"]')
    if login_btn.count() == 0:
        print('ERROR: SUPERAI login button not found')
        return False
    print('SUPERAI login page renders correctly')

    # Inject mock token
    page.evaluate('''() => {
        localStorage.setItem('mate_platform_token', 'mock-token');
        localStorage.setItem('mate_platform_user', JSON.stringify({id:'admin',username:'admin',tenantId:'default',roles:['admin']}));
    }''')
    page.goto('http://localhost:9301/chat')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-superai-chat.png', full_page=True)
    print('Screenshot saved: tmp-20260717-superai-chat.png')

    sender = page.locator('.ant-sender')
    if sender.count() == 0:
        print('ERROR: SUPERAI chat sender not found')
        return False
    print('SUPERAI chat page renders correctly')
    return True

def smoke_dw(page):
    print('\n=== DW Smoke Test ===')
    page.goto('http://localhost:9401')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-dw-login.png', full_page=True)
    print('Screenshot saved: tmp-20260717-dw-login.png')

    login_btn = page.locator('button[type="submit"]')
    if login_btn.count() == 0:
        print('ERROR: DW login button not found')
        return False
    print('DW login page renders correctly')

    page.evaluate('''() => {
        localStorage.setItem('mate_platform_token', 'mock-token');
        localStorage.setItem('mate_platform_user', JSON.stringify({id:'admin',username:'admin',tenantId:'default',roles:['admin']}));
    }''')
    page.goto('http://localhost:9401/dw')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-dw-list.png', full_page=True)
    print('Screenshot saved: tmp-20260717-dw-list.png')

    create_btn = page.locator('button:has-text("创建数字员工")').first
    if create_btn.count() == 0:
        print('ERROR: DW create employee button not found')
        return False
    print('DW employee list page renders correctly')

    create_btn.click()
    page.wait_for_url('**/dw/employees/create', timeout=10000)
    page.wait_for_load_state('networkidle')
    page.screenshot(path=r'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\tmp-20260717-dw-wizard.png', full_page=True)
    print('Screenshot saved: tmp-20260717-dw-wizard.png')
    print('DW employee creation wizard renders correctly')
    return True

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        try:
            ok_sai = smoke_superai(page)
            ok_dw = smoke_dw(page)
            if ok_sai and ok_dw:
                print('\nAll smoke tests passed')
                return 0
            else:
                print('\nSome smoke tests failed')
                return 1
        finally:
            browser.close()

if __name__ == '__main__':
    sys.exit(run())
