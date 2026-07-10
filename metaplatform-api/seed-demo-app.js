/**
 * P6-3: 创建 Demo 应用 + 完整数据集 (按 schema 实际列名)
 *   - 1 应用 ("客户管理")
 *   - 5 dataset (view 类型 + 内置默认数据)
 *   - 5 form (signup / contact / survey / booking / feedback)
 *   - 5 report (sales / customers / inventory / finance / support)
 *   - 5 dashboard (overview / sales / customers / finance / support)
 *   - 5 alias (公开访问)
 *   - 1 collaborators (Bob 协作者)
 *   - 3 modules
 *   - 各 page 自动镜像 + 关联
 */
import { v4 as uuid } from "uuid";
import db from "./src/db-sqlite.js";

const APP_NAME = "📊 客户管理 (Demo)";
const APP_DESC = "演示 MetaPlatform 完整闭环: 数据集 → 表单 → 报表 → 仪表盘 → 公开访问";

function now() { return new Date().toISOString(); }

async function main() {
  // ── 1. 用户 ──
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@metaplatform.com");
  const userId = user?.id ?? null;
  if (!userId) throw new Error("未找到 admin 用户");
  console.log("✓ Admin userId =", userId);

  // ── 2. 创建应用 ──
  const appId = uuid();
  db.prepare(
    `INSERT INTO applications (id, name, description, category, status, icon, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, 'demo', 'draft', ?, ?, ?, ?)`
  ).run(appId, APP_NAME, APP_DESC, "📊", userId, now(), now());
  console.log("✓ App created:", appId);

  // ── 3. 5 dataset (view 类型 + 内置默认数据) ──
  const datasetConfigs = [
    { name: "客户列表", sourceType: "view", desc: "示例客户数据 (50 行)" },
    { name: "订单", sourceType: "view", desc: "订单记录 (200 行)" },
    { name: "产品库存", sourceType: "view", desc: "产品 SKU 数据" },
    { name: "发票", sourceType: "view", desc: "月度发票" },
    { name: "工单", sourceType: "view", desc: "客服工单记录" },
  ];
  const datasetIds = [];
  for (const cfg of datasetConfigs) {
    const id = uuid();
    db.prepare(
      `INSERT INTO app_datasets (id, app_id, name, description, source_type, fields_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, appId, cfg.name, cfg.desc, cfg.sourceType,
      JSON.stringify([
        { name: "name", label: "name", type: "string" },
        { name: "amount", label: "amount", type: "number" },
        { name: "status", label: "status", type: "string" },
        { name: "created_at", label: "created_at", type: "date" },
      ]),
      userId, now(), now()
    );
    datasetIds.push({ id, name: cfg.name });
    console.log(`  ✓ Dataset: ${cfg.name}`);
  }

  // ── 4. 5 form ──
  const formConfigs = [
    { name: "客户登记", schema: { fields: [
      { name: "name", label: "姓名", type: "text", required: true },
      { name: "email", label: "邮箱", type: "email", required: true },
      { name: "phone", label: "电话", type: "text" },
      { name: "company", label: "公司", type: "text" },
      { name: "plan", label: "套餐", type: "select", options: ["基础版", "团队版", "企业版"] },
    ] } },
    { name: "联系我们", schema: { fields: [
      { name: "name", label: "姓名", type: "text", required: true },
      { name: "email", label: "邮箱", type: "email", required: true },
      { name: "message", label: "留言", type: "textarea", required: true },
    ] } },
    { name: "客户满意度调查", schema: { fields: [
      { name: "rating", label: "评分 (1-5)", type: "number", required: true },
      { name: "comments", label: "建议", type: "textarea" },
      { name: "subscribe", label: "订阅 newsletter", type: "checkbox" },
    ] } },
    { name: "会议预约", schema: { fields: [
      { name: "name", label: "姓名", type: "text", required: true },
      { name: "email", label: "邮箱", type: "email", required: true },
      { name: "date", label: "日期", type: "date", required: true },
      { name: "topic", label: "议题", type: "select", options: ["销售", "技术支持", "合作"], required: true },
    ] } },
    { name: "产品反馈", schema: { fields: [
      { name: "product", label: "产品", type: "select", options: ["CRM", "ERP", "BI", "其他"] },
      { name: "rating", label: "评分", type: "number", required: true },
      { name: "feedback", label: "详细反馈", type: "textarea" },
    ] } },
  ];
  const formIds = [];
  for (const cfg of formConfigs) {
    const id = uuid();
    db.prepare(
      `INSERT INTO app_forms (id, app_id, name, schema_json, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'published', 1, ?, ?)`
    ).run(id, appId, cfg.name, JSON.stringify(cfg.schema), now(), now());
    formIds.push({ id, name: cfg.name });
    console.log(`  ✓ Form: ${cfg.name}`);
  }

  // ── 5. 5 reports ──
  const reportConfigs = [
    { name: "销售汇总", dataset: "订单", widgets: [
      { id: "w1", title: "总销售额", type: "kpi", datasetId: datasetIds[1].id, dim: "status", metric: "amount" },
      { id: "w2", title: "订单状态分布", type: "pie", datasetId: datasetIds[1].id, dim: "status", metric: "amount" },
      { id: "w3", title: "订单明细", type: "table", datasetId: datasetIds[1].id },
    ] },
    { name: "客户分析", dataset: "客户列表", widgets: [
      { id: "w1", title: "客户总数", type: "kpi", datasetId: datasetIds[0].id, metric: "amount" },
      { id: "w2", title: "客户状态", type: "pie", datasetId: datasetIds[0].id, dim: "status" },
    ] },
    { name: "库存报表", dataset: "产品库存", widgets: [
      { id: "w1", title: "产品数", type: "kpi", datasetId: datasetIds[2].id, metric: "amount" },
      { id: "w2", title: "产品分布", type: "bar", datasetId: datasetIds[2].id, dim: "status", metric: "amount" },
    ] },
    { name: "财务报表", dataset: "发票", widgets: [
      { id: "w1", title: "开票总额", type: "kpi", datasetId: datasetIds[3].id, metric: "amount" },
      { id: "w2", title: "月度趋势", type: "line", datasetId: datasetIds[3].id, dim: "name", metric: "amount" },
    ] },
    { name: "客服工单", dataset: "工单", widgets: [
      { id: "w1", title: "工单总数", type: "kpi", datasetId: datasetIds[4].id, metric: "amount" },
      { id: "w2", title: "工单状态", type: "funnel", datasetId: datasetIds[4].id, dim: "status", metric: "amount" },
    ] },
  ];
  const reportIds = [];
  for (const cfg of reportConfigs) {
    const id = uuid();
    db.prepare(
      `INSERT INTO app_reports (id, app_id, name, dataset_id, layout_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`
    ).run(id, appId, cfg.name,
      datasetIds.find((d) => d.name === cfg.dataset)?.id ?? null,
      JSON.stringify({ widgets: cfg.widgets, version: 1 }),
      now(), now()
    );
    reportIds.push({ id, name: cfg.name });
    console.log(`  ✓ Report: ${cfg.name}`);
  }

  // ── 6. 5 dashboards ──
  const dashboardConfigs = [
    { name: "总览", widgets: [
      { id: "d1", title: "总销售额", type: "kpi", datasetId: datasetIds[1].id, metric: "amount" },
      { id: "d2", title: "客户总数", type: "kpi", datasetId: datasetIds[0].id, metric: "amount" },
      { id: "d3", title: "订单状态", type: "pie", datasetId: datasetIds[1].id, dim: "status", metric: "amount" },
      { id: "d4", title: "销售明细", type: "table", datasetId: datasetIds[1].id },
    ] },
    { name: "销售看板", widgets: [
      { id: "d1", title: "销售趋势", type: "line", datasetId: datasetIds[1].id, dim: "name", metric: "amount" },
      { id: "d2", title: "订单金额", type: "bar", datasetId: datasetIds[1].id, dim: "status", metric: "amount" },
    ] },
    { name: "客户看板", widgets: [
      { id: "d1", title: "客户分布", type: "pie", datasetId: datasetIds[0].id, dim: "status", metric: "amount" },
      { id: "d2", title: "客户表", type: "table", datasetId: datasetIds[0].id },
    ] },
    { name: "财务看板", widgets: [
      { id: "d1", title: "发票总额", type: "kpi", datasetId: datasetIds[3].id, metric: "amount" },
      { id: "d2", title: "发票趋势", type: "area", datasetId: datasetIds[3].id, dim: "name", metric: "amount" },
    ] },
    { name: "客服看板", widgets: [
      { id: "d1", title: "工单数", type: "gauge", datasetId: datasetIds[4].id, metric: "amount" },
      { id: "d2", title: "工单漏斗", type: "funnel", datasetId: datasetIds[4].id, dim: "status", metric: "amount" },
    ] },
  ];
  const dashboardIds = [];
  for (const cfg of dashboardConfigs) {
    const id = uuid();
    db.prepare(
      `INSERT INTO app_dashboards (id, app_id, name, layout_json, widgets_json, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)`
    ).run(id, appId, cfg.name,
      JSON.stringify({ version: 1 }),
      JSON.stringify(cfg.widgets),
      userId, now(), now()
    );
    dashboardIds.push({ id, name: cfg.name });
    console.log(`  ✓ Dashboard: ${cfg.name}`);
  }

  // ── 7. 镜像 pages (form / report / dashboard → page) ──
  const iconMap = { form: "📝", report: "📊", dashboard: "📈" };
  for (const f of formIds) {
    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, status, icon, form_id, created_at, updated_at)
       VALUES (?, ?, ?, 'form', 'draft', ?, ?, ?, ?)`
    ).run(uuid(), appId, f.name, iconMap.form, f.id, now(), now());
  }
  for (const r of reportIds) {
    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, status, icon, report_id, created_at, updated_at)
       VALUES (?, ?, ?, 'report', 'draft', ?, ?, ?, ?)`
    ).run(uuid(), appId, r.name, iconMap.report, r.id, now(), now());
  }
  for (const d of dashboardIds) {
    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, status, icon, dashboard_id, created_at, updated_at)
       VALUES (?, ?, ?, 'dashboard', 'draft', ?, ?, ?, ?)`
    ).run(uuid(), appId, d.name, iconMap.dashboard, d.id, now(), now());
  }
  console.log("✓ 15 pages mirrored");

  // ── 8. 3 modules ──
  const moduleIds = [];
  const modConfigs = [
    { label: "📋 表单收集", icon: "📋", color: "text-amber-600", bgColor: "bg-amber-50" },
    { label: "📊 报表分析", icon: "📊", color: "text-blue-600", bgColor: "bg-blue-50" },
    { label: "📈 仪表盘", icon: "📈", color: "text-violet-600", bgColor: "bg-violet-50" },
  ];
  for (const cfg of modConfigs) {
    const id = uuid();
    db.prepare(
      `INSERT INTO app_modules (id, app_id, label, icon, color, bg_color, type_filter, sort_order, config, page_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, appId, cfg.label, cfg.icon, cfg.color, cfg.bgColor, "[]", 0, "{}", JSON.stringify([]), now(), now());
    moduleIds.push({ id, label: cfg.label });
  }
  console.log("✓ 3 modules created");

  // ── 9. attach pages to modules by type ──
  const allPages = db.prepare(`SELECT id, type, name FROM app_pages WHERE app_id = ?`).all(appId);
  for (const p of allPages) {
    let modId = null;
    if (p.type === "form") modId = moduleIds[0].id;
    else if (p.type === "report") modId = moduleIds[1].id;
    else if (p.type === "dashboard") modId = moduleIds[2].id;
    if (!modId) continue;
    const mod = db.prepare(`SELECT page_ids FROM app_modules WHERE id = ?`).get(modId);
    const ids = JSON.parse(mod.page_ids || "[]");
    ids.push(p.id);
    db.prepare(`UPDATE app_modules SET page_ids = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(ids), now(), modId);
  }
  console.log("✓ Pages attached to modules");

  // ── 10. 5 aliases (公开访问) ──
  const aliasConfigs = [
    { slug: "demo-signup", kind: "form", targetId: formIds[0].id },
    { slug: "demo-contact", kind: "form", targetId: formIds[1].id },
    { slug: "demo-survey", kind: "form", targetId: formIds[2].id },
    { slug: "demo-sales-report", kind: "report", targetId: reportIds[0].id },
    { slug: "demo-overview-dash", kind: "dashboard", targetId: dashboardIds[0].id },
  ];
  for (const a of aliasConfigs) {
    db.prepare(
      `INSERT INTO app_public_aliases (slug, app_id, kind, target_id, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`
    ).run(a.slug, appId, a.kind, a.targetId, now());
  }
  console.log("✓ 5 public aliases created");

  // ── 11. 1 collaborator ──
  const collabId = uuid();
  db.prepare(
    `INSERT INTO app_collaborators (id, app_id, user_id, user_email, user_name, role, invited_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'editor', ?, ?)`
  ).run(collabId, appId, userId, "admin@metaplatform.com", "Admin", userId, now());
  console.log("✓ 1 collaborator seeded");

  // ── 12. 模拟数据 — 写入 app_page_components 储存 mock rows, 报表 preview 直接拉 ──
  for (const d of datasetIds) {
    const simId = uuid();
    const rows = [];
    for (let i = 1; i <= 20; i++) {
      rows.push({
        name: `${d.name}-${i}`,
        amount: Math.floor(Math.random() * 10000),
        status: ["active", "pending", "closed"][i % 3],
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }
    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, status, icon, form_id, config, created_at, updated_at)
       VALUES (?, ?, ?, 'dataset_rows', 'published', '🗄', ?, ?, ?, ?)`
    ).run(simId, appId, `${d.name} (rows)`, d.id,
      JSON.stringify({ rows, isDemoSeed: true, dataset_id: d.id }),
      now(), now());
  }
  console.log("✓ 5 dataset sim rows seeded");

  console.log("\n🎉 Demo 应用创建完成!");
  console.log(`   AppId: ${appId}`);
  console.log(`   应用名: ${APP_NAME}`);
  console.log(`   数据集: 5, 表单: 5, 报表: 5, 仪表盘: 5`);
  console.log(`   Aliases: 5 (slug: demo-signup / demo-contact / ...)`);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });