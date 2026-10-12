import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Login UI has legacy development defaults; never retain unmasked automatic artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

const artifactMode = process.env.MP11_ARTIFACT_MODE ?? 'dev';
const websiteTitle = '让企业的数据、AI 与业务行动协同起来';

test('product introduction leads visitors through capabilities, scenarios, development updates and version planning', async ({ page }) => {
  await page.goto('/website/');
  await expect(page.getByText('本体驱动的企业 AI 操作平台', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '了解平台', exact: true })).toHaveAttribute('href', '#platform');
  expect(await page.locator('main > section[id]').evaluateAll(elements => elements.map(element => element.id))).toEqual(['top', 'platform', 'capabilities', 'orders', 'updates', 'plan', 'faq']);
  for (const [name, anchor] of [['平台介绍', 'platform'], ['产品能力', 'capabilities'], ['业务场景', 'orders'], ['产品更新', 'updates'], ['版本规划', 'plan']]) {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
    await expect(page.locator(`#${anchor} h2`)).toBeInViewport();
  }
  await expect(page.locator('#updates time')).toHaveCount(4);
  await expect(page.locator('#updates')).toContainText('2026-10-11');
  for (const theme of ['关系定义与关联', '对象创建与模型发布', '真实数据接入与恢复', '官网与平台入口']) await expect(page.locator('#updates')).toContainText(theme);
  for (const state of ['1.1.0 开发中', '1.1.1 规划', '1.2 研究 / 规划']) await expect(page.locator('#plan')).toContainText(state);
  await expect(page.locator('#plan')).toContainText('尚未发布');
  await expect(page.locator('#plan')).toContainText('OWL / RDF / SHACL');
  await expect(page.locator('#updates')).not.toContainText('正式发布');
  await page.goto('/website/#chain');
  await expect(page.getByRole('heading', { name: '把业务语言变成协作基础' })).toBeInViewport();
});
test('anonymous website directory and index expose real platform links', async ({ page }) => {
  const requests: string[] = [];
  const responses: { path: string; status: number }[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  for (const path of ['/website/', '/website/index.html']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    responses.push({ path, status: response!.status() });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(websiteTitle);
    const entries = page.getByRole('link', { name: '进入平台', exact: true });
    expect(await entries.count()).toBe(4);
    for (const entry of await entries.all()) await expect(entry).toHaveAttribute('href', '/home');
    await expect(page.getByText('产品 1.1.0 · 开发中', { exact: true })).toBeVisible();
  }
  expect(requests.filter(path => path.startsWith('/api/'))).toEqual([]);
  writeFileSync(`tests/e2e/.artifacts/MP11-website-${artifactMode}-requests.json`, JSON.stringify({ responses, requests }, null, 2));
});

test('platform entry hands anonymous visitors to existing AuthGuard login', async ({ page }) => {
  await page.goto('/website/');
  await page.getByRole('link', { name: '进入平台', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByRole('textbox').first()).toBeVisible();
  // No login screenshot: the existing login page contains development defaults.
});

test('default entry remains available with JavaScript disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/website/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(websiteTitle);
  for (const entry of await page.getByRole('link', { name: '进入平台', exact: true }).all()) await expect(entry).toHaveAttribute('href', '/home');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByText('菜单', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: '产品更新', exact: true }).locator('visible=true').first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#updates$/);
  await expect(page.locator('#updates h2')).toBeInViewport();
  await page.getByText('菜单', { exact: true }).click();
  await page.goto('/website/#faq');
  await page.getByText('什么是业务本体？', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#faq details').first()).toHaveAttribute('open', '');
  await expect(page.locator('#faq details').first()).toContainText('审核等动作');
  await page.getByRole('link', { name: '进入平台', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  await context.close();
});

for (const width of [360, 390, 768, 1440]) {
  test(`website navigation and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/website/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `tests/e2e/.artifacts/MP11-website-${artifactMode}-${width}.png`, fullPage: true });
    await page.screenshot({ path: `tests/e2e/.artifacts/MP11-website-${artifactMode}-${width}-hero.png` });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳过导航' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    if (width <= 820) {
      await page.getByText('菜单', { exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
      await expect(page.getByText('菜单', { exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('link', { name: '业务场景', exact: true }).locator('visible=true').first()).toBeVisible();
    }
    const scenarioLink = page.getByRole('link', { name: '业务场景', exact: true }).locator('visible=true').first();
    await scenarioLink.focus();
    await page.keyboard.press('Enter');
    if (width <= 820) await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/#orders$/);
    await expect(page.getByRole('heading', { name: '从一笔订单，到一次有依据的决策' })).toBeInViewport();
    for (const [name, id] of [['平台介绍', 'platform'], ['产品能力', 'capabilities'], ['产品更新', 'updates'], ['版本规划', 'plan']]) {
      if (width <= 820) {
        await page.getByText('菜单', { exact: true }).focus();
        await page.keyboard.press('Enter');
      }
      await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).locator('visible=true').first().focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id} h2`)).toBeInViewport();
      if (width <= 820) await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
    }
  });
}

test('reduced motion removes animated effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/website/');
  expect(await page.locator('.hero').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

for (const destination of ['javascript:alert(1)', 'data:text/html,unsafe', '//unsafe.example/home', 'https://public-user:public-pass@platform.example.com/home', 'https://platform.example.com/home', '/workspace/home']) {
  test(`standalone destination configuration: ${destination}`, async ({ page }) => {
    // Represents a static deployment's public HTML configuration; no business API is mocked.
    const html = readFileSync('public/website/index.html', 'utf8').replace('name="metaplatform-platform-url" content=""', `name="metaplatform-platform-url" content="${destination}"`);
    await page.route('**/website/index.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/website/index.html');
    const allowed = (destination.startsWith('https://') && !destination.includes('@')) || destination.startsWith('/workspace');
    for (const entry of await page.getByRole('link', { name: '进入平台', exact: true }).all()) {
      await expect(entry).toHaveAttribute('href', allowed ? destination : '/home');
    }
  });
}

test('standalone generated links work without JavaScript', async ({ browser, baseURL }, testInfo) => {
  const output = testInfo.outputPath('standalone.html');
  const generated = spawnSync(process.execPath, [resolve('../../../metaplatform-website/configure-platform.mjs'), '--output', output, '--platform-url', 'https://platform.example.com/home'], { encoding: 'utf8' });
  expect(generated.status, generated.stderr).toBe(0);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.route('**/standalone.html', route => route.fulfill({ contentType: 'text/html', body: readFileSync(output, 'utf8') }));
  await page.goto('/standalone.html');
  for (const entry of await page.getByRole('link', { name: '进入平台', exact: true }).all()) await expect(entry).toHaveAttribute('href', 'https://platform.example.com/home');
  await context.close();
});

test('static generator rejects unsafe credentials without leaking input', async ({}, testInfo) => {
  const output = testInfo.outputPath('rejected.html');
  const destination = 'https://public-user:public-pass@platform.example.com/home';
  const generated = spawnSync(process.execPath, [resolve('../../../metaplatform-website/configure-platform.mjs'), '--output', output, '--platform-url', destination], { encoding: 'utf8' });
  expect(generated.status).not.toBe(0);
  expect(existsSync(output)).toBe(false);
  expect(generated.stderr).not.toContain(destination);
  expect(generated.stderr).not.toContain('public-pass');
});
for (const token of ['$&', '$`', "$'", '$$', '$1']) {
  test(`generated standalone URL preserves literal replacement token ${token}`, async ({ browser, baseURL }, testInfo) => {
    const destination = `https://platform.example.com/home?value=${token}`;
    const output = testInfo.outputPath('literal-url.html');
    const generated = spawnSync(process.execPath, [resolve('../../../metaplatform-website/configure-platform.mjs'), '--output', output, '--platform-url', destination], { encoding: 'utf8' });
    expect(generated.status, generated.stderr).toBe(0);
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.route('**/literal-url.html', route => route.fulfill({ contentType: 'text/html', body: readFileSync(output, 'utf8') }));
    await page.goto('/literal-url.html');
    const entries = page.getByRole('link', { name: '进入平台', exact: true });
    await expect(entries).toHaveCount(4);
    for (const entry of await entries.all()) await expect(entry).toHaveAttribute('href', destination);
    await expect(page.locator('meta[name="metaplatform-platform-url"]')).toHaveAttribute('content', destination);
    await context.close();
  });
}
