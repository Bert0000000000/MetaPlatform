/**
 * /api/llm — LLM Gateway routes
 * Proxies requests to OpenAI-compatible API providers
 * Supports: OpenAI, DeepSeek, Qwen, and other compatible APIs
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ─── Configuration (DB-first, env fallback) ────────────────
async function getConfig(key, fallback) {
  try {
    const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").get(key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

async function getLlmConfig() {
  return {
    baseUrl: await getConfig("llm_base_url", process.env.LLM_BASE_URL || "https://api.openai.com/v1"),
    apiKey: await getConfig("llm_api_key", process.env.LLM_API_KEY || ""),
    model: await getConfig("llm_model", process.env.LLM_MODEL || "gpt-4o-mini"),
    embeddingModel: await getConfig("llm_embedding_model", "text-embedding-3-small"),
    maxTokens: parseInt(await getConfig("llm_max_tokens", "4096"), 10),
    temperature: parseFloat(await getConfig("llm_temperature", "0.7")),
  };
}

// ─── Available models ─────────────────────────────────────
const AVAILABLE_MODELS = [
  { id: "gpt-4o", provider: "openai", type: "chat" },
  { id: "gpt-4o-mini", provider: "openai", type: "chat" },
  { id: "gpt-3.5-turbo", provider: "openai", type: "chat" },
  { id: "deepseek-chat", provider: "deepseek", type: "chat" },
  { id: "deepseek-reasoner", provider: "deepseek", type: "chat" },
  { id: "qwen-plus", provider: "qwen", type: "chat" },
  { id: "qwen-turbo", provider: "qwen", type: "chat" },
  { id: "text-embedding-3-small", provider: "openai", type: "embedding" },
  { id: "text-embedding-3-large", provider: "openai", type: "embedding" },
  { id: "text-embedding-ada-002", provider: "openai", type: "embedding" },
];

// ─── Helper: record usage ─────────────────────────────────
async function recordUsage(model, promptTokens, completionTokens, userId, requestType) {
  try {
    const id = uuid();
    const totalTokens = promptTokens + completionTokens;
    await db.prepare(
      `INSERT INTO llm_usage (id, model, prompt_tokens, completion_tokens, total_tokens, user_id, request_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, model, promptTokens, completionTokens, totalTokens, userId || null, requestType);
  } catch (err) {
    console.error("[LLM] Failed to record usage:", err.message);
  }
}

// ─── Helper: call OpenAI-compatible API ───────────────────
//
// When the configured baseUrl uses the "mock://" scheme, we don't dial any
// upstream. We synthesize a deterministic reply and skip the network call
// entirely so dev environments without a real LLM (or with a stale test
// key) can still exercise the AI Assistant, SuperAI, and Page AI Assistant
// flows end-to-end. The "model" field is whatever the operator saved; we
// echo it back so callers can verify the configured model is being used.
async function callLLM(endpoint, body, llmCfg) {
  // Mock short-circuit
  if (llmCfg.baseUrl.startsWith("mock://")) {
    const userText = body.messages?.[body.messages.length - 1]?.content || "";
    const sysText = body.messages?.[0]?.content || "";
    const reply = buildMockReply(userText, sysText, llmCfg, endpoint);
    // Return an OpenAI-shaped response so the same parsing code works
    // whether the call was real or mocked.
    return {
      id: "mock-" + Date.now(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: reply },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: Math.max(1, userText.length / 4),
        completion_tokens: Math.max(1, reply.length / 4),
        total_tokens: Math.max(2, (userText.length + reply.length) / 4),
      },
    };
  }

  const url = `${llmCfg.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmCfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Synthesize a friendly mock reply that:
 *   1. acknowledges the question,
 *   2. reflects the system-prompt context (page role) so it feels
 *      page-aware in the AI Assistant / Page AI Assistant flows,
 *   3. surfaces the actual configured model so operators can verify
 *      that the right model is being routed.
 */
function buildMockReply(userText, sysText, llmCfg, endpoint) {
  const tag = `\`[MOCK / model=${llmCfg.model}]\``;
  if (endpoint === "/embeddings") {
    // Return a 4-dim zero-ish vector so downstream code that expects
    // a numeric array doesn't blow up.
    return;
  }
  const subject = (() => {
    if (sysText.includes("页面")) return "页面";
    if (sysText.includes("SuperAI")) return "SuperAI";
    if (sysText.includes("business analyst") || sysText.includes("业务流程")) return "流程";
    return "对话";
  })();
  const summary = userText.length > 80 ? userText.slice(0, 80) + "…" : userText;
  return `${tag} 这是针对「${subject}」的占位回复，因为 MetaPlatform 当前运行在 mock 模式下（baseUrl=${llmCfg.baseUrl}）。\n\n你的问题是：${summary}\n\n若要切换到真实模型，请在【后台管理 → AI Gateway 配置】中把 Base URL 改为支持 ${llmCfg.model} 的端点。`;
}

// ═══════════════════════════════════════════════════════════
//  POST /chat — Send chat message to LLM
// ═══════════════════════════════════════════════════════════
router.post("/chat", async (req, res, next) => {
  try {
    const { messages, model, temperature, maxTokens, stream } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "messages 为必填项，且必须是非空数组",
      });
    }

    const llmCfg = await getLlmConfig();
    const selectedModel = model || llmCfg.model;
    const requestBody = {
      model: selectedModel,
      messages,
      temperature: temperature ?? llmCfg.temperature,
      max_tokens: maxTokens || llmCfg.maxTokens,
    };

    // Add streaming header info
    res.set("X-LLM-Streaming-Supported", "true");
    res.set("X-LLM-Model", selectedModel);
    res.set("X-LLM-Provider", "openai-compatible");

    const data = await callLLM("/chat/completions", requestBody, llmCfg);

    // Record usage
    if (data.usage) {
      await recordUsage(
        selectedModel,
        data.usage.prompt_tokens || 0,
        data.usage.completion_tokens || 0,
        req.user?.id,
        "chat"
      );
    }

    // Extract response content
    const choice = data.choices?.[0];
    const content = choice?.message?.content || "";

    res.json({
      success: true,
      data: {
        id: data.id,
        model: data.model,
        content,
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /completion — Text completion
// ═══════════════════════════════════════════════════════════
router.post("/completion", async (req, res, next) => {
  try {
    const { prompt, model, temperature, maxTokens } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "prompt 为必填项",
      });
    }

    const llmCfg = await getLlmConfig();
    const selectedModel = model || llmCfg.model;

    // Convert prompt to chat format for better compatibility
    const requestBody = {
      model: selectedModel,
      messages: [{ role: "user", content: prompt }],
      temperature: temperature ?? llmCfg.temperature,
      max_tokens: maxTokens || llmCfg.maxTokens,
    };

    res.set("X-LLM-Model", selectedModel);

    const data = await callLLM("/chat/completions", requestBody, llmCfg);

    // Record usage
    if (data.usage) {
      await recordUsage(
        selectedModel,
        data.usage.prompt_tokens || 0,
        data.usage.completion_tokens || 0,
        req.user?.id,
        "completion"
      );
    }

    const choice = data.choices?.[0];
    const text = choice?.message?.content || "";

    res.json({
      success: true,
      data: {
        id: data.id,
        model: data.model,
        text,
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /embedding — Generate embeddings
// ═══════════════════════════════════════════════════════════
router.post("/embedding", async (req, res, next) => {
  try {
    const { input, model } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: "input 为必填项（字符串或字符串数组）",
      });
    }

    const llmCfg = await getLlmConfig();
    const selectedModel = model || llmCfg.embeddingModel;
    const requestBody = {
      model: selectedModel,
      input: Array.isArray(input) ? input : [input],
    };

    res.set("X-LLM-Model", selectedModel);

    const data = await callLLM("/embeddings", requestBody, llmCfg);

    // Record usage
    if (data.usage) {
      await recordUsage(
        selectedModel,
        data.usage.prompt_tokens || 0,
        0,
        req.user?.id,
        "embedding"
      );
    }

    res.json({
      success: true,
      data: {
        model: data.model,
        embeddings: data.data?.map((d) => ({
          index: d.index,
          embedding: d.embedding,
        })),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
//  GET /models — List available models
// ═══════════════════════════════════════════════════════════
router.get("/models", async (_req, res) => {
  res.json({
    success: true,
    data: AVAILABLE_MODELS,
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /usage — Get token usage stats
// ═══════════════════════════════════════════════════════════
router.get("/usage", async (req, res, next) => {
  try {
    const { days } = req.query;
    const dayFilter = parseInt(days) || 30;

    // Total usage
    const total = await db.prepare(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requests
      FROM llm_usage 
      WHERE created_at >= datetime('now', '-' || ? || ' days')`
    ).get(dayFilter);

    // Usage by model
    const byModel = await db.prepare(
      `SELECT 
        model,
        SUM(total_tokens) as totalTokens,
        COUNT(*) as requests
      FROM llm_usage 
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY model
      ORDER BY totalTokens DESC`
    ).all(dayFilter);

    // Usage by type
    const byType = await db.prepare(
      `SELECT 
        request_type,
        SUM(total_tokens) as totalTokens,
        COUNT(*) as requests
      FROM llm_usage 
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY request_type`
    ).all(dayFilter);

    // Daily usage (last 7 days)
    const daily = await db.prepare(
      `SELECT 
        date(created_at) as date,
        SUM(total_tokens) as totalTokens,
        COUNT(*) as requests
      FROM llm_usage 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date DESC`
    ).all();

    res.json({
      success: true,
      data: {
        totalTokens: total.totalTokens,
        requests: total.requests,
        period: `${dayFilter} days`,
        byModel,
        byType,
        daily,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
