/**
 * AdminComponentsPage
 * --------------------------------------------------
 * 后台管理 / 组件库 Tab
 *
 * 严格按 metaplatform-design-draft/pages/components.html 原型 1:1 还原：
 *  - Sidebar 顶部导航 + 高亮"后台管理"
 *  - Page Header：标题"组件库" + 操作按钮（导出 / 查看仓库 / 新建组件，与其他 admin 子页面样式一致）
 *  - Tab Bar：全部 / UI 组件 / 流程节点 / 插件 / 文档
 *  - 4 个 Section：UI 组件 / 流程节点（含 palette + dropzone + 节点目录） / 插件 / 文档
 *
 * 实现要点：
 *  - 全部交互行为本地 useState 维护：tab 切换、palette 类目过滤、palette 搜索、
 *    palette 分组折叠、拖拽到画布、节点目录分组、插件安装切换。
 *  - 颜色变量、间距、圆角与原型完全一致（var(--background)/var(--foreground)/…）。
 *  - 图标统一使用 lucide-react，与 portal 其他页面风格保持一致。
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Github,
  Plus,
  LayoutGrid,
  MousePointerClick,
  PlugZap,
  BookText,
  ChevronDown,
  Settings,
  Star,
  Save,
  History,
  Map,
  Grid3x3,
  Image,
  FileJson,
  Users,
  Check,
  X,
  Tag,
  Info,
  Square,
  SquareStack,
  CheckCircle,
  AlertCircle,
  Box,
  Cog,
  ArrowRight,
  Download,
  Search,
  Clock,
  User,
  Wrench,
  Link2,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

// v1.4 R1.5.4：流程组件 section 已移除，36 节点 palette 相关常量（PALETTE_NODES /
// buildPaletteNode 等）一并清理。文件 node-render-v2.tsx / flowgram-editor.tsx
// 保留方便后续恢复。

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
  const [activeTab, setActiveTab] = useState<'all' | 'ui' | 'plugin' | 'doc'>('all');

  // 插件
  const [plugins, setPlugins] = useState<PluginDef[]>(PLUGINS);

  // 注入样式（只一次）
  useEffect(() => {
    ensureCompsStyle();
  }, []);

  const togglePlugin = (key: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.key === key ? { ...p, installed: !p.installed } : p))
    );
  };

  // 顶部 Tab
  const isSectionVisible = (key: 'ui' | 'plugin' | 'doc') => activeTab === 'all' || activeTab === key;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <div className="acp-page">
        {/* Main */}
        <div className="acp-main">
          {/* Page Header —— 与其他 admin 子页保持一致（标题 + 描述 + 右侧操作），不再用 antd PageHeader/Breadcrumb */}
          <div className="acp-page-header">
            <div>
              <h1>组件库</h1>
              <p>UI 组件、流程节点、插件、API 文档一站式参考</p>
            </div>
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
          </div>

          {/* Tab Bar */}
          <div className="acp-tab-bar">
            {(
              [
                { key: 'all', label: '全部', Icon: LayoutGrid },
                { key: 'ui', label: 'UI 组件', Icon: MousePointerClick },
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
          {/* v1.4 R1.5.4：临时移除流程节点 section（保留 node-render-v2.tsx 等文件方便恢复） */}

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
    </div>
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
  .acp-page { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--background); }
  /* Page Header（与其他 admin 子页面保持一致：h1 + 描述 + 右侧操作按钮） */
  .acp-page-header { margin-bottom: 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .acp-page-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; color: var(--foreground); }
  .acp-page-header p { font-size: 14px; color: var(--muted-foreground); }
  /* 全屏编辑模式：隐藏页面其他内容，只留画布占满屏幕 */
  body.acp-fullscreen .mate-subtabs,
  body.acp-fullscreen .acp-page-header,
  body.acp-fullscreen .acp-breadcrumb,
  body.acp-fullscreen .acp-aside,
  body.acp-fullscreen .acp-page > nav,
  body.acp-fullscreen .acp-main > nav,
  body.acp-fullscreen .acp-main > header,
  body.acp-fullscreen .acp-main > .acp-section:not(.acp-flow-section),
  body.acp-fullscreen .acp-node-catalog,
  body.acp-fullscreen .acp-marketplace,
  body.acp-fullscreen .acp-config,
  body.acp-fullscreen .acp-logs,
  body.acp-fullscreen .acp-org,
  body.acp-fullscreen .acp-ops,
  body.acp-fullscreen .acp-permissions,
  body.acp-fullscreen .acp-users { display: none !important; }
  /* 全屏下隐藏 acp-flow-section 的标题与说明，只保留画布 */
  body.acp-fullscreen .acp-flow-section > .acp-section-title,
  body.acp-fullscreen .acp-flow-section > .acp-section-desc { display: none !important; }
  body.acp-fullscreen .acp-page { min-height: 100vh; height: 100vh; }
  body.acp-fullscreen .acp-main { padding: 0; max-width: none; width: 100%; overflow: hidden; }
  body.acp-fullscreen .acp-flow-canvas-area {
    position: fixed; inset: 0; z-index: 100000;
    border-radius: 0; border: none;
    padding: 12px;
    background: var(--background);
  }
  body.acp-fullscreen .acp-flow-canvas-area .acp-dropzone { min-height: 0; height: calc(100vh - 80px); }
  body.acp-fullscreen .acp-flow-canvas-wrap { height: 100%; }

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
  .acp-flow-layout { display: flex; flex-direction: column; gap: 16px; }
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
  /* === v1.4 R1.5: 36 节点 palette（嵌入 ACFlowgramEditor 内置） === */
  .acp-palette-panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    padding: 8px 6px;
    width: 220px;
    flex-shrink: 0;
    min-height: 0;
    max-height: 100%;
  }
  .acp-palette-group { margin-bottom: 4px; }
  .acp-palette-group-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 6px 6px 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
  }
  .acp-palette-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 4px 4px;
  }
  .acp-palette-card {
    cursor: grab;
    transition: transform .15s;
  }
  .acp-palette-card:hover { transform: translateY(-1px); }
  .acp-palette-card:active { cursor: grabbing; transform: scale(0.97); }

  /* Canvas area */
  .acp-flow-canvas-area { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; min-width: 0; position: relative; }
  /* 全屏编辑模式（覆盖式兜底，不依赖浏览器原生 Fullscreen API） */
  .acp-flow-canvas-area.is-fullscreen {
    position: fixed; inset: 0; z-index: 9999;
    border-radius: 0; border: none;
    padding: 12px;
    background: var(--background);
  }
  .acp-flow-canvas-area.is-fullscreen .acp-dropzone { min-height: 0; height: calc(100vh - 80px); }
  .acp-flow-canvas-area.is-fullscreen + #acp-fullscreen-close-mask { display: block; }
  #acp-fullscreen-close-mask { display: none; }
  /* 退出全屏按钮 */
  .acp-flow-fullscreen-close { position: fixed; top: 14px; right: 18px; z-index: 10001; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
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
  /* FlowGram 网格背景层跟随画布容器占满 */
  .acp-dropzone .gedit-flow-background-layer { position: absolute !important; inset: 0 !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; }
  .acp-dropzone .gedit-grid-svg { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; left: 0 !important; top: 0 !important; }

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

// v1.4 R1.5.4：ensureNodeCardStyle / AC_NODE_CARD_CSS（17 节点 v1 卡片样式）随流程组件一并移除。
// 新版 36 节点样式见 node-render-v2.tsx（按需恢复时启用）。

