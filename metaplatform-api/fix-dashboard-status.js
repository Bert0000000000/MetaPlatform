import db from "./src/db-sqlite.js";
try {
  db.prepare("UPDATE app_dashboards SET status = 'published' WHERE status IS NULL OR status = ''").run();
  const c = db.prepare("SELECT COUNT(*) AS c FROM app_dashboards WHERE status = 'published'").get();
  console.log("dashboards status=published count:", c.c);
} catch (e) {
  console.error("FAIL:", e.message);
}