/* 北极星 demo v2 全链路走查：登录 → SuperAI 真聊天 → 本体 → 数据资产 → 截图留证 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:9250';
const GW = 'http://localhost:8100';
const OUT = 'tests/e2e/screenshots';

(async () => {
  // 真实 IAM 登录拿 token
  const res = await fetch(`${GW}/api/v1/iam/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const login = await res.json();
  const token = login.accessToken;
  const user = { username: 'admin', tenant_id: 'tenant-default', roles: ['admin'] };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1) 登录页截图
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/northstar-01-login.png` });

  // 注入真实 token（与 auth.setup.ts 同源写入方式）
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('mate_platform_token', t);
    localStorage.setItem('mate_platform_user', JSON.stringify(u));
  }, { t: token, u: user });

  // 2) 工作台
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/northstar-02-workbench.png` });

  // 3) SuperAI 聊天（真实 ARK LLM 流式回答）
  await page.goto(`${BASE}/superai/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/northstar-03-superai-loaded.png` });
  const input = page.locator('textarea:visible, input[type="text"]:visible').last();
  if (await input.count()) {
    await input.fill('用两句话介绍 Mate Platform 的本体引擎能做什么。');
    await input.press('Enter');
    await page.waitForTimeout(20000); // 等待流式回答完成
  }
  await page.screenshot({ path: `${OUT}/northstar-04-superai-answer.png`, fullPage: false });

  // 4) 本体 Studio（类型与实例）
  await page.goto(`${BASE}/ontology`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/northstar-05-ontology.png` });

  // 5) 数据资产目录
  await page.goto(`${BASE}/arch/data/assets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/northstar-06-data-assets.png` });

  await browser.close();
  console.log('northstar demo walkthrough done');
})();
