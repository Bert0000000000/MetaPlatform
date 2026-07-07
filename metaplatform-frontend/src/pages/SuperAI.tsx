import { useState, useRef, useEffect, useCallback } from "react";
import { agentsApi, knowledgeApi } from "@/lib/api";
import type { Agent, KnowledgeDocument } from "@/lib/api";
import { llmApi, type ChatMessage } from "@/lib/llm-api";
import { dispatchApi, type DispatchResult } from "@/lib/dispatch-api";
import { useNavigate } from "react-router-dom";
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Bot as BotIcon, ListChecks, BookOpen, Smartphone, BarChart3, GitBranch, FileEdit, Search as SearchIcon, TrendingUp, RefreshCw, FileText, Ruler, Briefcase, ScrollText, Scale, Clock, Trash2, X, Loader2, Image as ImageIcon, Mic, MicOff, Paperclip, FileSpreadsheet, File as FileIcon, Camera, Volume2, ArrowRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ── Icon resolver: API icon string → Lucide component ── */
const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, TrendingUp, RefreshCw, FileText, Sparkles, MessageSquare,
  Bot, User, Smartphone, GitBranch, FileEdit, BookOpen,
};
function resolveAgentIcon(iconName?: string): React.ElementType {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return Bot;
}

/* ─────────────────── Types ─────────────────── */
interface Attachment {
  id: string;
  type: "image" | "document" | "voice";
  name: string;
  size?: string;
  url?: string; // data URL for images
  duration?: string; // for voice
  mimeType?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  attachments?: Attachment[];
  dispatchLinks?: { label: string; path: string }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

/* ─────────────────── Initial messages ─────────────────── */
const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "你好，我是 SuperAI\n我可以帮你：\n- 建应用 / 建对象 / 建流程\n- 查数据 / 分析指标\n- 启动智能体 / 调度任务\n- 回答业务问题\n\n请告诉我你想做什么？",
  ts: formatTime(),
};

function formatTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

/* ─────────────────── Suggestions ─────────────────── */
const SUGGESTIONS = [
  { icon: Smartphone, text: "帮我建一个请假审批应用", category: "建应用" },
  { icon: BarChart3, text: "上个月的订单总额是多少？", category: "查数据" },
  { icon: GitBranch, text: "梳理采购流程并发现瓶颈", category: "流程分析" },
  { icon: Bot, text: "启动财务月结智能体", category: "智能体" },
  { icon: FileEdit, text: "起草一份客户拜访纪要", category: "内容生成" },
  { icon: SearchIcon, text: "从合同库中查找应收账款条款", category: "知识检索" },
];

/* ─────────────────── Mock task data ─────────────────── */
const RECENT_TASKS_FALLBACK = [
  { id: 1, title: "生成客户分层标签", agent: "数据分析智能体", status: "completed", time: "2 分钟前", result: "生成 1,234 个客户标签" },
  { id: 2, title: "起草 2026 Q3 销售预测报告", agent: "财务分析智能体", status: "running", time: "进行中", result: "" },
  { id: 3, title: "解析上传的采购合同 PDF", agent: "合同审查智能体", status: "completed", time: "1 小时前", result: "提取 18 个关键条款" },
  { id: 4, title: "为「客户管理」应用生成 3 张报表", agent: "VibeCoding", status: "failed", time: "3 小时前", result: "权限不足" },
  { id: 5, title: "推荐本月最佳供应商", agent: "供应链智能体", status: "completed", time: "昨天", result: "Top 5 已排序" },
];

const KNOWLEDGE_DOCS_FALLBACK = [
  { title: "MetaPlatform 用户手册", type: "PDF", size: "12.4 MB", updated: "今天", category: "产品文档", icon: BookOpen },
  { title: "API 接口规范 v2.1", type: "Markdown", size: "384 KB", updated: "3 天前", category: "技术规范", icon: Ruler },
  { title: "BPMN 2.0 节点参考", type: "Web", size: "—", updated: "1 周前", category: "标准规范", icon: Briefcase },
  { title: "销售话术库（已索引）", type: "向量库", size: "8.2K 条", updated: "实时", category: "业务知识", icon: ScrollText },
];



/* ─────────────────── ChatTab ─────────────────── */
interface ChatTabProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  agentPrompt?: string | null;
  onAgentPromptConsumed?: () => void;
}

function ChatTab({ messages, setMessages, agentPrompt, onAgentPromptConsumed }: ChatTabProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dispatchingAgents, setDispatchingAgents] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  /* Auto-scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* Handle agent prompt injection */
  useEffect(() => {
    if (agentPrompt) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: agentPrompt, ts: formatTime() },
      ]);
      onAgentPromptConsumed?.();
    }
  }, [agentPrompt, setMessages, onAgentPromptConsumed]);

  /* Recording timer */
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
    }
    return () => { if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };
  }, [isRecording]);

  function formatRecordingTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  /* Image upload handler */
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const att: Attachment = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "image",
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          url: reader.result as string,
          mimeType: file.type,
        };
        setPendingAttachments((prev) => [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  /* Document upload handler */
  function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const sizeKb = file.size / 1024;
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toFixed(1)} KB`;
      const att: Attachment = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "document",
        name: file.name,
        size: sizeStr,
        mimeType: file.type || `application/${ext}`,
      };
      setPendingAttachments((prev) => [...prev, att]);
    });
    e.target.value = "";
  }

  /* Voice recording toggle (mock) */
  function toggleRecording() {
    if (isRecording) {
      setIsRecording(false);
      // Mock transcription
      const voiceAtt: Attachment = {
        id: `voice-${Date.now()}`,
        type: "voice",
        name: `语音消息_${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}.webm`,
        duration: formatRecordingTime(recordingTime),
        size: `${(recordingTime * 16).toFixed(0)} KB`,
      };
      setPendingAttachments((prev) => [...prev, voiceAtt]);
      setInput((prev) => prev || "（语音消息已录制，请发送或补充文字说明）");
    } else {
      setIsRecording(true);
    }
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function getDocIcon(name: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return FileIcon;
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return FileSpreadsheet;
    return FileText;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content && pendingAttachments.length === 0) return;
    if (isTyping) return;

    const userMsg: Message = {
      role: "user",
      content: content || "（发送了附件）",
      ts: formatTime(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
    };
    setMessages((m) => [...m, userMsg]);
    if (!text) setInput("");
    setPendingAttachments([]);
    setIsTyping(true);

    try {
      let reply: string;
      let dispatchedTo: string[] = [];
      let dispatchLinks: { label: string; path: string }[] = [];

      // Step 1: Try Agent Dispatch (cross-module orchestration)
      try {
        setDispatchingAgents(["正在识别意图..."]);
        const dispatchResult = await dispatchApi.dispatch(content);

        if (dispatchResult.type === "dispatch" && dispatchResult.agents.length > 0) {
          // Successfully dispatched to one or more agents
          setDispatchingAgents(dispatchResult.agents.map((a) => a.name));
          dispatchedTo = dispatchResult.agents.map((a) => a.name);
          reply = dispatchResult.response || "操作已完成。";

          // Extract navigation links from results
          for (const r of dispatchResult.results) {
            if (r.link) {
              const moduleNames: Record<string, string> = {
                apps: "应用", ontology: "本体对象", processes: "流程设计器",
                data: "数据中心", knowledge: "知识库", agents: "数字员工",
              };
              dispatchLinks.push({
                label: moduleNames[r.module] || r.module,
                path: r.link,
              });
            }
          }

          // Add dispatch info to reply
          const agentNames = dispatchedTo.join("、");
          const dispatchPrefix = `[调度 ${agentNames}] `;
          reply = dispatchPrefix + reply;

          if (dispatchLinks.length > 0) {
            reply += "\n\n相关链接：" + dispatchLinks.map((l) => l.label).join(" / ");
          }
        } else {
          // No agent matched — fall through to LLM
          throw new Error("No agent matched");
        }
      } catch (dispatchError) {
        // Step 2: Try LLM API
        try {
          const systemMessage: ChatMessage = {
            role: "system",
            content: "你是 MetaPlatform 的 SuperAI 助手，帮助企业用户建应用、查数据、分析流程、生成内容、调度智能体。请用中文回复，简洁专业。",
          };

          const allMessages = [...messages, userMsg];
          const chatMessages: ChatMessage[] = [
            systemMessage,
            ...allMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ];

          const response = await llmApi.chat(chatMessages, {
            // Don't pin a model — backend uses the operator-configured model
            // (system_config.llm_model) by default. Pinning to "gpt-4o-mini"
            // would shadow Qwen / DeepSeek / etc. that the operator saved
            // in [后台管理 → AI Gateway 配置].
            temperature: 0.7,
            maxTokens: 1024,
          });
          reply = response.content;
        } catch (llmError) {
          // Step 3: Handle failure
          console.warn("[SuperAI] LLM API unavailable:", llmError);
          const reason = llmError instanceof Error ? llmError.message : String(llmError);
          if (userMsg.attachments?.some((a) => a.type === "image")) {
            reply = `已收到你上传的图片。\n\n（AI 调用失败：${reason}\n请到【后台管理 → AI Gateway 配置】检查 Base URL / API Key / 模型名称。）`;
          } else if (userMsg.attachments?.some((a) => a.type === "voice")) {
            reply = `已收到你的语音消息。语音转文字功能正在处理中。\n\n（AI 调用失败：${reason}）`;
          } else if (userMsg.attachments?.some((a) => a.type === "document")) {
            const docNames = userMsg.attachments.filter((a) => a.type === "document").map((a) => a.name).join("、");
            reply = `已收到文档：${docNames}\n\n（AI 调用失败：${reason}）`;
          } else {
            // For text-only messages, surface the underlying error so the
            // user can actually tell what's wrong instead of seeing a
            // generic "service unavailable". Includes the hint to flip
            // the gateway to mock:// mode for local testing.
            reply = `抱歉，AI 调用失败：${reason}\n\n提示：把【后台管理 → AI Gateway 配置】的 Base URL 改为 mock://local 可进入 Mock 模式（无需真实 LLM 也能跑通），或填入能支持当前已配模型的 Provider 凭证。`;
          }
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: reply, ts: formatTime(), dispatchLinks }]);
    } finally {
      setIsTyping(false);
      setDispatchingAgents([]);
    }
  }

  /* Attachment preview component */
  function AttachmentPreview({ attachment, isOwn }: { attachment: Attachment; isOwn: boolean }) {
    if (attachment.type === "image" && attachment.url) {
      return (
        <div className="rounded-lg overflow-hidden border max-w-[200px] mb-1">
          <img src={attachment.url} alt={attachment.name} className="w-full h-auto max-h-[150px] object-cover" />
          <div className={`px-2 py-1 text-[10px] ${isOwn ? "bg-primary/20" : "bg-muted"}`}>
            {attachment.name} ({attachment.size})
          </div>
        </div>
      );
    }
    if (attachment.type === "voice") {
      return (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-1 ${isOwn ? "bg-primary/10" : "bg-muted/50"}`}>
          <Volume2 className="size-4 text-primary shrink-0" />
          <div className="flex gap-[2px] items-end h-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-[3px] bg-primary/60 rounded-full" style={{ height: `${4 + Math.random() * 12}px` }} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground ml-1">{attachment.duration}</span>
        </div>
      );
    }
    if (attachment.type === "document") {
      const DocIcon = getDocIcon(attachment.name);
      return (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-1 ${isOwn ? "bg-primary/10" : "bg-muted/50"}`}>
          <DocIcon className="size-5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{attachment.name}</div>
            <div className="text-[10px] text-muted-foreground">{attachment.size}</div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex flex-col gap-4" style={{ maxWidth: "900px" }}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </div>
              )}
              <div className={`max-w-[70%] flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {/* Attachments display */}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mb-1 space-y-1">
                    {m.attachments.map((att) => (
                      <AttachmentPreview key={att.id} attachment={att} isOwn={m.role === "user"} />
                    ))}
                  </div>
                )}
                <Card className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}>
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    {m.dispatchLinks && m.dispatchLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
                        {m.dispatchLinks.map((link, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => navigate(link.path)}
                          >
                            <ArrowRight className="size-3" />
                            {link.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {m.ts && <span className="text-xs text-muted-foreground mt-1">{m.ts}</span>}
              </div>
              {m.role === "user" && (
                <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot className="size-4" />
              </div>
              <Card className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>SuperAI 正在思考...</span>
                  </div>
                  {dispatchingAgents.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">调度中：</span>
                      {dispatchingAgents.map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1">
                          <Loader2 className="size-2.5 animate-spin" />
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="mx-auto" style={{ maxWidth: "900px" }}>
          {/* Recording indicator */}
          {isRecording && (
            <div className="mb-2 flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <div className="size-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600">语音输入中...</span>
              <span className="text-sm text-red-500 font-mono">{formatRecordingTime(recordingTime)}</span>
              <div className="flex gap-[2px] items-end h-5 flex-1">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-red-400 rounded-full animate-pulse"
                    style={{
                      height: `${4 + Math.random() * 16}px`,
                      animationDelay: `${i * 50}ms`,
                      animationDuration: `${300 + Math.random() * 400}ms`,
                    }}
                  />
                ))}
              </div>
              <Button size="sm" variant="destructive" onClick={toggleRecording}>
                <MicOff className="size-3 mr-1" /> 停止
              </Button>
            </div>
          )}

          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex gap-2 flex-wrap">
              {pendingAttachments.map((att) => (
                <div key={att.id} className="relative group">
                  {att.type === "image" && att.url ? (
                    <div className="w-16 h-16 rounded border overflow-hidden">
                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : att.type === "voice" ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded border text-xs">
                      <Mic className="size-3 text-primary" />
                      <span>{att.duration}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded border text-xs max-w-[140px]">
                      {(() => { const DocIcon = getDocIcon(att.name); return <DocIcon className="size-3 text-blue-500 shrink-0" />; })()}
                      <span className="truncate">{att.name}</span>
                    </div>
                  )}
                  <button
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeAttachment(att.id)}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-3">
              <div className="flex items-end gap-2">
                {/* Multi-modal input buttons */}
                <div className="flex flex-col gap-1">
                  {/* Hidden file inputs */}
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx" multiple className="hidden" onChange={handleDocUpload} />

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="上传图片"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isTyping}
                    >
                      <ImageIcon className="size-4 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button
                      variant={isRecording ? "destructive" : "ghost"}
                      size="icon"
                      className="size-7"
                      title={isRecording ? "停止录音" : "语音输入"}
                      onClick={toggleRecording}
                      disabled={isTyping}
                    >
                      {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4 text-muted-foreground hover:text-primary" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="上传文档 (PDF/Word/Excel)"
                      onClick={() => docInputRef.current?.click()}
                      disabled={isTyping}
                    >
                      <Paperclip className="size-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </div>
                </div>

                <textarea
                  className="flex-1 resize-none border-0 bg-transparent p-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                  placeholder="问我任何问题...(按 Enter 发送，Shift+Enter 换行)"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={isTyping || isRecording}
                />
                <Button onClick={() => send()} size="icon" aria-label="发送" disabled={isTyping || isRecording}>
                  {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span className="text-muted-foreground shrink-0">智能建议：</span>
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    className="hover:underline text-foreground disabled:opacity-50"
                    disabled={isTyping}
                  >
                    <s.icon className="size-3 mr-1 inline" />{s.text}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── AgentTab ─────────────────── */
interface AgentTabProps {
  onActivateAgent: (prompt: string) => void;
}

/* 本地 fallback 智能体数据（API 不可用时） */
const FALLBACK_AGENTS = [
  { id: "data", name: "数据分析智能体", description: "查数据 / 出报表 / 发现异常", icon: "BarChart3", prompt: "你好，我已激活「数据分析智能体」，我可以帮你查询数据、生成报表、发现异常指标。请告诉我你想分析什么？" },
  { id: "report", name: "报表生成智能体", description: "自动编排 BI 报表", icon: "TrendingUp", prompt: "你好，我已激活「报表生成智能体」，我可以自动编排 BI 报表并可视化。请告诉我想生成什么报表？" },
  { id: "process", name: "流程分析智能体", description: "识别瓶颈 / 给出优化建议", icon: "RefreshCw", prompt: "你好，我已激活「流程分析智能体」，我可以识别流程瓶颈并给出优化建议。请告诉我想分析哪条流程？" },
  { id: "doc", name: "文档撰写智能体", description: "起草合同 / 会议纪要 / 周报", icon: "FileText", prompt: "你好，我已激活「文档撰写智能体」，我可以帮你起草合同、会议纪要、周报等文档。请告诉我想写什么？" },
  { id: "code", name: "VibeCoding 智能体", description: "自然语言生成完整应用", icon: "Sparkles", prompt: "你好，我已激活「VibeCoding 智能体」，我可以用自然语言帮你生成完整应用。请描述你想要的应用？" },
  { id: "support", name: "客服智能体", description: "7x24 答疑 / 工单预处理", icon: "MessageSquare", prompt: "你好，我已激活「客服智能体」，我可以 7x24 小时答疑并预处理工单。请问有什么可以帮你的？" },
];

interface AgentWithPrompt {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
}

function AgentTab({ onActivateAgent }: AgentTabProps) {
  const [agents, setAgents] = useState<AgentWithPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await agentsApi.list();
        if (!cancelled && data.length > 0) {
          // 将 API agent 映射为带 prompt 的本地格式
          const mapped = data.map((a: Agent) => ({
            id: a.id,
            name: a.name,
            description: a.description || a.type || "",
            icon: a.type || "Bot",
            prompt: `你好，我已激活「${a.name}」。${a.description || "请问有什么可以帮你的？"}`,
          }));
          setAgents(mapped);
        } else if (!cancelled) {
          setAgents(FALLBACK_AGENTS);
        }
      } catch {
        if (!cancelled) setAgents(FALLBACK_AGENTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold">智能体广场</h1>
          <p className="text-xs text-muted-foreground">SuperAI 内置 6 类业务智能体，可一键唤起</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> 加载智能体...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => {
              const Icon = resolveAgentIcon(a.icon);
              return (
                <Card key={a.id} className="hover:border-primary cursor-pointer transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Icon className="size-5" />
                      <Badge variant="secondary">内置</Badge>
                    </div>
                    <CardTitle className="text-sm mt-1">{a.name}</CardTitle>
                    <CardDescription>{a.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onActivateAgent(a.prompt)}
                    >
                      <BotIcon className="size-3 mr-1" />
                      唤起
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
}

/* ─────────────────── TasksTab ─────────────────── */
function TasksTab() {
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskAgent, setNewTaskAgent] = useState("");
  const [newTaskAgentId, setNewTaskAgentId] = useState<string>("");
  const [agentsList, setAgentsList] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState(RECENT_TASKS_FALLBACK);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const agents = await agentsApi.list();
        if (cancelled) return;
        setAgentsList(agents.map((a) => ({ id: a.id, name: a.name })));
        const agentNameMap: Record<string, string> = {};
        agents.forEach((a) => { agentNameMap[a.id] = a.name; });
        const allTasks = await Promise.all(
          agents.map((a) => agentsApi.listTasks(a.id).catch(() => []))
        );
        if (cancelled) return;
        const mapped = allTasks.flat().map((t) => ({
          id: t.id,
          agent_id: t.agent_id,
          title: t.title,
          status: t.status,
          agent: agentNameMap[t.agent_id] || t.agent_id,
          output: t.output,
          result: t.output || "",
          time: "",
        }));
        if (mapped.length > 0) setTasks(mapped);
        else setTasks(RECENT_TASKS_FALLBACK);
      } catch {
        if (!cancelled) setTasks(RECENT_TASKS_FALLBACK);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">智能体任务</h1>
          <p className="text-sm text-muted-foreground">SuperAI 调度的所有任务，含历史记录</p>
        </div>
        <Button size="sm" onClick={() => setNewTaskDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新建任务
        </Button>
      </div>

      {tasksLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> 加载任务...
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ListChecks className="size-8 mb-2" />
          <p className="text-sm">暂无任务</p>
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">任务</th>
                <th className="px-4 py-2 font-medium">智能体</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">结果</th>
                <th className="px-4 py-2 font-medium text-right">时间</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.agent}</td>
                  <td className="px-4 py-3">
                    {t.status === "completed" && <Badge variant="secondary" className="text-green-600">已完成</Badge>}
                    {t.status === "running" && <Badge className="bg-blue-500">进行中</Badge>}
                    {t.status === "failed" && <Badge variant="destructive">失败</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {"agent_id" in t ? (t.output || "已完成") : (t.result || "—")}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{t.time || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      {/* New Task Dialog */}
      <Dialog open={newTaskDialogOpen} onOpenChange={setNewTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5" /> 新建智能体任务
            </DialogTitle>
            <DialogDescription>创建一个新的智能体执行任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>任务名称</Label>
              <Input
                placeholder="如：分析上月销售数据"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>指定智能体</Label>
              <div className="grid grid-cols-2 gap-2">
                {agentsList.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => { setNewTaskAgent(agent.name); setNewTaskAgentId(agent.id); }}
                    className={`text-left rounded border p-2 text-xs transition-all hover:border-primary ${
                      newTaskAgent === agent.name ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    {agent.name}
                  </button>
                ))}
                {agentsList.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-2">加载中...</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskDialogOpen(false)}>取消</Button>
            <Button onClick={() => setNewTaskDialogOpen(false)} disabled={!newTaskName.trim()}>
              <Plus className="size-3 mr-1" /> 创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────── KnowledgeTab ─────────────────── */
const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  PDF: FileText,
  Markdown: BookOpen,
  Web: Briefcase,
  向量库: ScrollText,
};

function KnowledgeTab() {
  const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
  const [uploadDocDialogOpen, setUploadDocDialogOpen] = useState(false);
  const [vectorDbType, setVectorDbType] = useState("");
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState(KNOWLEDGE_DOCS_FALLBACK);
  const [docsLoading, setDocsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await knowledgeApi.listDocuments();
        if (cancelled) return;
        const mapped = data.map((d) => ({
          title: d.title,
          type: d.type,
          size: d.file_size ? `${(d.file_size / 1024 / 1024).toFixed(1)} MB` : "—",
          updated: d.status === "indexed" ? "已索引" : d.status,
          category: d.category || "未分类",
          icon: DOC_TYPE_ICONS[d.type] || FileText,
        }));
        if (mapped.length > 0) setDocuments(mapped);
        else setDocuments(KNOWLEDGE_DOCS_FALLBACK);
      } catch {
        if (!cancelled) setDocuments(KNOWLEDGE_DOCS_FALLBACK);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const docCount = documents.length;
  const dataSources = [...new Set(documents.map((d) => d.category))].length;
  const knowledgeEntries = documents.length * 80;
  const docTypes = [...new Set(documents.map((d) => d.type))];

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">知识中心</h1>
          <p className="text-sm text-muted-foreground">SuperAI 检索增强（RAG）的私有知识库</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setVectorDialogOpen(true)}>
            接入向量库
          </Button>
          <Button size="sm" onClick={() => setUploadDocDialogOpen(true)}>
            <Plus className="size-3 mr-1" />
            上传文档
          </Button>
        </div>
      </div>

      {docsLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> 加载知识库...
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">{docCount}</div>
            <div className="text-xs text-muted-foreground">文档总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">{knowledgeEntries.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">已索引片段</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">{dataSources}</div>
            <div className="text-xs text-muted-foreground">数据源</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">{docTypes.length} 类</div>
            <div className="text-xs text-muted-foreground">文档类型</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已接入的知识源</CardTitle>
          <CardDescription>支持文档上传、网页抓取、数据库同步、API 接入</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary cursor-pointer">
                <d.icon className="size-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.category} · {d.type} · {d.size} · 更新于 {d.updated}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Vector DB Connection Dialog */}
      <Dialog open={vectorDialogOpen} onOpenChange={setVectorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="size-5" /> 接入向量库
            </DialogTitle>
            <DialogDescription>配置向量数据库连接，用于 RAG 知识检索</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>向量数据库类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "milvus", label: "Milvus" },
                  { value: "pinecone", label: "Pinecone" },
                  { value: "qdrant", label: "Qdrant" },
                  { value: "weaviate", label: "Weaviate" },
                ].map((db) => (
                  <button
                    key={db.value}
                    type="button"
                    onClick={() => setVectorDbType(db.value)}
                    className={`text-left rounded border p-3 text-sm transition-all hover:border-primary ${
                      vectorDbType === db.value ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    {db.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>连接地址</Label>
              <Input placeholder="http://localhost:19530" />
            </div>
            <div className="space-y-2">
              <Label>Collection 名称</Label>
              <Input placeholder="knowledge_base" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVectorDialogOpen(false)}>取消</Button>
            <Button onClick={() => setVectorDialogOpen(false)} disabled={!vectorDbType}>
              接入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDocDialogOpen} onOpenChange={setUploadDocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5" /> 上传文档
            </DialogTitle>
            <DialogDescription>上传文档到知识库，支持 PDF、Word、Markdown 等格式</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <FileText className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">拖放文档到此处，或点击选择文件</p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.md,.txt,.csv"
                className="max-w-xs mx-auto"
                onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
              />
              {docUploadFile && (
                <p className="text-xs text-primary mt-2">已选择: {docUploadFile.name}</p>
              )}
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              支持格式: PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、CSV。单文件最大 50MB
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDocDialogOpen(false); setDocUploadFile(null); }}>取消</Button>
            <Button onClick={() => { setUploadDocDialogOpen(false); setDocUploadFile(null); }} disabled={!docUploadFile}>
              <Plus className="size-3 mr-1" /> 上传并索引
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────── History Sidebar ─────────────────── */
interface HistorySidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (conv: Conversation) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function HistorySidebar({ conversations, currentId, onSelect, onDelete, onClose }: HistorySidebarProps) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l z-40 flex flex-col shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">对话历史</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="size-8 mb-2" />
            <p className="text-sm">暂无历史对话</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                  conv.id === currentId ? "bg-muted border" : ""
                }`}
                onClick={() => onSelect(conv)}
              >
                <MessageSquare className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {conv.messages.length} 条消息 · {conv.createdAt}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Main SuperAIPage ─────────────────── */
export function SuperAIPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [activeTab, setActiveTab] = useState("chat");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);

  /* Save current conversation before switching */
  const saveCurrentConversation = useCallback(() => {
    if (messages.length <= 1) return; // Don't save empty conversations
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 30) || "新对话";
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    if (currentConvId) {
      // Update existing
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConvId ? { ...c, messages, title } : c))
      );
    } else {
      // Save as new
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        title,
        messages,
        createdAt: dateStr,
      };
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConvId(newConv.id);
    }
  }, [messages, currentConvId]);

  /* New conversation */
  function handleNewConversation() {
    saveCurrentConversation();
    setMessages([WELCOME_MESSAGE]);
    setCurrentConvId(null);
    setActiveTab("chat");
  }

  /* Select conversation from history */
  function handleSelectConversation(conv: Conversation) {
    // Save current first
    if (messages.length > 1) {
      saveCurrentConversation();
    }
    setMessages(conv.messages);
    setCurrentConvId(conv.id);
    setShowHistory(false);
    setActiveTab("chat");
  }

  /* Delete conversation */
  function handleDeleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === currentConvId) {
      setMessages([WELCOME_MESSAGE]);
      setCurrentConvId(null);
    }
  }

  /* Activate agent - switch to chat and inject prompt */
  function handleActivateAgent(prompt: string) {
    saveCurrentConversation();
    setMessages([WELCOME_MESSAGE]);
    setCurrentConvId(null);
    setAgentPrompt(prompt);
    setActiveTab("chat");
  }

  /* Agent prompt consumed callback */
  const handleAgentPromptConsumed = useCallback(() => {
    setAgentPrompt(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            SuperAI
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI 对话入口 · Cmd+K 全局唤起</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="size-3 mr-1" />
            历史
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{conversations.length}</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewConversation}>
            <Plus className="size-3 mr-1" />
            新对话
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <div className="border-b bg-background px-6">
              <TabsList className="h-11 bg-transparent">
                <TabsTrigger value="chat" className="gap-1.5 data-[state=active]:bg-primary/10">
                  <MessageSquare className="size-3.5" /> 对话
                </TabsTrigger>
                <TabsTrigger value="agent" className="gap-1.5 data-[state=active]:bg-primary/10">
                  <Bot className="size-3.5" /> 智能体
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-primary/10">
                  <ListChecks className="size-3.5" /> 任务
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="gap-1.5 data-[state=active]:bg-primary/10">
                  <BookOpen className="size-3.5" /> 知识中心
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
              <ChatTab
                messages={messages}
                setMessages={setMessages}
                agentPrompt={agentPrompt}
                onAgentPromptConsumed={handleAgentPromptConsumed}
              />
            </TabsContent>
            <TabsContent value="agent" className="flex-1 m-0 overflow-y-auto">
              <AgentTab onActivateAgent={handleActivateAgent} />
            </TabsContent>
            <TabsContent value="tasks" className="flex-1 m-0 overflow-y-auto">
              <TasksTab />
            </TabsContent>
            <TabsContent value="knowledge" className="flex-1 m-0 overflow-y-auto">
              <KnowledgeTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* History sidebar */}
        {showHistory && (
          <HistorySidebar
            conversations={conversations}
            currentId={currentConvId}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}
