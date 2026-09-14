import { Suspense, lazy, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Hexagon, Database, PlayCircle, GitBranch, Plus, Boxes, ShieldCheck,
  Home, LineChart,
} from 'lucide-react';
import { Button } from '@douyinfe/semi-ui';
import { AIAssistantTrigger, AIAssistantWorkspace, PageRoot, SubTabs, usePageAssistant } from '@mate/shared';
import OverviewPage from './OverviewPage';
import OntologyModelingPage from './OntologyModelingPage';
import OntologyDatacenterPage from './OntologyDatacenterPage';
import OntologyActionPage from './OntologyActionPage';
import ObjectDataPage from './ObjectDataPage';
import TypeManagementTab from './TypeManagementTab';
import GovernancePage from './GovernancePage';
import AnalyticsTab from './AnalyticsTab';
import { useOntologyAssistant, type ProposalFromStream } from './hooks/useOntologyAssistant';
import ProposalConfirmDrawer from './components/ProposalConfirmDrawer';

// 懒加载（减首屏 bundle）：
//   - 知识图谱页（OntologyGraphPage 含较重的图渲染，非首屏 tab）
//   - 分析应用三个子页（分析工作台 / 仪表盘 / 地图）由 AnalyticsTab 按需挂载
const OntologyGraphPage = lazy(() => import('./OntologyGraphPage'));

const LAZY_FALLBACK = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--muted-foreground)', fontSize: 13 }}>
    加载中…
  </div>
);

// 8 个一级 tab（两轮去重后）：
//   - 类型管理 = 对象/关系/动作/接口 四类 Kernel 类型层基元的统一入口
//   - 分析应用 = 分析工作台 / 仪表盘 / 地图（L6 应用层三件套，Palantir Quiver/Carbon/Map 对位）
const TABS = [
  { key: 'overview', label: '总览', icon: Home, path: '/ontology' },
  { key: 'concept', label: '类型管理', icon: Hexagon, path: '/ontology?tab=concept' },
  { key: 'objects', label: '对象数据', icon: Boxes, path: '/ontology?tab=objects' },
  { key: 'datacenter', label: '数据中心', icon: Database, path: '/ontology?tab=datacenter' },
  { key: 'action', label: 'Action 编排', icon: PlayCircle, path: '/ontology?tab=action' },
  { key: 'graph', label: '知识图谱', icon: GitBranch, path: '/ontology?tab=graph' },
  { key: 'governance', label: '治理', icon: ShieldCheck, path: '/ontology?tab=governance' },
  { key: 'analytics', label: '分析应用', icon: LineChart, path: '/ontology?tab=analytics' },
];

/**
 * 历史 tab key → 目标 {tab, subTab}。
 * 被合并的 tab 不只映射父 tab，还要落到对应子 tab，
 * 否则旧链接（如 ?tab=relationship-types）会丢失目标子页、落回默认子页。
 */
const LEGACY_TABS: Record<string, { tab: string; subTab?: string }> = {
  modeling: { tab: 'concept' },
  rel: { tab: 'concept', subTab: 'relationship' },
  relationship: { tab: 'concept', subTab: 'relationship' },
  'relationship-types': { tab: 'concept', subTab: 'relationship' },
  'action-type': { tab: 'concept', subTab: 'action' },
  'action-types': { tab: 'concept', subTab: 'action' },
  interfaces: { tab: 'concept', subTab: 'interface' },
  analysis: { tab: 'analytics', subTab: 'analysis' },
  dashboard: { tab: 'analytics', subTab: 'dashboard' },
  map: { tab: 'analytics', subTab: 'map' },
  data: { tab: 'datacenter' },
  orchestration: { tab: 'action' },
  knowledge: { tab: 'graph' },
};

/**
 * 页面级语义标题。SubTabs 负责导航，不应同时承担页面标题语义；
 * 标题也为系统验收、无障碍导航和浏览器历史提供稳定锚点。
 */
const TAB_TITLES: Record<string, string> = {
  overview: '总览',
  concept: '类型管理',
  objects: '对象数据',
  datacenter: '数据中心',
  action: 'Action 编排',
  graph: '知识图谱',
  governance: '治理',
  analytics: '分析应用',
};

/** /ontology 无 query 时默认落在总览 tab（首页驾驶舱）。 */
function resolveTab(rawTab: string | null, rawSub: string | null): { tab: string; subTab?: string } {
  const k = (rawTab || 'overview').toLowerCase();
  const legacy = LEGACY_TABS[k];
  if (legacy) return { tab: legacy.tab, subTab: legacy.subTab ?? undefined };
  const known = TABS.some((t) => t.key === k);
  if (!known) return { tab: 'overview' };
  return { tab: k, subTab: rawSub ?? undefined };
}

/** tab → SubTabs active 匹配锚点（各 tab 唯一且互为非前缀，保证精确命中）。 */
const tabMatchPath = (key: string) => (key === 'overview' ? '/ontology' : `?tab=${key}`);

/**
 * @param defaultTab UI-P0 新 IA 桥接：`/ontology/{explorer,datacenter,model,ops}` 用路径表达
 *   主 tab，而本页内部仍以 `?tab=` 为准。无 query 时用该默认值兜底，两侧保持一致。
 */
export default function OntologyShellPage({ defaultTab }: { defaultTab?: string } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab: activeTab, subTab } = resolveTab(
    searchParams.get('tab') ?? defaultTab ?? null,
    searchParams.get('subTab'),
  );

  // 概念模型 tab 的「新建概念」drawer 开关：状态提到 Shell，按钮渲染在 sticky 行右侧
  const [createOpen, setCreateOpen] = useState(false);

  // Proposal 流桥接（MP-ONT-PROPOSAL-01）：
  //   流结束后若后端返回 proposal_id → 自动弹 ProposalConfirmDrawer
  //   否则纯文本回答显示在面板气泡里
  const [pendingProposal, setPendingProposal] = useState<ProposalFromStream | null>(null);

  // 模型列表 refresh key：proposal execute 成功后递增，触发 ModelingPage 重新拉数据
  const [modelingRefreshKey, setModelingRefreshKey] = useState(0);

  const assistant = useOntologyAssistant({
    employeeId: 'ontology-modeler',
    employeeName: '本体建模数字员工',
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

  // 数据中心是 Ontology Shell 的一个正式子域，需要保持页面级员工身份，
  // 避免所有子页都伪装成同一个建模员工。
  const dataAssistant = usePageAssistant({
    employeeId: 'ontology-data-steward',
    employeeName: '本体数据管家',
    employeeDescription: '帮助你把控本体数据质量、数据一致性和数据源同步状态',
    moduleLabel: 'Ontology 数据中心',
    welcomeMessage: '你好，我是本体数据管家。可协助你分析数据源、同步状态和数据质量指标。',
    suggestions: ['分析本体数据质量', '检查数据一致性', '调查数据同步异常'],
  });
  const activeAssistant = activeTab === 'datacenter' ? dataAssistant : assistant;

  // 各 tab 的 active 匹配锚点互不相同且互为非前缀（overview → '/ontology'，
  // 其余 → '?tab=<key>'），SubTabs 精确命中当前 tab，不再依赖 pathname 拼接。
  const subTabs = useMemo(
    () => TABS.map((t) => ({ label: t.label, path: t.path, activePath: tabMatchPath(t.key) })),
    [],
  );

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
      <h1
        style={{
          margin: 0,
          flexShrink: 0,
          fontSize: 18,
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        {TAB_TITLES[activeTab] ?? 'Ontology'}
      </h1>
      {/* tab 收敛到 8 个后常规宽度单行放下；overflowX 兜底窄屏横向滚动 */}
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' }}>
        <SubTabs
          items={subTabs}
          activePath={tabMatchPath(activeTab)}
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
      <AIAssistantTrigger open={activeAssistant.isOpen} onClick={activeAssistant.toggle} />
    </div>
  );

  return (
    <PageRoot header={stickyHeader}>
      <AIAssistantWorkspace assistant={activeAssistant}>
        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'overview' && <OverviewPage />}
          {activeTab === 'objects' && <ObjectDataPage />}
          {activeTab === 'concept' && (
            <TypeManagementTab
              initialSub={subTab}
              conceptNode={
                <OntologyModelingPage
                  createOpen={createOpen}
                  setCreateOpen={setCreateOpen}
                  refreshKey={modelingRefreshKey}
                />
              }
            />
          )}
          {activeTab === 'datacenter' && <OntologyDatacenterPage initialSubTab={subTab} />}
          {activeTab === 'action' && <OntologyActionPage />}
          {activeTab === 'graph' && (
            <Suspense fallback={LAZY_FALLBACK}>
              <OntologyGraphPage />
            </Suspense>
          )}
          {activeTab === 'governance' && <GovernancePage />}
          {activeTab === 'analytics' && <AnalyticsTab initialSub={subTab} />}
        </div>
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
