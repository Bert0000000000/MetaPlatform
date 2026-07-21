from playwright.sync_api import sync_playwright

urls = [
    ('SUPERAI', 'http://localhost:9301'),
    ('SUPERAI-login', 'http://localhost:9301/login'),
    ('APPHUB', 'http://localhost:9201'),
    ('ONTSTUDIO', 'http://localhost:9101'),
    ('DW', 'http://localhost:9401'),
    ('MCPHUB', 'http://localhost:9501'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, url in urls:
        page = browser.new_page()
        logs = []
        page.on('console', lambda msg: logs.append(f"{msg.type}: {msg.text}"))
        page.on('pageerror', lambda err: logs.append(f"PAGEERROR: {err}"))
        try:
            page.goto(url, wait_until='networkidle', timeout=15000)
        except Exception as e:
            logs.append(f"GOTO ERROR: {e}")
        html = page.content()
        root_inner = page.locator('#root').inner_html(timeout=2000) if page.locator('#root').count() else 'NO_ROOT'
        print(f"\n=== {name} ({url}) ===")
        print(f"Title: {page.title()}")
        print(f"#root children length: {len(root_inner)}")
        print(f"body innerText: {page.locator('body').inner_text()[:200]!r}")
        print("Console logs:")
        for line in logs[:20]:
            print('  ', line)
        if len(root_inner) < 200:
            print("#root innerHTML:", root_inner[:500])
        page.close()
    browser.close()
