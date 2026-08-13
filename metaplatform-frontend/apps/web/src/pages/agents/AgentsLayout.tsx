import { Outlet } from 'react-router-dom';
import { ModuleTabsLayout, PageRoot, type ModuleTab } from '@mate/shared';

/** 数字员工 4 个 tab（侧边栏只保留一级「数字员工」，二级移到内容区）。
 *  员工 tab path=/agents，靠最长前缀匹配自动归属 create / :employeeId / external。 */
export const AGENTS_TABS: ModuleTab[] = [
  { key: 'employees', label: '员工', path: '/agents' },
  { key: 'tasks', label: '任务', path: '/agents/tasks' },
  { key: 'collab', label: '协作', path: '/agents/collab' },
  { key: 'evaluation', label: '评估', path: '/agents/evaluation' },
];

export default function AgentsLayout() {
  return (
    <PageRoot>
      <ModuleTabsLayout tabs={AGENTS_TABS}>
        <Outlet />
      </ModuleTabsLayout>
    </PageRoot>
  );
}
