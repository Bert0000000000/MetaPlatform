import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';
import {
  FlowgramEditor,
  ALL_NODE_REGISTRIES,
  flowDataToFlowgram,
  LEAVE_FLOW_INITIAL_DATA,
  type FlowGramDocumentJSON,
} from '@mate/shared/flow';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

export default function ProcessDesignerPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  const [doc, setDoc] = useState<FlowGramDocumentJSON | null>(
    LEAVE_FLOW_INITIAL_DATA as unknown as FlowGramDocumentJSON
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minHeight: 0,
        overflow: 'hidden',
        background: 'radial-gradient(circle at 0% 0%, #1a1c20 0%, #0a0b0d 100%)',
      }}
    >
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      <div style={{ flex: 1, minHeight: 0 }}>
        <FlowgramEditor
          initialData={flowDataToFlowgram(LEAVE_FLOW_INITIAL_DATA) as unknown as Parameters<typeof FlowgramEditor>[0]['initialData']}
          nodeRegistries={ALL_NODE_REGISTRIES}
          onChange={(json: unknown) => {
            // eslint-disable-next-line no-console
            console.log('[ProcessDesignerPage] document changed', json);
            setDoc(json as FlowGramDocumentJSON);
          }}
        />
      </div>
    </div>
  );
}
