import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Bubble, Sender, Welcome } from '@ant-design/x';
import { Button, Tabs, Typography, Flex, Tag, Space, Tooltip, Select, Card, theme } from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  CodeOutlined,
  ApartmentOutlined,
  TeamOutlined,
  GlobalOutlined,
  BookOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { streamChat } from '@/api/chat';
import { listKnowledgeBases, search as ragSearch } from '@/api/rag';
import { semanticQuery as ontSemanticQuery } from '@/api/ontology';
import HistorySidebar from '@/components/HistorySidebar';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import AnalysisPanel from '@/components/AnalysisPanel';
import ActionPanel from '@/components/ActionPanel';
import ExplorePanel from '@/components/ExplorePanel';
import GeneratePanel from '@/components/GeneratePanel';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import type {
  ChatSession,
  ChatMessage,
  ChatMode,
  Citation,
  KnowledgeBase,
  SqlAuditResult,
  ChartType,
  ChartDataSet,
  ActionResult,
  GraphData,
  GeneratedConfig,
  CodeReviewResult,
} from '@/types';

const MODES: { key: ChatMode; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: '问答', icon: <MessageOutlined /> },
  { key: 'analysis', label: '分析', icon: <BarChartOutlined /> },
  { key: 'action', label: '操作', icon: <ThunderboltOutlined /> },
  { key: 'exploration', label: '探索', icon: <ApartmentOutlined /> },
  { key: 'code', label: '代码', icon: <CodeOutlined /> },
  { key: 'task', label: '编排', icon: <TeamOutlined /> },
  { key: 'dispatch', label: '调度', icon: <GlobalOutlined /> },
];

const MODE_SYSTEM_PROMPTS: Record<ChatMode, string> = {
  chat: '你是 Mate Platform 的智能助手 SuperAI，请用专业、简洁的中文回答。回答时请使用 Markdown 格式，支持标题、列表、代码块等。',
  analysis: '你是 Mate Platform 的数据分析助手。用户会用自然语言描述分析需求，请帮助生成 SQL、执行查询并可视化结果。',
  action: '你是 Mate Platform 的 Action 执行助手。根据用户的描述匹配合适的 Action，并辅助用户填写参数后执行。',
  exploration: '你是 Mate Platform 的 Ontology 探索助手。帮助用户通过自然语言查询企业知识图谱，探索概念、实体和关系。',
  code: '你是 Mate Platform 的代码生成助手。根据用户描述生成表单配置、审批流程、代码片段、仪表盘配置等。支持代码解释和安全审查。',
  task: '你是 Mate Platform 的任务编排助手。帮助用户拆解复杂任务，编排多个步骤和 Action 完成端到端流程。',
  dispatch: '你是 Mate Platform 的调度助手。帮助用户协调多个领域的数字员工协作完成跨域任务。',
};

const MODE_PLACEHOLDER: Record<ChatMode, string> = {
  chat: '请输入您的问题，按 Ctrl + Enter 发送',
  analysis: '描述您想分析的数据，如：按部门统计本月销售额',
  action: '描述您想执行的操作，如：给合同快到期的客户发送提醒',
  exploration: '探索企业数据关系，如：客户A有哪些关联的合同和订单',
  code: '描述您想生成的内容，如：生成一个客户信息登记表单',
  task: '描述您的复杂任务，如：分析上个季度的客户流失原因并生成报告',
  dispatch: '描述需要多领域数字员工协作的专业问题',
};

const WELCOME_PROMPTS = [
  '什么是 Ontology 本体引擎？',
  '按部门统计本月销售额',
  '给合同快到期的客户发送续签提醒',
  '生成一个客户信息登记表单',
];

const MAX_CONTEXT_TURNS = 10;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
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

function CitationList({ citations }: { citations?: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <Space wrap size="small" style={{ marginTop: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        📚 参考来源：
      </Typography.Text>
      {citations.map((c) => (
        <Tooltip key={c.id} title={c.snippet} placement="topLeft">
          <Tag color="blue" style={{ cursor: 'pointer', maxWidth: 200 }}>
            {c.title} ({c.score}%)
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
}

export default function ChatPage() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

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
  const [modeQuery, setModeQuery] = useState('');

  useEffect(() => {
    listKnowledgeBases().then(setKnowledgeBases).catch(() => {});
  }, []);

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
    const session = createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setInput('');
    setModeQuery('');
  }, []);

  const handleSelectConversation = useCallback((key: string) => {
    setActiveId(key);
    setInput('');
    setModeQuery('');
  }, []);

  const handleDeleteConversation = useCallback((key: string) => {
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
  }, [sessions]);

  const handleToggleFavorite = useCallback((id: string) => {
    updateSession(id, (session) => ({
      ...session,
      favorite: !session.favorite,
    }));
  }, [updateSession]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const sessionId = activeSession.id;
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

      const systemPrompt = MODE_SYSTEM_PROMPTS[activeSession.mode];

      // In exploration mode, fetch ontology graph in parallel and embed into the assistant message.
      if (activeSession.mode === 'exploration') {
        ontSemanticQuery(trimmed)
          .then((graphData) => {
            updateMessage(sessionId, assistantId, (msg) => ({
              ...msg,
              metadata: { ...(msg.metadata || {}), graphData },
            }));
          })
          .catch(() => {
            /* Graph fetch failed; assistant text response still shows. */
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
            updateMessage(sessionId, assistantId, (msg) => ({
              ...msg,
              content: msg.content + delta,
            }));
          },
          onDone: (citations) => {
            updateMessage(sessionId, assistantId, (msg) => ({
              ...msg,
              status: 'success',
              streaming: false,
              citations: citations.length > 0 ? citations : ragCitations,
            }));
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
      );
    },
    [activeSession, loading, updateSession, updateMessage, selectedKbIds],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleModeChange = useCallback(
    (mode: string) => {
      updateSession(activeSession.id, (session) => ({
        ...session,
        mode: mode as ChatMode,
      }));
      setModeQuery('');
    },
    [activeSession.id, updateSession],
  );

  const handleModeResult = useCallback(
    (metadata: {
      sql?: string;
      sqlAudit?: SqlAuditResult;
      chartData?: ChartDataSet;
      chartType?: ChartType;
      actionResult?: ActionResult;
      graphData?: GraphData;
      generatedConfig?: GeneratedConfig;
      codeReview?: CodeReviewResult;
    }) => {
      const sessionId = activeSession.id;
      const lastAssistantMsg = activeSession.messages
        .filter((m) => m.role === 'assistant')
        .pop();
      if (lastAssistantMsg) {
        updateMessage(sessionId, lastAssistantMsg.id, (msg) => ({
          ...msg,
          metadata: { ...msg.metadata, ...metadata },
        }));
      }
    },
    [activeSession, updateMessage],
  );

  const contextTurns = Math.ceil(
    activeSession.messages.filter((m) => m.status === 'success').length / 2,
  );

  const renderModePanel = () => {
    switch (activeSession.mode) {
      case 'analysis':
        return (
          <AnalysisPanel
            query={modeQuery}
            onQueryChange={setModeQuery}
            onResult={handleModeResult}
          />
        );
      case 'action':
        return (
          <ActionPanel
            query={modeQuery}
            onQueryChange={setModeQuery}
            onResult={handleModeResult}
          />
        );
      case 'exploration':
        return (
          <ExplorePanel
            query={modeQuery}
            onQueryChange={setModeQuery}
            onResult={handleModeResult}
          />
        );
      case 'code':
        return (
          <GeneratePanel
            query={modeQuery}
            onQueryChange={setModeQuery}
            onResult={handleModeResult}
          />
        );
      default:
        return null;
    }
  };

  const isModePanelVisible = ['analysis', 'action', 'exploration', 'code'].includes(
    activeSession.mode,
  );

  const bubbleItems: React.ComponentProps<typeof Bubble.List>['items'] = useMemo(() => {
    return activeSession.messages.map((msg) => {
      const isUser = msg.role === 'user';
      const graphData = !isUser ? msg.metadata?.graphData : undefined;
      return {
        key: msg.id,
        role: isUser ? 'user' : 'ai',
        status: msg.status,
        placement: isUser ? ('end' as const) : ('start' as const),
        streaming: msg.streaming,
        loading: msg.status === 'loading',
        content: isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        ) : (
          <div>
            <MarkdownRenderer content={msg.content || '...'} />
            {graphData && graphData.nodes.length > 0 && (
              <Card
                size="small"
                style={{ marginTop: 12, background: 'transparent' }}
                bodyStyle={{ padding: 8 }}
                title={
                  <Space size={4}>
                    <ApartmentOutlined />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      知识图谱 · {graphData.nodes.length} 节点 / {graphData.edges.length} 关系
                    </Typography.Text>
                  </Space>
                }
              >
                <KnowledgeGraph data={graphData} height={300} />
              </Card>
            )}
          </div>
        ),
        footer:
          !isUser && msg.citations && msg.citations.length > 0
            ? () => <CitationList citations={msg.citations} />
            : undefined,
      };
    });
  }, [activeSession.messages]);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 64px - 32px)' }}>
      <div
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            padding: 12,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <HistorySidebar
            sessions={sessions}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onNew={handleNewConversation}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>

        <Card size="small" title={<Space><BookOutlined />知识库</Space>} style={{ flexShrink: 0 }}>
          <Select
            mode="multiple"
            placeholder="选择知识库"
            value={selectedKbIds}
            onChange={setSelectedKbIds}
            style={{ width: '100%' }}
            options={knowledgeBases.map((kb) => ({
              label: `${kb.name} (${kb.documentCount}篇)`,
              value: kb.id,
            }))}
            maxTagCount={2}
          />
        </Card>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          padding: 24,
        }}
      >
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Space>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {activeSession.title}
            </Typography.Title>
            <Tag color="blue">{MODES.find((m) => m.key === activeSession.mode)?.label}</Tag>
          </Space>
          <Space size="small">
            <Tooltip title={`上下文中有 ${contextTurns} 轮对话（最多 ${MAX_CONTEXT_TURNS} 轮）`}>
              <Tag icon={<HistoryOutlined />} color={contextTurns >= MAX_CONTEXT_TURNS ? 'orange' : 'default'}>
                上下文：{contextTurns}/{MAX_CONTEXT_TURNS} 轮
              </Tag>
            </Tooltip>
            {activeSession.favorite && <Tag color="gold">★ 已收藏</Tag>}
          </Space>
        </Flex>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeSession.messages.length === 0 && !isModePanelVisible ? (
            <Flex style={{ flex: 1 }} align="center" justify="center">
              <Welcome
                icon={<RobotOutlined style={{ fontSize: 48 }} />}
                title="你好，我是 SuperAI"
                description="Mate Platform 的统一 AI 交互入口。基于 Ontology 与 RAG，为您提供可溯源的智能问答、数据分析、Action 执行等能力。"
                extra={
                  <Space wrap style={{ justifyContent: 'center', marginTop: 16 }}>
                    {WELCOME_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        type="dashed"
                        onClick={() => handleSend(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </Space>
                }
              />
            </Flex>
          ) : (
            <Bubble.List
              items={bubbleItems}
              autoScroll
              role={{
                ai: { placement: 'start', avatar: <RobotOutlined /> },
                user: { placement: 'end', avatar: <UserOutlined /> },
              }}
            />
          )}
        </div>

        {isModePanelVisible && (
          <div style={{ marginTop: 8, maxHeight: 400, overflow: 'auto' }}>
            {renderModePanel()}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Tabs
            activeKey={activeSession.mode}
            onChange={handleModeChange}
            size="small"
            items={MODES.map((m) => ({
              key: m.key,
              label: (
                <Space size={4}>
                  {m.icon}
                  <span>{m.label}</span>
                </Space>
              ),
            }))}
            style={{ marginBottom: 8 }}
          />
          <Sender
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            loading={loading}
            onCancel={handleCancel}
            placeholder={MODE_PLACEHOLDER[activeSession.mode]}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </div>
      </div>
    </div>
  );
}
