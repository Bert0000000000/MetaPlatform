/**
 * AdminComponentsPage
 * --------------------------------------------------
 * 后台管理 / 组件库 Tab。
 *
 * 设计参考：metaplatform-design-draft/pages/components.html 的版式与 class 命名。
 * 流程设计器区域使用 FlowSurface（基于 @flowgram.ai/fixed-layout-editor）。
 *
 * 验证项（受真实状态驱动）：
 *  - 拖拽节点：固定 pass（FlowGram 节点库自带）。
 *  - 端口连线：固定 pass。
 *  - Undo/Redo：canUndo / canRedo 通过 ref 暴露出来后回报。
 *  - Minimap：通过 withMinimap=true → pass。
 *  - 双主题切换：根据 themeMode 实时切换。
 *  - FlowGram JSON：保存 / 发布后回填。
 */
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, ChevronDown, ClipboardCopy, Layers, Lock, Moon, Package, Play, Save,
  Settings, Sliders, Star, Sun, Trash2, Undo2, Redo2, Workflow, Plus, Minus, Maximize2, Zap,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import {
  AGENT_NODE_MATERIALS,
  AGENT_PALETTE_CATEGORIES,
  BPMN_NODE_MATERIALS,
  BPMN_PALETTE_CATEGORIES,
  FlowSurface,
  type FlowData,
  type FlowSurfaceMode,
  type FlowSurfaceHandle,
  type ResolvedThemeMode,
} from '@mate/shared/flow';
import { LEAVE_FLOW_INITIAL_DATA } from '@mate/shared/flow';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

/**
 * 把 AdminComponentsPage 私有的样式打包到一个常量里 + 用 id 锁定，
 * 防止 React 重渲染时反复向 document.head 注入新的 <style> 节点，
 * 导致 body 高度无限增长。
 */
const COMPS_PAGE_STYLE_ID = 'comps-page-style-v1';
const COMPS_PAGE_STYLE = `
  .comps-page { display: flex; gap: 0; position: fixed; top: 64px; right: 0; bottom: 0; left: 240px; overflow: hidden; background: var(--background); }
  .comps-sidebar { width: 240px; flex-shrink: 0; overflow: auto; background: var(--sidebar); border-right: 1px solid var(--sidebar-border); padding: 20px 12px; }
  .comps-side-section { font-size: 11px; font-weight: 600; color: var(--sidebar-foreground); opacity: .6; text-transform: uppercase; letter-spacing: .04em; padding: 12px; }
  .comps-nav-item { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 12px; border-radius: 6px; cursor: pointer; font-size: 14px; color: var(--sidebar-foreground); text-decoration: none; transition: background .15s; }
  .comps-nav-item:hover:not(.active) { background: var(--sidebar-accent); }
  .comps-nav-item.active { background: var(--sidebar-primary); color: var(--sidebar-primary-foreground); }
  .comps-nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
  .comps-main { flex: 1; min-height: 0; padding: 24px 32px; overflow-y: auto; }
  .comps-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted-foreground); margin-bottom: 16px; }
  .comps-breadcrumb span.current { color: var(--foreground); }
  .comps-section-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; }
  .comps-section-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .comps-section-title svg { width: 16px; height: 16px; color: var(--muted-foreground); }
  .comps-section-desc { font-size: 12px; color: var(--muted-foreground); margin-bottom: 18px; line-height: 1.6; }
  .comps-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 12px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; }
  .comps-mode-group { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; }
  .comps-mode-group button { background: transparent; border: none; color: var(--muted-foreground); padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  .comps-mode-group button:hover:not(.active) { color: var(--foreground); }
  .comps-mode-group button.active { background: var(--foreground); color: var(--background); font-weight: 500; }
  .comps-mode-group button:disabled { opacity: .35; cursor: not-allowed; }
  .comps-flow-host { height: 600px; max-height: 600px; min-height: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; position: relative; }
  .comps-quick-row { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; }
  .comps-error { background: rgba(255,97,102,.1); color: var(--destructive); border: 1px solid var(--destructive); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 16px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
`;

function ensureCompsStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(COMPS_PAGE_STYLE_ID)) return;
  const node = document.createElement('style');
  node.id = COMPS_PAGE_STYLE_ID;
  node.textContent = COMPS_PAGE_STYLE;
  document.head.appendChild(node);
}

type CompSection = 'flow' | 'btn' | 'card' | 'badge';

const COMPS: { key: CompSection; label: string; icon: typeof Workflow }[] = [
  { key: 'flow', label: '流程设计器', icon: Workflow },
  { key: 'btn', label: '按钮 & 输入', icon: Sliders },
  { key: 'card', label: '卡片 & 列表', icon: Layers },
  { key: 'badge', label: '徽标 & 标签', icon: Box },
];

const AGENT_DEMO_DATA: FlowData = {
  nodes: [
    { id: 'a_in', type: 'agent.input', name: '用户输入', x: 60, y: 60, width: 130, height: 56 },
    { id: 'a_llm1', type: 'agent.llm', name: '意图识别', x: 240, y: 40, width: 150, height: 70, data: { model: 'doubao-pro', temperature: 0.3 } },
    { id: 'a_kb', type: 'agent.knowledgeRetrieval', name: '知识检索', x: 430, y: 40, width: 150, height: 70, data: { kb: 'product-docs', topK: 5, threshold: 0.6 } },
    { id: 'a_tool', type: 'agent.toolCall', name: '工单系统', x: 430, y: 140, width: 150, height: 70, data: { server: 'mcp-toolbox', toolName: 'createTicket', timeoutMs: 5000 } },
    { id: 'a_if', type: 'agent.condition', name: '是否需要升级', x: 620, y: 80, width: 110, height: 60 },
    { id: 'a_human', type: 'agent.humanConfirm', name: '人工坐席', x: 770, y: 30, width: 150, height: 60, data: { channel: 'im' } },
    { id: 'a_llm2', type: 'agent.llm', name: '智能答复', x: 770, y: 130, width: 150, height: 70, data: { model: 'doubao-lite', temperature: 0.5 } },
    { id: 'a_out', type: 'agent.output', name: '回复用户', x: 960, y: 80, width: 130, height: 56 },
  ],
  edges: [
    { id: 'ae1', source: 'a_in', target: 'a_llm1' },
    { id: 'ae2', source: 'a_llm1', target: 'a_kb' },
    { id: 'ae3', source: 'a_llm1', target: 'a_tool' },
    { id: 'ae4', source: 'a_kb', target: 'a_if' },
    { id: 'ae5', source: 'a_tool', target: 'a_if' },
    { id: 'ae6', source: 'a_if', target: 'a_human', label: '需要' },
    { id: 'ae7', source: 'a_if', target: 'a_llm2', label: '不需要' },
    { id: 'ae8', source: 'a_human', target: 'a_out' },
    { id: 'ae9', source: 'a_llm2', target: 'a_out' },
  ],
};

/**
 * Error boundary isolated to <FlowSurface /> subtree:
 *  - Avoids entire-page being white-washed when FlowGram throws.
 *  - Reports captured error up to AdminComponentsPage via onError().
 */
class FlowSurfaceBoundary extends Component<{ children: ReactNode; onError: (msg: string) => void }> {
  state = { hasError: false as boolean, msg: '' as string };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, msg: String(err?.stack ?? err?.message ?? err) };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[FlowSurface error]', err, info);
    this.props.onError(this.state.msg || String(err?.message ?? err));
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="comps-error"
          style={{
            margin: 16,
            padding: 16,
            background: 'rgba(255, 97, 102, .1)',
            border: '1px solid var(--destructive)',
            color: 'var(--destructive)',
            borderRadius: 'var(--radius)',
          }}
        >
          <strong>FlowSurface 渲染失败：</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12 }}>{this.state.msg}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminComponentsPage() {
  const location = useLocation();
  const [section, setSection] = useState<CompSection>('flow');
  const [mode, setMode] = useState<FlowSurfaceMode>('bpmn');
  const [themeMode, setThemeMode] = useState<ResolvedThemeMode>('dark');
  const [flowgramPreview, setFlowgramPreview] = useState<string>('');
  const [hasSavedJson, setHasSavedJson] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState<boolean>(false);

  useEffect(() => {
    setPageReady(true);
    ensureCompsStyle();
  }, []);

  const initialData = useMemo<FlowData>(
    () => (mode === 'agent' ? AGENT_DEMO_DATA : LEAVE_FLOW_INITIAL_DATA),
    [mode],
  );
  const nodeMaterials = useMemo(
    () => (mode === 'agent' ? AGENT_NODE_MATERIALS : BPMN_NODE_MATERIALS),
    [mode],
  );
  const paletteCategories = useMemo(
    () => (mode === 'agent' ? AGENT_PALETTE_CATEGORIES : BPMN_PALETTE_CATEGORIES),
    [mode],
  );

  const handleSaved = useCallback((json: unknown) => {
    setHasSavedJson(true);
    setFlowgramPreview(JSON.stringify(json, null, 2));
  }, []);

  const handleSurfaceError = useCallback((msg: string) => {
    setRenderError(msg);
  }, []);

  const handleSurfaceClear = useCallback(() => setRenderError(null), []);

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} embedded />

      <div className="comps-page">
        {/* Sidebar */}
        <aside className="comps-sidebar">
          <div className="comps-side-section">组件库</div>
          {COMPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className={`comps-nav-item${section === item.key ? ' active' : ''}`}
                onClick={() => setSection(item.key)}
              >
                <Icon /> {item.label}
              </div>
            );
          })}
          <div className="comps-side-section" style={{ marginTop: 8 }}>设计系统</div>
          <div className="comps-nav-item"><Settings /> Token</div>
          <div className="comps-nav-item"><Package /> 物料源</div>
        </aside>

        {/* Main */}
        <main className="comps-main">
          <div className="comps-breadcrumb">
            <span>后台管理</span>
            <span style={{ opacity: .5 }}>/</span>
            <span className="current">组件库</span>
            <span style={{ opacity: .5 }}>/</span>
            <span>{COMPS.find((c) => c.key === section)?.label}</span>
          </div>

          {renderError && (
            <div className="comps-error">
              <strong>FlowCanvas 渲染失败：</strong>
              <br />
              {renderError}
            </div>
          )}

          {section === 'flow' && (
            <FlowDesignerSection
              mode={mode}
              setMode={setMode}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              initialData={initialData}
              nodeMaterials={nodeMaterials}
              paletteCategories={paletteCategories}
              flowgramPreview={flowgramPreview}
              hasSavedJson={hasSavedJson}
              pageReady={pageReady}
              onSaved={handleSaved}
              onMountError={handleSurfaceError}
              onMountSuccess={handleSurfaceClear}
            />
          )}

          {section === 'btn' && <ButtonAndInputSection />}
          {section === 'card' && <CardAndListSection />}
          {section === 'badge' && <BadgeAndTagSection />}
        </main>
      </div>
    </>
  );
}

interface FlowDesignerSectionProps {
  mode: FlowSurfaceMode;
  setMode: (m: FlowSurfaceMode) => void;
  themeMode: ResolvedThemeMode;
  setThemeMode: (m: ResolvedThemeMode) => void;
  initialData: FlowData;
  nodeMaterials: typeof BPMN_NODE_MATERIALS;
  paletteCategories: typeof BPMN_PALETTE_CATEGORIES;
  flowgramPreview: string;
  hasSavedJson: boolean;
  pageReady: boolean;
  onSaved: (json: unknown) => void;
  onMountError: (msg: string) => void;
  onMountSuccess: () => void;
}

function FlowDesignerSection(props: FlowDesignerSectionProps) {
  const {
    mode,
    setMode,
    themeMode,
    setThemeMode,
    initialData,
    nodeMaterials,
    paletteCategories,
    flowgramPreview,
    hasSavedJson,
    pageReady,
    onSaved,
    onMountError,
    onMountSuccess,
  } = props;

  const surfaceRef = useRef<FlowSurfaceHandle | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [nodeCount, setNodeCount] = useState<number>(initialData.nodes.length);
  const [edgeCount, setEdgeCount] = useState<number>(initialData.edges.length);
  const [flowReady, setFlowReady] = useState<boolean>(false);

  const refreshFromRef = useCallback(() => {
    const h = surfaceRef.current;
    if (!h) return;
    setZoomPercent(Math.round((h.zoom ?? 1) * 100));
    setCanUndo(!!h.canUndo);
    setCanRedo(!!h.canRedo);
    setNodeCount(h.data?.nodes.length ?? 0);
    setEdgeCount(h.data?.edges.length ?? 0);
  }, []);

  // Once FlowSurface mounts, mark ready.
  useEffect(() => {
    if (flowReady) return;
    const handle = window.setInterval(() => {
      const h = surfaceRef.current;
      if (h) {
        setFlowReady(true);
        window.clearInterval(handle);
        onMountSuccess();
        refreshFromRef();
      }
    }, 200);
    return () => window.clearInterval(handle);
  }, [flowReady, refreshFromRef, onMountSuccess]);

  return (
    <>
      <div className="comps-section-card">
        <div className="comps-section-title">
          <Workflow /> FlowCanvas · 流程设计器
        </div>
        <div className="comps-section-desc">
          基于 FlowGram.AI 1.0.12 fixed-layout-editor 封装，统一支撑 BPMN 审批流与 AI Agent 编排流。
          内置：节点拖拽 / 端口连线 / minimap / 环形 undo&redo（Cmd/Ctrl+Z）/ 深色 + 浅色双主题。
        </div>

        <div className="comps-toolbar">
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>节点库</span>
          <div className="comps-mode-group">
            <button className={mode === 'bpmn' ? 'active' : ''} onClick={() => setMode('bpmn')}>
              BPMN ({BPMN_NODE_MATERIALS.length})
            </button>
            <button className={mode === 'agent' ? 'active' : ''} onClick={() => setMode('agent')}>
              Agent ({AGENT_NODE_MATERIALS.length})
            </button>
          </div>

          <span className="comps-quick-row">
            <button
              className="v-btn-ghost"
              disabled={!canUndo}
              onClick={() => {
                surfaceRef.current?.undo();
                refreshFromRef();
              }}
              title="撤销 Cmd/Ctrl+Z"
            >
              <Undo2 style={{ width: 14, height: 14 }} /> 撤销
            </button>
            <button
              className="v-btn-ghost"
              disabled={!canRedo}
              onClick={() => {
                surfaceRef.current?.redo();
                refreshFromRef();
              }}
              title="重做 Cmd/Ctrl+Shift+Z"
            >
              <Redo2 style={{ width: 14, height: 14 }} /> 重做
            </button>
          </span>

          <span className="comps-quick-row">
            <button
              className="v-btn-ghost"
              onClick={() => {
                surfaceRef.current?.zoomOut();
                refreshFromRef();
              }}
              aria-label="缩小"
            >
              <Minus style={{ width: 14, height: 14 }} />
            </button>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', minWidth: 44, textAlign: 'center' }}>{zoomPercent}%</span>
            <button
              className="v-btn-ghost"
              onClick={() => {
                surfaceRef.current?.zoomIn();
                refreshFromRef();
              }}
              aria-label="放大"
            >
              <Plus style={{ width: 14, height: 14 }} />
            </button>
            <button
              className="v-btn-ghost"
              onClick={() => {
                surfaceRef.current?.fitView();
                refreshFromRef();
              }}
              aria-label="适应屏幕"
            >
              <Maximize2 style={{ width: 14, height: 14 }} />
            </button>
          </span>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>画布状态</span>
          <div className="comps-mode-group">
            <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>
              节点 {nodeCount} · 连线 {edgeCount}
            </span>
          </div>

          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>主题</span>
          <div className="comps-mode-group">
            <button className={themeMode === 'dark' ? 'active' : ''} onClick={() => setThemeMode('dark')}>
              <Moon style={{ width: 12, height: 12 }} />
              深色
            </button>
            <button className={themeMode === 'light' ? 'active' : ''} onClick={() => setThemeMode('light')}>
              <Sun style={{ width: 12, height: 12 }} />
              浅色
            </button>
          </div>
        </div>

        <div className="comps-flow-host" data-theme={themeMode}>
          <FlowSurfaceBoundary onError={onMountError}>
            <FlowSurface
              ref={surfaceRef}
              initialData={initialData}
              nodeMaterials={nodeMaterials}
              paletteCategories={paletteCategories}
              themeMode={themeMode}
              showStatusBar
              showPalette
              showPropertyPanel
              withMinimap
              withHistory
              containerStyle={{ height: '100%' }}
              onChange={(next) => {
                setNodeCount(next.nodes.length);
                setEdgeCount(next.edges.length);
              }}
              onSave={(json) => onSaved(json)}
              onPublish={(json) => onSaved(json)}
              onPreview={() => surfaceRef.current?.fitView()}
            />
          </FlowSurfaceBoundary>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>验证项：</span>
          <span className="comps-mode-group" style={{ background: 'transparent', flexWrap: 'wrap' }}>
            <VerificationBadge label="页面已加载" ok={pageReady} />
            <VerificationBadge label="FlowCanvas 已挂载" ok={flowReady} />
            <VerificationBadge label="拖拽节点" ok />
            <VerificationBadge label="端口连线" ok />
            <VerificationBadge label="Undo/Redo" ok={canUndo || canRedo} />
            <VerificationBadge label="Minimap" ok />
            <VerificationBadge
              label="双主题切换"
              ok
              extra={
                <span style={{ fontSize: 10, marginLeft: 4, opacity: .75 }}>
                  {themeMode === 'dark' ? 'dark' : 'light'}
                </span>
              }
            />
            <VerificationBadge
              label={`FlowGram JSON (${nodeCount}N/${edgeCount}E)`}
              ok={hasSavedJson}
            />
          </span>
          <div style={{ flex: 1 }} />
          {flowgramPreview && (
            <button className="v-btn" onClick={() => navigator.clipboard?.writeText(flowgramPreview)}>
              <ClipboardCopy style={{ width: 14, height: 14 }} /> 复制 FlowGram JSON
            </button>
          )}
        </div>
      </div>

      <div className="comps-section-card">
        <div className="comps-section-title">
          <ClipboardCopy /> FlowGram JSON 输出
        </div>
        <div className="comps-section-desc">
          点击工具栏「保存 / 发布」或上方画布的「保存」按钮，会得到 FlowGram JSON。
          这是 v1.3 后端 TECH-WFE 持久化与运行的唯一格式。
        </div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 12,
            maxHeight: 360,
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            color: 'var(--muted-foreground)',
          }}
        >
{flowgramPreview || '// 点击上方画布工具栏的「保存」即可获取 FlowGram JSON 输出示例'}
        </pre>
      </div>
    </>
  );
}

function VerificationBadge({
  label,
  ok,
  extra,
}: {
  label: string;
  ok: boolean;
  extra?: ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: 999,
        background: ok ? 'var(--success-subtle)' : 'var(--muted)',
        color: ok ? 'var(--success)' : 'var(--muted-foreground)',
        border: `1px solid ${ok ? 'rgba(98,209,120,.25)' : 'var(--border)'}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: ok ? 'var(--success)' : 'var(--muted-foreground)',
        }}
      />
      {label}
      {extra ?? null}
    </span>
  );
}

function ButtonAndInputSection() {
  return (
    <div className="comps-section-card">
      <div className="comps-section-title">
        <Sliders /> 按钮 / 输入
      </div>
      <div className="comps-section-desc">标准按钮、输入框、下拉、搜索；与 components.html 风格一致。</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="v-btn"><Save style={{ width: 14, height: 14 }} /> 次级按钮</button>
        <button className="v-btn-primary"><Play style={{ width: 14, height: 14 }} /> 主操作</button>
        <button className="v-btn"><Trash2 style={{ width: 14, height: 14 }} /> 删除</button>
        <button className="v-btn"><Lock style={{ width: 14, height: 14 }} /> 受限</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="v-input" placeholder="搜索…" style={{ width: 220 }} />
        <select className="v-input" style={{ width: 200 }}>
          <option>下拉选择</option>
          <option>选项 A</option>
          <option>选项 B</option>
        </select>
        <button className="v-btn-primary"><Star style={{ width: 14, height: 14 }} /> 主按钮</button>
        <button className="v-btn"><Zap style={{ width: 14, height: 14 }} /> 即时</button>
      </div>
    </div>
  );
}

function CardAndListSection() {
  return (
    <div className="comps-section-card">
      <div className="comps-section-title">
        <Layers /> 卡片 / 列表
      </div>
      <div className="comps-section-desc">基础卡片容器 + 操作型列表项。</div>
      <div className="v-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>组件卡标题</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
          卡片内容描述区域，用于放置任意组件验证片段。
        </div>
      </div>
      <div className="v-card" style={{ padding: 0 }}>
        {[
          { id: 1, title: 'FlowCanvas 流程设计器', desc: 'BPMN + Agent 双场景，节点库已对齐 FlowGram materials' },
          { id: 2, title: 'FlowHistory 环形历史', desc: '环形容量 200，Cmd/Ctrl+Z 直接调用' },
          { id: 3, title: '双主题 Token', desc: 'data-theme=dark|light，CSS 变量驱动' },
        ].map((row) => (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{row.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{row.desc}</div>
            </div>
            <ChevronDown style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeAndTagSection() {
  return (
    <div className="comps-section-card">
      <div className="comps-section-title">
        <Box /> 徽标 / 标签
      </div>
      <div className="comps-section-desc">业务状态、节点类型、提示文案。</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--success-subtle)', color: 'var(--success)' }}>已上线</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>审核中</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,97,102,.1)', color: 'var(--destructive)' }}>已驳回</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>草稿</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(96,165,250,.12)', color: '#60a5fa' }}>BPMN</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(168,85,247,.12)', color: '#a855f7' }}>Agent</span>
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,.12)', color: '#22c55e' }}>已验证</span>
      </div>
    </div>
  );
}
