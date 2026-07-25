/**
 * FlowDesigner
 * --------------------------------------------------
 * Mate Platform 三大流程编排场景的统一编辑器封装。
 *
 * 设计目标：
 *  - 一行接入即可获得"画布 + 工具条 + 本地持久化 + 全屏"完整体验
 *  - 通过 mode 切换 BPMN / Agent / Business 三类节点库与初始数据
 *  - 不依赖后端 API：保存到 localStorage，加载时自动恢复
 *  - 高级用法：传 customRegistries 注入专属卡片（参见 admin/components/node-render.tsx）
 *
 * 用法（apps/portal 内）：
 *
 *   import { FlowDesigner } from '@mate/shared/flow';
 *
 *   <FlowDesigner
 *     mode="bpmn"
 *     storageKey="process-bpmn-2026-q3"
 *     height={640}
 *     onSave={(doc) => console.log('saved', doc)}
 *   />
 *
 * 创建于 2026-07-24，R1 UI 优化阶段。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  FolderOpen,
  Trash2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  CloudOff,
  Cloud,
  Pencil,
  ChevronDown,
  Workflow,
  Bot,
  Briefcase,
} from 'lucide-react';
import {
  FlowgramEditor,
  type FlowgramEditorProps,
} from './flowgram-demo/editor';
import {
  ALL_NODE_REGISTRIES,
  BPMN_NODE_REGISTRIES,
  AGENT_NODE_REGISTRIES,
  BUSINESS_FLOW_REGISTRIES,
} from './node-registries';
import { flowDataToFlowgram, type FlowGramDocumentJSON } from './flow-adapter';
import type { FlowDocumentJSON, FlowNodeRegistry } from '@flowgram.ai/fixed-layout-editor';
import {
  FLOW_MODE_META,
  FLOW_MODE_PRESETS,
  type FlowMode,
} from './presets';

// ============================================================
// 类型
// ============================================================
export interface FlowDesignerProps {
  /**
   * 编排场景：'bpmn' 审批 / 'agent' AI 协作 / 'business' 业务
   * 默认 'bpmn'
   */
  mode?: FlowMode;
  /**
   * localStorage 键名。不传则用 `flowdesigner:${mode}:default`
   */
  storageKey?: string;
  /**
   * 画布高度，默认 640（接受 number px 或 string CSS 长度，如 '100%'）
   */
  height?: number | string;
  /**
   * 初始数据覆盖：缺省用 presets[mode]
   */
  initialData?: FlowGramDocumentJSON;
  /**
   * 节点库覆盖：缺省按 mode 自动选 BPMN/AGENT/BUSINESS
   * 传 'all' 可启用全部 17 种
   */
  nodeRegistryMode?: 'auto' | 'all';
  /**
   * 注入自定义 nodeRegistries（如 admin/components 17 专属卡片）
   */
  customRegistries?: FlowNodeRegistry[];
  /**
   * 隐藏工具条
   */
  hideToolbar?: boolean;
  /**
   * 隐藏顶部 mode 切换
   */
  hideModeSwitch?: boolean;
  /**
   * 隐藏 localStorage 工具（保存/加载/清空）
   */
  hideLocalStorage?: boolean;
  /**
   * 保存成功回调（拿到的是当前 doc JSON）
   */
  onSave?: (doc: FlowGramDocumentJSON) => void;
  /**
   * document 变化回调（拖动 / 编辑 / 删除都触发）
   */
  onChange?: (doc: FlowGramDocumentJSON) => void;
}

// ============================================================
// localStorage 工具
// ============================================================
const LS_PREFIX = 'flowdesigner:';

function buildKey(mode: FlowMode, customKey?: string) {
  return customKey ?? `${LS_PREFIX}${mode}:default`;
}

function loadDoc(key: string): FlowGramDocumentJSON | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as FlowGramDocumentJSON;
  } catch (e) {
    console.warn('[FlowDesigner] loadDoc failed', key, e);
    return null;
  }
}

function saveDoc(key: string, doc: FlowGramDocumentJSON): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(doc));
    return true;
  } catch (e) {
    console.warn('[FlowDesigner] saveDoc failed', key, e);
    return false;
  }
}

function clearDoc(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    console.warn('[FlowDesigner] clearDoc failed', key, e);
  }
}

// ============================================================
// mode 节点库选择
// ============================================================
function pickRegistries(
  mode: FlowMode,
  registryMode: 'auto' | 'all' = 'auto',
  customRegistries?: FlowNodeRegistry[]
): FlowNodeRegistry[] {
  const base =
    registryMode === 'all'
      ? ALL_NODE_REGISTRIES
      : mode === 'bpmn'
      ? BPMN_NODE_REGISTRIES
      : mode === 'agent'
      ? AGENT_NODE_REGISTRIES
      : BUSINESS_FLOW_REGISTRIES;

  if (!customRegistries || customRegistries.length === 0) return base;
  // 合并：按 type 覆盖
  const byType: Record<string, FlowNodeRegistry> = {};
  for (const r of base) byType[r.type] = r;
  for (const r of customRegistries) {
    const prev = byType[r.type];
    byType[r.type] = prev ? { ...prev, ...r } : r;
  }
  return Object.values(byType);
}

// ============================================================
// 主组件
// ============================================================
export const FlowDesigner: React.FC<FlowDesignerProps> = (props) => {
  const {
    mode = 'bpmn',
    storageKey,
    height = 640,
    initialData,
    nodeRegistryMode = 'auto',
    customRegistries,
    hideToolbar = false,
    hideModeSwitch = false,
    hideLocalStorage = false,
    onSave,
    onChange,
  } = props;

  // mode 由父组件控制时也允许内部切换（用 ref 记录初始）
  const [currentMode, setCurrentMode] = useState<FlowMode>(mode);
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const fullStorageKey = useMemo(
    () => buildKey(currentMode, storageKey),
    [currentMode, storageKey]
  );

  // 当前 doc 缓存（FlowgramEditor onChange 写入）
  const docRef = useRef<FlowGramDocumentJSON | null>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [hasStored, setHasStored] = useState<boolean>(() =>
    typeof window !== 'undefined' ? !!window.localStorage.getItem(fullStorageKey) : false
  );
  const [justSavedTick, setJustSavedTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 检查 storage 里是否有该 key 的草稿
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasStored(!!window.localStorage.getItem(fullStorageKey));
  }, [fullStorageKey]);

  // 编辑器初始数据：用户传入 > localStorage > presets[currentMode]
  // docVersion 是清空按钮的重置信号（用 key 重挂载代替也可，但这里显式更稳）
  const editorInitialData = useMemo<FlowGramDocumentJSON>(() => {
    if (initialData) return initialData;
    const fromLs = loadDoc(fullStorageKey);
    if (fromLs) return fromLs;
    return flowDataToFlowgram(FLOW_MODE_PRESETS[currentMode]) as unknown as FlowGramDocumentJSON;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullStorageKey, currentMode, docVersion]);

  const nodeRegistries = useMemo(
    () => pickRegistries(currentMode, nodeRegistryMode, customRegistries),
    [currentMode, nodeRegistryMode, customRegistries]
  );

  const handleChange: FlowgramEditorProps['onChange'] = useCallback(
    (json: FlowDocumentJSON) => {
      docRef.current = json as unknown as FlowGramDocumentJSON;
      onChange?.(json as unknown as FlowGramDocumentJSON);
    },
    [onChange]
  );

  const handleSave = useCallback(() => {
    if (!docRef.current) return;
    const ok = saveDoc(fullStorageKey, docRef.current);
    if (ok) {
      setHasStored(true);
      setJustSavedTick((t) => t + 1);
      onSave?.(docRef.current);
    }
  }, [fullStorageKey, onSave]);

  const handleClear = useCallback(() => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        '确认清空当前流程？此操作会删除本地保存的草稿。'
      );
      if (!confirmed) return;
    }
    clearDoc(fullStorageKey);
    setHasStored(false);
    // 重置为 preset
    docRef.current = flowDataToFlowgram(FLOW_MODE_PRESETS[currentMode]) as unknown as FlowGramDocumentJSON;
    setDocVersion((v) => v + 1);
  }, [fullStorageKey, currentMode]);

  const handleModeChange = useCallback((newMode: FlowMode) => {
    setCurrentMode(newMode);
  }, []);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // Esc 退出全屏
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const meta = FLOW_MODE_META[currentMode];
  const ModeIcon =
    currentMode === 'bpmn' ? Workflow : currentMode === 'agent' ? Bot : Briefcase;

  return (
    <div
      className={`fd-root${isFullscreen ? ' fd-fullscreen' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        height: isFullscreen ? '100vh' : height,
        ...(isFullscreen
          ? { position: 'fixed', inset: 0, zIndex: 9999, borderRadius: 0, border: 'none' }
          : {}),
      }}
    >
      {/* ---------- 工具条 ---------- */}
      {!hideToolbar && (
        <div
          className="fd-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {/* 左：当前场景 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className={`fd-mode-icon fd-mode-${meta.accent}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ModeIcon size={15} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  lineHeight: 1.3,
                }}
              >
                {meta.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted-foreground)',
                  lineHeight: 1.3,
                }}
              >
                {meta.description}
              </div>
            </div>
            {!hideModeSwitch && (
              <ModeDropdown currentMode={currentMode} onChange={handleModeChange} />
            )}
          </div>

          {/* 右：localStorage 状态 + 按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!hideLocalStorage && (
              <>
                <StoredStatus hasStored={hasStored} justSavedTick={justSavedTick} />
                <button className="fd-btn" onClick={handleSave} title="保存到浏览器本地">
                  <Save size={14} /> 保存
                </button>
                <button
                  className="fd-btn"
                  onClick={handleClear}
                  title="清空并恢复为模板"
                  disabled={!hasStored && !docRef.current}
                >
                  <Trash2 size={14} /> 清空
                </button>
              </>
            )}
            <button className="fd-btn" onClick={toggleFullscreen} title="全屏编辑">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? '退出' : '全屏'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- 画布 ---------- */}
      <div
        className="fd-canvas"
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
        }}
      >
        <FlowgramEditor
          key={`${currentMode}-${docVersion}`}
          initialData={editorInitialData as unknown as FlowDocumentJSON}
          nodeRegistries={nodeRegistries}
          onChange={handleChange}
        />
      </div>

      {/* ---------- 样式注入（一次性） ---------- */}
      <StyleInjector />
    </div>
  );
};

// ============================================================
// 子组件
// ============================================================
const ModeDropdown: React.FC<{
  currentMode: FlowMode;
  onChange: (m: FlowMode) => void;
}> = ({ currentMode, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="fd-btn"
        onClick={() => setOpen((v) => !v)}
        title="切换编排场景"
      >
        <Pencil size={14} /> 切换场景
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="fd-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            zIndex: 10,
            minWidth: 240,
            padding: 4,
          }}
        >
          {(Object.keys(FLOW_MODE_META) as FlowMode[]).map((m) => {
            const meta = FLOW_MODE_META[m];
            const active = m === currentMode;
            return (
              <button
                key={m}
                className={`fd-dropdown-item${active ? ' active' : ''}`}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: active ? 'var(--muted)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--foreground)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{meta.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {meta.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StoredStatus: React.FC<{ hasStored: boolean; justSavedTick: number }> = ({
  hasStored,
  justSavedTick,
}) => {
  // justSavedTick > 0 → 刚保存过
  if (justSavedTick > 0) {
    return (
      <span
        className="fd-status fd-status-saved"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--success)',
        }}
      >
        <CheckCircle2 size={12} /> 已保存
      </span>
    );
  }
  if (hasStored) {
    return (
      <span
        className="fd-status fd-status-stored"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--muted-foreground)',
        }}
      >
        <Cloud size={12} /> 草稿
      </span>
    );
  }
  return (
    <span
      className="fd-status fd-status-empty"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: 'var(--muted-foreground)',
      }}
    >
      <CloudOff size={12} /> 未保存
    </span>
  );
};

// ============================================================
// 样式（注入一次）
// ============================================================
const STYLE_ID = 'flow-designer-shared-style-v1';
const STYLE = `
  .fd-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--foreground);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    transition: background .15s, border-color .15s;
  }
  .fd-btn:hover:not(:disabled) {
    background: var(--muted);
    border-color: #3a3a3a;
  }
  .fd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .fd-mode-icon { color: var(--foreground); }
  .fd-mode-icon.fd-mode-bpmn     { background: var(--info-subtle);     color: var(--info); }
  .fd-mode-icon.fd-mode-ai       { background: var(--purple-subtle);   color: var(--purple); }
  .fd-mode-icon.fd-mode-business { background: var(--success-subtle);  color: var(--success); }
  .fd-dropdown-item:hover { background: var(--muted) !important; }
  .fd-root .demo-fixed-container,
  .fd-root .demo-fixed-layout,
  .fd-root .demo-fixed-editor { width: 100%; height: 100%; min-height: 0; }
  .fd-root .demo-fixed-layout { grid-template-columns: 240px 1fr; }
  .fd-root .gedit-flow-background-layer,
  .fd-root .gedit-grid-svg { position: absolute !important; inset: 0 !important; }
`;

let styleInjected = false;
const StyleInjector: React.FC = () => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (styleInjected) return;
    if (document.getElementById(STYLE_ID)) {
      styleInjected = true;
      return;
    }
    const node = document.createElement('style');
    node.id = STYLE_ID;
    node.textContent = STYLE;
    document.head.appendChild(node);
    styleInjected = true;
  }, []);
  return null;
};

export default FlowDesigner;
