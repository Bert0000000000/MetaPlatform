/**
 * ChatPage - SuperAI AI 对话（Calm Density 重排版）
 * --------------------------------------------------
 * 布局（Semi 官方 AI 组件方案，壳已提供页面外框）：
 * ┌───────────────────────────┬──────────────┐
 * │ 对话区（左）               │ Sidebar（右） │
 * │  · topbar（开关+标题）     │  · 会话历史    │
 * │  · AIChatDialogue         │  · timeline   │
 * │  · AIChatInput(Configure) │              │
 * └───────────────────────────┴──────────────┘
 *
 * 排版契约（DESIGN-SPEC §4 令牌 / §5 骨架）：本文件 0 处 JSX inline style，
 * 间距/颜色全部走共享类（shell/skeleton/superai.css）+ Semi 组件属性。
 * 后端对接：copilot stream（LLM 流式）/ conversations（会话 CRUD + 历史）/ 多模态。
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AIChatDialogue,
  AIChatInput,
  Sidebar,
  Avatar,
  Button,
  Typography,
  Toast,
  Input,
  List,
  Row,
  Col,
  Space,
  Tag,
} from '@douyinfe/semi-ui';
import type { Message as SemiMessage } from '@douyinfe/semi-ui/lib/es/aiChatDialogue/interface';
import type { FileItem } from '@douyinfe/semi-ui/lib/es/upload';
import type {
  Reference,
  Suggestion,
  Skill,
} from '@douyinfe/semi-ui/lib/es/aiChatInput/interface';
import { getUser, PageLoading, RobotOutlined } from '@mate/shared';
import {
  IconBolt,
  IconChevronLeft,
  IconChevronRight,
  IconDelete,
  IconPlus,
  IconSearch,
  IconStar,
  IconStarStroked,
  IconTemplateStroked,
  IconUser,
  IconUserCircle,
} from '@douyinfe/semi-icons';
import EmptyState from '@/components/skeleton/EmptyState';
import {
  streamChat,
  streamAgentChat,
  listMultimodalModels,
  listChatModels,
  multimodalUploadChat,
  parseRoutingDecisionEvent,
} from '@/api/superai/chat';
import type { AgentProposalEvent } from '@/api/superai/chat';
import { approveRun, cancelRun, newIdempotencyKey, startRun, type RunState } from '@/api/agentTeam';
import AgentTeamSchedule from './components/AgentTeamSchedule';
import { STATUS_TAG } from './agentTeamRunView';
import { useAgentTeamRun } from './useAgentTeamRun';
import { RoutingDecisionPanel } from './components/RoutingDecisionPanel';
import { EvidenceRenderer } from './components/EvidenceRenderer';
import { ClaimRenderer } from './components/ClaimRenderer';
import OntologyEvidencePanel from './components/OntologyEvidencePanel';
import ProposalActionCard from './components/ProposalActionCard';
import ProposalConfirmDrawer from '@/pages/ontology/components/ProposalConfirmDrawer';
import { clearRoutingDecisionForStreamError } from './routingDecisionState';
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
  RoutingDecision,
} from '@/api/superai/types';
import './superai.css';

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
// AI 提案 kind → 中文标签（ProposalActionCard 与「详细讨论」共用）。
const PROPOSAL_KIND_LABEL: Record<string, string> = {
  action: '执行 Action',
  create_instance: '创建实例',
  model_type: '新建概念',
  merge_suggestion: '合并建议',
};
// claim 类型 → 中文标签（回复里「AI 分析与建议」分节统计用）。
const CLAIM_TYPE_LABEL: Record<string, string> = {
  FACT: '事实',
  INFERENCE: '推断',
  RECOMMENDATION: '建议',
};

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

/**
 * 会话 ↔ 本轮 agent-team run 的关联键。
 *
 * 后端没有「会话 ↔ run」这张表（那是新增后端功能，本批明确不做），所以关联落在
 * **浏览器本地**——刷新页面后靠它去 `GET /runs/{id}` 把调度视图恢复回来。换一台
 * 机器打开同一个会话看不到上一轮的调度，这是本地存储的固有限制，不假装没有。
 */
const RUN_STORE_PREFIX = 'mp-agent-team-run:';

function loadStoredRunId(sessionId: string): string {
  if (!sessionId) return '';
  try {
    return localStorage.getItem(RUN_STORE_PREFIX + sessionId) ?? '';
  } catch {
    return '';
  }
}

function storeRunId(sessionId: string, runId: string): void {
  if (!sessionId) return;
  try {
    if (runId) localStorage.setItem(RUN_STORE_PREFIX + sessionId, runId);
    else localStorage.removeItem(RUN_STORE_PREFIX + sessionId);
  } catch {
    // 本地存不了就退化成"刷新后不恢复"，不影响本轮调度本身
  }
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

/**
 * 解析回答末尾的 claims JSON 块。
 *
 * 模型输出形态不稳定：可能裸输出、可能包在 ```json 代码块里、可能前后带空白或
 * 一句收尾话。这里用配对括号扫描定位 `{"claims": [ ... ]}`（而非宽松正则），
 * 解析失败就原样返回、不吞正文。
 */
function extractClaims(content: string): { content: string; claims: Claim[] } {
  const start = content.indexOf('{"claims"');
  if (start < 0) return { content, claims: [] };

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return { content, claims: [] };

  try {
    const parsed = JSON.parse(content.slice(start, end)) as {
      claims?: Array<{ content?: string; text?: string; type: Claim['type']; confidence?: number }>;
    };
    const claims: Claim[] = (parsed.claims ?? [])
      .filter((c) => c && (c.content || c.text))
      .map((c) => ({
        claimId: generateId(),
        content: c.content ?? c.text ?? '',
        type: c.type,
        confidence: c.confidence,
      }));
    if (claims.length === 0) return { content, claims: [] };
    // 连同可能包裹它的 ```json 代码块一起剥掉，避免留下空围栏。
    const before = content.slice(0, start).replace(/```(?:json)?\s*$/, '');
    const after = content.slice(end).replace(/^\s*```/, '');
    return { content: `${before}${after}`.trim(), claims };
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

function restoreHistoryMetadata(
  metadata: Record<string, unknown> | undefined,
): ChatMessage['metadata'] {
  if (!metadata) return undefined;
  const routingDecisions = Array.isArray(metadata.routingDecisions)
    ? metadata.routingDecisions
      .map(parseRoutingDecisionEvent)
      .filter((decision): decision is RoutingDecision => decision !== null)
    : undefined;
  return {
    ...(metadata as ChatMessage['metadata']),
    ...(routingDecisions ? { routingDecisions } : {}),
  };
}

// ============ 组件 ============

const { Configure } = AIChatInput;

// ============ 技能 / 模板 / 建议 常量 ============

const SKILLS: Skill[] = [
  { icon: <IconTemplateStroked />, value: 'writing', label: '帮我写作', hasTemplate: true },
  { icon: <IconSearch />, value: 'research', label: '联网搜索' },
];

const SUGGESTION_SEEDS = ['天气如何', '空气质量', '工作进程', '日程安排'];

const WRITING_TEMPLATES: Array<{ title: string; desc: string; content: string }> = [
  {
    title: '总结汇报',
    desc: '凝练你的工作成效',
    content:
      '我的职业是<input-slot placeholder="[请输入职业]"></input-slot>，帮我写一份关于<input-slot placeholder="[输入目的]"></input-slot>的总结汇报',
  },
  {
    title: '话术',
    desc: '满足不同场景表达需求',
    content:
      '我是一名<select-slot value="打工人" options=\'["打工人","学生"]\'></select-slot>，帮我写一段面向<input-slot placeholder="[输入对象]">陌生同事</input-slot>的话术内容',
  },
  {
    title: '宣传文案',
    desc: '撰写各平台的推广文案',
    content:
      '帮我写一篇面向<input-slot placeholder="[输入目标人群]"></input-slot>职场人士，关于<input-slot placeholder="[输入产品]"></input-slot>的宣传文案，需要直击痛点，吸引用户点击。',
  },
];

/** 写作模板面板：点击模板将内容插入输入框（Semi List 承载，无自绘样式） */
function TemplatePanel({ onTemplateClick }: { onTemplateClick: (content: string) => void }) {
  return (
    <List
      size="small"
      split={false}
      dataSource={WRITING_TEMPLATES}
      renderItem={(item) => (
        <List.Item
          onClick={() => onTemplateClick(item.content)}
          header={<IconTemplateStroked />}
          main={
            <>
              <div>
                <Typography.Text strong>{item.title}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="tertiary" size="small">{item.desc}</Typography.Text>
              </div>
            </>
          }
        />
      )}
    />
  );
}

export default function ChatPage() {
  // --- 会话与消息状态 ---
  // 起始为空列表：会话一律来自后端 conversations 接口，不预置任何演示数据。
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>(() => '');
  const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
  const [agentMode, setAgentMode] = useState(false);
  // Agent 产品层（agent-team run）：一句话 → 拆任务图 → 派数字员工 → 真实执行 →
  // 停人工确认。调度过程**常驻在会话历史之上**，不散在每条消息里。
  const [teamMode, setTeamMode] = useState(false);
  const [teamRunId, setTeamRunId] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const { run: teamRun, setRun: setTeamRun, live: teamRunLive, refresh: refreshTeamRun } =
    useAgentTeamRun(teamRunId);
  const [agentSteps, setAgentSteps] = useState<Record<string, any[]>>({});
  // 本体证据 / 待确认提案：按 assistant 消息 id 归集，与 agentSteps 同构。
  const [agentEvidence, setAgentEvidence] = useState<Record<string, Evidence[]>>({});
  const [agentProposals, setAgentProposals] = useState<Record<string, AgentProposalEvent[]>>({});
  // 点「同意」后打开确认抽屉的提案（抽屉负责 confirm + execute）。
  const [pendingProposal, setPendingProposal] = useState<AgentProposalEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sessionPanelVisible, setSessionPanelVisible] = useState(true);
  const [currentModel, setCurrentModel] = useState('doubao-pro-32k');
  // 用户手动改选过模型后，后台 default_model 加载完成不再覆盖选择
  const modelTouchedRef = useRef(false);
  const [temperature, setTemperature] = useState(70);
  const [imageFiles, setImageFiles] = useState<FileItem[]>([]);
  const [isMultimodal, setIsMultimodal] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [multimodalModels, setMultimodalModels] = useState<MultimodalModel[]>([]);
  const [availableModels, setAvailableModels] = useState<{ label: string; value: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const loadedHistoryRef = useRef<Set<string>>(new Set());
  const aiInputRef = useRef<any>(null);
  // 引用区留空：不预置示例引用，交由用户自行添加
  const [references, setReferences] = useState<Reference[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // 对话角色名取当前登录用户（无登录态时退化为中性称呼，不写死 Admin）
  const currentUserName = useMemo(() => getUser()?.username ?? '我', []);

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
        Toast.warning('会话列表加载失败');
      })
      .finally(() => {
        setConversationsLoading(false);
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
          metadata: restoreHistoryMetadata(m.metadata),
        }));
        setSessions((prev) =>
          prev.map((s) => (s.id === activeId ? { ...s, messages } : s)),
        );
      })
      .catch(() => {
        Toast.warning('会话历史加载失败，保留本地消息');
      });
  }, [activeId]);

  // --- 调度视图恢复：切会话 / 刷新页面后，从本地记的 run_id 去 GET /runs/{id} 取回 ---
  useEffect(() => {
    setTeamRun(null);
    setTeamRunId(loadStoredRunId(activeId));
  }, [activeId, setTeamRun]);

  // --- 模型列表：文本聊天走后台 AI Provider 配置（/models/chat），多模态单独加载 ---
  useEffect(() => {
    listChatModels()
      .then((source) => {
        setAvailableModels(source.items.map((m) => ({ label: m.name || m.modelId, value: m.modelId })));
        // 默认选中后台配置的 default_model；用户已手动改选时不覆盖
        if (source.defaultModel && !modelTouchedRef.current) {
          setCurrentModel(source.defaultModel);
        }
      })
      .catch(() => {
        // 模型列表加载失败：保持空可选列表，不伪造可用模型
      });
    listMultimodalModels()
      .then((models) => {
        setMultimodalModels(models);
      })
      .catch(() => {
        // 多模态模型列表加载失败：上传分支选择时自行提示
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
            content: `[警告] ${error instanceof Error ? error.message : '多模态请求失败'}`,
            status: 'error',
          }));
        } finally {
          setLoading(false);
        }
        return;
      }

      // Agent 产品层分支：一句话交给 agent-team，拆任务图 → 派数字员工 → 真实执行
      // → 停人工确认。**调度过程落在上方常驻的调度区域**，消息里只留一条受理回执
      // ——这是"两套调度表示合一"的关键：调度不再散在每条消息里。
      if (teamMode) {
        const userMessage = createMessage('user', trimmed, { status: 'local' });
        const assistantMessage = createMessage('assistant', '', { status: 'loading' });
        updateSession(sessionId, (s) => ({
          ...s,
          messages: [...s.messages, userMessage, assistantMessage],
          updatedAt: now(),
          title: s.title === '新对话' ? trimmed.slice(0, 24) || '新对话' : s.title,
        }));
        setScheduleOpen(true);
        try {
          const accepted = await startRun(trimmed, 3, newIdempotencyKey());
          storeRunId(sessionId, accepted.run_id);
          setTeamRun(null);
          setTeamRunId(accepted.run_id);
          updateMessage(sessionId, assistantMessage.id, (m) => ({
            ...m,
            status: 'success',
            content: `已受理这一轮（run_id：${accepted.run_id}）。任务图、员工状态与产出见上方「Agent 产品层调度」区域。`,
          }));
        } catch (error) {
          updateMessage(sessionId, assistantMessage.id, (m) => ({
            ...m,
            content: `[警告] 提交 Agent 产品层失败：${error instanceof Error ? error.message : '未知错误'}`,
            status: 'error',
          }));
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

      if (agentMode) {
        streamAgentChat(
          [
            { role: 'system', content: UNIFIED_SYSTEM_PROMPT },
            ...historyMessages,
            { role: 'user', content: trimmed },
          ],
          {
            onReasoning: (text) => {
              updateMessage(sessionId, assistantId, (m) => ({
                ...m,
                metadata: {
                  ...(m.metadata || {}),
                  thinking: ((m.metadata?.thinking as string | undefined) ?? '') + text,
                },
              }));
            },
            onToolCall: (call) => {
              // 只有 dispatch_employee 才是「调度数字员工」。本体工具调用
              // （list_classes / query_* / propose_* …）由证据卡片和提案卡片
              // 承载，不能在这里记成一次员工调度——那会谎报谁干了什么。
              if (call.tool !== 'dispatch_employee') return;
              const target = (call.args.target_rid as string) ?? call.tool;
              const message = (call.args.message as string) || '';
              setAgentSteps((prev) => ({
                ...prev,
                [assistantId]: [
                  ...(prev[assistantId] || []),
                  {
                    callId: call.callId,
                    type: 'agent',
                    status: 'in_progress',
                    summary: `调度 ${target} 数字员工`,
                    actions: [
                      { status: 'in_progress', summary: message || '委派任务' },
                    ],
                  },
                ],
              }));
            },
            onToolResult: (res) => {
              setAgentSteps((prev) => {
                const steps = [...(prev[assistantId] || [])];
                const idx = steps.findIndex((st) => st.callId === res.callId);
                if (idx < 0) return prev;
                const inner = (res.result?.result as Record<string, unknown> | undefined) ?? {};
                const role = (res.result?.role as string) ?? '数字员工';
                const workerKind = (res.result?.worker_kind as string) ?? '';
                const outcomeStatus =
                  (res.result?.polled_state as string) ??
                  (inner.status as string) ??
                  (res.result?.status as string) ??
                  'completed';
                const a2aTask = (inner.task_id as string) ?? (res.result?.task_id as string) ?? '';
                const done = res.status !== 'error' && outcomeStatus === 'completed';
                const summary = a2aTask
                  ? `${workerKind ? `${workerKind} 任务` : '任务'} ${a2aTask} · ${outcomeStatus}`
                  : done
                    ? '调度完成'
                    : '委派已提交';
                const step = {
                  ...steps[idx],
                  status: res.status === 'error' ? 'failed' : done ? 'completed' : 'in_progress',
                  summary: res.status === 'error' ? `调度 ${role} 失败` : `已调度 ${role}`,
                  actions: [
                    {
                      status: res.status === 'error' ? 'failed' : done ? 'completed' : 'in_progress',
                      summary,
                      description: res.status === 'error' ? JSON.stringify(res.result) : undefined,
                    },
                  ],
                };
                steps[idx] = step;
                return { ...prev, [assistantId]: steps };
              });
            },
            onRoutingDecision: ({ decision }) => {
              updateMessage(sessionId, assistantId, (m) => ({
                ...m,
                metadata: {
                  ...(m.metadata || {}),
                  routingDecisions: [...(m.metadata?.routingDecisions ?? []), decision],
                },
              }));
            },
            onRoutingDecisionError: ({ message }) => {
              updateMessage(sessionId, assistantId, (m) => ({
                ...m,
                metadata: clearRoutingDecisionForStreamError(m.metadata, message),
              }));
            },
            onEvidence: (ev) => {
              if (ev.items.length === 0) return;
              setAgentEvidence((prev) => ({
                ...prev,
                [assistantId]: [...(prev[assistantId] || []), ...ev.items],
              }));
            },
            onProposal: (proposal) => {
              setAgentProposals((prev) => {
                const existing = prev[assistantId] || [];
                if (existing.some((p) => p.proposalId === proposal.proposalId)) return prev;
                return { ...prev, [assistantId]: [...existing, proposal] };
              });
            },
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
                content: `[警告] ${errMsg}`,
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
        return;
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
              content: `[警告] ${errMsg}`,
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
    [activeSession, loading, updateSession, updateMessage, isMultimodal, selectedModelId, imageFiles, currentModel, temperature, agentMode, teamMode],
  );

  /** 人工确认闸门 / 取消：控制面调用会等图停下再回话，所以单独一个 busy。 */
  const callTeam = useCallback(
    async (fn: (id: string) => Promise<RunState>, failMsg: string) => {
      if (!teamRunId) return;
      setTeamBusy(true);
      try {
        setTeamRun(await fn(teamRunId));
        await refreshTeamRun();
      } catch (e) {
        Toast.error(`${failMsg}：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setTeamBusy(false);
      }
    },
    [teamRunId, refreshTeamRun, setTeamRun],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  // 「详细讨论」：把提案上下文回填成追问，让 AI 带着上下文重新推理。
  const handleDiscussProposal = useCallback(
    (proposal: AgentProposalEvent) => {
      const kindLabel = PROPOSAL_KIND_LABEL[proposal.kind] ?? proposal.kind;
      const lines = [`我想详细讨论刚才这个提案（${kindLabel}，id: ${proposal.proposalId}）。`];
      if (proposal.impactSummary) {
        lines.push(`提案影响：${proposal.impactSummary}`);
      }
      lines.push('请先说明它的依据和潜在风险，再给出可选的修订方案。');
      void handleSend(lines.join('\n'));
    },
    [handleSend],
  );

  // --- 引用 / 建议 / 技能 / 模板 ---
  const handleReferenceDelete = useCallback((item: Reference) => {
    setReferences((prev) => prev.filter((r) => r.id !== item.id));
  }, []);

  const handleReferenceClick = useCallback((item: Reference) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener');
    } else if (typeof item.content === 'string') {
      Toast.info(item.content);
    } else if (item.name) {
      Toast.info(item.name);
    }
  }, []);

  const handleContentChange = useCallback((contents: Array<{ type: string; [key: string]: unknown }>) => {
    const text = extractPlainText(contents);
    if (text.includes('\n')) {
      setSuggestions([]);
      return;
    }
    if (text.length === 0) {
      setSuggestions([]);
    } else if (text.length < 4) {
      setSuggestions(SUGGESTION_SEEDS.map((seed) => `${text}，${seed}`));
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleSuggestClick = useCallback(
    (suggestion: Suggestion) => {
      const s = suggestion as unknown as string | string[] | { content?: string };
      const text = typeof s === 'string' ? s : Array.isArray(s) ? s.join('') : (s.content ?? '');
      if (text) void handleSend(text);
    },
    [handleSend],
  );

  const handleTemplateClick = useCallback((content: string) => {
    aiInputRef.current?.setContentWhileSaveTool?.(content);
    aiInputRef.current?.focusEditor?.();
  }, []);

  const renderTemplate = useCallback(
    (skill: Skill) => (skill.value === 'writing' ? <TemplatePanel onTemplateClick={handleTemplateClick} /> : null),
    [handleTemplateClick],
  );

  // --- 会话 CRUD（后端对接） ---
  const handleNewConversation = useCallback(async () => {
    try {
      const conv = await apiCreateConversation({ title: '新对话', mode: 'chat' });
      // The freshly created conversation is known to have no remote messages.
      // Mark it loaded before switching activeId so its empty-history request
      // cannot race with the user's first live stream and overwrite it.
      loadedHistoryRef.current.add(conv.id);
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
          const steps = agentSteps[msg.id];
          if (steps && steps.length > 0) {
            contentItems.push({ type: 'steps', steps });
          }
          const routingDecisions = msg.metadata?.routingDecisions as RoutingDecision[] | undefined;
          const routingDecisionError = msg.metadata?.routingDecisionError;
          if ((routingDecisions && routingDecisions.length > 0) || routingDecisionError) {
            contentItems.push({ type: 'routing_decision', routingDecisions, routingDecisionError });
          }
        }
        if (text) {
          const annotations: Array<{ title: string; detail?: string; url?: string }> = [];
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
        // AI 的分析与建议：把回答拆成 事实 / 推断 / 建议（带置信度），
        // 放在正文之后、证据之前 —— 先给结论，再给支撑，最后给动作。
        if (msg.claims && msg.claims.length > 0) {
          contentItems.push({ type: 'claims', claims: msg.claims });
        }
        // 证据放在回答之后（引用面）：流式取证的本体对象 + onDone 汇总的
        // citations / graph 证据。
        const mergedEvidence = [...(msg.evidence ?? []), ...(agentEvidence[msg.id] ?? [])];
        if (mergedEvidence.length > 0) {
          contentItems.push({ type: 'evidence', evidence: mergedEvidence });
        }
        // 后续 action 计划：AI 提议 → 用户 同意/讨论/驳回。
        for (const proposal of agentProposals[msg.id] ?? []) {
          contentItems.push({ type: 'proposal', proposal });
        }
        return {
          id: msg.id,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: contentItems,
          status,
          createdAt: msg.createdAt ? Date.parse(msg.createdAt) : Date.now(),
        };
      }),
    [activeSession?.messages, streamingMap, agentSteps, agentEvidence, agentProposals],
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

  // 无活动会话：加载中给加载态，加载完成后给诚实空态（两者视觉可区分）
  if (!activeSession) {
    return (
      <div className="mp-split mp-page-full">
        <div className="mp-split-main">
          {conversationsLoading ? (
            <PageLoading tip="正在加载会话…" />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无会话"
              desc="新建一个会话，开始与 SuperAI 对话。"
              actions={
                <Button
                  theme="solid"
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => void handleNewConversation()}
                >
                  新建会话
                </Button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  // ============ 渲染 ============
  return (
    <div className="mp-split mp-page-full">
      {/* ===== 左：对话区 ===== */}
      <div className="mp-split-main">
        {/* chat-topbar：侧栏开关 + 对话标题 + 运行状态 */}
        <div className="mp-pagetabs">
          <Row type="flex" align="middle" justify="space-between">
            <Col span={19}>
              <Typography.Text strong ellipsis={{ showTooltip: true }}>
                {activeSession.title}
              </Typography.Text>
            </Col>
            <Space align="center" spacing={8}>
              {isSessionRunning(activeSession) && (
                <Tag color="blue" size="small" prefixIcon={<span className="mp-exec-dot is-running" />}>
                  运行中
                </Tag>
              )}
              <Button
                theme="borderless"
                size="small"
                icon={sessionPanelVisible ? <IconChevronRight /> : <IconChevronLeft />}
                title={sessionPanelVisible ? '收起会话侧栏' : '展开会话侧栏'}
                onClick={() => setSessionPanelVisible((v) => !v)}
              />
            </Space>
          </Row>
        </div>

        {/* 常驻调度区域：会话历史**之上**的那一块。任务图 / 员工状态 / 波次 /
            终态 / 证据 / 交付物都在这里，不再散在每条消息里。 */}
        <div className="mp-schedule-region" data-testid="chat-schedule-region">
          <div className="mp-schedule-head">
            <span className="mp-evidence-section-title">Agent 产品层调度</span>
            <span className="mp-team-chips">
              {teamRun ? (
                <Tag
                  color={teamRun.status === 'awaiting_approval' ? 'amber' : teamRun.status === 'running' ? 'blue' : teamRun.status === 'completed' ? 'green' : 'grey'}
                  type="light"
                  data-testid="chat-schedule-status"
                >
                  {STATUS_TAG[teamRun.status].label}
                </Tag>
              ) : null}
              {teamRunLive ? (
                <Tag color="blue" type="light" data-testid="chat-schedule-live">
                  实时
                </Tag>
              ) : null}
              <button
                type="button"
                className="mp-proposal-btn"
                onClick={() => setScheduleOpen((v) => !v)}
                data-testid="chat-schedule-toggle"
              >
                {scheduleOpen ? '收起' : '展开'}
              </button>
            </span>
          </div>
          {scheduleOpen ? (
            teamRun || teamRunId ? (
              <AgentTeamSchedule
                run={teamRun}
                runId={teamRunId}
                live={teamRunLive}
                busy={teamBusy}
                onApprove={(approved) =>
                  void callTeam(
                    (id) => approveRun(id, approved),
                    approved ? '确认失败' : '驳回失败',
                  )
                }
                onCancel={() => void callTeam((id) => cancelRun(id), '取消失败')}
              />
            ) : (
              <Typography.Text type="tertiary" data-testid="chat-schedule-empty">
                打开下方「Agent 产品层」后发一句话，这里会实时显示任务图、员工状态与波次。
              </Typography.Text>
            )
          ) : null}
        </div>

        {/* 消息流（官方 AIChatDialogue：左右布局 + reasoning + annotations） */}
        <div className="mp-split-main">
          <AIChatDialogue
            key={activeSession.id}
            roleConfig={{
              user: { name: currentUserName },
              assistant: { name: 'SuperAI' },
            }}
            dialogueRenderConfig={{
              renderDialogueAvatar: ({ message }) => (
                <Avatar size="extra-small" color={message?.role === 'user' ? 'blue' : 'grey'}>
                  {message?.role === 'user' ? <IconUser size="extra-small" /> : <IconUserCircle size="extra-small" />}
                </Avatar>
              ),
            }}
            renderDialogueContentItem={{
              steps: (item: any) => {
                const steps: any[] = item.steps ?? [];
                if (steps.length === 0) return null;
                return (
                  <div className="mp-exec-col">
                    {steps.map((s: any, i: number) => {
                      const dotState = s.status === 'failed' ? 'is-failed' : s.status === 'completed' ? 'is-done' : 'is-running';
                      return (
                        <div key={i}>
                          <div className="mp-exec-step-head">
                            <span className={`mp-exec-dot ${dotState}`} />
                            <span className="mp-exec-step-title">{s.summary}</span>
                          </div>
                          {(s.actions ?? []).map((a: any, j: number) => (
                            <div key={j} className="mp-exec-step-body">
                              {a.summary}
                              {a.description ? (
                                <div>
                                  <Typography.Text type="tertiary" size="small">{a.description}</Typography.Text>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              },
              routing_decision: (item: { routingDecisions?: RoutingDecision[]; routingDecisionError?: string }) => {
                const decisions = item.routingDecisions ?? [];
                return decisions.length > 0 || item.routingDecisionError
                  ? <RoutingDecisionPanel decision={decisions} streamError={item.routingDecisionError} />
                  : null;
              },
              claims: (item: { claims?: Claim[] }) => {
                const list = item.claims ?? [];
                if (list.length === 0) return null;
                const counts = list.reduce<Record<string, number>>((acc, c) => {
                  acc[c.type] = (acc[c.type] ?? 0) + 1;
                  return acc;
                }, {});
                const summary = (['FACT', 'INFERENCE', 'RECOMMENDATION'] as const)
                  .filter((t) => counts[t])
                  .map((t) => `${CLAIM_TYPE_LABEL[t] ?? t} ${counts[t]}`)
                  .join(' · ');
                return (
                  <div className="mp-claims-section">
                    <div className="mp-evidence-section-title">
                      AI 分析与建议{summary ? ` · ${summary}` : ''}
                    </div>
                    <div className="mp-claims-list">
                      {list.map((c) => (
                        <ClaimRenderer key={c.claimId} claim={c} />
                      ))}
                    </div>
                  </div>
                );
              },
              evidence: (item: { evidence?: Evidence[] }) => {
                const list = item.evidence ?? [];
                if (list.length === 0) return null;
                // 指向具体本体对象的证据 → 关系图 + 对象数据；
                // 类型级 / 文档类证据仍平铺成卡片。
                const objectEvidence = list.filter(
                  (e) => e.type === 'ONTOLOGY_OBJECT' && e.objectId,
                );
                const restEvidence = list.filter(
                  (e) => !(e.type === 'ONTOLOGY_OBJECT' && e.objectId),
                );
                return (
                  <div className="mp-evidence-section">
                    <div className="mp-evidence-section-title">本体证据 · {list.length}</div>
                    <OntologyEvidencePanel evidence={objectEvidence} />
                    {restEvidence.length > 0 ? (
                      <EvidenceRenderer evidenceList={restEvidence} />
                    ) : null}
                  </div>
                );
              },
              proposal: (item: { proposal?: AgentProposalEvent }) => {
                const proposal = item.proposal;
                if (!proposal) return null;
                const resolvedStatus =
                  proposal.status === 'executed' || proposal.status === 'rejected'
                    ? proposal.status
                    : null;
                return (
                  <ProposalActionCard
                    proposal={proposal}
                    resolvedStatus={resolvedStatus}
                    onApprove={(p) => setPendingProposal(p)}
                    onDiscuss={handleDiscussProposal}
                    onRejected={(id) =>
                      setAgentProposals((prev) => {
                        const next: Record<string, AgentProposalEvent[]> = {};
                        for (const [key, list] of Object.entries(prev)) {
                          next[key] = list.map((p) =>
                            p.proposalId === id ? { ...p, status: 'rejected' } : p,
                          );
                        }
                        return next;
                      })
                    }
                  />
                );
              },
            }}
            chats={semiMessages}
            hints={activeSession.messages.length === 0 ? WELCOME_PROMPTS : EMPTY_HINTS}
            onHintClick={(hint) => {
              void handleSend(hint);
            }}
          />
        </div>

        {/* 输入框（官方 Configure：模型 / 深度思考 / 思考模式 / 附件） */}
        <AIChatInput
          ref={aiInputRef}
          immediatelyRender={false}
          placeholder="输入消息，Shift + Enter 换行..."
          sendHotKey="enter"
          round={false}
          references={references}
          onReferenceDelete={handleReferenceDelete}
          onReferenceClick={handleReferenceClick}
          suggestions={suggestions as unknown as Suggestion[]}
          onContentChange={handleContentChange}
          onSuggestClick={handleSuggestClick}
          skills={SKILLS}
          skillHotKey="/"
          renderTemplate={renderTemplate}
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
              {/* key 使 default_model 异步加载完成后重挂载同步显示（initValue 仅挂载时生效）；
                  选中交互在 dev 预览窗可能被 React 事件委托截断（既有环境怪癖），非本改动引入 */}
              <Configure.Select
                key={`model-${currentModel}`}
                optionList={availableModels}
                field="model"
                initValue={currentModel}
              />
              <Button
                size="small"
                type={agentMode ? 'primary' : 'tertiary'}
                icon={<RobotOutlined size={14} />}
                onClick={() => setAgentMode((v) => !v)}
              >
                {agentMode ? 'Agent 调度中' : 'Agent 调度'}
              </Button>
              {/* Agent 产品层：走 agent-team run（任务图 / 派数字员工 / 人工确认），
                  调度过程显示在上方的常驻区域。用原生 button —— dev 预览窗里
                  Semi Button 的 onClick 会被 React 事件委托截断（既有环境怪癖）。 */}
              <button
                type="button"
                className={`mp-proposal-btn${teamMode ? ' mp-proposal-btn--primary' : ''}`}
                onClick={() => setTeamMode((v) => !v)}
                data-testid="chat-team-mode"
              >
                {teamMode ? 'Agent 产品层 · 开' : 'Agent 产品层'}
              </button>
              <Configure.Button icon={<IconBolt />} field="thinking">
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
            // Semi Configure.onRemove 以单参调用（无 changedValue），须可选链
            if (changedValue?.model != null) {
              modelTouchedRef.current = true;
              setCurrentModel(changedValue.model);
            }
            if (changedValue?.thinkType != null) {
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
          options={[{ key: 'toolbar', icon: null, name: null }]}
          renderOptionItem={() => (
            <>
              <Button theme="solid" type="primary" icon={<IconPlus />} block onClick={() => void handleNewConversation()}>
                新建会话
              </Button>
              <Input
                placeholder="搜索会话..."
                prefix={<IconSearch />}
                showClear
                value={searchKeyword}
                onChange={(v) => setSearchKeyword(v)}
              />
            </>
          )}
          renderMainContent={() => (
            <>
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
                        <div className="mp-pane-title">{g.label}</div>
                        <List
                          split={false}
                          dataSource={g.items}
                          renderItem={(s) => (
                            <List.Item
                              key={s.id}
                              onClick={() => handleSelectConversation(s.id)}
                              header={
                                isSessionRunning(s) ? <span className="mp-exec-dot is-running" /> : undefined
                              }
                              main={
                                <>
                                  <div>
                                    <Typography.Text strong ellipsis={{ showTooltip: true }}>
                                      {s.title}
                                    </Typography.Text>
                                  </div>
                                  <Space spacing={6}>
                                    <Typography.Text type="tertiary" size="small">
                                      {new Date(s.updatedAt).toLocaleString('zh-CN', {
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </Typography.Text>
                                    {s.id === activeId ? (
                                      <Tag color="blue" size="small">当前</Tag>
                                    ) : null}
                                  </Space>
                                </>
                              }
                              extra={
                                <Space spacing={2}>
                                  <Button
                                    size="small"
                                    theme="borderless"
                                    icon={s.favorite ? <IconStar /> : <IconStarStroked />}
                                    title={s.favorite ? '取消收藏' : '收藏'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleToggleFavorite(s.id);
                                    }}
                                  />
                                  <Button
                                    size="small"
                                    theme="borderless"
                                    icon={<IconDelete />}
                                    title="删除会话"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleDeleteConversation(s.id);
                                    }}
                                  />
                                </Space>
                              }
                            />
                          )}
                        />
                      </div>
                    ))}
                  </>
                );
              })()}
            </>
          )}
        />
      )}

      {/* 提案确认抽屉（复用本体域状态机：preview + preflight → confirm → execute） */}
      <ProposalConfirmDrawer
        open={pendingProposal !== null}
        proposalId={pendingProposal?.proposalId ?? null}
        initialKind={pendingProposal?.kind}
        onExecuted={(proposalId) => {
          setAgentProposals((prev) => {
            const next: Record<string, AgentProposalEvent[]> = {};
            for (const [key, list] of Object.entries(prev)) {
              next[key] = list.map((p) =>
                p.proposalId === proposalId ? { ...p, status: 'executed' } : p,
              );
            }
            return next;
          });
        }}
        onClosed={() => setPendingProposal(null)}
      />
    </div>
  );
}
