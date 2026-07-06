/**
 * /api/data — Data source & metrics routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import fs from "fs";
import net from "net";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Data Sources
// ════════════════════════════════════════════════════════

// GET /sources — list data sources
router.get("/sources", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM data_sources ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /sources — create data source
router.post("/sources", (req, res, next) => {
  try {
    const { name, type, host, port, database_name, username, password_encrypted, description } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, error: "name, type 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO data_sources (id, name, type, host, port, database_name, username, password_encrypted, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)`
    ).run(id, name, type, host || null, port || null, database_name || null, username || null, password_encrypted || null, description || "", now, now);
    const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /sources/:id — update data source
router.put("/sources/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });

    const { name, type, host, port, database_name, username, password_encrypted, status, description } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE data_sources SET name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?, password_encrypted = ?, status = ?, description = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      host ?? existing.host,
      port ?? existing.port,
      database_name ?? existing.database_name,
      username ?? existing.username,
      password_encrypted ?? existing.password_encrypted,
      status ?? existing.status,
      description ?? existing.description,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /sources/:id — delete data source
router.delete("/sources/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });
    db.prepare("DELETE FROM data_sources WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// GET /sources/:id/test — test connection (real connectivity check)
router.get("/sources/:id/test", async (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });

    const startTime = Date.now();
    let connected = false;
    let message = "";

    // Check if connection details are configured
    if (!existing.host && !existing.database_name) {
      message = "缺少连接配置（host 或 database_name 未设置）";
    } else if (!existing.username) {
      message = "缺少认证信息（username 未设置）";
    } else {
      // Attempt actual connectivity test based on data source type
      try {
        const type = (existing.type || "").toLowerCase();
        if (type === "sqlite") {
          // For SQLite, verify the database file path is accessible
          if (fs.existsSync(existing.database_name)) {
            connected = true;
            message = "SQLite 数据库文件可访问";
          } else {
            message = `SQLite 数据库文件不存在: ${existing.database_name}`;
          }
        } else if (type === "mysql" || type === "postgresql" || type === "postgres") {
          // For MySQL/PostgreSQL, attempt a TCP socket connection to verify the server is reachable
          const port = existing.port || (type === "mysql" ? 3306 : 5432);
          connected = await new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
              socket.destroy();
              resolve(false);
            }, 5000);
            socket.connect(port, existing.host, () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(true);
            });
            socket.on("error", () => {
              clearTimeout(timeout);
              resolve(false);
            });
          });
          message = connected
            ? `${type.toUpperCase()} 服务器 ${existing.host}:${port} 连接成功`
            : `${type.toUpperCase()} 服务器 ${existing.host}:${port} 连接失败`;
        } else {
          // Unknown type: check if host is reachable via TCP
          const port = existing.port || 3306;
          connected = await new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
              socket.destroy();
              resolve(false);
            }, 5000);
            socket.connect(port, existing.host, () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(true);
            });
            socket.on("error", () => {
              clearTimeout(timeout);
              resolve(false);
            });
          });
          message = connected
            ? `服务器 ${existing.host}:${port} 连接成功`
            : `服务器 ${existing.host}:${port} 连接失败`;
        }
      } catch (testErr) {
        message = `连接测试出错: ${testErr.message}`;
      }
    }

    const latencyMs = Date.now() - startTime;

    // Update data source status based on test result
    try {
      const newStatus = connected ? "online" : "offline";
      db.prepare("UPDATE data_sources SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newStatus, req.params.id);
    } catch {}

    res.json({
      success: true,
      data: {
        connected,
        latency_ms: latencyMs,
        message,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Metrics
// ════════════════════════════════════════════════════════

// GET /metrics — list metrics (from data_metrics table, with fallback to computed counts)
router.get("/metrics", (_req, res, next) => {
  try {
    // Try to get metrics from the data_metrics table first
    const metrics = db.prepare("SELECT * FROM data_metrics ORDER BY created_at DESC").all();

    if (metrics.length > 0) {
      return res.json({ success: true, data: metrics });
    }

    // Fallback: compute metrics from data_sources and other tables
    const sourceCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_sources").get().cnt;
    const onlineCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_sources WHERE status = 'online'").get().cnt;
    const offlineCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_sources WHERE status = 'offline'").get().cnt;
    const appCount = db.prepare("SELECT COUNT(*) AS cnt FROM applications").get().cnt;
    const objectCount = db.prepare("SELECT COUNT(*) AS cnt FROM ontology_objects").get().cnt;
    const processCount = db.prepare("SELECT COUNT(*) AS cnt FROM process_definitions").get().cnt;
    const docCount = db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_documents").get().cnt;
    const agentCount = db.prepare("SELECT COUNT(*) AS cnt FROM agents").get().cnt;
    const userCount = db.prepare("SELECT COUNT(*) AS cnt FROM users").get().cnt;

    res.json({
      success: true,
      data: [
        { id: "computed_sources", metric_name: "数据源总数", metric_value: sourceCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_online", metric_name: "在线数据源", metric_value: onlineCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_offline", metric_name: "离线数据源", metric_value: offlineCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_apps", metric_name: "应用总数", metric_value: appCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_objects", metric_name: "对象总数", metric_value: objectCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_processes", metric_name: "流程定义", metric_value: processCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_docs", metric_name: "知识文档", metric_value: docCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_agents", metric_name: "智能体", metric_value: agentCount, source_id: null, period: "current", created_at: new Date().toISOString() },
        { id: "computed_users", metric_name: "用户数", metric_value: userCount, source_id: null, period: "current", created_at: new Date().toISOString() },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// POST /metrics — create metric (store in data_metrics table)
router.post("/metrics", (req, res, next) => {
  try {
    const { source_id, metric_name, metric_value, period } = req.body;
    if (!metric_name) return res.status(400).json({ success: false, error: "metric_name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO data_metrics (id, source_id, metric_name, metric_value, period, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, source_id || null, metric_name, metric_value ?? null, period || null, now);
    const row = db.prepare("SELECT * FROM data_metrics WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  AI Query (NL2SQL simulation)
// ════════════════════════════════════════════════════════

// POST /ask — natural language query (keyword-matching NL2SQL)
router.post("/ask", (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, error: "question 为必填项" });

    const q = question.toLowerCase();
    let sql = null;
    let table = null;

    // Table detection: map keywords to table names
    const tableKeywords = {
      "数据源": "data_sources",
      "data_source": "data_sources",
      "应用": "applications",
      "app": "applications",
      "对象": "ontology_objects",
      "object": "ontology_objects",
      "流程": "process_definitions",
      "process": "process_definitions",
      "文档": "knowledge_documents",
      "document": "knowledge_documents",
      "知识": "knowledge_documents",
      "智能体": "agents",
      "agent": "agents",
      "用户": "users",
      "user": "users",
      "任务": "agent_tasks",
      "task": "agent_tasks",
      "指标": "data_metrics",
      "metric": "data_metrics",
      "部门": "departments",
      "department": "departments",
    };

    // Detect which table the user is asking about
    for (const [keyword, tableName] of Object.entries(tableKeywords)) {
      if (q.includes(keyword)) {
        table = tableName;
        break;
      }
    }

    // Default to data_sources if no table detected
    if (!table) {
      table = "data_sources";
    }

    // Operation detection: map keywords to SQL operations
    if (q.includes("数量") || q.includes("多少") || q.includes("count") || q.includes("总数") || q.includes("共")) {
      sql = `SELECT COUNT(*) AS count FROM ${table}`;
    } else if (q.includes("在线") || q.includes("online")) {
      sql = table === "data_sources"
        ? `SELECT * FROM ${table} WHERE status = 'online'`
        : `SELECT * FROM ${table} WHERE status = 'active'`;
    } else if (q.includes("离线") || q.includes("offline")) {
      sql = table === "data_sources"
        ? `SELECT * FROM ${table} WHERE status = 'offline'`
        : `SELECT * FROM ${table} WHERE status != 'active'`;
    } else if (q.includes("最近") || q.includes("latest") || q.includes("latest")) {
      sql = `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 10`;
    } else if (q.includes("删除") || q.includes("delete")) {
      // Do NOT allow DELETE via NL2SQL for safety
      return res.status(400).json({
        success: false,
        error: "出于安全考虑，NL2SQL 不支持 DELETE 操作",
        question,
      });
    } else if (q.includes("更新") || q.includes("update") || q.includes("修改")) {
      return res.status(400).json({
        success: false,
        error: "出于安全考虑，NL2SQL 不支持 UPDATE 操作",
        question,
      });
    } else if (q.includes("插入") || q.includes("insert") || q.includes("新增") || q.includes("创建")) {
      return res.status(400).json({
        success: false,
        error: "出于安全考虑，NL2SQL 不支持 INSERT 操作",
        question,
      });
    } else {
      // Default: list all records
      sql = `SELECT * FROM ${table} LIMIT 50`;
    }

    // Whitelist: only allow SELECT queries
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith("SELECT")) {
      return res.status(400).json({
        success: false,
        error: "NL2SQL 仅支持 SELECT 查询",
        question,
      });
    }

    const results = db.prepare(sql).all();
    res.json({ success: true, data: { sql, results, question, table } });
  } catch (err) {
    next(err);
  }
});

// POST /export — export data as CSV
router.post("/export", (req, res, next) => {
  try {
    const { format, table, query, columns } = req.body;

    if (format && format !== "csv") {
      return res.status(400).json({ success: false, error: `暂不支持 ${format} 格式，目前仅支持 CSV` });
    }

    // Determine which table to query
    const targetTable = table || "data_sources";

    // Whitelist of allowed tables for export
    const allowedTables = [
      "data_sources", "applications", "ontology_objects", "process_definitions",
      "knowledge_documents", "agents", "users", "departments", "data_metrics",
      "agent_tasks", "audit_logs",
    ];
    if (!allowedTables.includes(targetTable)) {
      return res.status(400).json({ success: false, error: `不允许导出 ${targetTable} 表的数据` });
    }

    // Use provided query if it's a safe SELECT, otherwise build from table
    let sql;
    if (query && query.trim().toUpperCase().startsWith("SELECT")) {
      sql = query;
    } else {
      const colList = Array.isArray(columns) && columns.length > 0
        ? columns.filter(c => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)).join(", ")
        : "*";
      sql = `SELECT ${colList} FROM ${targetTable} LIMIT 10000`;
    }

    const rows = db.prepare(sql).all();

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: { message: "没有数据可导出", count: 0 } });
    }

    // Build CSV string
    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(",")];
    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape CSV: wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvLines.push(values.join(","));
    }
    const csvContent = csvLines.join("\n");

    // Set headers and send CSV file
    const filename = `export_${targetTable}_${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // Add BOM for Excel compatibility with Chinese characters
    res.send("\uFEFF" + csvContent);
  } catch (err) {
    next(err);
  }
});

// GET / — data module overview
router.get("/", (req, res) => {
  try {
    const sources = db.prepare("SELECT COUNT(*) AS cnt FROM data_sources").get().cnt;
    res.json({ success: true, data: { sources } });
  } catch (err) {
    res.json({ success: true, data: { sources: 0 } });
  }
});

export default router;
