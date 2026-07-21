from playwright.sync_api import sync_playwright

APPS = [
    ('SUPERAI', 'http://localhost:9301', '/chat', 'SuperAI'),
    ('ONTSTUDIO', 'http://localhost:9101', '/concepts', 'Ontology Studio'),
    ('APPHUB', 'http://localhost:9201', '/apps', '应用中心'),
    ('DW', 'http://localhost:9401', '/dw/employees', '数字员工工作台'),
    ('MCPHUB', 'http://localhost:9501', '/', 'MCP Hub'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(15000)

    for name, base, home, title_keyword in APPS:
        logs = []
        page.on('console', lambda msg, logs=logs: logs.append(f"{msg.type}: {msg.text}"))
        page.on('pageerror', lambda err, logs=logs: logs.append(f"PAGEERROR: {err}"))
        page.on('requestfailed', lambda req, logs=logs: logs.append(f"REQFAIL: {req.url()} {req.failure().error_text if req.failure() else ''}"))

        print(f"\n=== {name} ({base}) ===")
        try:
            page.goto(base, wait_until='networkidle')
            print(f"After goto base: title={page.title()}, url={page.url}")
            # Fill login form if present
            tenant_input = page.locator('input[id="tenantId"], input[name="tenantId"]').first
            if tenant_input.count() > 0:
                page.locator('input[id="tenantId"], input[name="tenantId"]').first.fill('default')
                page.locator('input[id="username"], input[name="username"]').first.fill('admin')
                page.locator('input[id="password"], input[name="password"]').first.fill('Meta@12345')
                page.locator('button[type="submit"]').first.click()
                page.wait_for_load_state('networkidle')
                print(f"After login: title={page.title()}, url={page.url}")
            # Check home content
            body_text = page.locator('body').inner_text()[:200]
            print(f"body text: {body_text!r}")
            print(f"#root length: {len(page.locator('#root').inner_html())}")
            print("logs:")
            for line in logs[-20:]:
                print('  ', line)
        except Exception as e:
            print(f"ERROR: {e}")
            for line in logs[-20:]:
                print('  ', line)

    browser.close()
