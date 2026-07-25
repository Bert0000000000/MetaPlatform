/**
 * ProcessDesignerPage
 * --------------------------------------------------
 * 应用中心 → 流程设计器。
 *
 * 2026-07-24 R1 UI 优化：
 *  - 替换为 `@mate/shared/flow` 的 FlowDesigner
 *  - 三大场景 mode 切换（审批 BPMN / AI 协作 Agent / 业务流程 Business）
 *  - 保存到 localStorage（按应用 ID 隔离 key）
 *  - 工具条内置（保存 / 加载 / 清空 / 全屏 + 状态指示）
 *
 * 注意：本页面是 v1.3 重构期的"骨架"——不接后端 API，
 *       数据全部留在 localStorage，方便快速验证画布交互。
 *       后续 R2/R3 会接入 TECH-WFE / TECH-AGENT 的真实保存接口。
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';
import { FlowDesigner, type FlowMode } from '@mate/shared/flow';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

/**
 * 从 localStorage / URL 参数 / 默认值推断当前 mode。
 * 优先 URL `?mode=`，其次 localStorage `flowdesigner:current-mode`，最后默认 'bpmn'。
 */
function detectMode(): FlowMode {
  if (typeof window === 'undefined') return 'bpmn';
  try {
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get('mode');
    if (fromUrl === 'bpmn' || fromUrl === 'agent' || fromUrl === 'business') {
      return fromUrl as FlowMode;
    }
    const fromLs = window.localStorage.getItem('flowdesigner:current-mode');
    if (fromLs === 'bpmn' || fromLs === 'agent' || fromLs === 'business') {
      return fromLs as FlowMode;
    }
  } catch {
    // 忽略
  }
  return 'bpmn';
}

export default function ProcessDesignerPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  const initialMode = useMemo(() => detectMode(), []);
  const storageKey = `flowdesigner:app:${appId}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--background)',
      }}
    >
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <FlowDesigner
          mode={initialMode}
          storageKey={storageKey}
          height="100%"
          onSave={(doc) => {
            // eslint-disable-next-line no-console
            console.log('[ProcessDesignerPage] saved', { appId, nodeCount: (doc as any)?.nodes?.length });
            // 顺手在 localStorage 记录当前 mode（用于刷新后恢复）
            try {
              window.localStorage.setItem('flowdesigner:current-mode', initialMode);
            } catch {
              // ignore
            }
          }}
          onChange={(doc) => {
            // eslint-disable-next-line no-console
            console.debug('[ProcessDesignerPage] changed', (doc as any)?.nodes?.length, 'nodes');
          }}
        />
      </div>
    </div>
  );
}
