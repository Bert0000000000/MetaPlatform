import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Hexagon, Link2, Zap, Database, PlayCircle, GitBranch, Plus } from 'lucide-react';
import { Button } from '@douyinfe/semi-ui';
import { AIAssistantTrigger, AIAssistantWorkspace, PageRoot, SubTabs, usePageAssistant } from '@mate/shared';
import OntologyModelingPage from './OntologyModelingPage';
import OntologyDatacenterPage from './OntologyDatacenterPage';
import OntologyActionPage from './OntologyActionPage';
import OntologyGraphPage from './OntologyGraphPage';
import RelationshipTypeListPage from './relationship-types/RelationshipTypeListPage';
import ActionTypeListPage from './actions/ActionTypeListPage';

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

  const assistant = usePageAssistant({
    employeeId: 'ontology-shell',
    employeeName: '本体 AI',
    employeeDescription: '统一调度本体引擎各模块的数字员工',
    moduleLabel: 'Ontology 引擎',
    welcomeMessage: '你好，我是本体 AI。可以协助你管理概念/数据/动作/图谱各模块。',
    suggestions: ['当前本体有多少概念', 'CDC 同步状态如何', '近期新增了哪些 Action'],
    createReply: (content) => `我会在「${TABS.find((t) => t.key === activeTab)?.label ?? activeTab}」模块内为你解答：「${content}」。`,
  });

  // 概念模型 tab 的「新建概念」drawer 开关：状态提到 Shell，按钮渲染在 sticky 行右侧
  const [createOpen, setCreateOpen] = useState(false);

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
          <OntologyModelingPage createOpen={createOpen} setCreateOpen={setCreateOpen} />
        )}
        {activeTab === 'datacenter' && <OntologyDatacenterPage initialSubTab={subTab} />}
        {activeTab === 'action' && <OntologyActionPage />}
        {activeTab === 'graph' && <OntologyGraphPage />}
        {activeTab === 'relationship-types' && <RelationshipTypeListPage />}
        {activeTab === 'action-types' && <ActionTypeListPage />}
      </AIAssistantWorkspace>
    </PageRoot>
  );
}