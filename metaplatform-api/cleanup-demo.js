/**
 * P8-5: Demo reset endpoint (admin only)
 * 路径: POST /api/admin/demo-reset
 * 鉴权: admin token 必需
 * 行为: 删除所有 category='demo' 的应用 + 镜像表 rows
 */
import db from "./src/db-sqlite.js";
import { v4 as uuid } from "uuid";
import { requireRole } from "./src/middleware/auth.js";

export default function mountDemoReset(app) {
  app.post("/api/admin/demo-reset", requireRole("admin"), async (req, res) => {
    try {
      const demos = db.prepare("SELECT id FROM applications WHERE category = 'demo'").all();
      const removed = [];
      for (const a of demos) {
        // 删除全部关联
        db.prepare("DELETE FROM app_public_aliases WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_collaborators WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_modules WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_pages WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_forms WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_reports WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_dashboards WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_datasets WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM applications WHERE id = ?").run(a.id);
        removed.push(a.id);
      }
      // Demo aliases leak
      const aliasSlugs = ["demo-signup","demo-contact","demo-survey","demo-sales-report","demo-overview-dash"];
      for (const slug of aliasSlugs) {
        db.prepare("DELETE FROM app_public_aliases WHERE slug = ?").run(slug);
      }
      const orphans = db.prepare("SELECT id FROM app_pages WHERE type = 'dataset_rows'").all();
      for (const o of orphans) {
        db.prepare("DELETE FROM app_pages WHERE id = ?").run(o.id);
      }
      res.json({
        success: true,
        data: { removedApps: removed.length, removedPages: orphans.length, note: "运行 cleanup-demo.js + seed-demo-app.js 即可重新生成" },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err?.message ?? err) });
    }
  });

  app.post("/api/admin/demo-reset-and-seed", requireRole("admin"), async (req, res) => {
    // Reset + reseed in one step
    try {
      // 1) cleanup
      const demos = db.prepare("SELECT id FROM applications WHERE category = 'demo'").all();
      for (const a of demos) {
        db.prepare("DELETE FROM app_public_aliases WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_collaborators WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_modules WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_pages WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_forms WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_reports WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_dashboards WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM app_datasets WHERE app_id = ?").run(a.id);
        db.prepare("DELETE FROM applications WHERE id = ?").run(a.id);
      }
      const aliasSlugs = ["demo-signup","demo-contact","demo-survey","demo-sales-report","demo-overview-dash"];
      for (const slug of aliasSlugs) db.prepare("DELETE FROM app_public_aliases WHERE slug = ?").run(slug);
      const orphans = db.prepare("SELECT id FROM app_pages WHERE type = 'dataset_rows'").all();
      for (const o of orphans) db.prepare("DELETE FROM app_pages WHERE id = ?").run(o.id);

      // 2) reseed (inline copy of seed-demo-app.js logic — synchronous, no async deps needed here)
      const user = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@metaplatform.com");
      const userId = user?.id ?? null;
      if (!userId) return res.status(500).json({ success: false, error: "admin user not found" });
      const APP_NAME = "📊 客户管理 (Demo)";
      const APP_DESC = "演示 MetaPlatform 完整闭环";
      const now = () => new Date().toISOString();
      const appId = uuid();
      db.prepare(
        `INSERT INTO applications (id, name, description, category, status, icon, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, 'demo', 'draft', ?, ?, ?, ?)`
      ).run(appId, APP_NAME, APP_DESC, "📊", userId, now(), now());

      // 创建 5 dataset (简化版 — 只插容器)
      const dsNames = ["客户列表", "订单", "产品库存", "发票", "工单"];
      const datasetIds = [];
      for (const name of dsNames) {
        const id = uuid();
        db.prepare(
          `INSERT INTO app_datasets (id, app_id, name, description, source_type, fields_json, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'view', ?, ?, ?, ?)`
        ).run(id, appId, name, `示例 ${name}`, JSON.stringify([
          { name: "name", label: "name", type: "string" },
          { name: "amount", label: "amount", type: "number" },
          { name: "status", label: "status", type: "string" },
        ]), userId, now(), now());
        datasetIds.push({ id, name });
      }

      // 5 form (空 schema) + 5 report (空 widgets) + 5 dashboard (空 widgets)
      const formNames = ["客户登记", "联系我们", "客户满意度调查", "会议预约", "产品反馈"];
      const formIds = [];
      for (const name of formNames) {
        const id = uuid();
        db.prepare(
          `INSERT INTO app_forms (id, app_id, name, schema_json, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'published', 1, ?, ?)`
        ).run(id, appId, name, JSON.stringify({ fields: [] }), now(), now());
        formIds.push({ id, name });
      }

      const reportNames = ["销售汇总", "客户分析", "库存报表", "财务报表", "客服工单"];
      const reportIds = [];
      for (const name of reportNames) {
        const id = uuid();
        db.prepare(
          `INSERT INTO app_reports (id, app_id, name, dataset_id, layout_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`
        ).run(id, appId, name, datasetIds[reportNames.indexOf(name) % 5].id, JSON.stringify({ widgets: [] }), now(), now());
        reportIds.push({ id, name });
      }

      const dashNames = ["总览", "销售看板", "客户看板", "财务看板", "客服看板"];
      const dashIds = [];
      for (const name of dashNames) {
        const id = uuid();
        db.prepare(
          `INSERT INTO app_dashboards (id, app_id, name, layout_json, widgets_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`
        ).run(id, appId, name, JSON.stringify({ version: 1 }), JSON.stringify([]), now(), now());
        dashIds.push({ id, name });
      }

      // 镜像 pages
      const iconMap = { form: "📝", report: "📊", dashboard: "📈" };
      for (const f of formIds) {
        db.prepare(`INSERT INTO app_pages (id, app_id, name, type, status, icon, form_id, created_at, updated_at)
          VALUES (?, ?, ?, 'form', 'draft', ?, ?, ?, ?)`).run(uuid(), appId, f.name, iconMap.form, f.id, now(), now());
      }
      for (const r of reportIds) {
        db.prepare(`INSERT INTO app_pages (id, app_id, name, type, status, icon, report_id, created_at, updated_at)
          VALUES (?, ?, ?, 'report', 'draft', ?, ?, ?, ?)`).run(uuid(), appId, r.name, iconMap.report, r.id, now(), now());
      }
      for (const d of dashIds) {
        db.prepare(`INSERT INTO app_pages (id, app_id, name, type, status, icon, dashboard_id, created_at, updated_at)
          VALUES (?, ?, ?, 'dashboard', 'draft', ?, ?, ?, ?)`).run(uuid(), appId, d.name, iconMap.dashboard, d.id, now(), now());
      }

      // dataset_rows 模拟数据
      for (const d of datasetIds) {
        const rows = [];
        for (let i = 1; i <= 20; i++) {
          rows.push({
            name: `${d.name}-${i}`,
            amount: Math.floor(Math.random() * 10000),
            status: ["active", "pending", "closed"][i % 3],
          });
        }
        db.prepare(`INSERT INTO app_pages (id, app_id, name, type, status, icon, form_id, config, created_at, updated_at)
          VALUES (?, ?, ?, 'dataset_rows', 'published', '🗄', ?, ?, ?, ?)`).run(
          uuid(), appId, `${d.name} (rows)`, d.id, JSON.stringify({ rows }), now(), now()
        );
      }

      // 3 aliases
      const aliasConfigs = [
        { slug: "demo-signup", kind: "form", targetId: formIds[0].id },
        { slug: "demo-overview-dash", kind: "dashboard", targetId: dashIds[0].id },
        { slug: "demo-contact", kind: "form", targetId: formIds[1].id },
      ];
      for (const a of aliasConfigs) {
        db.prepare(
          `INSERT INTO app_public_aliases (slug, app_id, kind, target_id, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`
        ).run(a.slug, appId, a.kind, a.targetId, now());
      }

      res.json({
        success: true,
        data: {
          appId,
          appName: APP_NAME,
          datasetCount: datasetIds.length,
          formCount: formIds.length,
          reportCount: reportIds.length,
          dashboardCount: dashIds.length,
          aliasCount: aliasConfigs.length,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err?.message ?? err) });
    }
  });
}