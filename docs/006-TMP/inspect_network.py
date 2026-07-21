import json
import urllib.request
from playwright.sync_api import sync_playwright


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


def inspect_app(page, name, base, home, token, user):
    logs = []
    network = []
    page.on('console', lambda msg, logs=logs: logs.append(f'{msg.type}: {msg.text}'))
    page.on('pageerror', lambda err, logs=logs: logs.append(f'PAGEERROR: {err}'))
    page.on('request', lambda req, network=network: network.append(('REQ', req.method(), req.url())))
    page.on('response', lambda resp, network=network: network.append(('RESP', resp.status, resp.url)))

    print(f'\n=== {name} ({base}{home}) ===')
    page.goto(base + home, wait_until='networkidle')
    page.evaluate(
        '''(args) => {
            localStorage.setItem('mate_platform_token', args.token);
            localStorage.setItem('mate_platform_user', JSON.stringify(args.user));
        }''',
        {'token': token, 'user': user},
    )
    page.reload(wait_until='networkidle')
    print(f'title={page.title()}, url={page.url}')
    print(f'body text: {page.locator("body").inner_text()[:200]!r}')
    print('network:')
    for kind, a, b in network:
        if kind == 'RESP' and a >= 400:
            print(f'  {kind} {a} {b}')
    print('logs:')
    for line in logs[-20:]:
        print('  ', line)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(15000)
    token, user = get_token()

    inspect_app(page, 'SUPERAI', 'http://localhost:9301', '/chat', token, user)
    inspect_app(page, 'DW', 'http://localhost:9401', '/dw/employees', token, user)

    browser.close()
