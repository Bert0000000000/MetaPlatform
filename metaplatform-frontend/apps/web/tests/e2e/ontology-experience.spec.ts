import { expect, test, type Page } from '@playwright/test';

const customer = { rid: 'ont.acme.obj.crm.customer.v1', display_name: '客户', properties: [
  { rid: 'ont.acme.prop.crm.customer-id.v1', title: '编号', type_id: 'string', format: 'string', nullable: false, primary_key: true },
], primary_key: ['ont.acme.prop.crm.customer-id.v1'], interfaces: [], checksum: 'customer-checksum' };
const order = { ...customer, rid: 'ont.acme.obj.crm.order.v1', display_name: '订单' };
const relation = { rid: 'ont.acme.link.crm.customer-orders.v1', src: customer.rid, dst: order.rid,
  src_display_name: '客户订单', dst_display_name: '所属客户', cardinality: '1:N', link_properties: [] };

async function fixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    localStorage.setItem('mate_platform_token', 'browser-ui-fixture');
    localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'ui-fixture', username: 'ui-fixture', tenantId: 'acme', roles: ['USER'] }));
  });
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/object-types') ? [customer, order]
      : path.endsWith('/link-types') ? [relation]
      : path.endsWith('/validate') ? { valid: true, errors: [], warnings: [], destructive: [], references: {resolved:[],unresolved:[],dependencies:[]} }
      : [];
    return route.fulfill({ json: data });
  });
}

test('root introduces the website and leads anonymous visitors to platform login', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('让企业的数据、AI 与业务行动协同起来');
  await page.getByRole('link', {name:'进入平台',exact:true}).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
});

test('root introduction works without JavaScript', async ({browser,baseURL}) => {
  const context = await browser.newContext({javaScriptEnabled:false,baseURL});
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toHaveText('让企业的数据、AI 与业务行动协同起来');
  await context.close();
});

test('HTTP creation opens and retains input across property and advanced operations', async ({page}) => {
  await fixture(page);
  await page.goto('/ontology/model/object-types?create=true');
  await expect(page.getByRole('heading',{name:'新建对象类型',exact:true})).toBeVisible();
  await page.getByLabel('业务名称',{exact:true}).fill('测试订单');
  await page.getByLabel('业务标识',{exact:true}).fill('http-order');
  await page.getByRole('button',{name:'添加属性',exact:true}).click();
  await page.getByPlaceholder('例如 dept_name').fill('amount');
  await page.getByRole('button',{name:'高级设置',exact:true}).click();
  await page.getByRole('button',{name:'添加行',exact:true}).click();
  await expect(page.getByLabel('业务名称',{exact:true})).toHaveValue('测试订单');
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();
  await expect(page.getByText('草稿已保存，刷新后可恢复；尚未发布。')).toBeVisible();
  await expect(page.getByRole('heading',{name:'页面渲染出错'})).toHaveCount(0);
});

for (const [width,height] of [[1280,720],[1920,1080],[768,1024]]) {
  test(`graph fills the work area without clipping at ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height}); await fixture(page);
    await page.goto('/ontology/model/graph');
    const svg = page.getByRole('img',{name:'本体类与关系结构图'});
    await expect(svg).toBeVisible();
    const before = await svg.boundingBox();
    const footer = page.getByRole('group',{name:'图谱用途筛选'});
    await expect(footer).toBeInViewport();
    const layout = await page.locator('.mw-workbench').evaluate(element => {
      const bounds = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
      return {bottom:bounds.bottom,parentBottom:parent.bottom,viewport:innerHeight};
    });
    expect(Math.abs(layout.bottom-layout.parentBottom)).toBeLessThanOrEqual(2);
    expect(layout.bottom).toBeLessThanOrEqual(height);
    await page.getByRole('button',{name:'查看本体类 客户',exact:true}).press('Enter');
    await expect(page.locator('#model-inspector')).toContainText('客户');
    await page.getByRole('button',{name:'资源树',exact:true}).click();
    await page.getByRole('button',{name:'属性检查器',exact:true}).click();
    await expect.poll(async()=>(await svg.boundingBox())!.width).toBeGreaterThan(before!.width);
    await page.getByRole('button',{name:'放大本体图'}).click();
    await page.getByRole('button',{name:'适应本体图'}).click();
    await page.getByRole('button',{name:'重新布局本体图'}).click();
    await page.getByRole('button',{name:'展开本体图'}).click();
    await expect(page.locator('.ms-schema-expanded')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ms-schema-expanded')).toHaveCount(0);
    await page.getByRole('button',{name:'资源列表',exact:true}).click();
    await expect(page.getByRole('button',{name:'选择模型 客户',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'图谱视图',exact:true}).click();
    await page.getByLabel('搜索图谱对象').fill('订单');
    await expect(page.getByRole('button',{name:'查看本体类 客户',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'查看本体类 订单',exact:true})).toBeVisible();
  });
}
