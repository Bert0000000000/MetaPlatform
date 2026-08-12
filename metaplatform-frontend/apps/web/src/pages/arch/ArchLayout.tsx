import { Tabs } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface SubTab {
  key: string;
  label: string;
  path: string;
}

interface ArchTab {
  key: string;
  label: string;
  subTabs: SubTab[];
}

export const ARCH_TABS: ArchTab[] = [
  {
    key: 'business',
    label: '业务架构',
    subTabs: [
      { key: 'capabilities', label: '能力地图', path: '/arch/capabilities' },
      { key: 'value-streams', label: '价值流', path: '/arch/value-streams' },
      { key: 'processes', label: '业务流程', path: '/arch/processes' },
      { key: 'org-roles', label: '组织角色', path: '/arch/org-roles' },
    ],
  },
  {
    key: 'application',
    label: '应用架构',
    subTabs: [
      { key: 'applications', label: '应用全景', path: '/arch/applications' },
      { key: 'tech-debt', label: '技术债务', path: '/arch/tech-debt' },
    ],
  },
  {
    key: 'data',
    label: '数据架构',
    subTabs: [
      { key: 'data', label: '主题域', path: '/arch/data' },
      { key: 'data/flows', label: '数据流转', path: '/arch/data/flows' },
      { key: 'data/assets', label: '资产目录', path: '/arch/data/assets' },
      { key: 'data/standards', label: '数据标准', path: '/arch/data/standards' },
    ],
  },
  {
    key: 'technology',
    label: '技术架构',
    subTabs: [
      { key: 'tech-stacks', label: '技术栈', path: '/arch/tech-stacks' },
      { key: 'tech-components', label: '技术组件', path: '/arch/tech-components' },
      { key: 'deployment-topologies', label: '基础设施', path: '/arch/deployment-topologies' },
      { key: 'tech-radar', label: '技术雷达', path: '/arch/tech-radar' },
    ],
  },
  {
    key: 'governance',
    label: '架构治理',
    subTabs: [
      { key: 'reviews', label: '架构评审', path: '/arch/reviews' },
      { key: 'review-templates', label: '评审模板', path: '/arch/review-templates' },
      { key: 'principles', label: '标准规范', path: '/arch/principles' },
    ],
  },
  {
    key: 'ontology-mapping',
    label: 'Ontology联动',
    subTabs: [
      { key: 'ontology-mapping', label: '映射配置', path: '/arch/ontology-mapping' },
    ],
  },
];

const DEFAULT_TAB = ARCH_TABS[0];
const DEFAULT_SUB = DEFAULT_TAB.subTabs[0];

/** 根据当前 URL 推算激活的一级 / 二级 Tab。先精确匹配，再按最长前缀匹配（用于详情子路由）。 */
function resolveActive(path: string): { topKey: string; subKey: string } {
  if (path === '/arch' || path === '/arch/') {
    return { topKey: DEFAULT_TAB.key, subKey: DEFAULT_SUB.key };
  }

  // 技术架构总览页无独立二级 Tab，归入「技术架构」并高亮首个子项
  if (path === '/arch/tech') {
    const tech = ARCH_TABS.find((t) => t.key === 'technology')!;
    return { topKey: tech.key, subKey: tech.subTabs[0].key };
  }

  // 1. 精确匹配
  for (const tab of ARCH_TABS) {
    for (const sub of tab.subTabs) {
      if (path === sub.path) {
        return { topKey: tab.key, subKey: sub.key };
      }
    }
  }

  // 2. 前缀匹配（最长路径优先，避免 /arch/data 误吞 /arch/data/flows）
  let best: { tab: ArchTab; sub: SubTab } | null = null;
  for (const tab of ARCH_TABS) {
    for (const sub of tab.subTabs) {
      if (path.startsWith(sub.path + '/')) {
        if (!best || sub.path.length > best.sub.path.length) {
          best = { tab, sub };
        }
      }
    }
  }
  if (best) {
    return { topKey: best.tab.key, subKey: best.sub.key };
  }

  return { topKey: DEFAULT_TAB.key, subKey: DEFAULT_SUB.key };
}

export default function ArchLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { topKey: activeTopTab, subKey: activeSubTab } = resolveActive(location.pathname);
  const currentTab = ARCH_TABS.find((t) => t.key === activeTopTab) ?? DEFAULT_TAB;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
      {/* 一级 Tab */}
      <Tabs
        activeKey={activeTopTab}
        onChange={(key) => {
          const tab = ARCH_TABS.find((t) => t.key === key);
          if (tab && tab.subTabs.length > 0) {
            navigate(tab.subTabs[0].path);
          }
        }}
        tabList={ARCH_TABS.map((t) => ({ tab: t.label, itemKey: t.key }))}
        size="large"
        tabBarStyle={{ marginBottom: 0 }}
      />

      {/* 二级 Tab（侧边栏风格）+ 内容区 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', paddingTop: 4 }}>
        {currentTab.subTabs.length > 0 && (
          <Tabs
            tabPosition="left"
            activeKey={activeSubTab}
            onChange={(key) => {
              const sub = currentTab.subTabs.find((s) => s.key === key);
              if (sub) navigate(sub.path);
            }}
            tabBarStyle={{ minWidth: 132, marginTop: 4 }}
            style={{ flex: 1, minHeight: 0 }}
          >
            {currentTab.subTabs.map((s) => (
              <Tabs.TabPane itemKey={s.key} tab={s.label} key={s.key}>
                {s.key === activeSubTab ? (
                  <div style={{ height: '100%', overflowY: 'auto', paddingRight: 8, paddingBottom: 24 }}>
                    {children}
                  </div>
                ) : null}
              </Tabs.TabPane>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
