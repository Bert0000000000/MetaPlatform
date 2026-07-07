/**
 * /api/dispatch — Agent Dispatch & Cross-module Orchestration
 * SuperAI uses this to route commands to the appropriate module agents
 */
import { Router } from "express";
import db from "../db.js";
import { v4 as uuid } from "uuid";

const router = Router();

// ─── Agent Registry ───────────────────────────────────────
const AGENTS = [
  {
    id: "app-architect",
    name: "应用架构师",
    icon: "Smartphone",
    module: "apps",
    description: "创建和管理应用、页面、表单",
    keywords: ["应用", "创建", "新建", "app", "建应用", "页面", "表单", "低代码"],
    actions: ["create_app", "list_apps", "get_app"],
  },
  {
    id: "ontology-modeler",
    name: "本体建模师",
    icon: "Dna",
    module: "ontology",
    description: "管理业务对象、属性、关系",
    keywords: ["对象", "模型", "本体", "字段", "属性", "关系", "建模", "ontology"],
    actions: ["create_object", "list_objects", "create_property"],
  },
  {
    id: "process-designer",
    name: "流程设计师",
    icon: "GitBranch",
    module: "processes",
    description: "设计和管理业务流程、审批流",
    keywords: ["流程", "审批", "设计", "process", "bpmn", "workflow"],
    actions: ["create_process", "list_processes", "start_instance"],
  },
  {
    id: "data-analyst",
    name: "数据分析师",
    icon: "BarChart3",
    module: "data",
    description: "查询数据、生成报表、分析指标",
    keywords: ["数据", "查询", "报表", "指标", "分析", "data", "chart"],
    actions: ["query_data", "list_sources", "list_metrics"],
  },
  {
    id: "knowledge-keeper",
    name: "知识管理员",
    icon: "BookOpen",
    module: "knowledge",
    description: "搜索知识库、管理文档",
    keywords: ["知识", "搜索", "文档", "知识库", "knowledge", "search"],
    actions: ["search_docs", "list_docs", "create_doc"],
  },
  {
    id: "digital-worker",
    name: "数字员工经理",
    icon: "Users",
    module: "agents",
    description: "管理数字员工、分配任务",
    keywords: ["数字员工", "智能体", "agent", "员工", "任务"],
    actions: ["list_agents", "create_task", "assign_task"],
  },
  {
    id: "system-admin",
    name: "系统管理员",
    icon: "Settings2",
    module: "admin",
    description: "用户管理、系统配置",
    keywords: ["用户", "管理", "配置", "admin", "权限", "角色"],
    actions: ["list_users", "list_roles", "get_config"],
  },
  {
    id: "code-engineer",
    name: "代码工程师",
    icon: "Code",
    module: "export",
    description: "生成代码、导出工程",
    keywords: ["代码", "导出", "生成", "code", "export", "sdk"],
    actions: ["generate_code", "export_project"],
  },
];

// ─── Intent Detection ─────────────────────────────────────
function detectIntent(message) {
  const lower = message.toLowerCase();
  
  // Detect which agent(s) to dispatch to
  const matched = [];
  for (const agent of AGENTS) {
    const score = agent.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > 0) {
      matched.push({ agent, score });
    }
  }
  
  // Sort by score descending
  matched.sort((a, b) => b.score - a.score);
  
  // Detect specific action
  let action = null;
  let params = {};
  
  if (lower.includes("创建") || lower.includes("新建") || lower.includes("建")) {
    action = "create";
  } else if (lower.includes("查询") || lower.includes("查") || lower.includes("搜索") || lower.includes("找")) {
    action = "query";
  } else if (lower.includes("列表") || lower.includes("有哪些") || lower.includes("看看") || lower.includes("查看")) {
    action = "list";
  } else if (lower.includes("删除") || lower.includes("移除")) {
    action = "delete";
  } else if (lower.includes("更新") || lower.includes("修改")) {
    action = "update";
  } else if (lower.includes("统计") || lower.includes("分析") || lower.includes("多少")) {
    action = "analyze";
  }
  
  // Extract entity name if present
  const nameMatch = message.match(/(?:叫|名为|叫做|名称[是为]?|叫做?)\s*["""']?([^"""',，。\.]+)["""']?/);
  if (nameMatch) {
    params.name = nameMatch[1].trim();
  }
  
  return {
    agents: matched.slice(0, 3).map((m) => m.agent),
    action,
    params,
    raw: message,
  };
}

// ─── Agent Execution ──────────────────────────────────────

async function executeAgent(agent, action, params, user) {
  const results = [];
  
  try {
    switch (agent.module) {
      case "apps": {
        if (action === "create" && params.name) {
          const id = uuid();
          await db.prepare(`INSERT INTO applications (id, name, description, category, status, icon) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(id, params.name, `由 SuperAI 创建`, "traditional", "draft", "Smartphone");
          results.push({ type: "created", module: "apps", id, name: params.name, link: `/apps/${id}/overview` });
        } else {
          const apps = await db.prepare(`SELECT * FROM applications ORDER BY updated_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "apps", data: apps, count: apps.length });
        }
        break;
      }
      
      case "ontology": {
        if (action === "create" && params.name) {
          const id = uuid();
          await db.prepare(`INSERT INTO ontology_objects (id, name, label, status) VALUES (?, ?, ?, ?)`)
            .run(id, params.name, params.name, "active");
          results.push({ type: "created", module: "ontology", id, name: params.name, link: `/ontology/object/${id}` });
        } else {
          const objects = await db.prepare(`SELECT * FROM ontology_objects ORDER BY created_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "ontology", data: objects, count: objects.length });
        }
        break;
      }
      
      case "processes": {
        if (action === "create") {
          results.push({ type: "navigate", module: "processes", link: "/process/designer", message: "已打开流程设计器" });
        } else {
          const defs = await db.prepare(`SELECT * FROM process_definitions ORDER BY created_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "processes", data: defs, count: defs.length });
        }
        break;
      }
      
      case "data": {
        if (action === "query" || action === "analyze") {
          const sources = await db.prepare(`SELECT * FROM data_sources`).all();
          const metrics = await db.prepare(`SELECT * FROM data_metrics`).all();
          results.push({ type: "list", module: "data", data: { sources, metrics }, count: sources.length });
        } else {
          const sources = await db.prepare(`SELECT * FROM data_sources ORDER BY created_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "data", data: sources, count: sources.length });
        }
        break;
      }
      
      case "knowledge": {
        if (action === "query" || action === "search") {
          const docs = await db.prepare(`SELECT * FROM knowledge_documents WHERE title LIKE ? OR content LIKE ? LIMIT 10`)
            .all(`%${params.name || ""}%`, `%${params.name || ""}%`);
          results.push({ type: "search", module: "knowledge", data: docs, count: docs.length });
        } else {
          const docs = await db.prepare(`SELECT * FROM knowledge_documents ORDER BY created_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "knowledge", data: docs, count: docs.length });
        }
        break;
      }
      
      case "agents": {
        const agents = await db.prepare(`SELECT * FROM agents ORDER BY created_at DESC`).all();
        const online = agents.filter((a) => a.status === "online").length;
        results.push({ type: "list", module: "agents", data: agents, count: agents.length, online });
        break;
      }
      
      case "admin": {
        if (action === "list" || action === "analyze") {
          const users = await db.prepare(`SELECT COUNT(*) as count FROM users`).get();
          const roles = await db.prepare(`SELECT COUNT(*) as count FROM roles`).get();
          const logs = await db.prepare(`SELECT COUNT(*) as count FROM audit_logs`).get();
          results.push({ type: "stats", module: "admin", data: { users: users.count, roles: roles.count, logs: logs.count } });
        } else {
          const users = await db.prepare(`SELECT * FROM users ORDER BY created_at DESC LIMIT 10`).all();
          results.push({ type: "list", module: "admin", data: users, count: users.length });
        }
        break;
      }
      
      case "export": {
        results.push({ type: "navigate", module: "export", link: `/apps`, message: "请先选择要导出的应用" });
        break;
      }
    }
  } catch (err) {
    results.push({ type: "error", module: agent.module, error: err.message });
  }
  
  return results;
}

// ─── Generate Response ────────────────────────────────────
function generateResponse(intent, results) {
  const parts = [];
  
  if (results.length === 0) {
    return "我没有找到相关的模块来处理这个请求。请尝试更具体地描述你的需求。";
  }
  
  for (const result of results) {
    switch (result.type) {
      case "created":
        parts.push(`已在**${getModuleName(result.module)}**中创建「${result.name}」。[点击查看](${result.link})`);
        break;
      case "list":
        parts.push(`在**${getModuleName(result.module)}**中找到 ${result.count} 条记录。`);
        break;
      case "search":
        parts.push(`在知识库中搜索到 ${result.count} 篇相关文档。`);
        break;
      case "navigate":
        parts.push(result.message || `已跳转到${getModuleName(result.module)}。`);
        break;
      case "stats":
        parts.push(`系统概况：${result.data.users} 个用户、${result.data.roles} 个角色、${result.data.logs} 条日志。`);
        break;
      case "error":
        parts.push(`操作失败：${result.error}`);
        break;
    }
  }
  
  return parts.join("\n\n");
}

function getModuleName(module) {
  const map = {
    apps: "应用中心",
    ontology: "本体引擎",
    processes: "流程中心",
    data: "数据中心",
    knowledge: "知识库",
    agents: "数字员工",
    admin: "后台管理",
    export: "代码导出",
  };
  return map[module] || module;
}

// ─── Routes ───────────────────────────────────────────────

/** GET /agents — List all available agents */
router.get("/agents", async (_req, res) => {
  res.json({ success: true, data: AGENTS });
});

/** POST /dispatch — Dispatch a command to the appropriate agent */
router.post("/dispatch", async (req, res) => {
  try {
    const { message, agentId } = req.body;
    
    if (!message && !agentId) {
      return res.status(400).json({ success: false, error: "请提供 message 或 agentId" });
    }
    
    let intent;
    
    if (agentId) {
      // Direct dispatch to a specific agent
      const agent = AGENTS.find((a) => a.id === agentId);
      if (!agent) {
        return res.status(404).json({ success: false, error: `未找到 Agent: ${agentId}` });
      }
      intent = {
        agents: [agent],
        action: message ? detectIntent(message).action : "list",
        params: message ? detectIntent(message).params : {},
        raw: message || "",
      };
    } else {
      // Auto-detect intent
      intent = detectIntent(message);
      
      if (intent.agents.length === 0) {
        // Default to SuperAI chat
        return res.json({
          success: true,
          data: {
            type: "chat",
            agents: [],
            response: null, // Let frontend handle with LLM
            message,
          },
        });
      }
    }
    
    // Execute all matched agents
    const allResults = [];
    const dispatchedAgents = [];
    
    for (const agent of intent.agents) {
      const results = await executeAgent(agent, intent.action, intent.params, req.user);
      allResults.push(...results);
      dispatchedAgents.push({
        id: agent.id,
        name: agent.name,
        icon: agent.icon,
        module: agent.module,
        status: results.some((r) => r.type === "error") ? "error" : "success",
      });
    }
    
    const response = generateResponse(intent, allResults);
    
    // Log dispatch to audit
    try {
      await db.prepare(`INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(uuid(), req.user?.id || "system", req.user?.name || "SuperAI", "dispatch", "superai", intent.agents.map((a) => a.id).join(","), message);
    } catch { /* ignore audit errors */ }
    
    res.json({
      success: true,
      data: {
        type: "dispatch",
        agents: dispatchedAgents,
        results: allResults,
        response,
        message,
      },
    });
  } catch (err) {
    console.error("[Dispatch Error]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /execute — Execute a specific agent action directly */
router.post("/execute", async (req, res) => {
  try {
    const { agentId, action, params } = req.body;
    
    const agent = AGENTS.find((a) => a.id === agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: `未找到 Agent: ${agentId}` });
    }
    
    if (!agent.actions.includes(action)) {
      return res.status(400).json({ success: false, error: `Agent ${agent.name} 不支持操作: ${action}` });
    }
    
    const results = await executeAgent(agent, action, params || {}, req.user);
    
    res.json({
      success: true,
      data: {
        agent: { id: agent.id, name: agent.name, icon: agent.icon },
        action,
        results,
      },
    });
  } catch (err) {
    console.error("[Execute Error]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / — dispatch agent query
router.post("/", async (req, res, next) => {
  try {
    const { agent, query, input, messages } = req.body;
    const agentName = agent || "default";
    const queryText = query || input || (messages?.length ? messages[messages.length - 1]?.content : "");
    if (!queryText) {
      return res.status(400).json({ success: false, error: "query/input 为必填项" });
    }
    // Try LLM call
    const rows = await db.prepare("SELECT key, value FROM system_config WHERE key IN ('llm_base_url','llm_api_key','llm_model')").all();
    const cfg = {};
    for (const r of rows) cfg[r.key] = r.value;
    const baseUrl = cfg.llm_base_url || process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    const apiKey = cfg.llm_api_key || process.env.LLM_API_KEY || "";
    const model = cfg.llm_model || process.env.LLM_MODEL || "gpt-4o-mini";
    if (!apiKey) {
      return res.json({ success: true, data: { agent: agentName, response: "AI Gateway 未配置 API Key，请在后台管理中配置。", model } });
    }
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: messages || [{ role: "user", content: queryText }], max_tokens: 1024 }),
    });
    if (!resp.ok) {
      return res.json({ success: true, data: { agent: agentName, response: `LLM API 错误: ${resp.status}`, model } });
    }
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || "无响应";
    res.json({ success: true, data: { agent: agentName, response: reply, model, usage: data.usage } });
  } catch (err) {
    next(err);
  }
});

export default router;
