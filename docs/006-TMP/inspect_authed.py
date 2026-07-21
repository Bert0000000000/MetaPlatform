import json
import urllib.request
from playwright.sync_api import sync_playwright

APPS = [
    ('SUPERAI', 'http://localhost:9301', '/chat', '智能对话'),
    ('ONTSTUDIO', 'http://localhost:9101', '/concepts', '概念'),
    ('APPHUB', 'http://localhost:9201', '/apps', '创建应用'),
    ('DW', 'http://localhost:9401', '/dw/employees', '创建数字员工'),
    ('MCPHUB', 'http://localhost:9501', '/', '概览'),
]


def get_token():
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/iam/auth/login',
        data=json.dumps({
            'tenantId': 'default',
            'username': 'admin',
            'password': 'Meta@12345',
        }).encode(),
        headers={'Content-Type': 'application/json'},
    )
    resp = urllib.request.urlopen(req)
    payload = json.loads(resp.read())
    data = payload['data']
    return data['accessToken'], {
        'id': data['userId'],
        'username': data['username'],
        'tenantId': 'default',
        'roles': data.get('roles', []),
    }


def inject_auth(page, token, user):
    page.evaluate(
        '''(args) => {
            localStorage.setItem('mate_platform_token', args.token);
            localStorage.setItem('mate_platform_user', JSON.stringify(args.user));
        }''',
        {'token': token, 'user': user},
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(15000)

    token, user = get_token()
    print(f'Got token (len={len(token)})')

    for name, base, home, keyword in APPS:
        logs = []
        page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))

        print(f'\n=== {name} ({base}{home}) ===')
        try:
            page.goto(base + home, wait_until='networkidle')
            inject_auth(page, token, user)
            page.reload(wait_until='networkidle')
            page_title = page.title()
            body_text = page.locator('body').inner_text()[:200]
            root_len = len(page.locator('#root').inner_html())
            print(f'title={page_title}, url={page.url}')
            print(f'body text: {body_text!r}')
            print(f'#root length: {root_len}')
            print(f'contains keyword "{keyword}": {keyword in body_text}')
            print('logs:')
            for line in logs[-30:]:
                print('  ', line)
        except Exception as e:
            print(f'ERROR: {e}')
            for line in logs[-30:]:
                print('  ', line)

    browser.close()
