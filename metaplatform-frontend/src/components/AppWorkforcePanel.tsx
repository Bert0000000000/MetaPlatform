/**
 * AppWorkforcePanel — 应用内"数字员工"AI 助手面板
 * --------------------------------------------------------------------------
 * 用户在应用详情页描述一个修改/创建/发布需求, 数字员工解析意图并执行.
 *
 * 支持的意图 (前端启发式, 后续可平滑替换为真实 LLM):
 *   • 业务建模: "给XX表加一个XX字段" / "创建一个叫XX的对象" / "列出所有对象"
 *   • 页面:    "打开页面编辑器" / "新建一个表单" / "在XX页面加一个XX字段"
 *   • 应用配置: "把应用名改为XX" / "修改应用描述"
 *   • 发布:    "发布到测试环境" / "发布" / "部署应用" / "上线"
 *   • 通用:    "当前应用有多少个对象/页面/流程" / "总结一下这个应用"
 *
 * 实现策略:
 *   - 维护对话历史 (user/assistant/tool)
 *   - 每条用户消息先做意图识别, 再执行具体 action
 *   - action 卡片可点击"查看结果"跳到对应 tab 或新页面
 *   - 所有操作只走真实 API, 失败时把错误返回给用户
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Sparkles, Bot, Send, Loader2, CheckCircle2, AlertCircle,
  Database, FileEdit, Rocket, Settings, BarChart3, ExternalLink, Wand2, Pencil, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { appsApi, ontologyApi, llmApi, type Application } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useWorkforce, WORKFORCE_AVATARS, type WorkforceAvatarKey } from "@/hooks/useWorkforce";

/* ── 意图类型 ── */
type Intent =
  | { kind: "add_field"; objectName: string; fieldName: string; fieldType: string }
  | { kind: "create_object"; objectName: string }
  | { kind: "list_objects" }
  | { kind: "rename_app"; newName: string }
  | { kind: "update_description"; description: string }
  | { kind: "publish"; env: "test" | "staging" | "prod" }
  | { kind: "navigate"; tab: string; label: string }
  | { kind: "stats" }
  | { kind: "summary"; app: Application }
  | { kind: "unknown"; reason: string };

/* ── 消息类型 ── */
interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** action 卡片 */
  action?: { kind: "publish" | "navigate" | "create_field" | "create_object" | "update_app" | "stats"; status: "running" | "success" | "error"; detail?: string; link?: { to: string; label: string } };
  ts: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  appId: string;
  /** 预填入输入框的提示词 (例如"为这个应用搭建一个数据模型") */
  initialPrompt?: string;
  /** 初始提示词被消费后回调 (父级 layout 可清掉自己的 state) */
  onPromptConsumed?: () => void;
}

/* ── 字段类型映射 ── */
const FIELD_TYPE_MAP: Array<[RegExp, string]> = [
  [/手机|电话|phone|mobile/i, "phone"],
  [/邮箱|email|邮件/i, "email"],
  [/日期|date|时间|生日/i, "date"],
  [/数字|数量|金额|price|number|float|int/i, "number"],
  [/备注|描述|说明|comment|description/i, "text"],
  [/地址|address/i, "text"],
  [/是否|启用|状态|is_/i, "boolean"],
];
function inferFieldType(fieldName: string): string {
  for (const [re, t] of FIELD_TYPE_MAP) if (re.test(fieldName)) return t;
  return "text";
}

/* ════════════════════════════════════════════════════════════════════
   LLM 接入 (系统提示词 / 流式调用 / tool call 解析 / fallback)
   ════════════════════════════════════════════════════════════════════ */

/** 应用侧能感知到的对象 (供 LLM 拼写准确名字) */
interface ObjectSummary { id: string; name: string; label?: string; properties_count?: number; }

function buildSystemPrompt(
  app: Application | null,
  wfName: string,
  wfRole: string,
  objects: any[]
): string {
  const appName = app?.name ?? "（未命名）";
  const objList = (objects || []).slice(0, 50).map(o => `- ${o.label || o.name} (id=${o.id}, ${o.properties_count ?? 0} 字段)`).join("\n") || "（暂无业务对象）";
  // 一整个多行模板: 用反引号包住, 内部任意字符都不会触发字符串歧义.
  return `你叫「${wfName}」, 这个应用的 ${wfRole}。当前应用: 「${appName}」(分类: ${app?.category ?? "—"})。
当前应用已有的业务对象:
${objList}

═══════════════════════════════════════════════════════
【铁律】凡用户说 加 / 建 / 创建 / 新增 / 改 / 打开 / 发布 / 跳转 / 查看 等动作词, 你必须立刻输出 JSON 代码块, 不要再多写解释文字. 闲聊 / 介绍 / 知识问答才用 chat。
═══════════════════════════════════════════════════════

输出规则: 一句中文 + 一个 JSON 代码块。代码块用 \`\`\`json 包裹, 内含:
{
  "action": "<动作>",
  "args": { ... 精确的参数 ... },
  "message": "<给用户的中文展示>"
}

【可用 action 与 args】
1. add_field       在已有对象下新增字段
   args: { "objectName": "<对象中文名, 如 客户>", "fieldName": "<字段中文名, 如 手机号>", "fieldType": "<text|number|phone|email|date|boolean|select|multiline>" }
2. create_object   创建一个新业务对象 (新表)
   args: { "objectName": "<对象名, 如 产品>" }
3. rename_app      修改当前应用名
   args: { "newName": "<新名字>" }
4. update_description 修改应用描述
   args: { "description": "<新描述>" }
5. publish         发布到指定环境
   args: { "env": "test" 或 "staging" 或 "prod" }
6. navigate        跳转到应用内的某个 tab
   args: { "tab": "pages|datamodeling|workflows|config|publish|overview", "label": "<中文标签, 如 页面>" }
7. stats           统计/概览当前应用
   args: {}
8. summary         介绍当前应用
   args: {}
9. chat            普通聊天问答, 不执行任何动作
   args: {}

【字段类型映射】(必须严格映射, 不允许猜错)
手机 / 电话 / 手机号 → phone
邮箱 → email
数字 / 金额 / 价格 / 数量 / 年龄 / 分数 → number
日期 / 时间 / 生日 → date
是否 / 开关 / 启用 → boolean
状态 / 类型 / 性别 / 分类 → select
备注 / 描述 / 详情 / 说明 → multiline
其他默认 → text

═══════════════════════════════════════════════════════
【示例 - 必须照这样输出】
═══════════════════════════════════════════════════════

用户: 给客户表加一个手机号字段
你: 好, 我帮你在「客户」下加一个「手机号」字段 (phone 类型)。
\`\`\`json
{
  "action": "add_field",
  "args": { "objectName": "客户", "fieldName": "手机号", "fieldType": "phone" },
  "message": "已在「客户」下新增字段「手机号」"
}
\`\`\`

用户: 创建一个叫产品的对象
你: 好, 我帮你新建「产品」对象。
\`\`\`json
{
  "action": "create_object",
  "args": { "objectName": "产品" },
  "message": "已创建「产品」业务对象"
}
\`\`\`

用户: 把应用名改成销售管理平台
你: 好, 已改名。
\`\`\`json
{
  "action": "rename_app",
  "args": { "newName": "销售管理平台" },
  "message": "应用名已改为「销售管理平台」"
}
\`\`\`

用户: 发布到测试环境
你: 好, 已发布。
\`\`\`json
{
  "action": "publish",
  "args": { "env": "test" },
  "message": "已发布到测试环境"
}
\`\`\`

用户: 打开页面
你: 好, 跳转到页面 Tab。
\`\`\`json
{
  "action": "navigate",
  "args": { "tab": "pages", "label": "页面" },
  "message": "已打开页面"
}
\`\`\`

用户: 你好呀
你: 你好, 我是这个应用的「${wfName}」数字员工, 有什么可以帮你?
(此情况不输出 JSON, 直接给普通文字回复)

═══════════════════════════════════════════════════════
切记: 输出 JSON 代码块后**就停在那里**, 不要在代码块外再多写文字。args 里字段名必须用上面规定的英文。
`;
}

/** 流式调用 LLM (OpenAI-compatible SSE). 返回拼好的完整文本.
 *  自适应: 1) 后端真正流式 (Content-Type: text/event-stream) → 逐 token 输出
 *          2) 后端返回一次性 JSON (Content-Type: application/json) → 也读出 content 展示
 */
async function streamChatCompletion(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  systemPrompt: string,
  onToken: (chunk: string) => void,
): Promise<string> {
  const payload = {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.2,
    stream: true,
  };
  let res: Response;
  try {
    res = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // 网络层失败, 退回 llmApi.chat
    const r = await llmApi.chat(payload.messages);
    if (r.content) onToken(r.content);
    return r.content ?? "";
  }
  if (!res.ok) {
    // 401 / 5xx: 直接抛错, 外层 fallback 到启发式
    let errMsg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); errMsg = j?.error || errMsg; } catch { /* ignore */ }
    throw new Error(`LLM ${errMsg}`);
  }
  const ct = res.headers.get("content-type") || "";
  // ── 1) 后端一次性返回 JSON 的情况 (当前最常见) ──
  if (!res.body || !ct.includes("text/event-stream")) {
    try {
      const j = await res.json();
      const content: string = j?.data?.content ?? j?.content ?? j?.choices?.[0]?.message?.content ?? "";
      if (content) onToken(content);
      return content;
    } catch (e) {
      throw new Error(`无法解析 LLM 响应: ${e instanceof Error ? e.message : e}`);
    }
  }
  // ── 2) 真正的 SSE 流 ──
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payloadStr = trimmed.slice(5).trim();
      if (payloadStr === "[DONE]") continue;
      try {
        const obj = JSON.parse(payloadStr);
        const delta = obj?.choices?.[0]?.delta?.content
          ?? obj?.choices?.[0]?.text
          ?? obj?.content
          ?? "";
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        /* 忽略坏行 */
      }
    }
  }
  return full;
}

/* ── tool call 解析 (LLM 输出第一段 ```json ... ```) ── */
interface ToolCall {
  action: "add_field" | "create_object" | "rename_app" | "update_description" | "publish" | "navigate" | "stats" | "summary" | "chat" | string;
  args: Record<string, any>;
  message: string;
}

function parseToolCall(reply: string): ToolCall | null {
  // 找首个 ```json ... ```
  const match = reply.match(/```json\s*([\s\S]+?)\s*```/i);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[1]);
    if (!obj || typeof obj !== "object" || typeof obj.action !== "string") return null;
    return {
      action: obj.action,
      args: obj.args ?? {},
      message: typeof obj.message === "string" ? obj.message : "",
    };
  } catch {
    return null;
  }
}

/** 本地启发式 Intent → ToolCall, 让 fallback 出来的"可执行意图"走与 LLM 相同的执行链路 */
function intentToToolCall(intent: Intent): ToolCall {
  const i = intent as any;
  switch (intent.kind) {
    case "add_field": return { action: "add_field", args: { objectName: i.objectName, fieldName: i.fieldName, fieldType: i.fieldType }, message: "" };
    case "create_object": return { action: "create_object", args: { objectName: i.objectName }, message: "" };
    case "rename_app": return { action: "rename_app", args: { newName: i.newName }, message: "" };
    case "update_description": return { action: "update_description", args: { description: i.description }, message: "" };
    case "publish": return { action: "publish", args: { env: i.env ?? "test" }, message: "" };
    case "navigate": return { action: "navigate", args: { tab: i.tab, label: i.label }, message: "" };
    case "list_objects": return { action: "chat", args: {}, message: "" };
    case "stats": return { action: "stats", args: {}, message: "" };
    default: return { action: "chat", args: {}, message: "" };
  }
}

/** LLM tool call → 现有 Intent 形状, 复用执行器 */
function toIntent(tc: ToolCall, app: Application | null): Intent {
  switch (tc.action) {
    case "add_field":        return { kind: "add_field", objectName: String(tc.args?.objectName ?? "").trim(), fieldName: String(tc.args?.fieldName ?? "").trim(), fieldType: String(tc.args?.fieldType ?? "text").trim() };
    case "create_object":    return { kind: "create_object", objectName: String(tc.args?.objectName ?? "").trim() };
    case "rename_app":       return { kind: "rename_app", newName: String(tc.args?.newName ?? "").trim() };
    case "update_description": return { kind: "update_description", description: String(tc.args?.description ?? "").trim() };
    case "publish":          return { kind: "publish", env: (tc.args?.env === "prod" || tc.args?.env === "staging") ? tc.args.env : "test" };
    case "navigate":         return { kind: "navigate", tab: String(tc.args?.tab ?? "pages"), label: String(tc.args?.label ?? "页面") };
    case "stats":            return { kind: "stats" };
    case "summary":          return app ? { kind: "summary", app } : { kind: "unknown", reason: "应用信息未加载" };
    case "chat":             return { kind: "unknown", reason: "" };
    default:                 return { kind: "unknown", reason: "我不知道如何处理这个请求" };
  }
}

/** 工具调用的中文描述 (写"正在执行"提示用) */
function describeAction(tc: ToolCall): string {
  switch (tc.action) {
    case "add_field":          return `在「${tc.args?.objectName ?? ""}」下添加字段「${tc.args?.fieldName ?? ""}」`;
    case "create_object":      return `创建对象「${tc.args?.objectName ?? ""}」`;
    case "rename_app":         return `将应用名改为「${tc.args?.newName ?? ""}」`;
    case "update_description": return `更新应用描述`;
    case "publish":            return `发布到「${tc.args?.env ?? "test"}」环境`;
    case "navigate":           return `跳转到「${tc.args?.label ?? tc.args?.tab ?? ""}」`;
    case "stats":              return `统计应用信息`;
    case "summary":            return `总结当前应用`;
    default:                   return tc.action;
  }
}

/** 把 tool call 翻译成 ActionCard 标签 */
function actionCard(tc: ToolCall): NonNullable<ChatMsg["action"]> | null {
  switch (tc.action) {
    case "add_field":          return { kind: "create_field",  status: "running" };
    case "create_object":      return { kind: "create_object", status: "running" };
    case "rename_app":
    case "update_description": return { kind: "update_app",    status: "running" };
    case "publish":            return { kind: "publish",       status: "running" };
    case "navigate":           return { kind: "navigate",      status: "running" };
    case "stats":              return { kind: "stats",         status: "running" };
    default:                   return null;
  }
}

/* ── 意图识别 (LLM 不可用时的本地启发式 fallback) ── */
function recognizeIntent(text: string, app: Application | null): Intent {
  const t = text.trim();
  if (!t) return { kind: "unknown", reason: "请描述你想做什么" };

  // 列出对象 / 统计
  if (/(列出|查看|显示).*?(对象|表|业务模型)/i.test(t) || /所有对象/i.test(t)) {
    return { kind: "list_objects" };
  }
  if (/(多少.*?(对象|页面|流程))|(统计|概览|summary)/i.test(t)) {
    return { kind: "stats" };
  }
  if (/总结|简介|描述一下这个应用/.test(t) && app) {
    return { kind: "summary", app };
  }

  // 发布 / 部署 / 上线
  const pubMatch = t.match(/(发布|部署|上线|publish|deploy).*?(test|测试|staging|预发|prod|生产|dev|开发)?/i);
  if (pubMatch) {
    const envRaw = (pubMatch[2] || "test").toLowerCase();
    const env: "test" | "staging" | "prod" =
      /prod|生产/.test(envRaw) ? "prod" :
      /stag|预发/.test(envRaw) ? "staging" : "test";
    return { kind: "publish", env };
  }

  // 改名
  const renameMatch = t.match(/(把|将)?(应用|app).*?(改名|修改名|更名|名称改为|名改为|rename).*?(为|叫|to|is)?\s*[:：]?\s*(.+)$/i);
  if (renameMatch) {
    const newName = (renameMatch[5] || "").trim().replace(/^["'「」]+|["'「」]+$/g, "");
    if (newName) return { kind: "rename_app", newName };
  }

  // 改描述
  const descMatch = t.match(/(把|将)?(应用|app).*?描述.*?(改为|改成|为|是)\s*(.+)$/i);
  if (descMatch) {
    return { kind: "update_description", description: (descMatch[4] || "").trim() };
  }

  // 加字段
  const fieldMatch = t.match(/(给|为|在)?\s*(.+?)\s*(表|对象)?\s*(加|增加|添加|新增|new).*?字段.*?(叫|为|名为|名称为|是)?\s*[:：]?\s*["「]?(.+?)["」]?$/i)
    || t.match(/(给|为|在)?\s*(.+?)\s*(表|对象)?\s*(加|增加|添加|新增).*?["「](.+?)["」]/i);
  if (fieldMatch) {
    const objectName = (fieldMatch[2] || "").trim();
    const fieldName = (fieldMatch[5] || "").trim();
    if (objectName && fieldName) {
      return { kind: "add_field", objectName, fieldName, fieldType: inferFieldType(fieldName) };
    }
  }

  // 新建对象
  const createObjMatch = t.match(/(创建|新建|新增|添加).*?(一个|个)?\s*[:：]?\s*["「]?(.+?)["」]?\s*(对象|表|业务模型|entity)/i);
  if (createObjMatch) {
    const objectName = (createObjMatch[3] || "").trim();
    if (objectName) return { kind: "create_object", objectName };
  }

  // 跳转
  if (/(打开|进入|跳到|去)\s*(页面|page)/i.test(t)) return { kind: "navigate", tab: "pages", label: "页面" };
  if (/(打开|进入|跳到|去)\s*(业务数据|数据建模|建模|datamodeling)/i.test(t)) return { kind: "navigate", tab: "datamodeling", label: "业务数据建模" };
  if (/(打开|进入|跳到|去)\s*(流程|workflow)/i.test(t)) return { kind: "navigate", tab: "workflows", label: "流程" };
  if (/(打开|进入|跳到|去)\s*(应用配置|config)/i.test(t)) return { kind: "navigate", tab: "config", label: "应用配置" };
  if (/(打开|进入|跳到|去)\s*(应用发布|发布|publish)/i.test(t)) return { kind: "navigate", tab: "publish", label: "应用发布" };
  if (/(打开|进入|跳到|去)\s*(概览|overview)/i.test(t)) return { kind: "navigate", tab: "overview", label: "概览" };

  return { kind: "unknown", reason: "我还不太理解这个需求, 试试: 「给客户表加一个手机号字段」「发布到测试环境」「改名销售助手」「打开页面」" };
}

/* ── 主组件 ── */
export function AppWorkforcePanel({ open, onClose, appId, initialPrompt, onPromptConsumed }: Props) {
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [objects, setObjects] = useState<ObjectSummary[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 数字员工的"人设" (名字 / 头像 / 角色): 持久化在 localStorage
  const { name: wfName, avatarMeta, avatar: wfAvatar, role: wfRole, setName: setWfName, setAvatar: setWfAvatar, setRole: setWfRole } = useWorkforce(open ? appId : null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 加载应用基本信息
  useEffect(() => {
    if (!open || !appId) return;
    appsApi.get(appId).then(setApp).catch(() => setApp(null));
    if (messages.length === 0) {
      setMessages([{
        id: `sys-${Date.now()}`,
        role: "assistant",
        content: `你好, 我是「${wfName || "数字员工"}」, 这个应用的 ${wfRole || "应用助手"} ✨\n\n你可以让我:\n• 给 XX 表加一个 XX 字段\n• 创建一个叫 XX 的对象\n• 把应用名改为 XX\n• 发布到测试/预发/生产环境\n• 打开应用配置/页面/流程 等\n• 统计这个应用有多少对象/页面/流程\n\n说一句话, 我来帮你做 ✨`,
        ts: Date.now(),
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId]);

  // 接受父级预填 prompt (从业务数据建模页 "AI 智能建模" 触发)
  useEffect(() => {
    if (!open) return;
    if (!initialPrompt || !initialPrompt.trim()) return;
    setInput(initialPrompt);
    // 滚到底让用户看到预填
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    onPromptConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, open]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // 拉取应用对象列表 (用于 system prompt + 自动联想)
  useEffect(() => {
    if (!open || !appId) { setObjects([]); return; }
    let cancel = false;
    ontologyApi.listObjects(appId)
      .then((data: any[]) => {
        if (cancel) return;
        setObjects((data || []).map(o => ({
          id: o.id, name: o.name, label: o.label, properties_count: o.properties_count,
        })));
      })
      .catch(() => { if (!cancel) setObjects([]); });
    return () => { cancel = true; };
  }, [open, appId]);

  const addMsg = (m: Omit<ChatMsg, "id" | "ts">) => {
    setMessages(prev => [...prev, { ...m, id: `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() }]);
  };

  const updateLastAction = (status: ChatMsg["action"]["status"], detail?: string, link?: ChatMsg["action"]["link"]) => {
    setMessages(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].action) {
          next[i] = { ...next[i], action: { ...next[i].action!, status, detail, link } };
          return next;
        }
      }
      return next;
    });
  };

  /* ── 执行 intent ── */
  const runIntent = async (intent: Intent) => {
    switch (intent.kind) {
      case "stats": {
        try {
          const [objs, stats] = await Promise.all([
            ontologyApi.listObjects(appId).catch(() => []),
            appsApi.stats(appId).catch(() => null),
          ]);
          const lines = [
            `📊 **应用「${app?.name ?? "—"}」概览**`,
            `• 对象 (业务模型): **${objs.length}** 个${objs.length > 0 ? `\n  ${objs.slice(0, 5).map(o => `  - ${o.label || o.name} (${o.properties_count ?? 0} 字段)`).join("\n")}` : ""}`,
            stats ? `• 页面: **${stats.pages}** 个` : "",
            stats ? `• 流程: **${stats.flows}** 个` : "",
          ].filter(Boolean);
          addMsg({ role: "assistant", content: lines.join("\n") });
        } catch (e: any) {
          addMsg({ role: "assistant", content: `查询失败: ${e?.message ?? e}` });
        }
        break;
      }

      case "summary": {
        const a = intent.app;
        addMsg({
          role: "assistant",
          content:
            `📝 **${a.name}**\n\n` +
            `• 分类: ${a.category ?? "—"}\n` +
            `• 状态: ${a.status ?? "—"}\n` +
            `• 描述: ${a.description ?? "(无)"}\n` +
            `• 对象: ${a.objects_count ?? 0} | 页面: ${a.pages_count ?? 0} | 流程: ${a.flows_count ?? 0}`,
        });
        break;
      }

      case "list_objects": {
        try {
          const objs = await ontologyApi.listObjects(appId);
          if (objs.length === 0) {
            addMsg({ role: "assistant", content: "这个应用还没有任何业务对象, 你可以让我创建一个 (例如: 「创建一个客户对象」) 或到「业务数据建模」手动创建。" });
          } else {
            addMsg({
              role: "assistant",
              content: `这个应用共有 **${objs.length}** 个业务对象:\n` +
                objs.map(o => `• **${o.label || o.name}** (${o.properties_count ?? 0} 字段)`).join("\n"),
            });
          }
        } catch (e: any) {
          addMsg({ role: "assistant", content: `查询对象失败: ${e?.message ?? e}` });
        }
        break;
      }

      case "add_field": {
        addMsg({ role: "assistant", content: `好的, 我会帮你在「${intent.objectName}」表中加一个「${intent.fieldName}」字段 (类型推断为 **${intent.fieldType}**)。`, action: { kind: "create_field", status: "running" } });
        try {
          const objects = await ontologyApi.listObjects(appId);
          // 模糊匹配对象
          const obj = objects.find((o: any) => o.name === intent.objectName || o.label === intent.objectName)
            ?? objects.find((o: any) => (o.name || o.label || "").includes(intent.objectName));
          if (!obj) {
            updateLastAction("error", `未找到对象「${intent.objectName}」, 请先创建该对象`);
            addMsg({ role: "assistant", content: `没有找到名为「${intent.objectName}」的对象。要我帮你创建一个吗? 试试: 「创建 ${intent.objectName} 对象」` });
            return;
          }
          await ontologyApi.createProperty(obj.id, {
            name: intent.fieldName,
            label: intent.fieldName,
            type: intent.fieldType,            // 后端 ontology 字段名是 type
            data_type: intent.fieldType,      // 兼容前端其它地方
            required: false,
          });
          updateLastAction("success", `已在「${obj.label || obj.name}」下创建字段「${intent.fieldName}」(${intent.fieldType})`, { to: `/apps/${appId}/datamodeling`, label: "查看" });
          // 通知整页: 对象字段已变更, 让 DataModeling 等 UI 自动刷新
          window.dispatchEvent(new CustomEvent("mp:ontology-changed", { detail: { kind: "add_field", appId, objectId: obj.id } }));
        } catch (e: any) {
          updateLastAction("error", e?.message ?? String(e));
        }
        break;
      }

      case "create_object": {
        addMsg({ role: "assistant", content: `好的, 我来创建对象「${intent.objectName}」…`, action: { kind: "create_object", status: "running" } });
        try {
          await ontologyApi.createObject({
            app_id: appId,
            name: intent.objectName,
            label: intent.objectName,
            icon: "package",          // 后端 ontology 强制要求 icon, 缺此字段会 400
          });
          updateLastAction("success", `已创建对象「${intent.objectName}」`, { to: `/apps/${appId}/datamodeling`, label: "去配置字段" });
          window.dispatchEvent(new CustomEvent("mp:ontology-changed", { detail: { kind: "create_object", appId } }));
        } catch (e: any) {
          updateLastAction("error", e?.message ?? String(e));
        }
        break;
      }

      case "rename_app": {
        if (!app) { addMsg({ role: "assistant", content: "应用信息还没加载完, 请稍后再试" }); return; }
        addMsg({ role: "assistant", content: `好的, 我把应用名改为「${intent.newName}」…`, action: { kind: "update_app", status: "running" } });
        try {
          const updated = await appsApi.update(appId, { name: intent.newName });
          setApp(updated);
          updateLastAction("success", `应用名已更新为「${updated.name}」`);
          window.dispatchEvent(new CustomEvent("mp:app-changed", { detail: { kind: "rename_app", appId, app: updated } }));
        } catch (e: any) {
          updateLastAction("error", e?.message ?? String(e));
        }
        break;
      }

      case "update_description": {
        if (!app) { addMsg({ role: "assistant", content: "应用信息还没加载完" }); return; }
        addMsg({ role: "assistant", content: "好的, 我来更新应用描述…", action: { kind: "update_app", status: "running" } });
        try {
          const updated = await appsApi.update(appId, { description: intent.description });
          setApp(updated);
          updateLastAction("success", "应用描述已更新");
          window.dispatchEvent(new CustomEvent("mp:app-changed", { detail: { kind: "update_description", appId, app: updated } }));
        } catch (e: any) {
          updateLastAction("error", e?.message ?? String(e));
        }
        break;
      }

      case "publish": {
        const envLabel = intent.env === "prod" ? "生产" : intent.env === "staging" ? "预发" : "测试";
        addMsg({ role: "assistant", content: `好的, 我来把应用发布到 **${envLabel}** 环境…`, action: { kind: "publish", status: "running" } });
        try {
          const result = await appsApi.publish(appId);
          updateLastAction(
            "success",
            `已发布到 ${envLabel} 环境${result.published_url ? ` · 访问: ${result.published_url}` : ""}`,
            { to: `/apps/${appId}/publish`, label: "查看发布详情" },
          );
        } catch (e: any) {
          updateLastAction("error", e?.message ?? String(e));
        }
        break;
      }

      case "navigate": {
        addMsg({
          role: "assistant",
          content: `好的, 我带你去「${intent.label}」…`,
          action: { kind: "navigate", status: "success", link: { to: `/apps/${appId}/${intent.tab}`, label: "已打开" } },
        });
        setTimeout(() => navigate(`/apps/${appId}/${intent.tab}`), 200);
        break;
      }

      case "unknown": {
        addMsg({ role: "assistant", content: intent.reason });
        break;
      }
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    addMsg({ role: "user", content: text });
    setInput("");
    setBusy(true);
    try {
      // 1) 拿历史最近 N 条 + 当前 user 输入, 调 LLM, 流式更新消息气泡
      const history = messages.slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      const systemPrompt = buildSystemPrompt(app, wfName, wfRole, objects);

      const userMsgId = `pending-${Date.now()}`;
      // 在助手栏立刻插一条空消息, 流式往里灌
      setMessages(prev => [...prev, {
        id: userMsgId,
        role: "assistant",
        content: "",
        ts: Date.now(),
      }]);

      let fullReply = "";
      try {
        fullReply = await streamChatCompletion(
          [...history, { role: "user", content: text }],
          systemPrompt,
          (token) => {
            setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, content: (m.content || "") + token } : m));
          },
        );
      } catch (e) {
        // LLM 不可用 → 退到启发式意图识别 + 标注 "未连接 LLM"
        setMessages(prev => prev.map(m => m.id === userMsgId ? {
          ...m,
          content: `⚠️ LLM 暂不可用 (${e instanceof Error ? e.message : "未知错误"}), 已切换本地启发式引擎.`,
        } : m));
        const intent = recognizeIntent(text, app);
        await runIntent(intent);
        return;
      }

      // 2) 解析 fullReply 中的 tool call JSON (第一行 ```json ...```)
      let toolCall = parseToolCall(fullReply);

      // 兜底: 如果 LLM 解析不出来 (或解析出 chat/summary 但其实可以建模),
      // 还是过一遍本地启发式引擎, 命中"加字段/建对象/改名/发布"等意图就照样执行.
      if (!toolCall || /^(chat|summary|stats)$/.test(toolCall.action)) {
        const fallbackIntent = recognizeIntent(text, app);
        if (fallbackIntent.kind === "unknown") {
          // 真·聊天回答, 已经显示在气泡里了, 不执行动作
          return;
        }
        // 找到了一个真正可执行的动作, 用它覆盖 LLM 的输出
        if (!toolCall || toolCall.action === "chat" || toolCall.action === "summary") {
          // 提示用户: 已经按本地启发式识别
          setMessages(prev => prev.map(m => m.id === userMsgId ? {
            ...m,
            content: (m.content || "") + (m.content ? "\n\n" : "") + `🔧 本地引擎已识别动作, 正在执行…`,
          } : m));
          toolCall = intentToToolCall(fallbackIntent);
        }
      }

      // 3) 把"我正在做XX…"状态写在气泡末尾 (不清空, 让用户看到过程)
      const statusText = `\n\n*⚙️ 正在执行: ${describeAction(toolCall)}*`;
      setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, content: (m.content || "") + statusText } : m));

      // 4) 同步执行工具
      const intent = toIntent(toolCall, app);
      // 在执行前清掉 statusText 占位, 让结果替换
      setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, content: (m.content || "").replace(statusText, "").trimEnd() } : m));

      // 把"动作卡片"挂在助手气泡上 (action field)
      const cardTag = actionCard(toolCall);
      if (cardTag) {
        setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, action: { ...cardTag, status: "running" } } : m));
      }

      try {
        await runIntent(intent);
        // 标记动作卡片成功
        setMessages(prev => prev.map(m => m.id === userMsgId && m.action ? { ...m, action: { ...m.action!, status: "success" } } : m));
      } catch (e) {
        setMessages(prev => prev.map(m => m.id === userMsgId && m.action ? { ...m, action: { ...m.action!, status: "error", detail: e instanceof Error ? e.message : String(e) } } : m));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    // 嵌入式侧边面板: 父级需用 flex 布局, 面板作为右侧栏存在, 不浮在最上层
    // 三段式结构:
    //   1) <header> 固定 (flex-shrink-0)
    //   2) 消息流 flex-1 min-h-0 overflow-y-auto → 这一段滚动, 其余钉死
    //   3) <footer> 固定 (快捷指令 + 输入框, flex-shrink-0, 始终可见)
    <aside className="w-[400px] max-w-full shrink-0 bg-background border-l flex flex-col min-h-0 self-stretch overflow-hidden">
        {/* 头部 */}
        <header className="flex items-center justify-between px-4 py-3 border-b bg-primary shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`size-8 rounded-full bg-primary ${avatarMeta.gradient} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
              {avatarMeta.preview(wfName)}
            </div>
            <div className="min-w-0 flex-1">
              {renameOpen ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renameDraft.trim()) setWfName(renameDraft);
                    setRenameOpen(false);
                    setRenameDraft("");
                  }}
                >
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => setRenameOpen(false)}
                    onKeyDown={(e) => { if (e.key === "Escape") { setRenameOpen(false); setRenameDraft(""); } }}
                    className="h-6 text-xs px-1.5"
                    maxLength={16}
                  />
                  <Button type="submit" size="icon" variant="ghost" className="size-6">
                    <Check className="size-3" />
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  className="text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/60 rounded px-1 -ml-1 group"
                  onClick={() => { setRenameDraft(wfName); setRenameOpen(true); }}
                  title="点击重命名"
                >
                  <span className="truncate max-w-[180px]">{wfName}</span>
                  <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 shrink-0">AI</Badge>
                </button>
              )}
              <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                {wfRole} · {app?.name ?? "加载中…"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(s => !s)} className="size-7"
              title="设置">
              <Settings className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="size-7">
              <X className="size-4" />
            </Button>
          </div>
        </header>

        {/* 设置面板 */}
        {settingsOpen && (
          <div className="border-b bg-muted/40 px-4 py-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">头像样式</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WORKFORCE_AVATARS) as WorkforceAvatarKey[]).map(k => {
                  const meta = WORKFORCE_AVATARS[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setWfAvatar(k)}
                      className={
                        "size-9 rounded-full flex items-center justify-center text-white font-bold text-sm bg-primary " + meta.gradient +
                        (wfAvatar === k ? " ring-2 ring-offset-2 ring-violet-500" : " opacity-70 hover:opacity-100")
                      }
                      title={meta.key}
                    >
                      {meta.preview(wfName)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs">角色 / 定位</Label>
              <Input
                value={wfRole}
                onChange={(e) => setWfRole(e.target.value)}
                placeholder="如: 销售助手、运维专家"
                maxLength={32}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* 消息流 (只这一段滚动) */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3">
          {messages.map(m => (
            <MessageBubble key={m.id} msg={m} onLinkClick={() => onClose()} authorName={wfName} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="size-3 animate-spin" />「{wfName}」正在执行…
            </div>
          )}
        </div>

        {/* 快捷指令 (钉死底部) */}
        <div className="px-4 py-2 border-t bg-muted/30 shrink-0">
          <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
            <Wand2 className="size-3" /> 试试这些
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "统计这个应用",
              "给客户表加一个手机号字段",
              "发布到测试环境",
              "打开页面",
            ].map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs px-2 py-1 rounded-full border bg-background hover:border-violet-400 hover:text-violet-600 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 输入框 (始终可见) */}
        <div className="border-t p-3 shrink-0 bg-background">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="告诉数字员工你想做什么…"
              disabled={busy}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || busy}
              className="bg-primary hover:from-violet-600 hover:to-fuchsia-600">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
    </aside>
  );
}

/* ── 消息气泡 ── */
function MessageBubble({ msg, onLinkClick, authorName }: { msg: ChatMsg; onLinkClick: () => void; authorName?: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] space-y-1.5`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-violet-500" /> {authorName || "数字员工"}
          </div>
        )}
        <div className={
          "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words " +
          (isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm")
        }>
          {msg.content}
        </div>
        {msg.action && <ActionCard action={msg.action} onLinkClick={onLinkClick} />}
      </div>
    </div>
  );
}

/* ── Action 卡片 ── */
function ActionCard({ action, onLinkClick }: { action: NonNullable<ChatMsg["action"]>; onLinkClick: () => void }) {
  const navigate = useNavigate();
  const Icon =
    action.kind === "publish" ? Rocket :
    action.kind === "navigate" ? ExternalLink :
    action.kind === "create_field" ? Database :
    action.kind === "create_object" ? Database :
    action.kind === "update_app" ? Settings :
    BarChart3;
  const statusColor =
    action.status === "running" ? "border-violet-300 bg-primary" :
    action.status === "success" ? "border-green-300 bg-green-50" :
    "border-red-300 bg-red-50";
  const StatusIcon =
    action.status === "running" ? Loader2 :
    action.status === "success" ? CheckCircle2 :
    AlertCircle;
  const statusIconColor =
    action.status === "running" ? "text-violet-500 animate-spin" :
    action.status === "success" ? "text-green-600" :
    "text-red-600";

  return (
    <div className={`rounded-lg border p-2 ${statusColor}`}>
      <div className="flex items-center gap-2 text-xs">
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">
          {action.kind === "publish" ? "发布应用" :
           action.kind === "navigate" ? "导航" :
           action.kind === "create_field" ? "新增字段" :
           action.kind === "create_object" ? "创建对象" :
           action.kind === "update_app" ? "更新应用信息" :
           "应用统计"}
        </span>
        <StatusIcon className={`size-3.5 ml-auto shrink-0 ${statusIconColor}`} />
      </div>
      {action.detail && (
        <div className="mt-1 text-xs text-muted-foreground">{action.detail}</div>
      )}
      {action.link && action.status === "success" && (
        <button
          onClick={() => { navigate(action.link!.to); onLinkClick(); }}
          className="mt-1.5 text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          {action.link.label} <ExternalLink className="size-3" />
        </button>
      )}
    </div>
  );
}
