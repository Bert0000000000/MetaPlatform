import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Chat,
  Empty,
  Layout,
  Space,
  Switch,
  Tabs,
  Tag,
  Timeline,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import type { Message as SemiMessage } from '@douyinfe/semi-ui/lib/es/chat/interface';
import {
  AppstoreAddOutlined,
  ArrowLeftOutlined,
  ExportOutlined,
  FileTextOutlined,
  LayoutOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { chatCompletions } from '@/api/apphub/llm';
import { addCreatedTemplate, type TemplateCategory } from './data/templates';
import type {
  AIArtifact,
  AIFormArtifact,
  AIFlowArtifact,
  AIPageArtifact,
  AIDesignerMode,
  AIGeneratedApp,
  AIGeneratedModule,
  ChatMessage,
} from '@/api/apphub/types/ai-designer';
import type { FormField, FlowNode } from '@/api/apphub/types';
import type { DashboardWidget } from '@/api/apphub/pages';
import { PageRoot } from '@mate/shared';

const { Sider, Content } = Layout;
const SESSIONS_KEY = 'metaplatform:ai-designer:sessions';
const ACTIVE_KEY = 'metaplatform:ai-designer:active-key';
const ARTIFACTS_KEY = 'metaplatform:ai-designer:artifacts';
const AI_APPS_KEY = 'metaplatform:ai-designer:apps';
const MODE_KEY = 'metaplatform:ai-designer:mode';
const DEFAULT_ORDER: Array<'form' | 'flow' | 'page'> = ['form', 'flow', 'page'];

interface ChatSession {
  key: string;
  label: string;
  messages: ChatMessage[];
  artifacts: AIArtifact[];
}

function buildSystemPrompt(mode: AIDesignerMode): string {
  const base = `你是 Mate Platform 的 AI 应用设计助手。用户会用自然语言描述业务需求，你需要将其解析为低代码产物，并在回复末尾以 JSON 代码块输出。

可生成的产物类型：
1. form：表单定义，config 使用 FormConfig 结构，包含 name、description、fields 等字段。
2. flow：流程定义，config 使用 FlowConfig 结构，包含 name、description、nodes（start/approval/condition/end）、edges。
3. page：页面布局，config 使用 PageDesignerConfig 结构，包含 name、description、widgets（列表页用 table、详情页用 stat/rich-text 等）。

回复规则：
- 先用自然语言与用户确认需求，必要时询问缺失信息。
- 当需求足够清晰时，在回复末尾输出严格如下格式的 JSON 代码块：`;

  const singleRules = `
- 如果用户只要求修改某一类产物，仅输出该类型 artifact。
- form 的每个字段必须包含 id、type、label、fieldKey；flow 的节点必须包含 id、type、name、position；page 的组件必须包含 id、type、title、position。`;

  const fullRules = `
当前为「生成完整应用」模式：用户描述业务场景后，请始终输出 form + flow + page 三个 artifact，共同构成一个可运行的应用。

关联规则：
- 流程节点（approval/condition）必须通过 formBindings 引用表单字段的 fieldKey，使审批时能看到并依据表单字段。
- 页面看板中必须包含至少一个展示流程审批状态的 widget（stat/table），其 dataSource 应标识为流程状态（如 sourceId 为 "flowStatus" 或 query 包含 "status"）。
- 如果用户只要求修改某个产物（如"把审批流程增加一级部门经理审批"），可仅输出该类型 artifact，系统会自动替换已有产物。

输出示例：
\`\`\`json
{
  "artifacts": [
    { "type": "form", "name": "...", "description": "...", "config": { ... } },
    { "type": "flow", "name": "...", "description": "...", "config": { ... } },
    { "type": "page", "name": "...", "description": "...", "config": { ... } }
  ]
}
\`\`\``;

  return `${base}
\`\`\`json
{
  "artifacts": [
    { "type": "form", "name": "...", "description": "...", "config": { ... } },
    { "type": "flow", "name": "...", "description": "...", "config": { ... } },
    { "type": "page", "name": "...", "description": "...", "config": { ... } }
  ]
}
\`\`\`
${mode === 'full' ? fullRules : singleRules}`;
}

function generateId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function extractArtifacts(content: string): AIArtifact[] | null {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { artifacts?: AIArtifact[] };
    if (Array.isArray(parsed.artifacts)) {
      return parsed.artifacts;
    }
    return null;
  } catch {
    return null;
  }
}

function isFormArtifact(a: AIArtifact): a is AIFormArtifact {
  return a.type === 'form';
}

function isFlowArtifact(a: AIArtifact): a is AIFlowArtifact {
  return a.type === 'flow';
}

function isPageArtifact(a: AIArtifact): a is AIPageArtifact {
  return a.type === 'page';
}

function mergeArtifacts(
  prev: AIArtifact[],
  extracted: AIArtifact[] | null,
  mode: AIDesignerMode,
): AIArtifact[] {
  if (!extracted || extracted.length === 0) return prev;
  const map = new Map<ArtifactType, AIArtifact>();
  prev.forEach((a) => map.set(a.type, a));
  extracted.forEach((a) => map.set(a.type, a));
  if (mode === 'full') {
    return DEFAULT_ORDER.map((t) => map.get(t)).filter(Boolean) as AIArtifact[];
  }
  return Array.from(map.values());
}

type ArtifactType = 'form' | 'flow' | 'page';

function makeTitle(text: string): string {
  return text.trim().slice(0, 20) || '新对话';
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadActiveKey(): string | undefined {
  return localStorage.getItem(ACTIVE_KEY) || undefined;
}

function saveActiveKey(key: string | undefined) {
  if (key) {
    localStorage.setItem(ACTIVE_KEY, key);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

function saveArtifactsToStorage(artifacts: AIArtifact[]) {
  localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts));
}

function loadMode(): AIDesignerMode {
  const raw = localStorage.getItem(MODE_KEY);
  return raw === 'full' ? 'full' : 'single';
}

function saveMode(mode: AIDesignerMode) {
  localStorage.setItem(MODE_KEY, mode);
}

function loadGeneratedApps(): AIGeneratedApp[] {
  try {
    const raw = localStorage.getItem(AI_APPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIGeneratedApp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGeneratedApp(app: AIGeneratedApp) {
  const list = loadGeneratedApps();
  list.unshift(app);
  localStorage.setItem(AI_APPS_KEY, JSON.stringify(list));
}

function toAppCode(name: string): string {
  const code = name
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return code || `app_${Date.now()}`;
}

function buildGeneratedApp(artifacts: AIArtifact[]): AIGeneratedApp | null {
  const form = artifacts.find(isFormArtifact);
  const flow = artifacts.find(isFlowArtifact);
  const page = artifacts.find(isPageArtifact);
  if (!form || !flow || !page) return null;

  const now = new Date().toISOString();
  const appId = `app_${Date.now()}`;
  const name = form.config.name || flow.config.name || page.config.name || 'AI 生成应用';
  const code = toAppCode(name);
  const app: AIGeneratedApp = {
    appId,
    name,
    code,
    description: form.config.description || flow.config.description || page.config.description || '',
    icon: 'AppstoreOutlined',
    group: 'AI 生成',
    status: 'DESIGNING',
    moduleCount: 3,
    createdAt: now,
    updatedAt: now,
    modules: [],
  };

  const formModule: AIGeneratedModule = {
    moduleId: `mod_${Date.now()}_form`,
    appId,
    name: form.config.name || '表单',
    code: `${code}_form`,
    type: 'FORM',
    description: form.description || 'AI 生成的表单',
    icon: 'FileTextOutlined',
    config: form.config,
    createdAt: now,
    updatedAt: now,
  };

  const flowModule: AIGeneratedModule = {
    moduleId: `mod_${Date.now()}_flow`,
    appId,
    name: flow.config.name || '流程',
    code: `${code}_flow`,
    type: 'FLOW',
    description: flow.description || 'AI 生成的审批流程',
    icon: 'NodeIndexOutlined',
    config: flow.config,
    createdAt: now,
    updatedAt: now,
  };

  const pageModule: AIGeneratedModule = {
    moduleId: `mod_${Date.now()}_page`,
    appId,
    name: page.config.name || '看板页面',
    code: `${code}_page`,
    type: 'PAGE',
    description: page.description || 'AI 生成的看板页面',
    icon: 'LayoutOutlined',
    config: page.config,
    createdAt: now,
    updatedAt: now,
  };

  app.modules = [formModule, flowModule, pageModule];
  return app;
}

function exportAsTemplate(artifacts: AIArtifact[]) {
  const form = artifacts.find(isFormArtifact);
  const flow = artifacts.find(isFlowArtifact);
  if (!form || !flow) {
    Toast.warning('缺少表单或流程产物，无法导出模板');
    return;
  }

  const fields = form.config.fields.map((f) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    type: (f.type as TemplateFieldType) || 'text',
    required: f.required,
    placeholder: f.placeholder,
    options: f.options?.map((o) => (typeof o === 'string' ? o : o.label)),
  }));

  const flows = [
    {
      name: flow.config.name,
      description: flow.config.description,
      nodes: flow.config.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        assignee:
          n.config && 'assigneeType' in n.config
            ? n.config.assigneeIds.join(', ')
            : undefined,
      })),
    },
  ];

  const tpl = addCreatedTemplate({
    name: form.config.name || 'AI 生成模板',
    category: 'Collaboration' as TemplateCategory,
    description: form.config.description || '由 AI 设计器生成的应用模板',
    icon: 'AppstoreOutlined',
    tags: ['AI生成'],
    author: 'AI 设计器',
    screenshots: [],
    fields,
    flows,
    createdAt: new Date().toISOString(),
  });

  Toast.success(`已导出为模板「${tpl.name}」，可在应用市场查看`);
}

type TemplateFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'file';

function renderFormPreview(artifact: AIFormArtifact) {
  const cfg = artifact.config;
  return (
    <Space vertical style={{ width: '100%' }}>
      <Typography.Text strong>{cfg.name}</Typography.Text>
      <Typography.Paragraph type="tertiary">
        {cfg.description || artifact.description}
      </Typography.Paragraph>
      <Space wrap>
        {cfg.fields.map((f: FormField) => (
          <Tag key={f.id} color={f.required ? 'red' : 'blue'}>
            {f.label} ({f.type})
            {f.required ? ' *' : ''}
          </Tag>
        ))}
      </Space>
    </Space>
  );
}

function renderFlowPreview(artifact: AIFlowArtifact) {
  const cfg = artifact.config;
  return (
    <Space vertical style={{ width: '100%' }}>
      <Typography.Text strong>{cfg.name}</Typography.Text>
      <Typography.Paragraph type="tertiary">
        {cfg.description || artifact.description}
      </Typography.Paragraph>
      <Space wrap>
        {cfg.nodes.map((n: FlowNode) => (
          <Tag
            key={n.id}
            color={
              n.type === 'start' ? 'green' : n.type === 'end' ? 'red' : 'blue'
            }
          >
            {n.name}
          </Tag>
        ))}
      </Space>
    </Space>
  );
}

function renderPagePreview(artifact: AIPageArtifact) {
  const cfg = artifact.config;
  return (
    <Space vertical style={{ width: '100%' }}>
      <Typography.Text strong>{cfg.name}</Typography.Text>
      <Typography.Paragraph type="tertiary">
        {cfg.description || artifact.description}
      </Typography.Paragraph>
      <Space wrap>
        {cfg.widgets.map((w: DashboardWidget) => (
          <Tag key={w.id} color="purple">
            {w.title} ({w.type})
          </Tag>
        ))}
      </Space>
    </Space>
  );
}

function renderAppPreview(
  form: AIFormArtifact,
  flow: AIFlowArtifact,
  page: AIPageArtifact,
) {
  const formBindings = flow.config.nodes
    .flatMap((n) => n.formBindings || [])
    .map((b) => b.fieldKey);
  const boundFieldLabels = form.config.fields
    .filter((f) => formBindings.includes(f.fieldKey))
    .map((f) => f.label);

  const statusWidgets = page.config.widgets.filter(
    (w) =>
      w.dataSource?.sourceId?.toLowerCase().includes('flow') ||
      w.dataSource?.query?.toLowerCase().includes('status') ||
      w.type === 'stat',
  );

  return (
    <Timeline
      mode="left"
      style={{ marginTop: 8 }}
      dataSource={[
        {
          time: '表单',
          dot: <FileTextOutlined />,
          content: (
            <Space vertical spacing="tight" style={{ width: '100%' }}>
              <Typography.Text strong>{form.config.name}</Typography.Text>
              <Typography.Paragraph type="tertiary" style={{ margin: 0 }}>
                {form.config.description}
              </Typography.Paragraph>
              <Space wrap>
                {form.config.fields.map((f) => (
                  <Tag key={f.id} color={f.required ? 'red' : 'blue'}>
                    {f.label}
                  </Tag>
                ))}
              </Space>
            </Space>
          ),
        },
        {
          time: '流程',
          dot: <NodeIndexOutlined />,
          content: (
            <Space vertical spacing="tight" style={{ width: '100%' }}>
              <Typography.Text strong>{flow.config.name}</Typography.Text>
              <Typography.Paragraph type="tertiary" style={{ margin: 0 }}>
                {flow.config.description}
              </Typography.Paragraph>
              <Space wrap>
                {flow.config.nodes.map((n) => (
                  <Tag
                    key={n.id}
                    color={
                      n.type === 'start'
                        ? 'green'
                        : n.type === 'end'
                          ? 'red'
                          : 'blue'
                    }
                  >
                    {n.name}
                  </Tag>
                ))}
              </Space>
              {boundFieldLabels.length > 0 && (
                <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                  流程引用字段：{boundFieldLabels.join('、')}
                </Typography.Text>
              )}
            </Space>
          ),
        },
        {
          time: '页面',
          dot: <LayoutOutlined />,
          content: (
            <Space vertical spacing="tight" style={{ width: '100%' }}>
              <Typography.Text strong>{page.config.name}</Typography.Text>
              <Typography.Paragraph type="tertiary" style={{ margin: 0 }}>
                {page.config.description}
              </Typography.Paragraph>
              <Space wrap>
                {page.config.widgets.map((w) => (
                  <Tag key={w.id} color="purple">
                    {w.title} ({w.type})
                  </Tag>
                ))}
              </Space>
              {statusWidgets.length > 0 && (
                <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                  流程状态看板：
                  {statusWidgets.map((w) => w.title).join('、')}
                </Typography.Text>
              )}
            </Space>
          ),
        },
      ]}
    />
  );
}

export default function AIDesignerPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeKey, setActiveKey] = useState<string | undefined>(loadActiveKey());
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AIDesignerMode>(loadMode);
  const [previewTab, setPreviewTab] = useState<'artifacts' | 'app'>('artifacts');
  const sessionsRef = useRef(sessions);

  sessionsRef.current = sessions;

  useEffect(() => {
    saveActiveKey(activeKey);
  }, [activeKey]);

  const currentSession = useMemo(
    () => sessions.find((s) => s.key === activeKey),
    [sessions, activeKey],
  );

  // 业务消息 → Semi Chat 消息（system 消息不展示）；请求进行中追加 loading 占位气泡
  const displayChats = useMemo<SemiMessage[]>(() => {
    const base: SemiMessage[] = currentSession
      ? currentSession.messages
          .filter((m) => m.role !== 'system')
          .map((m, idx) => ({
            id: `${currentSession.key}-${idx}`,
            role: m.role,
            content: m.content,
            status: 'complete',
          }))
      : [];
    return loading
      ? [
          ...base,
          {
            id: `${currentSession?.key ?? 'pending'}-pending`,
            role: 'assistant',
            content: '',
            status: 'loading',
          },
        ]
      : base;
  }, [currentSession, loading]);

  const currentArtifacts = useMemo(
    () => currentSession?.artifacts || [],
    [currentSession],
  );

  const formArtifact = useMemo(
    () => currentArtifacts.find(isFormArtifact),
    [currentArtifacts],
  );
  const flowArtifact = useMemo(
    () => currentArtifacts.find(isFlowArtifact),
    [currentArtifacts],
  );
  const pageArtifact = useMemo(
    () => currentArtifacts.find(isPageArtifact),
    [currentArtifacts],
  );

  const hasFullApp = Boolean(formArtifact && flowArtifact && pageArtifact);

  useEffect(() => {
    if (mode === 'full' && hasFullApp) {
      setPreviewTab('app');
    }
  }, [mode, hasFullApp]);

  const handleModeChange = (checked: boolean) => {
    const next = checked ? 'full' : 'single';
    setMode(next);
    saveMode(next);

    if (activeKey) {
      const system: ChatMessage = { role: 'system', content: buildSystemPrompt(next) };
      const nextSessions = sessionsRef.current.map((s) =>
        s.key === activeKey
          ? { ...s, messages: [system, ...s.messages.slice(1)] }
          : s,
      );
      setSessions(nextSessions);
      saveSessions(nextSessions);
    }
  };

  const handleCreateSession = () => {
    const newSession: ChatSession = {
      key: generateId(),
      label: '新对话',
      messages: [{ role: 'system', content: buildSystemPrompt(mode) }],
      artifacts: [],
    };
    const next = [...sessions, newSession];
    setSessions(next);
    setActiveKey(newSession.key);
    saveSessions(next);
  };

  const handleActiveChange = (key: string) => {
    setActiveKey(key);
  };

  const handleSend = async (text: string) => {
    if (!activeKey) {
      Toast.warning('请先创建对话');
      return;
    }
    if (!text.trim()) return;

    const session = sessionsRef.current.find((s) => s.key === activeKey);
    if (!session) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const messagesWithUser = [...session.messages, userMessage];
    const nextWithUser = sessionsRef.current.map((s) =>
      s.key === activeKey
        ? {
            ...s,
            messages: messagesWithUser,
            label: s.label === '新对话' ? makeTitle(text) : s.label,
          }
        : s,
    );
    setSessions(nextWithUser);
    saveSessions(nextWithUser);

    setLoading(true);
    try {
      const res = await chatCompletions({
        messages: messagesWithUser,
        autoRoute: true,
      });
      const assistantContent = res.choices[0]?.message?.content || '无回复';
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
      };
      const messagesWithAssistant = [...messagesWithUser, assistantMessage];
      const extracted = extractArtifacts(assistantContent);
      const artifacts = mergeArtifacts(session.artifacts, extracted, mode);
      const next = sessionsRef.current.map((s) =>
        s.key === activeKey
          ? { ...s, messages: messagesWithAssistant, artifacts }
          : s,
      );
      setSessions(next);
      saveSessions(next);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (currentArtifacts.length === 0) {
      Toast.warning('当前没有可应用的产物');
      return;
    }
    saveArtifactsToStorage(currentArtifacts);
    Toast.success(`已将 ${currentArtifacts.length} 个产物保存到本地`);
  };

  const handleCreateApp = () => {
    if (!hasFullApp) {
      Toast.warning('当前产物不完整，需包含表单、流程、页面才能创建应用');
      return;
    }
    const app = buildGeneratedApp(currentArtifacts);
    if (!app) {
      Toast.warning('无法组装应用，请检查产物完整性');
      return;
    }
    saveGeneratedApp(app);
    Toast.success(`已创建应用「${app.name}」并保存到本地`);
  };

  const handleExportTemplate = () => {
    if (currentArtifacts.length === 0) {
      Toast.warning('当前没有可导出的产物');
      return;
    }
    exportAsTemplate(currentArtifacts);
  };

  return (
    <PageRoot>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps')}>
            返回
          </Button>
          <Typography.Text strong style={{ fontSize: 16 }}>
            <RobotOutlined /> AI 设计器
          </Typography.Text>
        </Space>

        <Space>
          <Tooltip content="开启后 AI 将自动生成表单+流程+页面完整应用">
            <Space>
              <Switch checked={mode === 'full'} onChange={handleModeChange} />
              <Typography.Text>生成完整应用</Typography.Text>
            </Space>
          </Tooltip>
          <Button
            icon={<SaveOutlined />}
            disabled={currentArtifacts.length === 0}
            onClick={handleApply}
          >
            应用到当前应用
          </Button>
          <Button
            type="primary"
            icon={<AppstoreAddOutlined />}
            disabled={!hasFullApp}
            onClick={handleCreateApp}
          >
            一键创建应用
          </Button>
          <Button
            icon={<ExportOutlined />}
            disabled={currentArtifacts.length === 0}
            onClick={handleExportTemplate}
          >
            导出为模板
          </Button>
        </Space>
      </div>

      <Layout style={{ flex: 1, overflow: 'hidden', background: 'transparent' }}>
        <Sider
          style={{ width: 240, background: 'transparent', marginRight: 16 }}
        >
          {/* 会话列表（替代旧 antd Conversations）：新建 + 列表项 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <Button
              type="primary"
              icon={<AppstoreAddOutlined />}
              block
              onClick={handleCreateSession}
            >
              新建对话
            </Button>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {sessions.map((s) => (
                <div
                  key={s.key}
                  onClick={() => handleActiveChange(s.key)}
                  title={s.label}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    marginBottom: 2,
                    background: s.key === activeKey ? 'var(--muted)' : 'transparent',
                    color: 'var(--foreground)',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'background .15s',
                  }}
                >
                  {s.label}
                </div>
              ))}
              {sessions.length === 0 && (
                <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: '16px 0' }}>
                  暂无对话
                </Typography.Text>
              )}
            </div>
          </div>
        </Sider>

        <Content style={{ display: 'flex', gap: 16, minWidth: 0 }}>
          <Card
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {currentSession ? (
              <Chat
                key={currentSession.key}
                style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 'none', paddingTop: 0, paddingBottom: 0 }}
                align="leftRight"
                mode="bubble"
                chats={displayChats}
                roleConfig={{
                  assistant: { avatar: <RobotOutlined /> },
                }}
                chatBoxRenderConfig={{
                  // 与原 Bubble.List 一致：用户侧不显示头像
                  renderChatBoxAvatar: ({ message, defaultAvatar }) =>
                    message && message.role === 'user' ? null : defaultAvatar,
                }}
                onMessageSend={(content) => {
                  void handleSend(content);
                }}
                placeholder={
                  mode === 'full'
                    ? '描述业务场景，例如：创建一个员工请假应用，包含请假表单、部门经理审批流程和审批状态看板'
                    : '描述业务需求，例如：创建一个请假申请单，包含申请人、请假类型、起止时间、事由字段，并绑定审批流程'
                }
                sendHotKey="enter"
              />
            ) : (
              <Empty description="请选择或新建对话" style={{ margin: 'auto' }} />
            )}
          </Card>

          <Card
            title="产物与应用预览"
            bodyStyle={{ overflow: 'auto' }}
            style={{ width: 420, overflow: 'auto' }}
          >
            {currentArtifacts.length === 0 ? (
              <Empty description="暂无产物，与 AI 对话生成" />
            ) : (
              <Tabs
                activeKey={previewTab}
                onChange={(k) => setPreviewTab(k as 'artifacts' | 'app')}
              >
                <Tabs.TabPane tab="产物预览" itemKey="artifacts">
                  <Tabs>
                    {currentArtifacts.map((artifact, idx) => (
                      <Tabs.TabPane
                        key={String(idx)}
                        itemKey={String(idx)}
                        tab={
                          artifact.type === 'form'
                            ? '表单'
                            : artifact.type === 'flow'
                              ? '流程'
                              : '页面'
                        }
                      >
                        <div>
                          {artifact.type === 'form' &&
                            renderFormPreview(artifact)}
                          {artifact.type === 'flow' &&
                            renderFlowPreview(artifact)}
                          {artifact.type === 'page' &&
                            renderPagePreview(artifact)}
                        </div>
                      </Tabs.TabPane>
                    ))}
                  </Tabs>
                </Tabs.TabPane>
                <Tabs.TabPane tab="应用预览" itemKey="app" disabled={!hasFullApp}>
                  {formArtifact && flowArtifact && pageArtifact ? (
                    renderAppPreview(formArtifact, flowArtifact, pageArtifact)
                  ) : (
                    <Empty description="请先生成完整的表单、流程、页面产物" />
                  )}
                </Tabs.TabPane>
              </Tabs>
            )}
          </Card>
        </Content>
      </Layout>
    </PageRoot>
  );
}
