/**
 * LLM Gateway (Phase 3 — AI Substrate)
 *
 * Provider-agnostic chat-completion abstraction. Supports:
 *   - OpenAI (gpt-4o-mini, gpt-4o, gpt-3.5-turbo, etc.)
 *   - Anthropic (claude-3-5-sonnet, claude-3-haiku)
 *   - Echo / Stub fallback (no API key needed, useful for tests)
 *
 * All providers expose the same simple interface:
 *   const { content, usage, raw } = await chat({ messages, model, temperature });
 *
 * Streaming is supported via `streamChat({...}) -> AsyncIterable<chunk>`.
 */

const LLM_PROVIDER = (process.env.LLM_PROVIDER || "auto").toLowerCase();
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

let openaiLib = null;
let openaiClient = null;
let anthropicLib = null;
let anthropicClient = null;

function resolveProvider() {
  if (LLM_PROVIDER === "openai" || LLM_PROVIDER === "auto") {
    if (LLM_API_KEY && LLM_BASE_URL.includes("openai")) return "openai";
  }
  if (LLM_PROVIDER === "anthropic" || LLM_PROVIDER === "auto") {
    if (ANTHROPIC_API_KEY) return "anthropic";
  }
  if (LLM_PROVIDER === "echo" || LLM_PROVIDER === "stub") return "echo";
  // Auto: pick first available
  if (LLM_API_KEY) return "openai";
  if (ANTHROPIC_API_KEY) return "anthropic";
  return "echo";
}

async function getOpenAI() {
  if (openaiClient) return openaiClient;
  if (!openaiLib) {
    openaiLib = await import("openai");
  }
  openaiClient = new openaiLib.default({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL });
  return openaiClient;
}

async function getAnthropic() {
  if (anthropicClient) return anthropicClient;
  if (!anthropicLib) {
    anthropicLib = await import("@anthropic-ai/sdk");
  }
  anthropicClient = new anthropicLib.default({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

/**
 * Normalize a chat call into { content, usage, raw, provider, model }.
 */
export async function chat({ messages, model, temperature = 0.7, maxTokens = 1024, systemPrompt }) {
  const provider = resolveProvider();
  const useModel = model || LLM_MODEL;

  if (provider === "openai") {
    const client = await getOpenAI();
    const payload = {
      model: useModel,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages,
      ],
      temperature,
      max_tokens: maxTokens,
    };
    try {
      const resp = await client.chat.completions.create(payload);
      const choice = resp.choices?.[0];
      return {
        content: choice?.message?.content || "",
        usage: resp.usage || {},
        provider: "openai",
        model: resp.model || useModel,
        raw: resp,
      };
    } catch (err) {
      console.warn(`[LLM] OpenAI call failed: ${err.message} — falling back to echo`);
      return echoChat(messages, useModel);
    }
  }

  if (provider === "anthropic") {
    const client = await getAnthropic();
    const sysMsg = systemPrompt || messages.find((m) => m.role === "system")?.content;
    const userMsgs = messages.filter((m) => m.role !== "system");
    try {
      const resp = await client.messages.create({
        model: useModel || "claude-3-5-sonnet-20240620",
        system: sysMsg,
        messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
      });
      const text = resp.content?.[0]?.type === "text" ? resp.content[0].text : "";
      return {
        content: text,
        usage: { input_tokens: resp.usage?.input_tokens, output_tokens: resp.usage?.output_tokens },
        provider: "anthropic",
        model: resp.model,
        raw: resp,
      };
    } catch (err) {
      console.warn(`[LLM] Anthropic call failed: ${err.message} — falling back to echo`);
      return echoChat(messages, useModel);
    }
  }

  // echo / fallback
  return echoChat(messages, useModel);
}

function echoChat(messages, model) {
  const last = messages[messages.length - 1];
  const userText = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content || "");
  return {
    content: `[echo-mode stub response for: "${userText.slice(0, 120)}"]`,
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    provider: "echo",
    model: model || "echo-stub",
    raw: { stub: true, note: "Configure LLM_API_KEY or ANTHROPIC_API_KEY for real completions" },
  };
}

/**
 * Stream chat completion. Yields content chunks as they arrive.
 * Falls back to a single-chunk echo when no API key is configured.
 */
export async function* streamChat({ messages, model, temperature = 0.7, maxTokens = 1024, systemPrompt }) {
  const provider = resolveProvider();
  const useModel = model || LLM_MODEL;

  if (provider === "openai") {
    const client = await getOpenAI();
    const stream = await client.chat.completions.create({
      model: useModel,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages,
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
    return;
  }

  if (provider === "anthropic") {
    const client = await getAnthropic();
    const sysMsg = systemPrompt || messages.find((m) => m.role === "system")?.content;
    const userMsgs = messages.filter((m) => m.role !== "system");
    const stream = await client.messages.stream({
      model: useModel || "claude-3-5-sonnet-20240620",
      system: sysMsg,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        yield event.delta.text;
      }
    }
    return;
  }

  // echo fallback: yield the whole echo response as one chunk
  const { content } = echoChat(messages, useModel);
  yield content;
}

export function getStatus() {
  const provider = resolveProvider();
  return {
    provider,
    defaultModel: LLM_MODEL,
    baseUrl: LLM_BASE_URL,
    openaiKeyConfigured: Boolean(LLM_API_KEY),
    anthropicKeyConfigured: Boolean(ANTHROPIC_API_KEY),
    note:
      provider === "echo"
        ? "No LLM_API_KEY / ANTHROPIC_API_KEY — gateway in echo-stub mode (chat returns stub text)"
        : `Using ${provider} (${LLM_MODEL})`,
  };
}

export default {
  chat,
  streamChat,
  getStatus,
};