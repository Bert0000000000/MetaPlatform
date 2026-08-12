import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Welcome } from '@ant-design/x';
import {
  Typography,
  Tooltip,
  Select,
  Switch,
  Upload,
  Image,
  Toast,
  Input,
  Slider,
} from '@douyinfe/semi-ui';
import type { FileItem } from '@douyinfe/semi-ui/lib/es/upload';
import {
  RobotOutlined,
  UserOutlined,
  BookOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  DeleteOutlined,
  PaperClipOutlined,
  SendOutlined,
  CopyOutlined,
  ReloadOutlined,
  LikeOutlined,
  DislikeOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { streamChat, listMultimodalModels, multimodalUploadChat } from '@/api/superai/chat';
import { listKnowledgeBases, search as ragSearch } from '@/api/superai/rag';
import { semanticQuery as ontSemanticQuery } from '@/api/superai/ontology';
import {
  listConversations,
  createConversation,
  deleteConversation,
  toggleFavorite,
  getHistory,
} from '@/api/superai/conversations';
import { MarkdownRenderer } from '@mate/shared';
import KnowledgeGraph from './components/KnowledgeGraph';
import ActionMatchCard from './components/ActionPanel';
import EvidencePanel from './components/EvidencePanel';
import { matchAction } from '@/api/superai/actions';
import type {
  ChatSession,
  ChatMessage,
  Citation,
  Claim,
  Evidence,
  GraphData,
  KnowledgeBase,
  ChatImage,
  MultimodalModel,
  ActionResult,
} from '@/api/superai/types';

const UNIFIED_SYSTEM_PROMPT = `你是 Mate Platform 的智能助手 SuperAI。你会自动识别用户意图并用最合适的方式回答：

- 普通问答：用专业、简洁的中文回答，使用 Markdown 格式。
- 数据分析：当用户描述数据需求时，帮助生成 SQL 并解释。
- 知识图谱：当用户查询实体关系时，结合 Ontology 知识图谱回答。
- 代码生成：当用户需要表单/流程/代码时，生成配置和代码片段。
- 任务编排：当用户描述复杂任务时，拆解步骤并给出执行方案。

始终使用 Markdown 格式，支持标题、列表、代码块、表格等。回答要专业、准确、可溯源。

在回答的**最末尾**输出一个 JSON 块，列出本次回答的 2-4 条关键论断。格式（不要把 JSON 包在代码块里，直接输出）：
{"claims":[{"content":"论断内容","type":"FACT|INFERENCE|RECOMMENDATION","confidence":0.9}]}
type 用 FACT（事实，可直接验证）、INFERENCE（推断，基于推理）、RECOMMENDATION（建议/行动）。没有依据时不要硬编造论断。`;

const WELCOME_PROMPTS = [
  '什么是 Ontology 本体引擎？',
  '按部门统计本月销售额',
  '给合同快到期的客户发送续签提醒',
  '生成一个客户信息登记表单',
];

const MAX_CONTEXT_TURNS = 10;

// ---- 结构化证据（Claims / Evidence）辅助 ----

/** 从回答末尾解析 claims JSON 块，返回剥离后的正文与 claims。 */
function extractClaims(content: string): { content: string; claims: Claim[] } {
  const claims: Claim[] = [];
  // 优先匹配 ```json ... ``` 围栏，其次匹配末尾 JSON 对象
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : content.match(/\{\s*"claims"\s*:[\s\S]*?\}\s*$/)?.[0];
  if (raw) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed?.claims)) {
        for (const c of parsed.claims) {
          if (c && typeof c.content === 'string' && c.content.trim()) {
            const type = c.type === 'FACT' || c.type === 'RECOMMENDATION' ? c.type : 'INFERENCE';
            const confidence = Number(c.confidence);
            claims.push({
              content: c.content.trim(),
              type,
              confidence: Number.isFinite(confidence) && confidence > 0 ? Math.min(confidence, 1) : undefined,
            });
          }
        }
      }
    } catch {
      /* 解析失败则忽略 claims */
    }
  }
  let cleaned = content;
  if (fence) {
    cleaned = content.replace(fence[0], '').replace(/\n+$/, '').trim();
  } else if (claims.length > 0) {
    cleaned = content.replace(/\{\s*"claims"\s*:[\s\S]*?\}\s*$/, '').replace(/\n+$/, '').trim();
  }
  return { content: cleaned, claims };
}

/** 知识库引用（Citation）→ 文档型证据（DOCUMENT）。 */
function citationsToEvidence(citations: Citation[]): Evidence[] {
  return citations
    .filter((c) => c && c.title)
    .map((c) => ({
      evidenceId: c.id,
      type: 'DOCUMENT' as const,
      ref: c.url || c.title,
      title: c.title,
      score: c.score,
      fragment: c.snippet,
    }));
}

/** Ontology 图谱 → 本体对象证据：关系 + 对应的数据（字段）+ 数据来源（数据资产/D 层/域）。 */
function graphToEvidence(graph: GraphData): Evidence[] {
  const items: Evidence[] = [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const node of graph.nodes) {
    if (node.type !== 'entity' || !node.data) continue;
    const d = node.data;
    const rels = (graph.edges ?? [])
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const otherId = e.source === node.id ? e.target : e.source;
        const other = nodeById.get(otherId);
        return other ? `${other.label}（${e.label || '关联'}）` : '';
      })
      .filter(Boolean);
    const fields = Array.isArray(d.fields) && d.fields.length > 0 ? d.fields.slice(0, 5).join(', ') : '';
    const source = [d.dataSource, d.layer, d.domain].filter(Boolean).join(' · ');
    const frag = [
      rels.length > 0 ? `关系：${rels.join('、')}` : '',
      fields ? `数据：${fields}` : '',
      source ? `来源：${source}` : '',
    ]
      .filter(Boolean)
      .join('；');
    if (!frag) continue;
    items.push({
      type: 'ONTOLOGY_OBJECT' as const,
      ref: node.id,
      title: node.label,
      fragment: frag,
    });
  }
  return items;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

function beforeUpload(file: File): boolean {
  const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type);
  if (!isAllowedType) {
    Toast.error('仅支持 png、jpeg、webp 格式的图片');
  }
  const isLt5M = file.size / 1024 / 1024 < MAX_IMAGE_SIZE_MB;
  if (!isLt5M) {
    Toast.error('单张图片不能超过 5MB');
  }
  return isAllowedType && isLt5M;
}

function createSession(title = '新对话'): ChatSession {
  return {
    id: generateId(),
    title,
    mode: 'chat',
    messages: [],
    updatedAt: now(),
    favorite: false,
  };
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    status: 'success',
    createdAt: now(),
    ...overrides,
  };
}

function isBackendConversation(id: string): boolean {
  return id.startsWith('conv-');
}

function conversationToSession(
  conv: import('@/api/superai/types').Conversation,
  messages: ChatMessage[] = [],
): ChatSession {
  return {
    id: conv.id,
    title: conv.title || '新对话',
    mode: conv.mode,
    messages,
    updatedAt: conv.updatedAt || now(),
    favorite: conv.favorite,
  };
}

function CitationList({ citations }: { citations?: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      <Typography.Text style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        📚 参考来源：
      </Typography.Text>
      {citations.map((c) => (
        <Tooltip key={c.id} content={c.snippet} position="topLeft">
          <span
            style={{
              display: 'inline-block',
              cursor: 'pointer',
              maxWidth: 200,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {c.title} ({c.score}%)
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

/** 思考过程折叠组件 */
function ThinkingSection({ content, duration }: { content?: string; duration?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return null;
  return (
    <div>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--muted-foreground)',
          cursor: 'pointer',
          padding: '8px 0 4px',
          userSelect: 'none',
        }}
      >
        <RightOutlined
            style={{
            fontSize: 14,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
        />
        <span>思考过程</span>
        <span style={{ marginLeft: 'auto' }}>{duration}</span>
      </div>
      {expanded && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            lineHeight: 1.6,
            padding: '8px 0 12px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 12,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/** 消息操作按钮 */
function MessageActions({ onCopy, onRegenerate }: { onCopy: () => void; onRegenerate?: () => void }) {
  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    color: 'var(--muted-foreground)',
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: "inherit",
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
      <button style={btnStyle} onClick={onCopy} className="msg-action-btn">
        <CopyOutlined style={{ fontSize: 14 }} />复制
      </button>
      {onRegenerate && (
        <button style={btnStyle} onClick={onRegenerate} className="msg-action-btn">
          <ReloadOutlined style={{ fontSize: 14 }} />重新生成
        </button>
      )}
      <button style={btnStyle} className="msg-action-btn">
        <LikeOutlined style={{ fontSize: 14 }} />
      </button>
      <button style={btnStyle} className="msg-action-btn">
        <DislikeOutlined style={{ fontSize: 14 }} />
      </button>
    </div>
  );
}

/** Action 执行结果卡（kernel 落库回显：applied_at / side_effects / action_rid） */
function ActionResultCard({ result }: { result: ActionResult }) {
  const output = (result.output ?? {}) as Record<string, unknown>;
  const fields: Array<[string, string]> = [
    ['Action', result.actionName || result.actionId],
    ['状态', result.success ? '成功' : '失败'],
    ['消息', result.message],
  ];
  const kernelFields = Object.entries(output)
    .filter(([k]) => ['applied_at', 'side_effects_emitted', 'action_rid', 'audit_id'].includes(k))
    .map(([k, v]) => [k, Array.isArray(v) ? (v as string[]).join(', ') : String(v)] as [string, string]);
  return (
    <div style={{ marginTop: 8, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: 12, fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
        <ThunderboltOutlined style={{ fontSize: 12, color: result.success ? 'var(--success)' : 'var(--destructive)' }} />
        <Typography.Text style={{ fontSize: 12, color: 'var(--foreground)' }}>执行结果</Typography.Text>
      </div>
      {[...fields, ...kernelFields].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
          <Typography.Text style={{ fontSize: 11, color: 'var(--muted-foreground)', minWidth: 120, display: 'inline-block' }}>{k}</Typography.Text>
          <Typography.Text style={{ fontSize: 11, color: 'var(--foreground)', wordBreak: 'break-all' }}>{v}</Typography.Text>
        </div>
      ))}
    </div>
  );
}

/** 单条消息渲染（贴合设计稿） */
function MessageRow({
  msg,
  onCopy,
  onActionResult,
  streamingContent,
}: {
  msg: ChatMessage;
  onCopy: (text: string) => void;
  onActionResult?: (result: ActionResult) => void;
  streamingContent?: string;
}) {
  const isUser = msg.role === 'user';
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const graphData = !isUser ? msg.metadata?.graphData : undefined;
  const thinkingContent = !isUser ? msg.metadata?.thinking : undefined;
  const thinkingDuration = !isUser ? msg.metadata?.thinkingDuration : undefined;
  const actionResult = !isUser ? msg.metadata?.actionResult : undefined;
  const actionMatch = !isUser ? msg.metadata?.actionMatch : undefined;
  // 流式期间用草稿 content（避免 onDelta 增量追加与 onDone 最终值竞争）
  const displayContent = msg.streaming && streamingContent != null ? streamingContent : msg.content;

  const time = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* 消息头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--muted-foreground)',
          }}
        >
          {isUser ? (
            <UserOutlined style={{ fontSize: 14 }} />
          ) : (
            <RobotOutlined style={{ fontSize: 14 }} />
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          {isUser ? 'Admin' : 'SuperAI'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{time}</span>
      </div>

      {/* 消息气泡 */}
      <div
        style={{
          maxWidth: 680,
          padding: '14px 18px',
          borderRadius: 4,
          fontSize: 14,
          lineHeight: 1.7,
          background: isUser ? 'var(--muted)' : 'var(--card)',
          color: 'var(--foreground)',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}
      >
        {/* 思考中状态 */}
        {msg.streaming && !streamingContent && msg.content === '' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0 4px' }}>
            <div style={{ display: 'inline-flex', gap: 3 }}>
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
            <span>正在思考...</span>
          </div>
        )}

        {/* 思考过程（仅 AI） */}
        {!isUser && thinkingContent && (
          <ThinkingSection content={thinkingContent} duration={thinkingDuration} />
        )}

        {/* 内容 */}
        {isUser ? (
          <div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.images && msg.images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {msg.images.map((img, idx) => (
                  <Image
                    key={idx}
                    src={img.base64 || img.url}
                    alt="用户上传图片"
                    style={{ maxHeight: 120, borderRadius: 4, cursor: 'pointer' }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <MarkdownRenderer content={displayContent || ''} variant="dark" />
            {graphData && graphData.nodes.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: graphCollapsed ? 0 : 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <BookOutlined style={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
                    <Typography.Text style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      知识图谱 · {graphData.nodes.length} 节点 / {graphData.edges.length} 关系
                    </Typography.Text>
                  </div>
                  <button
                    onClick={() => setGraphCollapsed((v) => !v)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted-foreground)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontFamily: 'inherit',
                    }}
                    title={graphCollapsed ? '展开图谱' : '收缩图谱'}
                  >
                    {graphCollapsed ? '展开 ▾' : '收缩 ▴'}
                  </button>
                </div>
                {!graphCollapsed && <KnowledgeGraph data={graphData} height={300} width={620} />}
              </div>
            )}
            <CitationList citations={msg.citations} />
            <EvidencePanel claims={msg.claims} evidence={msg.evidence} />
            {actionMatch && (
              <ActionMatchCard
                query={actionMatch.query}
                onResult={(result) => onActionResult?.(result)}
              />
            )}
            {actionResult && <ActionResultCard result={actionResult} />}
            {!msg.streaming && msg.content && (
              <MessageActions onCopy={() => onCopy(msg.content)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    {
      id: generateId(),
      title: 'Mate Platform 介绍',
      mode: 'chat',
      messages: [
        createMessage('user', '请介绍一下 Mate Platform'),
        createMessage(
          'assistant',
          '## Mate Platform\n\nMate Platform 是基于 **Ontology 本体论引擎**的企业级决策与运营提效平台。\n\n### 核心能力\n- Ontology 本体引擎（统一语义建模与推理）\n- 低代码应用构建（融合 BPMN 审批流与 AI Agent 编排）\n- 数字员工（AI 驱动的自动化）\n- 企业级 RAG 知识库\n- MCP/A2A 协议支持\n\n> AI 能力作为 Substrate 贯穿全栈，Ontology 引擎是唯一数据真相源。',
          {
            citations: [
              {
                id: 'c0',
                title: '项目总览',
                type: 'DOC',
                score: 98,
                snippet: 'Mate Platform 是统一的企业级 AI 运营平台。',
              },
            ],
          },
        ),
      ],
      updatedAt: now(),
      favorite: false,
    },
    createSession('新对话'),
  ]);
  const [activeId, setActiveId] = useState<string>(sessions[1].id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [isMultimodal, setIsMultimodal] = useState(false);
  const [multimodalModels, setMultimodalModels] = useState<MultimodalModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<FileItem[]>([]);
  const [currentModel, setCurrentModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{ label: string; value: string }[]>([]);
  // 流式草稿：assistantId → 累积中的 content（onDelta 阶段），onDone 后并入消息并清空
  const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
  const loadedHistoryRef = useRef<Set<string>>(new Set());
  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    listKnowledgeBases().then(setKnowledgeBases).catch((error) => { Toast.warning('知识库加载失败，已使用本地默认列表'); console.warn(error); });
    // 加载后端会话列表，与本地兜底会话合并
    listConversations()
      .then((convs) => {
        if (convs.length === 0) return;
        const backendSessions = convs.map((c) => conversationToSession(c));
        setSessions((prev) => {
          // 保留本地未持久化的会话（id 不以 conv- 开头）
          const localOnly = prev.filter((s) => !isBackendConversation(s.id));
          return [...backendSessions, ...localOnly];
        });
        // 默认选中第一个后端会话（如果有）
        if (convs.length > 0) {
          setActiveId((prev) =>
            prev.startsWith('conv-') ? prev : backendSessions[0].id,
          );
        }
      })
      .catch((error) => {
        /* 后端未就绪时降级到本地会话，但需告知用户 */
        Toast.warning('后端会话加载失败，已使用本地缓存');
        console.warn(error);
      });
  }, []);

  useEffect(() => {
    if (isMultimodal && !modelsLoadedRef.current) {
      modelsLoadedRef.current = true;
      listMultimodalModels()
        .then((models) => {
          setMultimodalModels(models);
          if (models.length > 0) {
            setSelectedModelId((prev) => prev || models[0].modelId);
          }
        })
        .catch(() => {
          Toast.error('加载多模态模型失败');
        });
    }
  }, [isMultimodal]);

  // Load available models on mount for the chat model selector
  useEffect(() => {
    listMultimodalModels()
      .then((models) => {
        const opts = models
          .filter((m) => m.enabled)
          .map((m) => ({ label: m.displayName || m.modelCode, value: m.modelId || m.modelCode }));
        if (opts.length > 0) {
          setAvailableModels(opts);
          setCurrentModel((prev) => prev || opts[0].value);
        }
      })
      .catch(() => {
        // Fallback model list
        setAvailableModels([
          { label: 'Doubao Pro 32K', value: 'doubao-pro-32k' },
          { label: 'GPT-4o', value: 'gpt-4o' },
          { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
          { label: 'DeepSeek Chat', value: 'deepseek-chat' },
        ]);
      });
  }, []);

  const loadHistoryIfNeeded = useCallback(
    async (sessionId: string) => {
      if (!isBackendConversation(sessionId)) return;
      if (loadedHistoryRef.current.has(sessionId)) return;
      loadedHistoryRef.current.add(sessionId);
      try {
        const messages = await getHistory(sessionId);
        if (messages.length === 0) return;
        const chatMessages: ChatMessage[] = messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: 'success' as const,
          createdAt: m.createdAt,
        }));
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId && s.messages.length === 0
              ? { ...s, messages: chatMessages }
              : s,
          ),
        );
      } catch {
        loadedHistoryRef.current.delete(sessionId);
      }
    },
    [],
  );

  // 挂载后 / 切换到后端会话时自动加载历史（消息已持久化，刷新不再为空）
  useEffect(() => {
    if (isBackendConversation(activeId)) {
      void loadHistoryIfNeeded(activeId);
    }
  }, [activeId, loadHistoryIfNeeded]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) || sessions[0],
    [sessions, activeId],
  );

  const abortRef = useRef<AbortController | null>(null);

  const updateSession = useCallback((sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? updater(s) : s)),
    );
  }, []);

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, updater: (msg: ChatMessage) => ChatMessage) => {
      updateSession(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((m) => (m.id === messageId ? updater(m) : m)),
        updatedAt: now(),
      }));
    },
    [updateSession],
  );

  const handleNewConversation = useCallback(() => {
    const localSession = createSession();
    setSessions((prev) => [localSession, ...prev]);
    setActiveId(localSession.id);
    setInput('');
    // 异步持久化到后端
    createConversation({ title: '新对话', mode: 'chat' })
      .then((conv) => {
        setSessions((prev) =>
          prev.map((s) => (s.id === localSession.id ? conversationToSession(conv) : s)),
        );
        setActiveId((prev) => (prev === localSession.id ? conv.id : prev));
      })
      .catch((error) => {
        /* 后端不可用时保留本地会话，但需告知用户 */
        Toast.warning('后端会话同步失败，保留本地会话');
        console.warn(error);
      });
  }, []);

  const handleSelectConversation = useCallback(
    (key: string) => {
      setActiveId(key);
      setInput('');
      loadHistoryIfNeeded(key);
    },
    [loadHistoryIfNeeded],
  );

  const handleDeleteConversation = useCallback((key: string) => {
    const wasBackend = isBackendConversation(key);
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== key);
      if (filtered.length === 0) {
        const session = createSession();
        return [session];
      }
      return filtered;
    });
    setActiveId((prev) => {
      if (prev === key) {
        const remaining = sessions.find((s) => s.id !== key);
        return remaining?.id || createSession().id;
      }
      return prev;
    });
    loadedHistoryRef.current.delete(key);
    if (wasBackend) {
      deleteConversation(key).catch((error) => {
        /* 后端删除失败，本地状态保持 */
        Toast.error('会话同步删除失败，请手动清理本地缓存');
        console.warn(error);
      });
    }
  }, [sessions]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      updateSession(id, (session) => ({
        ...session,
        favorite: !session.favorite,
      }));
      if (isBackendConversation(id)) {
        toggleFavorite(id).catch((error) => {
          // 后端失败时回滚本地状态
          updateSession(id, (session) => ({
            ...session,
            favorite: !session.favorite,
          }));
        });
      }
    },
    [updateSession],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const sessionId = activeSession.id;
      // 仅后端会话（conv-*）可持久化消息；本地临时会话不传 conversationId。
      const conversationId = isBackendConversation(sessionId) ? sessionId : undefined;

      if (isMultimodal) {
        if (imageFiles.length === 0) {
          Toast.warning('请至少上传一张图片');
          return;
        }
        if (!selectedModelId) {
          Toast.warning('请选择多模态模型');
          return;
        }

        const filesToSend = imageFiles;
        let chatImages: ChatImage[];
        try {
          chatImages = await Promise.all(
            filesToSend
              .filter((f) => f.fileInstance)
              .map(async (f) => ({
                uid: f.uid,
                base64: await fileToBase64(f.fileInstance as File),
                detail: 'auto' as const,
              })),
          );
        } catch {
          Toast.error('读取图片失败，请重试');
          return;
        }

        const userMessage = createMessage('user', trimmed, {
          status: 'local',
          images: chatImages,
        });
        const assistantMessage = createMessage('assistant', '', {
          status: 'loading',
        });
        const assistantId = assistantMessage.id;

        updateSession(sessionId, (session) => ({
          ...session,
          messages: [...session.messages, userMessage, assistantMessage],
          updatedAt: now(),
        }));

        if (activeSession.title === '新对话') {
          updateSession(sessionId, (session) => ({
            ...session,
            title: trimmed.slice(0, 24) || '新对话',
          }));
        }

        setLoading(true);
        setInput('');
        setImageFiles([]);

        try {
          const resp = await multimodalUploadChat({
            modelId: selectedModelId,
            text: trimmed,
            images: filesToSend.map((f) => f.fileInstance as File).filter(Boolean),
            systemPrompt: UNIFIED_SYSTEM_PROMPT,
            conversationId,
          });
          updateMessage(sessionId, assistantId, (msg) => ({
            ...msg,
            content: resp.content,
            status: 'success',
          }));
        } catch (error) {
          updateMessage(sessionId, assistantId, (msg) => ({
            ...msg,
            content: `⚠️ ${error instanceof Error ? error.message : '多模态请求失败'}`,
            status: 'error',
          }));
        } finally {
          setLoading(false);
        }
        return;
      }

      const userMessage = createMessage('user', trimmed, { status: 'local' });
      const assistantMessage = createMessage('assistant', '', {
        status: 'updating',
        streaming: true,
      });
      const assistantId = assistantMessage.id;

      updateSession(sessionId, (session) => ({
        ...session,
        messages: [...session.messages, userMessage, assistantMessage],
        updatedAt: now(),
      }));

      if (activeSession.title === '新对话') {
        updateSession(sessionId, (session) => ({
          ...session,
          title: trimmed.slice(0, 24) || '新对话',
        }));
      }

      setLoading(true);
      setInput('');

      // 三大原理 #3：检测 Action 意图 → 消息流内联 Action 匹配卡（不占用输入框上方空间）
      try {
        const matched = await matchAction(trimmed);
        if (matched && matched.length > 0) {
          const actionMatchId = generateId();
          updateSession(sessionId, (session) => ({
            ...session,
            messages: [...session.messages, createMessage('assistant', '', {
              status: 'success',
              metadata: { actionMatch: { query: trimmed, matched } },
            })],
            updatedAt: now(),
          }));
          updateMessage(sessionId, assistantId, (msg) => ({
            ...msg,
            status: 'success',
            streaming: false,
            content: '已匹配到可执行的 Action，请在下方面板选择并确认执行。',
          }));
          setLoading(false);
          abortRef.current = null;
          return;
        }
      } catch {
        // Action 匹配失败时继续走普通 LLM 对话
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const historyMessages = activeSession.messages
        .filter((m) => m.status === 'success')
        .slice(-MAX_CONTEXT_TURNS * 2)
        .map<Parameters<typeof streamChat>[0][number]>((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

      let ragContext = '';
      let ragCitations: Citation[] = [];
      if (selectedKbIds.length > 0) {
        try {
          const ragResults = await ragSearch(trimmed, selectedKbIds);
          if (ragResults.length > 0) {
            ragContext = '\n\n参考知识：\n' + ragResults.map((r) => `[${r.title}] ${r.content}`).join('\n');
            ragCitations = ragResults.map((r) => ({
              id: r.id,
              title: r.title,
              type: r.type,
              score: r.score,
              snippet: r.snippet,
              url: r.source,
            }));
          }
        } catch {
          // RAG 搜索失败，继续无上下文对话
        }
      }

      const systemPrompt = UNIFIED_SYSTEM_PROMPT;

      // 当用户输入涉及实体关系/知识图谱时，并行获取图谱数据
      if (trimmed.match(/关系|关联|图谱|ontology|实体|依赖|拓扑/i)) {
        ontSemanticQuery(trimmed)
          .then((graphData) => {
            updateMessage(sessionId, assistantId, (msg) => {
              // graphData 异步到达，可能在 onDone 之后：若消息已完成，补充本体 evidence（去重）
              const hasOntEvidence = (msg.evidence || []).some((e) => e.type === 'ONTOLOGY_OBJECT');
              return {
                ...msg,
                metadata: { ...(msg.metadata || {}), graphData },
                ...(!hasOntEvidence && msg.status === 'success'
                  ? { evidence: [...(msg.evidence || []), ...graphToEvidence(graphData)] }
                  : {}),
              };
            });
          })
          .catch((error) => {
            /* Graph fetch failed; assistant text response still shows. */
            console.warn('Graph fetch failed:', error);
          });
      }

      streamChat(
        [
          { role: 'system', content: systemPrompt + (ragContext ? '\n\n请基于以下参考知识回答问题：' + ragContext : '') },
          ...historyMessages,
          { role: 'user', content: trimmed },
        ],
        {
          onDelta: (delta) => {
            setStreamingMap((m) => ({ ...m, [assistantId]: (m[assistantId] || '') + delta }));
          },
          onDone: (fullContent, citations) => {
            const finalCitations = citations.length > 0 ? citations : ragCitations;
            const { content: cleanedContent, claims } = extractClaims(fullContent);
            updateMessage(sessionId, assistantId, (msg) => {
              const graph = msg.metadata?.graphData;
              const evidence: Evidence[] = [
                ...citationsToEvidence(finalCitations),
                ...(graph ? graphToEvidence(graph) : []),
              ];
              return {
                ...msg,
                status: 'success',
                streaming: false,
                content: cleanedContent,
                citations: finalCitations,
                claims: claims.length > 0 ? claims : undefined,
                evidence: evidence.length > 0 ? evidence : undefined,
              };
            });
            setStreamingMap((m) => {
              const next = { ...m };
              delete next[assistantId];
              return next;
            });
            setLoading(false);
            abortRef.current = null;
          },
          onError: (errMsg) => {
            updateMessage(sessionId, assistantId, (msg) => ({
              ...msg,
              content: `⚠️ ${errMsg}`,
              status: 'error',
              streaming: false,
            }));
            setLoading(false);
            abortRef.current = null;
          },
        },
        controller.signal,
        { model: currentModel, conversationId },
      );
    },
    [activeSession, loading, updateSession, updateMessage, selectedKbIds, isMultimodal, selectedModelId, imageFiles, currentModel],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleMultimodalToggle = useCallback((checked: boolean) => {
    setIsMultimodal(checked);
    if (!checked) {
      setImageFiles([]);
    }
  }, []);

  const contextTurns = Math.ceil(
    activeSession.messages.filter((m) => m.status === 'success').length / 2,
  );

  const [temperature, setTemperature] = useState(70);
  const [searchKeyword, setSearchKeyword] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 注入 thinking-dot 动画样式
  useEffect(() => {
    const styleId = 'superai-thinking-dot-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .thinking-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #a1a1a1;
        animation: superai-pulse 1.4s infinite ease-in-out;
      }
      .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
      .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes superai-pulse {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }
      .msg-action-btn:hover {
        color: #fafafa !important;
        background: #1a1a1a !important;
      }
      .superai-scroll::-webkit-scrollbar { width: 6px; }
      .superai-scroll::-webkit-scrollbar-track { background: transparent; }
      .superai-scroll::-webkit-scrollbar-thumb { background: #262626; border-radius: 3px; }
      .superai-scroll::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
    `;
    document.head.appendChild(style);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession.messages]);

  // textarea 自适应高度
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
    setInput(target.value);
  }, []);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !loading) {
          handleSend(input);
        }
      }
    },
    [input, loading, handleSend],
  );

  const handleCopyMessage = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      Toast.success('已复制');
    }).catch(() => {
      Toast.error('复制失败');
    });
  }, []);

  const filteredSessions = useMemo(() => {
    if (!searchKeyword.trim()) return sessions;
    const k = searchKeyword.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(k) ||
        s.messages.some((m) => m.content.toLowerCase().includes(k)),
    );
  }, [sessions, searchKeyword]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        background: 'var(--background)',
        width: '100%',
      }}
    >
      {/* 中间 - 会话列表 */}
      <div
        style={{
          width: 240,
          minWidth: 240,
          background: 'var(--background)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* conversation-header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>会话</h2>
          <button
            onClick={handleNewConversation}
            style={{
              background: 'transparent',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              height: 32,
              padding: '0 12px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <PlusOutlined style={{ fontSize: 14 }} />新建
          </button>
        </div>

        {/* 搜索框 */}
        <div style={{ padding: '8px 12px 4px' }}>
          <Input
            placeholder="搜索会话..."
            prefix={<SearchOutlined style={{ color: 'var(--muted-foreground)' }} />}
            showClear
            value={searchKeyword}
            onChange={(v) => setSearchKeyword(v)}
            size="small"
            style={{
              background: 'var(--muted)',
              borderColor: 'var(--border)',
              borderRadius: 4,
            }}
          />
        </div>

        {/* conversation-list */}
        <div className="superai-scroll" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {filteredSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectConversation(s.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                marginBottom: 2,
                background: s.id === activeId ? 'var(--muted)' : 'transparent',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => {
                if (s.id !== activeId) e.currentTarget.style.background = 'var(--card)';
              }}
              onMouseLeave={(e) => {
                if (s.id !== activeId) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--foreground)',
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {new Date(s.updatedAt).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  SuperAI
                </span>
                {s.favorite && (
                  <StarFilled style={{ fontSize: 10, color: 'var(--warning)' }} />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(s.id);
                  }}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                  title="删除"
                >
                  <DeleteOutlined style={{ fontSize: 12 }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* conversation-footer - 知识库选择 */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <Select
            multiple
            placeholder="选择知识库"
            value={selectedKbIds}
            onChange={(vals) => setSelectedKbIds((vals as string[]) ?? [])}
            style={{ width: '100%' }}
            optionList={knowledgeBases.map((kb) => ({
              label: `${kb.name} (${kb.documentCount}篇)`,
              value: kb.id,
            }))}
            maxTagCount={1}
            size="small"
          />
        </div>
      </div>

      {/* 右侧 - 聊天区 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--background)',
        }}
      >
        {/* chat-topbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            minHeight: 48,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip content={`上下文 ${contextTurns}/${MAX_CONTEXT_TURNS} 轮`}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                {activeSession.title}
              </span>
            </Tooltip>
            {activeSession.favorite && (
              <StarFilled style={{ fontSize: 12, color: 'var(--warning)' }} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Temperature</span>
            <Slider
              min={0}
              max={100}
              value={temperature}
              onChange={(v) => setTemperature(v as number)}
              style={{ width: 100, margin: 0 }}
              tooltipVisible={false}
            />
            <span
              style={{
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: 12,
                minWidth: 28,
                textAlign: 'right',
                color: 'var(--foreground)',
              }}
            >
              {(temperature / 100).toFixed(1)}
            </span>
          </div>
        </div>

        {/* messages-area */}
        <div
          className="superai-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {activeSession.messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Welcome
                variant="borderless"
                icon={<RobotOutlined style={{ fontSize: 36, color: 'var(--foreground)' }} />}
                title="你好，我是 SuperAI"
                description="统一 AI 交互入口，自动识别您的意图 — 智能问答、数据分析、知识图谱、代码生成，一个输入框搞定。"
                extra={
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16, maxWidth: 560 }}>
                    {WELCOME_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        style={{
                          background: 'var(--muted)',
                          border: '1px solid var(--border)',
                          color: 'var(--muted-foreground)',
                          borderRadius: 4,
                          padding: '6px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                }
              />
            </div>
          ) : (
            <>
              {activeSession.messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  onCopy={handleCopyMessage}
                  streamingContent={streamingMap[msg.id]}
                  onActionResult={(result) => {
                    updateSession(activeSession.id, (session) => ({
                      ...session,
                      messages: [...session.messages, createMessage('assistant', '', {
                        status: 'success',
                        metadata: { actionResult: result },
                      })],
                      updatedAt: now(),
                    }));
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* input-bar */}
        <div
          style={{
            background: 'var(--card)',
            borderTop: '1px solid var(--border)',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--foreground)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {isMultimodal && (
              <div style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Switch
                  checked={isMultimodal}
                  onChange={handleMultimodalToggle}
                  checkedText="多模态"
                  uncheckedText="文本"
                  size="small"
                />
                <Select
                  placeholder="选择多模态模型"
                  value={selectedModelId}
                  onChange={(v) => setSelectedModelId(v as string)}
                  optionList={multimodalModels.map((m) => ({
                    label: m.displayName || m.modelCode,
                    value: m.modelId,
                  }))}
                  style={{ width: 180 }}
                  size="small"
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  最多 8 张 · 单张 ≤5MB
                </span>
              </div>
            )}
            {isMultimodal && imageFiles.length > 0 && (
              <div style={{ padding: '8px 12px 0' }}>
                <Upload
                  fileList={imageFiles}
                  onChange={({ fileList }) =>
                    setImageFiles(fileList.map((f) => ({ ...f, status: 'success' })))
                  }
                  beforeUpload={({ file }) => beforeUpload(file.fileInstance as File)}
                  multiple
                  limit={8}
                  listType="picture"
                  accept="image/png,image/jpeg,image/webp"
                >
                  {imageFiles.length < 8 && (
                    <div>
                      <PaperClipOutlined />
                      <div style={{ marginTop: 8, fontSize: 12 }}>上传图片</div>
                    </div>
                  )}
                </Upload>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                isMultimodal
                  ? '输入文字描述，与图片一起发送，Shift + Enter 换行...'
                  : '输入消息，Shift + Enter 换行...'
              }
              style={{
                width: '100%',
                minHeight: 40,
                maxHeight: 160,
                resize: 'none',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground)',
                fontSize: 14,
                fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
                padding: '10px 14px',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            {/* 工具栏：附件按钮 + 模型指示器（在输入区域内部） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px 6px 8px',
              }}
            >
              <Tooltip content={isMultimodal ? '关闭多模态' : '开启多模态（图片上传）'}>
                <button
                  onClick={() => handleMultimodalToggle(!isMultimodal)}
                  style={{
                    background: 'transparent',
                    color: isMultimodal ? 'var(--foreground)' : 'var(--muted-foreground)',
                    border: 'none',
                    borderRadius: 4,
                    height: 28,
                    width: 28,
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isMultimodal ? 'var(--foreground)' : 'var(--muted-foreground)';
                  }}
                >
                  <PaperClipOutlined style={{ fontSize: 14 }} />
                </button>
              </Tooltip>
              <Select
                size="small"
                value={currentModel}
                onChange={(v) => setCurrentModel(v as string)}
                optionList={availableModels}
                style={{ width: 160, fontSize: 11 }}
                dropdownMatchSelectWidth={false}
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (loading) {
                handleCancel();
              } else if (input.trim()) {
                handleSend(input);
              }
            }}
            disabled={!loading && !input.trim()}
            style={{
              background: loading ? 'var(--muted)' : 'var(--foreground)',
              color: loading ? 'var(--muted-foreground)' : 'var(--background)',
              border: 'none',
              borderRadius: 4,
              height: 40,
              width: 40,
              padding: 0,
              fontSize: 14,
              cursor: (!loading && !input.trim()) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: (!loading && !input.trim()) ? 0.5 : 1,
            }}
          >
            {loading ? '■' : <SendOutlined style={{ fontSize: 16 }} />}
          </button>
        </div>
      </div>
    </div>
  );
}
