/**
 * AdminComponentsPage
 * --------------------------------------------------
 * 后台管理 / 组件库 Tab
 *
 * 严格按 metaplatform-design-draft/pages/components.html 原型 1:1 还原：
 *  - Sidebar 顶部导航 + 高亮"后台管理"
 *  - Breadcrumb：后台管理 / 组件库
 *  - Page Header：标题"组件库" + 操作按钮（导出 / 查看仓库 / 新建组件）
 *  - Tab Bar：全部 / UI 组件 / 流程节点 / 插件 / 文档
 *  - 4 个 Section：UI 组件 / 流程节点（含 palette + dropzone + 节点目录） / 插件 / 文档
 *
 * 实现要点：
 *  - 全部交互行为本地 useState 维护：tab 切换、palette 类目过滤、palette 搜索、
 *    palette 分组折叠、拖拽到画布、节点目录分组、插件安装切换。
 *  - 颜色变量、间距、圆角与原型完全一致（var(--background)/var(--foreground)/…）。
 *  - 图标统一使用 lucide-react，与 portal 其他页面风格保持一致。
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  Database,
  BookOpen,
  Settings,
  User,
  Download,
  Github,
  Plus,
  LayoutGrid,
  MousePointerClick,
  Workflow,
  PlugZap,
  BookText,
  ChevronDown,
  Search,
  Circle,
  CircleDot,
  UserCheck,
  Diamond,
  PlusSquare,
  Layers,
  FileText,
  Wrench,
  Bot as BotIcon,
  Code,
  Bell,
  Mail,
  MessageSquare,
  Link,
  Globe,
  Radio,
  Folder,
  RefreshCcw,
  Clock,
  Zap,
  FileInput,
  Link2,
  GitBranch as GitBranchIcon,
  Repeat,
  Combine,
  Hourglass,
  Star,
  Save,
  History,
  Map,
  Grid3x3,
  Image,
  FileJson,
  Users,
  Trash2,
  Check,
  X,
  Tag,
  Info,
  Square,
  SquareStack,
  CheckCircle,
  AlertCircle,
  Library,
  Box,
  Cog,
  ArrowRight,
  MousePointer2,
} from 'lucide-react';
import { Breadcrumb, PageHeader, SubTabs, type SubTabItem } from '@mate/shared';
import {
  ALL_NODE_REGISTRIES,
  flowDataToFlowgram,
  type FlowData,
} from '@mate/shared/flow';
import { ACFlowgramEditor } from './flowgram-editor';
import { AC_NODE_CARD_CSS, AC_NODE_RENDER_REGISTRIES } from './node-render';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

// ---------------- 节点类型定义 ---------------- //
type NodeCategory = 'bpmn' | 'ai' | 'business' | 'data' | 'trigger' | 'control';

interface PaletteNodeDef {
  key: string;
  name: string;
  sub: string;
  cat: NodeCategory;
  /** 节点英文标题（如 Start Event / LLM ...） */
  titleEn: string;
  /** 端口描述（如 1/1、N/1、0/1） */
  ports: string;
  Icon: typeof Circle;
}

const NODE_TITLE_EN: Record<string, string> = {
  start: 'Start Event',
  end: 'End Event',
  'user-task': 'User Task',
  'service-task': 'Service Task',
  exclusive: 'Exclusive Gateway',
  parallel: 'Parallel Gateway',
  inclusive: 'Inclusive Gateway',
  subprocess: 'Sub-Process',
  llm: 'LLM',
  prompt: 'Prompt Template',
  tool: 'Tool Use',
  rag: 'RAG Retrieval',
  'agent-decision': 'Agent Decision',
  'code-exec': 'Code Exec',
  'form-collect': 'Form Collect',
  'data-query': 'Data Query',
  'data-write': 'Data Write',
  notify: 'Notification',
  email: 'Email',
  sms: 'SMS',
  webhook: 'Webhook',
  'manual-task': 'Manual Task',
  'db-connect': 'DB Connect',
  http: 'HTTP Request',
  mq: 'MQ',
  'file-storage': 'File Storage',
  etl: 'ETL',
  schedule: 'Schedule',
  'event-trigger': 'Event Trigger',
  'form-submit': 'Form Submit',
  'webhook-trigger': 'Webhook Trigger',
  condition: 'Condition',
  loop: 'Loop',
  'parallel-control': 'Parallel',
  merge: 'Merge',
  wait: 'Wait',
};

const NODE_PORTS: Record<string, string> = {
  start: '1/0',
  end: '0/1',
  'user-task': '1/1',
  'service-task': '1/1',
  exclusive: '2/1',
  parallel: 'N/1',
  inclusive: 'N/1',
  subprocess: '1/1',
  llm: '1/1',
  prompt: '1/1',
  tool: '1/1',
  rag: '1/1',
  'agent-decision': '3/1',
  'code-exec': '1/1',
  'form-collect': '1/1',
  'data-query': '1/1',
  'data-write': '1/1',
  notify: '1/1',
  email: '1/1',
  sms: '1/1',
  webhook: '1/1',
  'manual-task': '1/1',
  'db-connect': '1/1',
  http: '1/1',
  mq: '1/1',
  'file-storage': '1/1',
  etl: '1/1',
  schedule: '1/0',
  'event-trigger': '1/0',
  'form-submit': '1/0',
  'webhook-trigger': '1/0',
  condition: '2/1',
  loop: '1/1',
  'parallel-control': 'N/1',
  merge: '1/N',
  wait: '1/1',
};

function buildPaletteNode(
  key: string,
  name: string,
  sub: string,
  cat: NodeCategory,
  Icon: typeof Circle
): PaletteNodeDef {
  return {
    key,
    name,
    sub,
    cat,
    titleEn: NODE_TITLE_EN[key] ?? key,
    ports: NODE_PORTS[key] ?? '1/1',
    Icon,
  };
}

const PALETTE_NODES: PaletteNodeDef[] = [
  // BPMN
  buildPaletteNode('start', '开始事件', '流程起点', 'bpmn', Circle),
  buildPaletteNode('end', '结束事件', '流程终点', 'bpmn', CircleDot),
  buildPaletteNode('user-task', '审批节点', '人工审批任务', 'bpmn', UserCheck),
  buildPaletteNode('service-task', '服务任务', '系统自动执行', 'bpmn', Settings),
  buildPaletteNode('exclusive', '排他网关', '单分支条件', 'bpmn', Diamond),
  buildPaletteNode('parallel', '并行网关', '并发分支', 'bpmn', PlusSquare),
  buildPaletteNode('inclusive', '包容网关', '多分支汇聚', 'bpmn', CircleDot),
  buildPaletteNode('subprocess', '子流程', '嵌套流程', 'bpmn', Layers),
  // AI
  buildPaletteNode('llm', 'LLM 调用', '模型推理入口', 'ai', Sparkles),
  buildPaletteNode('prompt', 'Prompt 模板', '变量化模板', 'ai', FileText),
  buildPaletteNode('tool', '工具调用', 'Function Calling', 'ai', Wrench),
  buildPaletteNode('rag', 'RAG 检索', '知识库增强', 'ai', BookOpen),
  buildPaletteNode('agent-decision', 'Agent 决策', '智能路由', 'ai', BotIcon),
  buildPaletteNode('code-exec', 'Code 执行', '沙箱运行', 'ai', Code),
  // Business
  buildPaletteNode('form-collect', '表单收集', '用户填报表单', 'business', FileText),
  buildPaletteNode('data-query', '数据查询', '本体查询', 'business', Search),
  buildPaletteNode('data-write', '数据写入', '持久化数据', 'business', Database),
  buildPaletteNode('notify', '通知发送', '站内消息', 'business', Bell),
  buildPaletteNode('email', '邮件发送', 'SMTP 发送', 'business', Mail),
  buildPaletteNode('sms', '短信发送', '短信网关', 'business', MessageSquare),
  buildPaletteNode('webhook', 'Webhook', 'HTTP 回调', 'business', Link),
  buildPaletteNode('manual-task', '人工任务', '线下执行', 'business', User),
  // Data
  buildPaletteNode('db-connect', '数据库连接', 'JDBC 接入', 'data', Database),
  buildPaletteNode('http', 'API 调用', 'HTTP Request', 'data', Globe),
  buildPaletteNode('mq', '消息队列', 'Kafka/MQ', 'data', Radio),
  buildPaletteNode('file-storage', '文件存储', '对象存储', 'data', Folder),
  buildPaletteNode('etl', 'ETL 任务', '数据抽取转换', 'data', RefreshCcw),
  // Trigger
  buildPaletteNode('schedule', '定时触发', 'Cron 表达式', 'trigger', Clock),
  buildPaletteNode('event-trigger', '事件触发', 'MQ 事件源', 'trigger', Zap),
  buildPaletteNode('form-submit', '表单提交', '用户主动提交', 'trigger', FileInput),
  buildPaletteNode('webhook-trigger', 'Webhook 触发', '外部回调', 'trigger', Link2),
  // Control
  buildPaletteNode('condition', '条件分支', 'If/Else', 'control', GitBranchIcon),
  buildPaletteNode('loop', '循环', '遍历迭代', 'control', Repeat),
  buildPaletteNode('parallel-control', '并行', '并发执行', 'control', Layers),
  buildPaletteNode('merge', '合并', '汇聚结果', 'control', Combine),
  buildPaletteNode('wait', '等待', '延迟/挂起', 'control', Hourglass),
];

const PALETTE_GROUPS: Array<{ key: NodeCategory; label: string; count: number }> = [
  { key: 'bpmn', label: 'BPMN 节点', count: 8 },
  { key: 'ai', label: 'AI Agent 节点', count: 6 },
  { key: 'business', label: '业务节点', count: 8 },
  { key: 'data', label: '数据集成', count: 5 },
  { key: 'trigger', label: '触发器', count: 4 },
  { key: 'control', label: '控制流', count: 5 },
];

// 合并节点注册：先用 ALL_NODE_REGISTRIES，再用 AC_NODE_RENDER_REGISTRIES 覆盖同 type 的 formMeta.render
type Registry = (typeof ALL_NODE_REGISTRIES)[number];
const AC_MERGED_REGISTRIES: Registry[] = (() => {
  const byType: Record<string, Registry> = {};
  for (const r of ALL_NODE_REGISTRIES) byType[r.type] = r;
  for (const r of AC_NODE_RENDER_REGISTRIES) {
    const prev = byType[r.type];
    byType[r.type] = (prev ? { ...prev, ...r } : r) as Registry;
  }
  return Object.values(byType);
})();

/** 真正带 formMeta.render 的 registry（用于覆盖默认 input 渲染） */
const AC_CUSTOM_REGISTRIES: Registry[] = AC_NODE_RENDER_REGISTRIES;

// FlowGram 初始数据：覆盖页面节点库 6 类节点（BPMN / Agent / 业务 / 数据 / 触发 / 控制）
// 的完整流程图，节点卡片按 BaseNode + title/content 渲染。
const AC_COMPONENTS_FLOW: FlowData = {
  nodes: [
    // 触发
    { id: 't1', type: 'business_trigger', name: '定时触发', x: 40, y: 60, width: 150, height: 70, data: { title: '触发器', content: 'Cron · 每日 09:00' } },
    // BPMN
    { id: 's1', type: 'bpmnStart', name: '开始', x: 210, y: 60, width: 150, height: 70, data: { title: '开始事件', content: '流程入口' } },
    { id: 'ut1', type: 'bpmnUserTask', name: '员工提交', x: 380, y: 60, width: 150, height: 70, data: { title: '员工提交', content: '请假申请单' } },
    { id: 'gw1', type: 'bpmnGatewayExclusive', name: '天数判断', x: 550, y: 60, width: 150, height: 70, data: { title: '排他网关', content: '天数 ≥ 3 ?' } },
    { id: 'ut2', type: 'bpmnUserTask', name: '主管审批', x: 720, y: 0, width: 150, height: 70, data: { title: '主管审批', content: '≤ 3 天直接通过' } },
    { id: 'ut3', type: 'bpmnUserTask', name: 'HR 审批', x: 720, y: 130, width: 150, height: 70, data: { title: 'HR 审批', content: '> 3 天需 HR 复核' } },
    { id: 'pg1', type: 'bpmnGatewayParallel', name: '并行合并', x: 890, y: 60, width: 150, height: 70, data: { title: '并行网关', content: '审批流汇聚' } },
    { id: 'st1', type: 'bpmnServiceTask', name: '同步考勤', x: 1060, y: 60, width: 150, height: 70, data: { title: '服务任务', content: '调用后端 API 同步考勤' } },
    // 结束
    { id: 'e1', type: 'bpmnEnd', name: '结束', x: 1230, y: 60, width: 150, height: 70, data: { title: '结束事件', content: '流程出口' } },
    // Agent (AI)
    { id: 'ai1', type: 'agent_llm', name: 'AI 摘要', x: 40, y: 230, width: 150, height: 70, data: { title: 'LLM 调用', content: '生成请假说明摘要' } },
    { id: 'ai2', type: 'agent_knowledge', name: '知识检索', x: 210, y: 230, width: 150, height: 70, data: { title: '知识检索', content: '查询公司请假制度' } },
    { id: 'ai3', type: 'agent_tool', name: 'MCP 工具', x: 380, y: 230, width: 150, height: 70, data: { title: 'MCP 工具', content: '调用企业微信通知工具' } },
    // 业务
    { id: 'n1', type: 'business_notify', name: '通知抄送', x: 1060, y: 230, width: 150, height: 70, data: { title: '通知抄送', content: '抄送 HRBP（不阻塞）' } },
    { id: 'dl1', type: 'business_delay', name: '延时等待', x: 1230, y: 230, width: 150, height: 70, data: { title: '定时器', content: '等待 1 天未申诉则结案' } },
    // 数据集成
    { id: 'db1', type: 'business_delay', name: '数据库', x: 40, y: 350, width: 150, height: 70, data: { title: '数据库', content: '写入请假记录到 PG' } },
    { id: 'ai4', type: 'agent_output', name: '数据写入', x: 210, y: 350, width: 150, height: 70, data: { title: '数据写入', content: '持久化到本体引擎' } },
  ],
  edges: [
    { id: 'e_t1_s1', source: 't1', target: 's1' },
    { id: 'e_s1_ut1', source: 's1', target: 'ut1' },
    { id: 'e_ut1_gw1', source: 'ut1', target: 'gw1' },
    { id: 'e_gw1_ut2', source: 'gw1', target: 'ut2', label: '≤ 3' },
    { id: 'e_gw1_ut3', source: 'gw1', target: 'ut3', label: '> 3' },
    { id: 'e_ut2_pg1', source: 'ut2', target: 'pg1' },
    { id: 'e_ut3_pg1', source: 'ut3', target: 'pg1' },
    { id: 'e_pg1_st1', source: 'pg1', target: 'st1' },
    { id: 'e_st1_n1', source: 'st1', target: 'n1' },
    { id: 'e_st1_dl1', source: 'st1', target: 'dl1' },
    { id: 'e_n1_dl1', source: 'n1', target: 'dl1' },
    { id: 'e_dl1_e1', source: 'dl1', target: 'e1' },
    { id: 'e_ai1_ai2', source: 'ai1', target: 'ai2' },
    { id: 'e_ai2_ai3', source: 'ai2', target: 'ai3' },
    { id: 'e_ai3_db1', source: 'ai3', target: 'db1' },
    { id: 'e_db1_ai4', source: 'db1', target: 'ai4' },
  ],
};
const AC_FLOWGRAM_INITIAL_DATA = flowDataToFlowgram(AC_COMPONENTS_FLOW) as never;

const PALETTE_CATEGORY_BG: Record<NodeCategory, string> = {
  bpmn: 'bg-bpmn',
  ai: 'bg-ai',
  business: 'bg-business',
  data: 'bg-data',
  trigger: 'bg-trigger',
  control: 'bg-control',
};

const PALETTE_CATEGORY_BADGE: Record<NodeCategory, { label: string; cls: string }> = {
  bpmn: { label: 'BPMN', cls: 'v-badge-info' },
  ai: { label: 'AI', cls: 'v-badge-purple' },
  business: { label: 'Business', cls: 'v-badge-success' },
  data: { label: 'Data', cls: 'v-badge-warning' },
  trigger: { label: 'Trigger', cls: 'v-badge-trigger' },
  control: { label: 'Control', cls: 'v-badge-neutral' },
};

// ---------------- 插件数据 ---------------- //
interface PluginDef {
  key: string;
  name: string;
  version: string;
  desc: string;
  Icon: typeof Star;
  installed: boolean;
}

const PLUGINS: PluginDef[] = [
  { key: 'favorites', name: '节点收藏', version: 'v1.2.0', desc: '收藏常用节点到顶部快速访问面板', Icon: Star, installed: false },
  { key: 'autosave', name: '自动保存', version: 'v2.0.1', desc: '编辑时自动保存草稿，防止意外丢失', Icon: Save, installed: true },
  { key: 'history', name: '撤销历史', version: 'v1.5.0', desc: '支持多步撤销与重做，记录操作轨迹', Icon: History, installed: false },
  { key: 'minimap', name: '小地图', version: 'v1.1.2', desc: '画布缩略图，快速定位与导航大流程', Icon: Map, installed: true },
  { key: 'grid', name: '网格对齐', version: 'v1.0.3', desc: '显示网格并支持节点自动吸附对齐', Icon: Grid3x3, installed: false },
  { key: 'thumbnail', name: '缩略图预览', version: 'v1.3.0', desc: '节点悬停时显示缩略图详情预览', Icon: Image, installed: false },
  { key: 'json', name: 'JSON 导入导出', version: 'v2.1.0', desc: '将流程导出为 JSON 文件或从 JSON 导入', Icon: FileJson, installed: true },
  { key: 'collab', name: '协同编辑', version: 'v0.9.5', desc: '多人同时编辑同一流程，光标实时同步', Icon: Users, installed: false },
];

// ---------------- 文档数据 ---------------- //
interface DocRow {
  api: string;
  category: string;
  badge: string;
  desc: string;
}

interface DocSection {
  title: string;
  Icon: typeof Box;
  rows: DocRow[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    title: '核心 Core',
    Icon: Box,
    rows: [
      { api: 'FlowDocument', category: 'Core', badge: 'v-badge-info', desc: '流程文档基类，承载节点与连线数据' },
      { api: 'FlowNodeEntity', category: 'Core', badge: 'v-badge-info', desc: '节点实体定义，包含端口与属性元数据' },
      { api: 'WorkflowDocument', category: 'Core', badge: 'v-badge-info', desc: '工作流文档，扩展 FlowDocument 能力' },
      { api: 'PlayGround', category: 'Core', badge: 'v-badge-info', desc: '画布主控，负责渲染与交互分发' },
      { api: 'WorkflowLinesManager', category: 'Core', badge: 'v-badge-info', desc: '连线管理器，维护连线生命周期' },
    ],
  },
  {
    title: 'Hooks',
    Icon: Link2,
    rows: [
      { api: 'useClientContext', category: 'Hook', badge: 'v-badge-purple', desc: '获取客户端上下文与配置' },
      { api: 'useNodeRender', category: 'Hook', badge: 'v-badge-purple', desc: '自定义节点渲染钩子' },
      { api: 'usePlaygroundTools', category: 'Hook', badge: 'v-badge-purple', desc: '访问画布工具集（缩放、对齐等）' },
      { api: 'useRefresh', category: 'Hook', badge: 'v-badge-purple', desc: '强制刷新组件渲染' },
      { api: 'useService', category: 'Hook', badge: 'v-badge-purple', desc: '获取注入服务实例' },
    ],
  },
  {
    title: '组件 Components',
    Icon: SquareStack,
    rows: [
      { api: 'EditorRenderer', category: 'Component', badge: 'v-badge-success', desc: '编辑器主渲染器入口' },
      { api: 'FixedLayoutEditorProvider', category: 'Component', badge: 'v-badge-success', desc: '固定布局编辑器 Provider' },
      { api: 'FreeLayoutEditorProvider', category: 'Component', badge: 'v-badge-success', desc: '自由布局编辑器 Provider' },
      { api: 'WorkflowNodeRenderer', category: 'Component', badge: 'v-badge-success', desc: '默认节点渲染组件' },
      { api: 'JsonSchemaEditor', category: 'Component', badge: 'v-badge-success', desc: 'JSON Schema 表单编辑器' },
      { api: 'VariableSelector', category: 'Component', badge: 'v-badge-success', desc: '流程变量选择器组件' },
    ],
  },
  {
    title: '服务 Services',
    Icon: Cog,
    rows: [
      { api: 'ClipboardService', category: 'Service', badge: 'v-badge-warning', desc: '剪贴板服务，支持节点复制粘贴' },
      { api: 'CommandService', category: 'Service', badge: 'v-badge-warning', desc: '命令系统，统一操作入口' },
      { api: 'FlowOperationService', category: 'Service', badge: 'v-badge-warning', desc: '流程操作服务（增删改节点）' },
      { api: 'HistoryService', category: 'Service', badge: 'v-badge-warning', desc: '历史记录与撤销重做服务' },
      { api: 'SelectionService', category: 'Service', badge: 'v-badge-warning', desc: '节点选择状态管理服务' },
    ],
  },
  {
    title: '工具函数 Utils',
    Icon: Wrench,
    rows: [
      { api: 'DisposableCollection', category: 'Utils', badge: 'v-badge-neutral', desc: '可释放资源集合，统一管理订阅' },
      { api: 'Disposable', category: 'Utils', badge: 'v-badge-neutral', desc: '可释放对象接口' },
      { api: 'Emitter', category: 'Utils', badge: 'v-badge-neutral', desc: '事件发射器，基于类型的事件总线' },
      { api: 'getNodeForm', category: 'Utils', badge: 'v-badge-neutral', desc: '获取节点表单实例的工具函数' },
    ],
  },
];

// ---------------- 主组件 ---------------- //
export default function AdminComponentsPage() {
  const location = useLocation();

  // 顶部 Tab
  const [activeTab, setActiveTab] = useState<'all' | 'ui' | 'flow' | 'plugin' | 'doc'>('all');

  // Palette
  const [paletteCat, setPaletteCat] = useState<'all' | NodeCategory>('all');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteCollapsed, setPaletteCollapsed] = useState<Record<NodeCategory, boolean>>({
    bpmn: false,
    ai: false,
    business: false,
    data: false,
    trigger: false,
    control: false,
  });

  // Dropzone（画布由 FlowgramEditor 提供，状态由其内部维护）
  const [dragOver, setDragOver] = useState(false);

  // 插件
  const [plugins, setPlugins] = useState<PluginDef[]>(PLUGINS);

  // 注入样式（只一次）
  useEffect(() => {
    ensureCompsStyle();
    ensureNodeCardStyle();
  }, []);

  const filteredPaletteGroups = useMemo(() => {
    return PALETTE_GROUPS.map((g) => ({
      ...g,
      nodes: PALETTE_NODES.filter(
        (n) =>
          n.cat === g.key &&
          (paletteCat === 'all' || paletteCat === g.key) &&
          (paletteQuery === '' || n.name.toLowerCase().includes(paletteQuery.toLowerCase()))
      ),
    })).filter((g) => g.nodes.length > 0);
  }, [paletteCat, paletteQuery]);

  // 拖拽到画布（FlowgramEditor 自带拖拽面板；这里只保留 dragOver 高亮）
  const handleNodeDragStart = (e: React.DragEvent<HTMLDivElement>, node: PaletteNodeDef) => {
    e.dataTransfer.setData('text/plain', node.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const togglePlugin = (key: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.key === key ? { ...p, installed: !p.installed } : p))
    );
  };

  // 顶部 Tab
  const isSectionVisible = (key: 'ui' | 'flow' | 'plugin' | 'doc') => activeTab === 'all' || activeTab === key;

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} embedded />

      <div className="acp-page">
        {/* Main */}
        <div className="acp-main">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[{ label: '后台管理', href: '/admin' }, { label: '组件库' }]}
            showHome={false}
            padding="0 0 20px"
            fontSize={12}
          />

          {/* Page Header */}
          <PageHeader
            title="组件库"
            subtitle="UI 组件、流程节点、插件、API 文档一站式参考"
            extra={
              <div className="acp-page-header-actions">
                <button className="acp-btn">
                  <Download /> 导出
                </button>
                <button className="acp-btn">
                  <Github /> 查看仓库
                </button>
                <button className="acp-btn-primary">
                  <Plus /> 新建组件
                </button>
              </div>
            }
          />

          {/* Tab Bar */}
          <div className="acp-tab-bar">
            {(
              [
                { key: 'all', label: '全部', Icon: LayoutGrid },
                { key: 'ui', label: 'UI 组件', Icon: MousePointerClick },
                { key: 'flow', label: '流程节点', Icon: Workflow },
                { key: 'plugin', label: '插件', Icon: PlugZap },
                { key: 'doc', label: '文档', Icon: BookText },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`v-tab${activeTab === key ? ' active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                <Icon /> {label}
              </button>
            ))}
          </div>

          {/* ============ UI 组件 ============ */}
          {isSectionVisible('ui') && (
            <section className="acp-section">
              <div className="acp-section-title">
                <MousePointerClick /> UI 组件
              </div>
              <p className="acp-section-desc">平台基础 UI 组件库，覆盖按钮、表单、反馈、数据展示等场景</p>

              <UIGroup name="按钮" count={4}>
                <UICard
                  preview={
                    <button className="acp-btn-primary">
                      <Check /> 确认操作
                    </button>
                  }
                  name={
                    <>
                      <Square /> 主要按钮
                    </>
                  }
                  desc="用于核心操作，醒目突出"
                />
                <UICard
                  preview={
                    <button className="acp-btn">
                      <Settings /> 次要操作
                    </button>
                  }
                  name={
                    <>
                      <Square /> 次要按钮
                    </>
                  }
                  desc="常规操作，低视觉权重"
                />
                <UICard
                  preview={
                    <button className="acp-btn acp-btn-sm">
                      <Plus /> 小型按钮
                    </button>
                  }
                  name={
                    <>
                      <Square /> 小型按钮
                    </>
                  }
                  desc="紧凑场景使用，高度 30px"
                />
                <UICard
                  preview={
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="v-badge v-badge-success">
                        <Check /> 已发布
                      </span>
                      <span className="v-badge v-badge-warning">
                        <Clock /> 待审核
                      </span>
                      <span className="v-badge v-badge-destructive">
                        <X /> 失败
                      </span>
                    </div>
                  }
                  name={
                    <>
                      <Tag /> 状态徽章
                    </>
                  }
                  desc="五色状态标识，零阴影"
                />
              </UIGroup>

              <UIGroup name="表单" count={3}>
                <UICard
                  preview={
                    <div style={{ width: '100%', maxWidth: 240 }}>
                      <label className="acp-label">输入框</label>
                      <div className="acp-input-icon-wrap">
                        <Search />
                        <input className="acp-input" type="text" placeholder="搜索内容…" />
                      </div>
                    </div>
                  }
                  name={
                    <>
                      <MousePointerClick /> 输入框
                    </>
                  }
                  desc="支持图标前缀、聚焦状态"
                />
                <UICard
                  preview={
                    <div style={{ width: '100%', maxWidth: 240 }}>
                      <label className="acp-label">下拉选择</label>
                      <select className="acp-select" style={{ width: '100%' }}>
                        <option>选项一</option>
                        <option>选项二</option>
                      </select>
                    </div>
                  }
                  name={
                    <>
                      <ChevronDown /> 下拉选择
                    </>
                  }
                  desc="原生 select 增强，自定义箭头"
                />
                <UICard
                  preview={
                    <div style={{ width: '100%', maxWidth: 240 }}>
                      <label className="acp-label">提示文本</label>
                      <div className="acp-hint">
                        <Info /> 说明信息显示
                      </div>
                    </div>
                  }
                  name={
                    <>
                      <Info /> 提示文本
                    </>
                  }
                  desc="表单辅助说明，muted 色"
                />
              </UIGroup>

              <UIGroup name="反馈" count={3}>
                <UICard
                  preview={
                    <span className="acp-verify-success">
                      <CheckCircle /> 验证通过
                    </span>
                  }
                  name={
                    <>
                      <CheckCircle /> 成功反馈
                    </>
                  }
                  desc="成功状态指示，绿色文本"
                />
                <UICard
                  preview={
                    <span className="acp-verify-error">
                      <AlertCircle /> 校验失败
                    </span>
                  }
                  name={
                    <>
                      <X /> 错误反馈
                    </>
                  }
                  desc="错误状态指示，红色文本"
                />
                <UICard
                  preview={
                    <div className="v-card" style={{ width: '100%', maxWidth: 240, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>卡片标题</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                        内容容器，支持嵌套与组合
                      </div>
                    </div>
                  }
                  tall
                  name={
                    <>
                      <SquareStack /> 卡片
                    </>
                  }
                  desc="通用容器，4px 圆角"
                />
              </UIGroup>
            </section>
          )}

          {/* ============ 流程节点 ============ */}
          {isSectionVisible('flow') && (
            <section className="acp-section">
              <div className="acp-section-title">
                <Workflow /> 流程节点
              </div>
              <p className="acp-section-desc">
                FlowGram.AI 双布局节点库，从左侧拖拽节点至画布构建 BPMN、AI、业务流程
              </p>

              <div className="acp-flow-layout">
                {/* Palette */}
                <aside className="acp-flow-palette">
                  <div className="acp-palette-header">
                    <div className="acp-palette-search">
                      <Search />
                      <input
                        type="text"
                        placeholder="搜索节点…"
                        value={paletteQuery}
                        onChange={(e) => setPaletteQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="acp-palette-categories">
                    {(['all', 'bpmn', 'ai', 'business', 'data'] as const).map((c) => (
                      <button
                        key={c}
                        className={`acp-cat-pill${paletteCat === c ? ' active' : ''}`}
                        onClick={() => setPaletteCat(c)}
                      >
                        {c === 'all'
                          ? '全部'
                          : c === 'bpmn'
                          ? 'BPMN'
                          : c === 'ai'
                          ? 'AI'
                          : c === 'business'
                          ? '业务'
                          : '数据'}
                      </button>
                    ))}
                  </div>
                  <div className="acp-palette-body">
                    {filteredPaletteGroups.map((g) => (
                      <div
                        key={g.key}
                        className={`acp-palette-group${paletteCollapsed[g.key] ? ' collapsed' : ''}`}
                      >
                        <div
                          className="acp-palette-group-header"
                          onClick={() =>
                            setPaletteCollapsed((prev) => ({ ...prev, [g.key]: !prev[g.key] }))
                          }
                        >
                          <span className="acp-palette-group-title">
                            <ChevronDown className="acp-palette-group-chevron" /> {g.label}
                          </span>
                          <span className="acp-palette-group-count">{g.count}</span>
                        </div>
                        <div className="acp-palette-group-items">
                          {g.nodes.map((node) => {
                            const Icon = node.Icon;
                            return (
                              <div
                                key={node.key}
                                className="acp-palette-item"
                                draggable
                                onDragStart={(e) => handleNodeDragStart(e, node)}
                              >
                                <div className={`acp-palette-icon ${PALETTE_CATEGORY_BG[node.cat]}`}>
                                  <Icon />
                                </div>
                                <div className="acp-palette-info">
                                  <div className="acp-palette-label">{node.name}</div>
                                  <div className="acp-palette-sub">{node.sub}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                {/* Canvas */}
                <div className="acp-flow-canvas-area">
                  <div className="acp-canvas-toolbar">
                    <div className="acp-canvas-toolbar-left">
                      <span className="acp-canvas-toolbar-title">流程画布</span>
                      <div className="acp-canvas-toggle">
                        <button className="active">固定布局</button>
                        <button>自由布局</button>
                      </div>
                    </div>
                    <div className="acp-canvas-toolbar-actions">
                      <button className="acp-btn acp-btn-sm">
                        <Download /> 导出
                      </button>
                      <button className="acp-btn-primary acp-btn-sm">
                        <Save /> 保存
                      </button>
                    </div>
                  </div>

                  <div className={`acp-dropzone${dragOver ? ' dragover' : ''}`}>
                    <ACFlowgramEditor
                      initialData={AC_FLOWGRAM_INITIAL_DATA}
                      nodeRegistries={AC_MERGED_REGISTRIES}
                      customRegistries={AC_CUSTOM_REGISTRIES}
                      hidePalette
                    />
                  </div>

                  {/* Node Catalog */}
                  <div className="acp-node-catalog">
                    <div className="acp-node-catalog-title">
                      <Library /> 节点完整目录
                    </div>
                    <p className="acp-node-catalog-desc">
                      所有可用节点的完整清单，按类别分组，点击可查看详情
                    </p>

                    {PALETTE_GROUPS.map((g) => {
                      const nodes = PALETTE_NODES.filter((n) => n.cat === g.key);
                      const badge = PALETTE_CATEGORY_BADGE[g.key];
                      return (
                        <div key={g.key} className="acp-node-group">
                          <div className="acp-node-group-header">
                            <span className="acp-node-group-name">{g.label}</span>
                            <span className="acp-node-group-count">{g.count}</span>
                            <span className={`v-badge ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="acp-node-grid">
                            {nodes.map((node) => {
                              const Icon = node.Icon;
                              return (
                                <div
                                  key={node.key}
                                  className="acp-node-card"
                                  draggable
                                  onDragStart={(e) => handleNodeDragStart(e, node)}
                                >
                                  <div className="acp-node-card-top">
                                    <div className={`acp-node-icon ${PALETTE_CATEGORY_BG[node.cat]}`}>
                                      <Icon />
                                    </div>
                                    <div className="acp-node-meta">
                                      <div className="acp-node-title">{node.name}</div>
                                      <div className="acp-node-desc">
                                        {node.titleEn} · {node.sub}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="acp-node-card-bottom">
                                    <span className={`v-badge ${badge.cls}`}>{badge.label}</span>
                                    <div className="acp-ports">
                                      <span className="acp-port out"></span>
                                      <span className="acp-ports-text">{node.ports}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============ 插件 ============ */}
          {isSectionVisible('plugin') && (
            <section className="acp-section">
              <div className="acp-section-title">
                <PlugZap /> 插件
              </div>
              <p className="acp-section-desc">官方 Flowgram.AI 风格插件，扩展设计器能力</p>

              <div className="acp-plugin-grid">
                {plugins.map((p) => {
                  const Icon = p.Icon;
                  return (
                    <div key={p.key} className="acp-plugin-card">
                      <div className="acp-plugin-head">
                        <div className="acp-plugin-icon">
                          <Icon />
                        </div>
                        <div className="acp-plugin-info">
                          <div className="acp-plugin-name">{p.name}</div>
                          <div className="acp-plugin-version">{p.version}</div>
                        </div>
                      </div>
                      <div className="acp-plugin-desc">{p.desc}</div>
                      <div className="acp-plugin-foot">
                        <span className="acp-plugin-author">
                          <User /> Flowgram Team
                        </span>
                        <button
                          className={`acp-plugin-action${p.installed ? ' installed' : ''}`}
                          onClick={() => togglePlugin(p.key)}
                        >
                          {p.installed ? '已安装' : '安装'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ============ 文档 ============ */}
          {isSectionVisible('doc') && (
            <section className="acp-section">
              <div className="acp-section-title">
                <BookText /> 文档
              </div>
              <p className="acp-section-desc">Flowgram.AI 完整 API 参考：核心、Hooks、组件、服务、工具函数</p>

              {DOC_SECTIONS.map((sec) => {
                const Icon = sec.Icon;
                return (
                  <div key={sec.title} className="acp-doc-section">
                    <div className="acp-doc-section-title">
                      <Icon /> {sec.title}
                    </div>
                    <div className="acp-doc-table">
                      <div className="acp-doc-row head">
                        <span>API</span>
                        <span>类别</span>
                        <span>说明</span>
                        <span></span>
                      </div>
                      {sec.rows.map((row) => (
                        <div key={row.api} className="acp-doc-row">
                          <span className="acp-doc-api">{row.api}</span>
                          <span>
                            <span className={`v-badge ${row.badge}`}>{row.category}</span>
                          </span>
                          <span className="acp-doc-desc">{row.desc}</span>
                          <a className="acp-doc-link" href="https://flowgram.ai/api/index.html">
                            查看文档 <ArrowRight />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- 子组件 ---------------- //
function UIGroup({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="acp-node-group">
      <div className="acp-node-group-header">
        <span className="acp-node-group-name">{name}</span>
        <span className="acp-node-group-count">{count}</span>
      </div>
      <div className="acp-comp-grid">{children}</div>
    </div>
  );
}

function UICard({
  preview,
  name,
  desc,
  tall,
}: {
  preview: React.ReactNode;
  name: React.ReactNode;
  desc: string;
  tall?: boolean;
}) {
  return (
    <div className="acp-comp-card">
      <div className={`acp-comp-preview${tall ? ' tall' : ''}`}>{preview}</div>
      <div className="acp-comp-name">{name}</div>
      <div className="acp-comp-desc">{desc}</div>
    </div>
  );
}

// ---------------- 样式注入 ---------------- //
const COMPS_PAGE_STYLE_ID = 'admin-components-page-style-v1';
const COMPS_PAGE_STYLE = `
  /* Layout shell */
  .acp-page { display: flex; flex-direction: column; min-height: calc(100vh - 56px); background: var(--background); }

  /* Main */
  .acp-main { flex: 1; min-height: 0; width: 100%; padding: 24px 32px; overflow-y: auto; }

  /* Page header actions slot */
  .acp-page-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

  /* Buttons */
  .acp-btn { background: transparent; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius); height: 36px; padding: 0 16px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-sans); white-space: nowrap; transition: background .15s; }
  .acp-btn:hover { background: var(--muted); }
  .acp-btn svg { width: 16px; height: 16px; }
  .acp-btn-primary { background: var(--primary); color: var(--primary-foreground); border: none; border-radius: var(--radius); height: 36px; padding: 0 16px; font-size: 13px; cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-sans); white-space: nowrap; transition: opacity .15s; }
  .acp-btn-primary:hover { opacity: .9; }
  .acp-btn-primary svg { width: 16px; height: 16px; }
  .acp-btn-sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: var(--radius); }

  /* Tabs (使用 portal 统一的 .v-tab) */
  .acp-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; flex-wrap: wrap; }
  .acp-tab-bar .v-tab { cursor: pointer; text-decoration: none; }

  /* Section */
  .acp-section { margin-bottom: 32px; }
  .acp-section-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; }
  .acp-section-title svg { width: 16px; height: 16px; color: var(--muted-foreground); }
  .acp-section-desc { font-size: 12px; color: var(--muted-foreground); margin-bottom: 16px; line-height: 1.5; max-width: 680px; }

  /* v-card (shared) */
  .v-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }

  /* v-badge (shared) */
  .v-badge { border-radius: 9999px; padding: 2px 8px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .v-badge svg { width: 11px; height: 11px; }
  .v-badge-success { background: var(--success-subtle); color: var(--success); }
  .v-badge-warning { background: var(--warning-subtle); color: var(--warning); }
  .v-badge-destructive { background: var(--destructive-subtle); color: var(--destructive); }
  .v-badge-info { background: var(--info-subtle); color: var(--info); }
  .v-badge-purple { background: var(--purple-subtle); color: var(--purple); }
  .v-badge-neutral { background: var(--muted); color: var(--muted-foreground); }
  .v-badge-trigger { background: rgba(232,121,249,0.1); color: #e879f9; }

  /* UI form helpers */
  .acp-label { display: block; font-size: 11px; color: var(--muted-foreground); margin-bottom: 4px; font-weight: 500; }
  .acp-input { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 7px 10px; outline: none; font-family: var(--font-sans); width: 100%; }
  .acp-input:focus { border-color: #3a3a3a; }
  .acp-input-icon-wrap { position: relative; }
  .acp-input-icon-wrap svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--muted-foreground); }
  .acp-input-icon-wrap .acp-input { padding-left: 32px; }
  .acp-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 7px 28px 7px 10px; outline: none; font-family: var(--font-sans); appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
  .acp-hint { font-size: 12px; color: var(--muted-foreground); display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: var(--muted); border: 1px dashed var(--border); border-radius: var(--radius); }
  .acp-hint svg { width: 14px; height: 14px; }
  .acp-verify-success { font-size: 12px; color: var(--success); display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--success-subtle); border-radius: var(--radius); }
  .acp-verify-error { font-size: 12px; color: var(--destructive); display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--destructive-subtle); border-radius: var(--radius); }
  .acp-verify-success svg, .acp-verify-error svg { width: 14px; height: 14px; }

  /* UI card */
  .acp-comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .acp-comp-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: border-color .15s; }
  .acp-comp-card:hover { border-color: #3a3a3a; }
  .acp-comp-preview { background: var(--muted); border-radius: var(--radius); padding: 18px; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; min-height: 90px; }
  .acp-comp-preview.tall { min-height: 120px; }
  .acp-comp-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
  .acp-comp-name svg { width: 14px; height: 14px; color: var(--muted-foreground); }
  .acp-comp-desc { font-size: 12px; color: var(--muted-foreground); line-height: 1.5; }

  /* Flow layout */
  .acp-flow-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; }
  .acp-flow-palette { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; }
  .acp-palette-header { padding: 14px; border-bottom: 1px solid var(--border); }
  .acp-palette-search { position: relative; }
  .acp-palette-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--muted-foreground); }
  .acp-palette-search input { width: 100%; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 10px 7px 32px; font-size: 12px; color: var(--foreground); font-family: var(--font-sans); outline: none; }
  .acp-palette-search input:focus { border-color: #3a3a3a; }
  .acp-palette-categories { display: flex; gap: 6px; padding: 12px 14px; border-bottom: 1px solid var(--border); overflow-x: auto; flex-wrap: nowrap; }
  .acp-cat-pill { font-size: 11px; padding: 4px 10px; border-radius: 9999px; border: 1px solid var(--border); background: transparent; color: var(--muted-foreground); cursor: pointer; white-space: nowrap; font-family: var(--font-sans); transition: all .15s; }
  .acp-cat-pill.active { background: var(--foreground); color: var(--background); border-color: var(--foreground); }
  .acp-cat-pill:hover:not(.active) { color: var(--foreground); border-color: #3a3a3a; }
  .acp-palette-body { flex: 1; overflow-y: auto; padding: 8px; max-height: 640px; }
  .acp-palette-group { margin-bottom: 6px; }
  .acp-palette-group-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; cursor: pointer; border-radius: var(--radius); transition: background .15s; user-select: none; }
  .acp-palette-group-header:hover { background: var(--muted); }
  .acp-palette-group-title { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .acp-palette-group-chevron { width: 14px; height: 14px; transition: transform .15s; }
  .acp-palette-group.collapsed .acp-palette-group-chevron { transform: rotate(-90deg); }
  .acp-palette-group-count { font-size: 11px; color: var(--muted-foreground); background: var(--muted); padding: 1px 6px; border-radius: 9999px; font-family: var(--font-mono); }
  .acp-palette-group.collapsed .acp-palette-group-items { display: none; }
  .acp-palette-group-items { padding: 4px 6px 8px; display: flex; flex-direction: column; gap: 2px; }
  .acp-palette-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius); cursor: grab; transition: background .15s; border: 1px dashed transparent; }
  .acp-palette-item:hover { background: var(--muted); border-color: var(--border); }
  .acp-palette-item:active { cursor: grabbing; }
  .acp-palette-icon { width: 32px; height: 32px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .acp-palette-icon svg { width: 16px; height: 16px; }
  .acp-palette-info { flex: 1; min-width: 0; }
  .acp-palette-label { font-size: 12px; font-weight: 500; color: var(--foreground); line-height: 1.3; }
  .acp-palette-sub { font-size: 11px; color: var(--muted-foreground); line-height: 1.3; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Canvas area */
  .acp-flow-canvas-area { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; min-width: 0; }
  .acp-canvas-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
  .acp-canvas-toolbar-left { display: flex; align-items: center; gap: 8px; }
  .acp-canvas-toolbar-title { font-size: 13px; font-weight: 600; }
  .acp-canvas-toolbar-actions { display: flex; gap: 6px; }
  .acp-canvas-toggle { display: flex; gap: 0; background: var(--muted); border-radius: var(--radius); padding: 2px; border: 1px solid var(--border); }
  .acp-canvas-toggle button { background: transparent; border: none; color: var(--muted-foreground); font-size: 12px; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: var(--font-sans); }
  .acp-canvas-toggle button.active { background: var(--foreground); color: var(--background); }
  .acp-dropzone { flex: 1; background: var(--background); border: 1px dashed var(--border); border-radius: var(--radius); padding: 12px; min-height: 480px; height: 560px; transition: border-color .15s, background .15s; position: relative; overflow: hidden; }
  .acp-dropzone.dragover { border-color: var(--info); background: var(--info-subtle); }
  .acp-dropzone > .demo-fixed-container,
  .acp-dropzone .demo-fixed-layout,
  .acp-dropzone .demo-fixed-editor { width: 100%; height: 100%; min-height: 0; }
  .acp-dropzone .demo-fixed-layout { grid-template-columns: 0 1fr; }
  .acp-dropzone .demo-fixed-container > .demo-fixed-tools { display: none; }

  /* Node catalog */
  .acp-node-catalog { margin-top: 24px; }
  .acp-node-catalog-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; }
  .acp-node-catalog-title svg { width: 16px; height: 16px; color: var(--muted-foreground); }
  .acp-node-catalog-desc { font-size: 12px; color: var(--muted-foreground); margin-bottom: 16px; max-width: 680px; line-height: 1.5; }
  .acp-node-group { margin-bottom: 24px; }
  .acp-node-group-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .acp-node-group-name { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .acp-node-group-count { font-size: 11px; color: var(--muted-foreground); background: var(--muted); padding: 2px 8px; border-radius: 9999px; font-family: var(--font-mono); }
  .acp-node-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .acp-node-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; transition: border-color .15s; position: relative; cursor: grab; }
  .acp-node-card:hover { border-color: #3a3a3a; }
  .acp-node-card:active { cursor: grabbing; }
  .acp-node-card-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .acp-node-icon { width: 36px; height: 36px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .acp-node-icon svg { width: 18px; height: 18px; }
  .acp-node-meta { flex: 1; min-width: 0; }
  .acp-node-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 2px; line-height: 1.3; }
  .acp-node-desc { font-size: 12px; color: var(--muted-foreground); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
  .acp-node-card-bottom { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border); }
  .acp-ports { display: flex; gap: 4px; align-items: center; }
  .acp-port { width: 8px; height: 8px; border-radius: 50%; background: var(--border); position: relative; }
  .acp-port.out { background: var(--success); }
  .acp-ports-text { font-size: 10px; color: var(--muted-foreground); font-family: var(--font-mono); margin-left: 4px; }

  /* Plugin */
  .acp-plugin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .acp-plugin-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: border-color .15s; }
  .acp-plugin-card:hover { border-color: #3a3a3a; }
  .acp-plugin-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .acp-plugin-icon { width: 38px; height: 38px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .acp-plugin-icon svg { width: 18px; height: 18px; color: var(--muted-foreground); }
  .acp-plugin-info { flex: 1; min-width: 0; }
  .acp-plugin-name { font-size: 13px; font-weight: 600; margin-bottom: 2px; letter-spacing: -0.01em; }
  .acp-plugin-version { font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); }
  .acp-plugin-desc { font-size: 12px; color: var(--muted-foreground); line-height: 1.5; margin-bottom: 12px; min-height: 38px; }
  .acp-plugin-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border); }
  .acp-plugin-author { font-size: 11px; color: var(--muted-foreground); display: flex; align-items: center; gap: 4px; }
  .acp-plugin-author svg { width: 12px; height: 12px; }
  .acp-plugin-action { padding: 4px 12px; border-radius: var(--radius); font-size: 12px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); border: 1px solid var(--border); background: transparent; color: var(--foreground); transition: all .15s; }
  .acp-plugin-action:hover { background: var(--muted); }
  .acp-plugin-action.installed { background: var(--success-subtle); color: var(--success); border-color: transparent; }

  /* Doc */
  .acp-doc-section { margin-bottom: 24px; }
  .acp-doc-section-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; }
  .acp-doc-section-title svg { width: 14px; height: 14px; color: var(--muted-foreground); }
  .acp-doc-table { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .acp-doc-row { display: grid; grid-template-columns: 1fr 100px 2fr 100px; gap: 16px; padding: 12px 16px; align-items: center; border-bottom: 1px solid var(--border); font-size: 12px; }
  .acp-doc-row:last-child { border-bottom: none; }
  .acp-doc-row.head { background: var(--muted); font-size: 11px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; }
  .acp-doc-api { font-family: var(--font-mono); color: var(--info); font-size: 12px; font-weight: 500; }
  .acp-doc-desc { color: var(--muted-foreground); line-height: 1.5; }
  .acp-doc-link { color: var(--muted-foreground); font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; justify-self: end; transition: color .15s; }
  .acp-doc-link:hover { color: var(--foreground); }
  .acp-doc-link svg { width: 12px; height: 12px; }

  /* Category color tokens */
  .bg-bpmn { background: var(--info-subtle); color: var(--info); }
  .bg-ai { background: var(--purple-subtle); color: var(--purple); }
  .bg-business { background: var(--success-subtle); color: var(--success); }
  .bg-data { background: var(--warning-subtle); color: var(--warning); }
  .bg-trigger { background: rgba(232,121,249,0.1); color: #e879f9; }
  .bg-control { background: var(--muted); color: var(--muted-foreground); }

  /* Responsive */
  @media (max-width: 1200px) { .acp-comp-grid, .acp-node-grid, .acp-plugin-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 1024px) {
    .acp-flow-layout { grid-template-columns: 1fr; }
    .acp-comp-grid, .acp-node-grid, .acp-plugin-grid { grid-template-columns: repeat(2, 1fr); }
    .acp-doc-row { grid-template-columns: 1fr 80px 2fr 80px; gap: 10px; }
  }
  @media (max-width: 768px) {
    .acp-page { padding: 16px; }
    .acp-comp-grid, .acp-node-grid, .acp-plugin-grid { grid-template-columns: 1fr; }
    .acp-page-header-actions { flex-wrap: wrap; }
    .acp-doc-row { grid-template-columns: 1fr; gap: 4px; }
    .acp-doc-row.head { display: none; }
    .acp-doc-link { justify-self: start; }
  }
`;

function ensureCompsStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(COMPS_PAGE_STYLE_ID)) return;
  const node = document.createElement('style');
  node.id = COMPS_PAGE_STYLE_ID;
  node.textContent = COMPS_PAGE_STYLE;
  document.head.appendChild(node);
}

function ensureNodeCardStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ac-node-card-style-v1')) return;
  const node = document.createElement('style');
  node.id = 'ac-node-card-style-v1';
  node.textContent = AC_NODE_CARD_CSS;
  document.head.appendChild(node);
}