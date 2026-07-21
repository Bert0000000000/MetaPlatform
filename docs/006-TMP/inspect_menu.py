from playwright.sync_api import sync_playwright

APPS = [
    ('DASHBOARD', 'http://localhost:9202', '/dashboard', '工作台'),
    ('ONTSTUDIO', 'http://localhost:9101', '/concepts', '概念'),
    ('APPHUB', 'http://localhost:9201', '/apps', '创建应用'),
    ('SUPERAI', 'http://localhost:9301', '/chat', '智能对话'),
    ('DW', 'http://localhost:9401', '/dw/employees', '创建数字员工'),
    ('ARCH', 'http://localhost:9206', '/arch', '架构总览'),
    ('MCPHUB', 'http://localhost:9501', '/', '概览'),
]


def login(page, base):
    page.goto(base, wait_until='networkidle')
    # 若已共享登录态（同一 localStorage token），可能直接进入首页
    if page.locator('button[type="submit"]').count() == 0:
        return
    page.get_by_label('租户 ID').fill('default')
    page.get_by_label('用户名').fill('admin')
    page.get_by_label('密码').fill('Meta@12345')
    page.locator('button[type="submit"]').click()
    try:
        page.wait_for_load_state('networkidle', timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(1500)


def collect_errors(logs):
    return [line for line in logs if 'PAGEERROR' in line or 'Maximum update depth' in line or 'Unhandled' in line]


def selected_sidebar_text(page):
    """返回左侧边栏当前选中的菜单项文本"""
    el = page.locator('.ant-layout-sider .ant-menu-item-selected').first
    return el.inner_text() if el.count() > 0 else None


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(15000)

    all_ok = True

    # 1. 验证所有 APP 登录后正常加载，且左侧显示全部 7 个模块
    for name, base, home, keyword in APPS:
        logs = []
        page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

        print(f'\n=== {name} ({base}) ===')
        login(page, base)
        print(f'After login: url={page.url}, title={page.title()}')
        body_text = page.locator('body').inner_text()
        print(f'contains "{keyword}": {keyword in body_text}')

        modules = ['工作台', '超级 AI', '数字员工', '应用中心', '本体论引擎', '架构中心', 'MCP 服务中心']
        missing = [m for m in modules if m not in body_text]
        if missing:
            print(f'MISSING modules in sidebar: {missing}')
            all_ok = False
        else:
            print('All 7 modules present in sidebar')

        errors = collect_errors(logs)
        if errors:
            print(f'ERRORS: {errors}')
            all_ok = False

    # 2. 跨应用跳转：从 DASHBOARD 点击「超级 AI」应跳转到 SUPERAI
    print('\n=== Cross-app navigation: DASHBOARD -> SUPERAI ===')
    logs = []
    page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
    page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

    login(page, 'http://localhost:9202')
    # 限定在侧边栏内点击，避免与内容区同名元素冲突
    page.locator('.ant-layout-sider').get_by_text('超级 AI').first.click()
    page.wait_for_timeout(2000)
    print(f'After click: url={page.url}, title={page.title()}')
    if 'localhost:9301/chat' not in page.url:
        print('ERROR: did not navigate to SUPERAI /chat')
        all_ok = False
    else:
        print('Cross-app navigation OK')

    errors = collect_errors(logs)
    if errors:
        print(f'ERRORS: {errors}')
        all_ok = False

    # 3. 同应用二级菜单：在 ONTSTUDIO 中切换「关系类型」与「关系实例」，检查选中互不干扰
    print('\n=== Same-app selection: ONTSTUDIO /relations vs /relation-instances ===')
    logs = []
    page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
    page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

    login(page, 'http://localhost:9101')
    sider = page.locator('.ant-layout-sider')
    sider.get_by_text('关系类型').click()
    page.wait_for_timeout(1000)
    url_relations = page.url
    selected_relations = selected_sidebar_text(page)
    print(f'After 关系类型 click: url={url_relations}, selected={selected_relations}')

    sider.get_by_text('关系实例').click()
    page.wait_for_timeout(1000)
    url_instances = page.url
    selected_instances = selected_sidebar_text(page)
    print(f'After 关系实例 click: url={url_instances}, selected={selected_instances}')

    if '/relations' not in url_relations or '/relation-instances' not in url_instances:
        print('ERROR: selection navigation failed')
        all_ok = False
    elif selected_relations == selected_instances:
        print(f'ERROR: selected item did not change ({selected_relations})')
        all_ok = False
    else:
        print('Same-app selection OK')

    errors = collect_errors(logs)
    if errors:
        print(f'ERRORS: {errors}')
        all_ok = False

    # 4. 三级菜单：在 ARCH 中切换二级与三级菜单
    print('\n=== Nested menu: ARCH /arch vs /arch/capabilities ===')
    logs = []
    page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
    page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

    login(page, 'http://localhost:9206')
    sider = page.locator('.ant-layout-sider')
    sider.get_by_text('能力地图').click()
    page.wait_for_timeout(1000)
    url_caps = page.url
    selected_caps = selected_sidebar_text(page)
    print(f'After 能力地图 click: url={url_caps}, selected={selected_caps}')

    if '/arch/capabilities' not in url_caps:
        print('ERROR: nested menu navigation failed')
        all_ok = False
    else:
        print('Nested menu navigation OK')

    errors = collect_errors(logs)
    if errors:
        print(f'ERRORS: {errors}')
        all_ok = False

    browser.close()

    print('\n=== OVERALL ===')
    print('PASS' if all_ok else 'FAIL')
