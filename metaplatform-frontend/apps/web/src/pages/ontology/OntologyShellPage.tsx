import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Hexagon, Link2, Zap, Database, PlayCircle, GitBranch, Plus } from 'lucide-react';
import { Button } from '@douyinfe/semi-ui';
import { AIAssistantTrigger, AIAssistantWorkspace, PageRoot, SubTabs } from '@mate/shared';
import OntologyModelingPage from './OntologyModelingPage';
import OntologyDatacenterPage from './OntologyDatacenterPage';
import OntologyActionPage from './OntologyActionPage';
import OntologyGraphPage from './OntologyGraphPage';
import RelationshipTypeListPage from './relationship-types/RelationshipTypeListPage';
import ActionTypeListPage from './actions/ActionTypeListPage';
import { useOntologyAssistant, type ProposalFromStream } from './hooks/useOntologyAssistant';
import ProposalConfirmDrawer from './components/ProposalConfirmDrawer';

const TABS = [
  { key: 'concept', label: '概念模型', icon: Hexagon, path: '/ontology' },
  { key: 'relationship-types', label: '关系类型', icon: Link2, path: '/ontology?tab=relationship-types' },
  { key: 'action-types', label: '动作类型', icon: Zap, path: '/ontology?tab=action-types' },
  { key: 'datacenter', label: '数据中心', icon: Database, path: '/ontology?tab=datacenter' },
  { key: 'action', label: 'Action 编排', icon: PlayCircle, path: '/ontology?tab=action' },
  { key: 'graph', label: '知识图谱', icon: GitBranch, path: '/ontology?tab=graph' },
];

const ALIASES: Record<string, string> = {
  modeling: 'concept',
  rel: 'relationship-types',
  relationship: 'relationship-types',
  'action-type': 'action-types',
  data: 'datacenter',
  orchestration: 'action',
  knowledge: 'graph',
};

function resolveTab(raw: string | null): string {
  const k = (raw || 'concept').toLowerCase();
  return ALIASES[k] ?? k;
}

export default function OntologyShellPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const activeTab = resolveTab(searchParams.get('tab'));
  const subTab = searchParams.get('subTab') ?? undefined;

  // 概念模型 tab 的「新建概念」drawer 开关：状态提到 Shell，按钮渲染在 sticky 行右侧
  const [createOpen, setCreateOpen] = useState(false);

  // Proposal 流桥接（MP-ONT-PROPOSAL-01）：
  //   流结束后若后端返回 proposal_id → 自动弹 ProposalConfirmDrawer
  //   否则纯文本回答显示在面板气泡里
  const [pendingProposal, setPendingProposal] = useState<ProposalFromStream | null>(null);

  // 模型列表 refresh key：proposal execute 成功后递增，触发 ModelingPage 重新拉数据
  const [modelingRefreshKey, setModelingRefreshKey] = useState(0);

  const assistant = useOntologyAssistant({
    employeeId: 'ontology-shell',
    employeeName: '本体 AI',
    employeeDescription: '统一调度本体引擎各模块的数字员工',
    moduleLabel: 'Ontology 引擎',
    welcomeMessage:
      '你好，我是本体 AI。可以协助你管理概念 / 数据 / 动作 / 图谱各模块，输入自然语言描述即可生成概念提案。',
    suggestions: [
      '帮我设计一个「数字员工档案」概念',
      '把「客户档案」和「企业客户」合并',
      '当前本体有多少概念',
      'CDC 同步状态如何',
    ],
    baseContext: {
      interaction: {
        appCode: 'mate-platform',
        pageCode: 'ontology-shell',
        pageUrl: '/ontology',
      },
    },
    onProposal: (proposal) => {
      // 收到 proposal_id → 弹确认抽屉
      setPendingProposal(proposal);
    },
    onError: (msg) => {
      // 流式失败兜底（toast 由 shared client interceptor 已处理，这里只防止遗漏）
      console.warn('[OntologyAssistant] stream failed:', msg);
    },
  });

  const subTabs = useMemo(
    () => TABS.map((t) => ({ label: t.label, path: t.path, activePath: activeTab === t.key ? '/ontology' : `${location.pathname}?tab=${t.key}` })),
    [activeTab, location.pathname],
  );

  const handleTabChange = (key: string) => {
    const next = new URLSearchParams();
    next.set('tab', key);
    // 切一级 tab 时清掉子 tab，避免非法 subTab 残留
    setSearchParams(next, { replace: false });
  };

  const handleSubTabChange = (subKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    next.set('subTab', subKey);
    setSearchParams(next, { replace: false });
  };

  const stickyHeader = (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 64,
        padding: '0 24px',
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        <SubTabs
          items={subTabs}
          activePath={activeTab === 'concept' ? '/ontology' : `?tab=${activeTab}`}
          embedded
        />
      </div>
      {activeTab === 'concept' && (
        <Button
          theme="solid"
          type="primary"
          onClick={() => setCreateOpen(true)}
          style={{ flexShrink: 0 }}
        >
          <Plus style={{ width: 16, height: 16 }} />新建概念
        </Button>
      )}
      <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
    </div>
  );

  return (
    <PageRoot header={stickyHeader}>
      <AIAssistantWorkspace assistant={assistant}>
        {activeTab === 'concept' && (
          <OntologyModelingPage
            createOpen={createOpen}
            setCreateOpen={setCreateOpen}
            refreshKey={modelingRefreshKey}
          />
        )}
        {activeTab === 'datacenter' && <OntologyDatacenterPage initialSubTab={subTab} />}
        {activeTab === 'action' && <OntologyActionPage />}
        {activeTab === 'graph' && <OntologyGraphPage />}
        {activeTab === 'relationship-types' && <RelationshipTypeListPage />}
        {activeTab === 'action-types' && <ActionTypeListPage />}
      </AIAssistantWorkspace>

      {/* ProposalConfirmDrawer：流返回 proposal_id 时弹出 */}
      <ProposalConfirmDrawer
        open={pendingProposal !== null}
        proposalId={pendingProposal?.proposal_id ?? null}
        initialKind={pendingProposal?.kind}
        onExecuted={(proposalId) => {
          // execute 成功 → 刷新概念列表 / 关系列表等
          if (proposalId) setModelingRefreshKey((k) => k + 1);
        }}
        onClosed={() => {
          setPendingProposal(null);
        }}
      />
    </PageRoot>
  );
}