/**
 * _shared/runDataset.js — 共享 dataset → rows 实现.
 * Report Run 与 Dashboard Widget Data 同时调用.
 */
import db from "../../db.js";

function safeJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

/**
 * @param dataset  { id, app_id, source_type, ontology_object_id, sql_text, form_id, ... }
 * @param appId    实际应用 id (用于 SQL/raw 注入的安全白名单)
 * @param limit    最大行数 (200 默认)
 * @returns rows
 */
export default async function runDataset(dataset, appId, limit = 200) {
  if (!dataset) return [];
  const st = String(dataset.source_type || "ontology_object").toLowerCase();
  const safeLimit = Math.min(Math.max(Number(limit || 200), 1), 2000);

  if (st === "form") {
    // 拉该应用下所有表单提交记录, 平铺 values_json 的字段到顶级
    const rows = await db.prepare(
      "SELECT id, form_id, values_json, submitted_at, submitter_email, submitter_name, status FROM form_submissions WHERE app_id = ? ORDER BY submitted_at DESC LIMIT ?"
    ).all(appId, safeLimit);
    return rows.map((r) => ({
      id: r.id,
      form_id: r.form_id,
      submitted_at: r.submitted_at,
      submitter_email: r.submitter_email,
      submitter_name: r.submitter_name,
      status: r.status,
      ...safeJSON(r.values_json, {}),
    }));
  }

  if (st === "sql" && dataset.sql_text) {
    // 简化: 我们的 sandbox 是单文件 SQLite; 直接 prepare + all 跑 dataset.sql_text.
    // 安全: 强制只允许 SELECT 语句, 否则拒绝.
    const sql = String(dataset.sql_text || "").trim();
    if (!sql) return [];
    if (!/^\s*(select|with)/i.test(sql)) {
      throw new Error("SQL 数据源仅允许 SELECT/WITH 语句");
    }
    // 限 LIMIT (若 SQL 已含 LIMIT, 信任并跳过)
    const boundedSql = /\blimit\b\s+\d/i.test(sql) ? sql : sql.replace(/;?\s*$/, "") + ` LIMIT ${safeLimit}`;
    try {
      const allRows = await db.prepare(boundedSql).all(...[]);
      return Array.isArray(allRows) ? allRows : [];
    } catch (err) {
      console.warn("[runDataset.sql] failed:", err?.message);
      return [];
    }
  }

  if (st === "ontology_object" && dataset.ontology_object_id) {
    const rows = await db.prepare(
      "SELECT id, name, label, description, icon, app_id FROM ontology_objects WHERE app_id = ? AND id = ? LIMIT ?"
    ).all(appId, dataset.ontology_object_id, safeLimit);
    return rows;
  }

  if (st === "view") {
    // P6-3: view 数据集 — 从 app_pages 表里 type='dataset_rows' AND form_id=? 的行里抽 config.rows
    // 注: 因为 app_pages 没有 dataset_id 列, 我们用 form_id 列存 dataset id (复用关系)。
    try {
      const containers = await db.prepare(
        "SELECT config FROM app_pages WHERE app_id = ? AND form_id = ? AND type = 'dataset_rows' LIMIT 1"
      ).get(appId, dataset.id);
      if (containers && containers.config) {
        const cfg = typeof containers.config === "string" ? JSON.parse(containers.config) : containers.config;
        const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
        return rows.slice(0, safeLimit);
      }
    } catch (e) {
      console.warn("[runDataset.view] fallback to ontology_objects:", e?.message);
    }
    // Fallback: 拉该应用的 ontology_objects (5 列)
    try {
      const rows = await db.prepare(
        "SELECT id, name, label, description FROM ontology_objects WHERE app_id = ? LIMIT ?"
      ).all(appId, safeLimit);
      return rows;
    } catch { return []; }
  }

  // 默认: 返回 dataset 自身 metadata
  return [
    {
      _note: `dataset ${dataset.id} (${st}) 尚未在 _shared/runDataset.js 中实现`,
      _hint: "在 reports / dashboards editor 中配置 source_type 和 sql_text / form_id / ontology_object_id",
      _dataset: dataset.id,
    },
  ];
}
