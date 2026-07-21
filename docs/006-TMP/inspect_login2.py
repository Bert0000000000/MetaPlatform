from playwright.sync_api import sync_playwright

APPS = [
    ('SUPERAI', 'http://localhost:9301', '/chat', '智能对话'),
    ('ONTSTUDIO', 'http://localhost:9101', '/concepts', '概念'),
    ('APPHUB', 'http://localhost:9201', '/apps', '创建应用'),
    ('DW', 'http://localhost:9401', '/dw/employees', '创建数字员工'),
    ('MCPHUB', 'http://localhost:9501', '/', '概览'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(15000)

    for name, base, home, keyword in APPS:
        logs = []
        page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

        print(f'\n=== {name} ({base}) ===')
        page.goto(base, wait_until='networkidle')
        print(f'Before login: url={page.url}, title={page.title()}')

        # Fill and submit login form
        page.get_by_placeholder('例如：default').fill('default')
        page.get_by_placeholder('请输入用户名').fill('admin')
        page.get_by_placeholder('请输入密码').fill('Meta@12345')
        page.locator('button[type="submit"]').click()

        # Wait for navigation or response
        try:
            page.wait_for_load_state('networkidle', timeout=10000)
        except Exception:
            pass
        page.wait_for_timeout(1500)

        print(f'After login: url={page.url}, title={page.title()}')
        body_text = page.locator('body').inner_text()[:300]
        print(f'body text: {body_text!r}')
        print(f'contains "{keyword}": {keyword in body_text}')
        print('logs:')
        for line in logs[-20:]:
            print('  ', line)

    browser.close()
