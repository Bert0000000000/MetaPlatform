/**
 * ChatPage - SuperAI AI 对话（重构版）
 * --------------------------------------------------
 * 布局（Semi 官方 AI 组件方案）：
 * ┌───────────────────────────┬──────────────┐
 * │ 对话区（左）               │ Sidebar（右） │
 * │  · topbar（开关+标题）     │  · 会话历史    │
 * │  · AIChatDialogue         │  · timeline   │
 * │  · AIChatInput(Configure) │              │
 * └───────────────────────────┴──────────────┘
 * 后端对接：copilot stream（LLM 流式）/ conversations（会话 CRUD + 历史）/ 多模态。
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AIChatDialogue,
  AIChatInput,
  Sidebar,
  Button,
  Typography,
  Toast,
  Input,
} from '@douyinfe/semi-ui';
import type { Message as SemiMessage } from '@douyinfe/semi-ui/lib/es/aiChatDialogue/interface';
import type { FileItem } from '@douyinfe/semi-ui/lib/es/upload';
import {
  ChevronsLeft,
  ChevronsRight,
  RobotOutlined,
  SearchOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@mate/shared';
import { DeleteOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import {
  streamChat,
  listMultimodalModels,
  multimodalUploadChat,
} from '@/api/superai/chat';
import {
  listConversations,
  createConversation as apiCreateConversation,
  getHistory,
  deleteConversation as apiDeleteConversation,
  toggleFavorite as apiToggleFavorite,
} from '@/api/superai/conversations';
import { matchAction } from '@/api/superai/actions';
import { semanticQuery } from '@/api/superai/ontology';
import type {
  ChatMessage,
  ChatSession,
  ChatImage,
  Claim,
  Citation,
  Evidence,
  GraphData,
  MultimodalModel,
} from '@/api/superai/types';

// ============ 常量 ============

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

/** 空提示数组（模块级常量，引用稳定 —— Semi Chat 会对 hints 读 .length） */
const EMPTY_HINTS: string[] = [];
const MAX_CONTEXT_TURNS = 10;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

// ============ 工具函数 ============

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function isBackendConversation(id: string): boolean {
  return id.startsWith('conv-');
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: generateId(), role, content, status: 'success', createdAt: now(), ...overrides };
}

function createSession(title = '新对话'): ChatSession {
  return { id: generateId(), title, mode: 'chat', messages: [], updatedAt: now(), favorite: false };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function beforeUpload(file: File): boolean {
  const okType = ALLOWED_IMAGE_TYPES.includes(file.type);
  if (!okType) Toast.error('仅支持 png、jpeg、webp 格式的图片');
  const okSize = file.size / 1024 / 1024 < MAX_IMAGE_SIZE_MB;
  if (!okSize) Toast.error('单张图片不能超过 5MB');
  return okType && okSize;
}

/** 从 AIChatInput 富文本 JSON（Content[]）提取纯文本 */
function extractPlainText(contents: Array<{ type: string; [key: string]: unknown }>): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === 'string') parts.push(obj.text);
      if (obj.content != null) walk(obj.content);
    }
  };
  walk(contents);
  return parts.join('');
}

/** 会话时间分组：今天 / 昨天 / 7 天内 / 更早 */
function timelineGroup(updatedAt: string): string {
  const t = new Date(updatedAt);
  const nowD = new Date();
  const startOfToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
  const startOfMsg = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays <= 7) return '7 天内';
  return '更早';
}

/** 会话是否运行中（存在流式/加载中的消息） */
function isSessionRunning(s: ChatSession): boolean {
  return s.messages.some((m) => m.streaming || m.status === 'loading' || m.status === 'updating');
}

/** 解析回答末尾的 claims JSON 块 */
function extractClaims(content: string): { content: string; claims: Claim[] } {
  const m = content.match(/\{"claims"\s*:\s*\[[\s\S]*?\]\s*\}(?:\s|$)/);
  if (!m) return { content, claims: [] };
  try {
    const parsed = JSON.parse(m[0]) as { claims?: Array<{ content: string; type: Claim['type']; confidence: number }> };
    const claims: Claim[] = (parsed.claims ?? []).map((c) => ({
      claimId: generateId(),
      content: c.content,
      type: c.type,
      confidence: c.confidence,
    }));
    return { content: content.replace(m[0], '').trim(), claims };
  } catch {
    return { content, claims: [] };
  }
}

function citationsToEvidence(citations: Citation[]): Evidence[] {
  return citations.map((c) => ({
    evidenceId: c.id,
    type: 'DOCUMENT' as const,
    ref: c.title,
    fragment: c.snippet,
    score: c.score,
    title: c.title,
  }));
}

function graphToEvidence(graph: GraphData): Evidence[] {
  return graph.nodes.map((n) => ({
    evidenceId: n.id,
    type: 'ONTOLOGY_OBJECT' as const,
    ref: n.label,
    fragment: `${n.type} · ${graph.edges.filter((e) => e.source === n.id || e.target === n.id).length} 条关系`,
    title: n.label,
  }));
}

function conversationToSession(
  conv: { id: string; title: string; mode: ChatSession['mode']; favorite: boolean; createdAt: string; updatedAt?: string },
  messages: ChatMessage[] = [],
): ChatSession {
  return {
    id: conv.id,
    title: conv.title || '新对话',
    mode: conv.mode,
    messages,
    updatedAt: conv.updatedAt || conv.createdAt || now(),
    favorite: conv.favorite,
  };
}

// ============ 组件 ============

const { Configure } = AIChatInput;

export default function ChatPage() {
  // --- 会话与消息状态 ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    {
      ...createSession('Mate Platform 介绍'),
      messages: [
        createMessage('user', '请介绍一下 Mate Platform'),
        createMessage(
          'assistant',
          '## Mate Platform\n\nMate Platform 是基于 **Ontology 本体论引擎**的企业级决策与运营提效平台。\n\n### 核心能力\n- Ontology 本体引擎（统一语义建模与推理）\n- 低代码应用构建（融合 BPMN 审批流与 AI Agent 编排）\n- 数字员工（AI 驱动的自动化）\n- 企业级 RAG 知识库\n- MCP/A2A 协议支持',
          {
            citations: [{ id: 'c0', title: '项目总览', type: 'DOC', score: 98, snippet: 'Mate Platform 是统一的企业级 AI 运营平台。' }],
          },
        ),
      ],
    },
  ]);
  const [activeId, setActiveId] = useState<string>(() => '');
  const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sessionPanelVisible, setSessionPanelVisible] = useState(true);
  const [currentModel, setCurrentModel] = useState('doubao-pro-32k');
  const [temperature, setTemperature] = useState(70);
  const [imageFiles, setImageFiles] = useState<FileItem[]>([]);
  const [isMultimodal, setIsMultimodal] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [multimodalModels, setMultimodalModels] = useState<MultimodalModel[]>([]);
  const [availableModels, setAvailableModels] = useState<{ label: string; value: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const loadedHistoryRef = useRef<Set<string>>(new Set());

  // activeId 初始化（挂载后取第一个会话）
  useEffect(() => {
    setActiveId((prev) => prev || sessions[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];

  // --- 后端对接：会话列表加载 ---
  useEffect(() => {
    listConversations()
      .then((convs) => {
        if (convs.length === 0) return;
        setSessions((prev) => {
          const localOnly = prev.filter((s) => !isBackendConversation(s.id));
          const backend = convs.map((c) => conversationToSession(c));
          return [...backend, ...localOnly];
        });
        setActiveId((prev) => (convs.some((c) => c.id === prev) ? prev : convs[0]?.id ?? prev));
      })
      .catch(() => {
        Toast.warning('后端会话加载失败，已使用本地缓存');
      });
  }, []);

  // --- 后端对接：历史消息加载（仅 conv-* 会话，加载一次） ---
  useEffect(() => {
    if (!activeId || !isBackendConversation(activeId) || loadedHistoryRef.current.has(activeId)) return;
    loadedHistoryRef.current.add(activeId);
    getHistory(activeId)
      .then((history) => {
        const messages: ChatMessage[] = history.map((m) => ({
          id: m.id ?? generateId(),
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content ?? '',
          status: 'success',
          createdAt: m.createdAt ?? now(),
        }));
        setSessions((prev) =>
          prev.map((s) => (s.id === activeId ? { ...s, messages } : s)),
        );
      })
      .catch(() => {
        Toast.warning('会话历史加载失败，保留本地消息');
      });
  }, [activeId]);

  // --- 模型列表（含多模态模型） ---
  useEffect(() => {
    listMultimodalModels()
      .then((models) => {
        setMultimodalModels(models);
        setAvailableModels(models.map((m) => ({ label: m.displayName || m.modelCode, value: m.modelId })));
      })
      .catch(() => {
        setAvailableModels([{ label: 'doubao-pro-32k', value: 'doubao-pro-32k' }]);
      });
  }, []);

  const updateSession = useCallback(
    (sessionId: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updater(s) : s)));
    },
    [],
  );

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, updater: (m: ChatMessage) => ChatMessage) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map((m) => (m.id === messageId ? updater(m) : m)) }
            : s,
        ),
      );
    },
    [],
  );

  // --- 发送消息（后端对接：copilot stream / 多模态） ---
  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !activeSession) return;
      const sessionId = activeSession.id;
      const conversationId = isBackendConversation(sessionId) ? sessionId : undefined;

      // 多模态分支
      if (isMultimodal) {
        if (imageFiles.length === 0) {
          Toast.warning('请至少上传一张图片');
          return;
        }
        if (!selectedModelId) {
          Toast.warning('请选择多模态模型');
          return;
        }
        let chatImages: ChatImage[];
        try {
          chatImages = await Promise.all(
            imageFiles
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
        const userMessage = createMessage('user', trimmed, { status: 'local', images: chatImages });
        const assistantMessage = createMessage('assistant', '', { status: 'loading' });
        updateSession(sessionId, (s) => ({
          ...s,
          messages: [...s.messages, userMessage, assistantMessage],
          updatedAt: now(),
          title: s.title === '新对话' ? trimmed.slice(0, 24) || '新对话' : s.title,
        }));
        setLoading(true);
        setImageFiles([]);
        try {
          const resp = await multimodalUploadChat({
            modelId: selectedModelId,
            text: trimmed,
            images: imageFiles.map((f) => f.fileInstance as File).filter(Boolean),
            systemPrompt: UNIFIED_SYSTEM_PROMPT,
            conversationId,
          });
          updateMessage(sessionId, assistantMessage.id, (m) => ({ ...m, content: resp.content, status: 'success' }));
        } catch (error) {
          updateMessage(sessionId, assistantMessage.id, (m) => ({
            ...m,
            content: `⚠️ ${error instanceof Error ? error.message : '多模态请求失败'}`,
            status: 'error',
          }));
        } finally {
          setLoading(false);
        }
        return;
      }

      // 普通流式分支
      const userMessage = createMessage('user', trimmed, { status: 'local' });
      const assistantMessage = createMessage('assistant', '', { status: 'updating', streaming: true });
      const assistantId = assistantMessage.id;
      updateSession(sessionId, (s) => ({
        ...s,
        messages: [...s.messages, userMessage, assistantMessage],
        updatedAt: now(),
        title: s.title === '新对话' ? trimmed.slice(0, 24) || '新对话' : s.title,
      }));
      setLoading(true);

      // Action 意图匹配（三大原理 #3）
      try {
        const matched = await matchAction(trimmed);
        if (matched && matched.length > 0) {
          updateSession(sessionId, (s) => ({
            ...s,
            messages: [
              ...s.messages,
              createMessage('assistant', '', {
                status: 'success',
                metadata: { actionMatch: { query: trimmed, matched } },
              }),
            ],
            updatedAt: now(),
          }));
          updateMessage(sessionId, assistantId, (m) => ({
            ...m,
            status: 'success',
            streaming: false,
            content: '已匹配到可执行的 Action，请在下方面板选择并确认执行。',
          }));
          setLoading(false);
          abortRef.current = null;
          return;
        }
      } catch {
        // 匹配失败继续普通对话
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const historyMessages = activeSession.messages
        .filter((m) => m.status === 'success')
        .slice(-MAX_CONTEXT_TURNS * 2)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' }));

      // Ontology 图谱并行获取（实体关系类问题）
      if (trimmed.match(/关系|关联|图谱|ontology|实体|依赖|拓扑/i)) {
        semanticQuery(trimmed)
          .then((graphData) => {
            updateMessage(sessionId, assistantId, (m) => ({
              ...m,
              metadata: { ...(m.metadata || {}), graphData },
              ...(!(m.evidence || []).some((e) => e.type === 'ONTOLOGY_OBJECT') && m.status === 'success'
                ? { evidence: [...(m.evidence || []), ...graphToEvidence(graphData)] }
                : {}),
            }));
          })
          .catch((error: Error) => {
            console.warn('Graph fetch failed:', error);
          });
      }

      streamChat(
        [
          { role: 'system', content: UNIFIED_SYSTEM_PROMPT },
          ...historyMessages,
          { role: 'user', content: trimmed },
        ],
        {
          onDelta: (delta) => {
            setStreamingMap((m) => ({ ...m, [assistantId]: (m[assistantId] || '') + delta }));
          },
          onDone: (fullContent, citations) => {
            const { content: cleanedContent, claims } = extractClaims(fullContent);
            updateMessage(sessionId, assistantId, (m) => {
              const graph = m.metadata?.graphData;
              const evidence: Evidence[] = [
                ...citationsToEvidence(citations),
                ...(graph ? graphToEvidence(graph) : []),
              ];
              return {
                ...m,
                status: 'success',
                streaming: false,
                content: cleanedContent,
                citations: citations.length > 0 ? citations : undefined,
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
            updateMessage(sessionId, assistantId, (m) => ({
              ...m,
              content: `⚠️ ${errMsg}`,
              status: 'error',
              streaming: false,
            }));
            setLoading(false);
            abortRef.current = null;
          },
        },
        controller.signal,
        { model: currentModel, temperature: temperature / 100, conversationId },
      );
    },
    [activeSession, loading, updateSession, updateMessage, isMultimodal, selectedModelId, imageFiles, currentModel, temperature],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  // --- 会话 CRUD（后端对接） ---
  const handleNewConversation = useCallback(async () => {
    try {
      const conv = await apiCreateConversation({ title: '新对话', mode: 'chat' });
      setSessions((prev) => [conversationToSession(conv), ...prev]);
      setActiveId(conv.id);
    } catch {
      const local = createSession();
      setSessions((prev) => [local, ...prev]);
      setActiveId(local.id);
    }
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (id === activeId && next.length > 0) setActiveId(next[0].id);
        return next;
      });
      if (isBackendConversation(id)) {
        try {
          await apiDeleteConversation(id);
        } catch {
          Toast.error('会话同步删除失败，请手动清理本地缓存');
        }
      }
    },
    [activeId],
  );

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const target = sessions.find((s) => s.id === id);
      if (!target) return;
      const nextFavorite = !target.favorite;
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: nextFavorite } : s)));
      if (isBackendConversation(id)) {
        try {
          await apiToggleFavorite(id);
        } catch {
          Toast.warning('收藏状态同步失败');
        }
      }
    },
    [sessions],
  );

  // --- 消息映射：官方 ContentItem 格式（reasoning / annotations / 文本） ---
  const semiMessages = useMemo<SemiMessage[]>(
    () =>
      (activeSession?.messages ?? []).map((msg) => {
        const draft = msg.streaming ? streamingMap[msg.id] : undefined;
        const text = draft !== undefined ? draft : (msg.content ?? '');
        const status: SemiMessage['status'] =
          msg.status === 'error'
            ? 'failed'
            : msg.streaming
              ? text === ''
                ? 'in_progress'
                : 'incomplete'
              : msg.status === 'loading' || msg.status === 'updating'
                ? 'in_progress'
                : 'completed';
        const contentItems: Array<Record<string, unknown>> = [];
        if (msg.role !== 'user') {
          const thinking = msg.metadata?.thinking as string | undefined;
          if (thinking) {
            contentItems.push({
              type: 'reasoning',
              status: 'completed',
              summary: [{ type: 'summary_text', text: thinking }],
            });
          }
        }
        if (text) {
          const annotations: Array<{ title: string; detail?: string; url?: string }> = [];
          for (const ev of (msg.evidence ?? []).slice(0, 6)) {
            annotations.push({ title: ev.title ?? ev.ref, detail: ev.fragment });
          }
          for (const c of (msg.citations ?? []).slice(0, 6)) {
            annotations.push({ title: c.title, detail: c.snippet });
          }
          contentItems.push({
            type: 'message',
            content: [
              {
                type: msg.role === 'user' ? 'input_text' : 'output_text',
                text,
                ...(annotations.length > 0 ? { annotations } : {}),
              },
            ],
            status: status === 'failed' ? 'failed' : status === 'incomplete' ? 'incomplete' : 'completed',
          });
        }
        return {
          id: msg.id,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: contentItems,
          status,
          createdAt: msg.createdAt ? Date.parse(msg.createdAt) : Date.now(),
        };
      }),
    [activeSession?.messages, streamingMap],
  );

  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    if (searchKeyword.trim()) {
      const k = searchKeyword.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(k) ||
          s.messages.some((m) => (m.content ?? '').toLowerCase().includes(k)),
      );
    }
    return result;
  }, [sessions, searchKeyword]);

  if (!activeSession) {
    return <div style={{ padding: 24 }}>加载中...</div>;
  }

  // ============ 渲染 ============
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, width: 'auto', margin: '0 -24px' }}>
      {/* ===== 左：对话区 ===== */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--background)',
        }}
      >
        {/* chat-topbar：侧栏开关 + 对话标题 + 运行状态 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            minHeight: 44,
          }}
        >
          <Button
            theme="borderless"
            size="small"
            icon={
              sessionPanelVisible ? (
                <ChevronsRight style={{ width: 15, height: 15 }} />
              ) : (
                <ChevronsLeft style={{ width: 15, height: 15 }} />
              )
            }
            title={sessionPanelVisible ? '收起会话侧栏' : '展开会话侧栏'}
            onClick={() => setSessionPanelVisible((v) => !v)}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSession.title}
          </span>
          {isSessionRunning(activeSession) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--semi-color-primary)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--semi-color-primary)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }}
              />
              运行中
            </span>
          )}
        </div>

        {/* 消息流（官方 AIChatDialogue：左右布局 + reasoning + annotations） */}
        <AIChatDialogue
          key={activeSession.id}
          className="superai-chat"
          style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 'none', padding: '24px 0 0' }}
          roleConfig={{
            user: { name: 'Admin', avatar: '👤' },
            assistant: { name: 'SuperAI', avatar: '🤖' },
          }}
          chats={semiMessages}
          topSlot={
            activeSession.messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px 0' }}>
                <RobotOutlined style={{ fontSize: 36, color: 'var(--foreground)' }} />
                <Typography.Title heading={4} style={{ margin: '16px 0 8px', color: 'var(--foreground)' }}>
                  你好，我是 SuperAI
                </Typography.Title>
                <Typography.Text style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  统一 AI 交互入口，自动识别您的意图 — 智能问答、数据分析、知识图谱、代码生成，一个输入框搞定。
                </Typography.Text>
              </div>
            ) : undefined
          }
          hints={activeSession.messages.length === 0 ? WELCOME_PROMPTS : EMPTY_HINTS}
          hintStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginLeft: 0 }}
          onHintClick={(hint) => {
            void handleSend(hint);
          }}
        />

        {/* 输入框（官方 Configure：模型 / 深度思考 / 思考模式 / 附件） */}
        <AIChatInput
          placeholder="输入消息，Shift + Enter 换行..."
          sendHotKey="enter"
          generating={loading}
          onStopGenerate={handleCancel}
          onMessageSend={(content) => {
            void handleSend(extractPlainText(content.inputContents ?? []));
          }}
          uploadProps={{
            action: '',
            fileList: imageFiles,
            onChange: ({ fileList }) => setImageFiles(fileList.map((f) => ({ ...f, status: 'success' }))),
            beforeUpload: ({ file }) => beforeUpload(file.fileInstance as File),
            multiple: true,
            limit: 8,
            accept: ALLOWED_IMAGE_TYPES.join(','),
          }}
          renderConfigureArea={() => (
            <>
              <Configure.Select optionList={availableModels} field="model" initValue={currentModel} />
              <Configure.Button icon={<ThunderboltOutlined style={{ fontSize: 14 }} />} field="thinking">
                深度思考
              </Configure.Button>
              <Configure.RadioButton
                options={[
                  { label: '极速', value: 'fast' },
                  { label: '思考', value: 'think' },
                  { label: '超能', value: 'super' },
                ]}
                field="thinkType"
                initValue="think"
              />
            </>
          )}
          onConfigureChange={(value, changedValue) => {
            if (changedValue.model != null) setCurrentModel(changedValue.model);
            if (changedValue.thinkType != null) {
              setTemperature(changedValue.thinkType === 'super' ? 90 : changedValue.thinkType === 'think' ? 60 : 30);
            }
          }}
        />
      </div>

      {/* ===== 右：会话历史 Sidebar（官方配置） ===== */}
      {sessionPanelVisible && (
        <Sidebar
          visible
          resizable
          title="会话历史"
          showClose
          defaultSize={{ width: 260 }}
          minWidth={200}
          maxWidth={360}
          onCancel={() => setSessionPanelVisible(false)}
          style={{ width: '100%', border: 'none', height: '100%', borderLeft: '1px solid var(--border)' }}
          renderMainContent={() => (
            <div className="superai-scroll" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
              <div style={{ padding: '8px 12px 4px' }}>
                <Button theme="solid" type="primary" icon={<PlusOutlined />} block onClick={() => void handleNewConversation()}>
                  新建会话
                </Button>
              </div>
              <div style={{ padding: '8px 12px 4px' }}>
                <Input
                  placeholder="搜索会话..."
                  prefix={<SearchOutlined style={{ color: 'var(--muted-foreground)' }} />}
                  showClear
                  value={searchKeyword}
                  onChange={(v) => setSearchKeyword(v)}
                  size="small"
                />
              </div>
              {(() => {
                const groups: Array<{ label: string; items: ChatSession[] }> = [];
                for (const s of filteredSessions) {
                  const g = timelineGroup(s.updatedAt);
                  let group = groups.find((x) => x.label === g);
                  if (!group) {
                    group = { label: g, items: [] };
                    groups.push(group);
                  }
                  group.items.push(s);
                }
                return (
                  <>
                    {groups.map((g) => (
                      <div key={g.label}>
                        <div
                          style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '8px 12px 4px', fontWeight: 600 }}
                        >
                          {g.label}
                        </div>
                        {g.items.map((s) => (
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
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 500,
                                marginBottom: 3,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'var(--foreground)',
                              }}
                            >
                              {isSessionRunning(s) && (
                                <>
                                  <span
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: '50%',
                                      flexShrink: 0,
                                      background: 'var(--semi-color-primary)',
                                      animation: 'pulse 1.2s ease-in-out infinite',
                                    }}
                                  />
                                  <span style={{ fontSize: 10, color: 'var(--semi-color-primary)', flexShrink: 0 }}>
                                    运行中
                                  </span>
                                </>
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
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
                              {s.favorite && <StarFilled style={{ fontSize: 10, color: 'var(--warning)' }} />}
                              <Button
                                size="small"
                                theme="borderless"
                                icon={s.favorite ? <StarFilled style={{ fontSize: 12, color: 'var(--warning)' }} /> : <StarOutlined style={{ fontSize: 12 }} />}
                                title={s.favorite ? '取消收藏' : '收藏'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleFavorite(s.id);
                                }}
                              />
                              <Button
                                size="small"
                                theme="borderless"
                                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                                title="删除会话"
                                style={{ marginLeft: 'auto' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteConversation(s.id);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
        />
      )}
    </div>
  );
}
