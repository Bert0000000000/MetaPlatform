/**
 * /api/dispatch — Agent Dispatch & Cross-module Orchestration
 * SuperAI uses this to route commands to the appropriate module agents
 */
import { Router } from "express";
import db from "../db.js";
import { v4 as uuid } from "uuid";

/**
 * 标准模块模板 (工作类别) — 创建应用时自动初始化
 *
 * 核心理念: 应用按"工作类别"分模块, 不是每个页面一个模块.
 * 每个应用初始化时创建 7 个模块, 页面创建时按 type 附加到对应模块.
 *
 * 类别: 业务模型 | 表单页面 | 列表页面 | Vue 页面 | 业务流程 | 报表页面 | 商业智能
 */
const STANDARD_MODULES = [
  { key: "model",     label: "业务模型", icon: "Database",      color: "text-red-500",     bgColor: "bg-red-50",    typeFilter: [] },
  { key: "form",      label: "表单页面", icon: "FileEdit",      color: "text-blue-500",    bgColor: "bg-blue-50",   typeFilter: ["form", "lowcode"] },
  { key: "list",      label: "列表页面", icon: "LayoutDashboard", color: "text-green-500", bgColor: "bg-green-50",  typeFilter: ["list"] },
  { key: "vue",       label: "Vue 页面", icon: "FileJson",      color: "text-emerald-500", bgColor: "bg-emerald-50", typeFilter: ["vue", "procode"] },
  { key: "workflow",  label: "业务流程", icon: "GitBranch",     color: "text-amber-500",   bgColor: "bg-amber-50",  typeFilter: ["workflow"] },
  { key: "report",    label: "报表页面", icon: "BarChart3",     color: "text-indigo-500",  bgColor: "bg-indigo-50", typeFilter: ["report", "dashboard"] },
  { key: "bi",        label: "商业智能", icon: "Layers",        color: "text-violet-500",  bgColor: "bg-violet-50", typeFilter: ["bi", "analytics"] },
];

/**
 * 检测意图对应的工作类别 (从用户输入中识别)
 *
 * 关键词分组 — 越靠前越优先匹配:
 *   - 表单: "表单", "申请单", "录入", "提交"
 *   - 列表: "列表", "查询", "管理", "所有"
 *   - 流程: "流程", "审批", "工作流"
 *   - 报表: "报表", "看板", "统计"
 *   - BI:   "BI", "分析", "指标"
 *   - 模型: "模型", "对象", "实体"  ← 兜底
 */
function detectWorkCategory(text) {
  const lower = text.toLowerCase();
  // 业务模型
  if (/(业务模型|本体|实体|对象模型|ontology)/i.test(text)) return "model";
  // 业务流程
  if (/(流程|审批流|工作流|bpmn|workflow|审批)/i.test(text)) return "workflow";
  // 报表
  if (/(报表|看板|dashboard|统计|汇总)/i.test(text)) return "report";
  // 商业智能
  if (/(商业智能|\bbi\b|智能分析|指标)/i.test(text)) return "bi";
  // Vue 页面
  if (/(vue\s*页面|procode|自定义页面)/i.test(text)) return "vue";
  // 表单 (在列表前面: "请假单" 是表单, 不是列表)
  if (/(表单|申请单|录入|提交|填写|新建表单|创建表单)/i.test(text)) return "form";
  // 列表
  if (/(列表|查询|管理|所有|清单)/i.test(text)) return "list";
  // 兜底
  return "form";
}

/**
 * 创建应用时初始化 7 个标准模块
 */
async function initStandardModules(appId) {
  const now = new Date().toISOString();
  const created = [];
  for (let i = 0; i < STANDARD_MODULES.length; i++) {
    const m = STANDARD_MODULES[i];
    const id = uuid();
    await db.prepare(
      `INSERT INTO app_modules (id, app_id, label, icon, color, bg_color, type_filter, sort_order, config, page_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, appId, m.label, m.icon, m.color, m.bgColor,
      JSON.stringify(m.typeFilter), i, JSON.stringify({ isStandard: true }),
      JSON.stringify([]), now, now,
    );
    created.push({ id, label: m.label, typeFilter: m.typeFilter });
  }
  return created;
}

/**
 * 在指定应用下创建页面, 并自动附加到对应模块
 *
 * @param {string} appId
 * @param {string} pageName
 * @param {string} categoryKey - STANDARD_MODULES.key 之一
 * @param {object} extras - { type, icon, config }
 */
async function createPageInModule(appId, pageName, categoryKey, extras = {}) {
  // 1. 找模块
  const allModules = await db.prepare(
    "SELECT * FROM app_modules WHERE app_id = ?"
  ).all(appId);
  const moduleRow = allModules.find((m) => m.label === STANDARD_MODULES.find((s) => s.key === categoryKey)?.label);
  if (!moduleRow) throw new Error(`找不到 ${categoryKey} 模块`);

  // 2. 创建页面
  const pageId = uuid();
  const now = new Date().toISOString();
  const pageType = extras.type || (STANDARD_MODULES.find((s) => s.key === categoryKey)?.typeFilter?.[0]) || "list";
  const maxRow = await db.prepare(
    "SELECT MAX(sort_order) AS max_order FROM app_pages WHERE app_id = ?"
  ).get(appId);
  const order = (maxRow?.max_order ?? -1) + 1;

  await db.prepare(
    `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    pageId, appId, pageName, pageType, extras.icon || null,
    "draft", extras.config ? JSON.stringify(extras.config) : null,
    order, now, now,
  );

  // 3. 附加到模块的 page_ids
  const pageIds = moduleRow.page_ids ? JSON.parse(moduleRow.page_ids) : [];
  if (!pageIds.includes(pageId)) pageIds.push(pageId);
  await db.prepare(
    "UPDATE app_modules SET page_ids = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(pageIds), now, moduleRow.id);

  return { pageId, pageName, moduleLabel: moduleRow.label };
}

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
    let score = agent.keywords.filter((kw) => lower.includes(kw)).length;

    // 优先级提升: 当用户说"建/创建/新建" + 应用相关词, app-builder 应该是首选
    if (agent.id === "app-architect" && /建|创建|新建/.test(lower) && /(应用|系统|平台|管理|表单|列表|报表|流程)/.test(lower)) {
      score += 5;
    }
    // 用户说"建/创建" + 报表/看板 → app-builder 而不是 data-analyst
    if (agent.id === "data-analyst" && /建|创建|新建/.test(lower) && /报表|看板/.test(lower)) {
      score -= 3;
    }

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
  // 优先匹配显式命名 (叫/名为/叫做/名称), 兜底匹配 "建一个X应用" / "建X应用"
  let nameMatch = message.match(/(?:叫|名为|叫做|名称[是为]?|叫做?)\s*["""']?([^"""',，。\.]+?)["""']?(?:的)?(?:应用|系统|平台|管理)?/);
  if (!nameMatch) {
    // 兜底 1: "建一个[名字]应用" / "创建[名字]系统"
    nameMatch = message.match(/(?:建|创建|新建)(?:一个|个)?\s*["""']?([^"""',，。\.]+?)["""']?(?:应用|系统|平台|管理)/);
  }
  if (!nameMatch) {
    // 兜底 2: "建一个X" / "创建X" (不带后缀, 但有动词前缀)
    nameMatch = message.match(/(?:建|创建|新建)(?:一个|个)?\s*["""']?([^"""',，。\.\s]{2,})["""']?/);
  }
  if (!nameMatch) {
    // 兜底 3: "X应用" / "X系统" / "X管理" (任何 X+后缀 模式)
    nameMatch = message.match(/["""']?([^"""',，。\.\s]{2,})["""']?(?:应用|系统|平台|管理|表单|列表|报表|流程)/);
  }
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

          // 🚀 自动初始化 7 个标准模块 (按工作类别分模块)
          const modules = await initStandardModules(id);

          // 🎯 检测用户意图中的工作类别, 自动创建对应页面
          // params.text 是原始用户输入, params.name 是应用名
          const userText = params.text || params.name || "";
          const category = detectWorkCategory(userText);

          // 创建应用根页面 (例如: "请假审批应用" → "请假单" 表单 + "请假列表" + "审批流程")
          const rootPageName = params.name.replace(/应用|系统|平台|管理$/, "").trim() || params.name;
          const rootPage = await createPageInModule(id, rootPageName, category, {
            icon: "FileText",
          });

          // 同时创建常见配套页面 (按类别)
          let extraPages = [];
          if (category === "form") {
            // 表单应用 → 自动添加列表 + 流程
            extraPages.push(
              await createPageInModule(id, `${rootPageName}列表`, "list", { icon: "LayoutDashboard" }),
            );
            extraPages.push(
              await createPageInModule(id, `${rootPageName}审批流程`, "workflow", { icon: "GitBranch" }),
            );
          } else if (category === "list") {
            // 列表应用 → 自动添加表单 (新增入口)
            extraPages.push(
              await createPageInModule(id, `新建${rootPageName}`, "form", { icon: "FileEdit" }),
            );
          } else if (category === "workflow") {
            // 流程应用 → 自动添加表单 + 列表
            extraPages.push(
              await createPageInModule(id, `${rootPageName}申请单`, "form", { icon: "FileEdit" }),
            );
            extraPages.push(
              await createPageInModule(id, `${rootPageName}查询`, "list", { icon: "LayoutDashboard" }),
            );
          } else if (category === "report" || category === "bi") {
            extraPages.push(
              await createPageInModule(id, `${rootPageName}明细数据`, "list", { icon: "LayoutDashboard" }),
            );
          }

          results.push({
            type: "created",
            module: "apps",
            id,
            name: params.name,
            link: `/apps/${id}/overview`,
            layout: "module-by-category",
            modulesCount: modules.length,
            modules: modules.map((m) => m.label),
            primaryCategory: category,
            primaryPage: rootPage,
            extraPages,
          });
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
        // 新格式: 含 layout/modulesCount/primaryPage/extraPages (按工作类别分模块)
        if (result.layout === "module-by-category") {
          const moduleList = result.modules?.join(" / ") || "";
          const primaryPageName = result.primaryPage?.pageName || result.name;
          const extras = result.extraPages?.map((p) => p.pageName).join("、") || "";
          parts.push(
            `已为您创建**${result.name}**, 自动初始化 ${result.modulesCount} 个标准模块 (${moduleList}).\n\n` +
            `主页面「${primaryPageName}」已放入**${result.primaryPage?.moduleLabel || ""}**` +
            (extras ? `, 同时创建配套页面: ${extras}` : "") + ".\n\n" +
            `[点击查看应用](${result.link})`,
          );
        } else {
          parts.push(`已在**${getModuleName(result.module)}**中创建「${result.name}」。[点击查看](${result.link})`);
        }
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
      // 把原始用户输入放进 params.text, 让 agent 可以做更精确的工作类别识别
      const agentParams = { ...intent.params, text: intent.raw };
      const results = await executeAgent(agent, intent.action, agentParams, req.user);
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
