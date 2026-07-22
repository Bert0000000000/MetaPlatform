import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface MenuItem {
  key: string;
  label: string;
  path: string;
}

const modules: Record<string, MenuItem[]> = {
  portal: [{ key: 'home', label: '首页', path: '/' }],
  dashboard: [
    { key: 'dashboard', label: '工作台', path: '/dashboard' },
    { key: 'my-apps', label: '我的应用', path: '/my-apps' },
    { key: 'my-agents', label: '我的数字员工', path: '/my-agents' },
    { key: 'notifications', label: '消息', path: '/notifications' },
    { key: 'portal', label: '门户', path: '/portal' },
    { key: 'deliverables', label: '交付材料', path: '/deliverables' },
  ],
  ontstudio: [
    { key: 'concepts', label: '概念管理', path: '/concepts' },
    { key: 'entities', label: '实体管理', path: '/entities' },
    { key: 'relations', label: '关系类型', path: '/relations' },
    { key: 'relation-instances', label: '关系实例', path: '/relation-instances' },
    { key: 'rules', label: '规则管理', path: '/rules' },
    { key: 'versions', label: '版本管理', path: '/versions' },
    { key: 'datasources', label: '数据源', path: '/datasources' },
    { key: 'mappings', label: '数据映射', path: '/mappings' },
    { key: 'actions', label: '动作定义', path: '/actions' },
    { key: 'orchestrations', label: '编排', path: '/orchestrations' },
    { key: 'triggers', label: '触发器', path: '/triggers' },
    { key: 'executions', label: '执行监控', path: '/executions' },
    { key: 'graph', label: '知识图谱', path: '/graph' },
    { key: 'quality', label: '数据质量', path: '/quality' },
    { key: 'lineage', label: '数据血缘', path: '/lineage' },
    { key: 'discovery', label: '本体发现', path: '/discovery' },
  ],
  superai: [
    { key: 'chat', label: 'AI 对话', path: '/chat' },
    { key: 'schedule', label: '任务编排', path: '/schedule/orchestration' },
    { key: 'schedule-plan', label: '执行计划', path: '/schedule/plan' },
    { key: 'schedule-parallel', label: '并行执行', path: '/schedule/parallel' },
    { key: 'schedule-aggregate', label: '结果聚合', path: '/schedule/aggregate' },
    { key: 'schedule-templates', label: '任务模板', path: '/schedule/templates' },
    { key: 'schedule-intent', label: '意图调度', path: '/schedule/intent' },
    { key: 'schedule-match', label: '员工匹配', path: '/schedule/match' },
    { key: 'schedule-plan-card', label: '计划卡片', path: '/schedule/plan-card' },
    { key: 'schedule-execution', label: '执行监控', path: '/schedule/execution' },
    { key: 'schedule-result', label: '结果总结', path: '/schedule/result' },
    { key: 'schedule-export', label: '报告导出', path: '/schedule/export' },
    { key: 'schedule-manual-select', label: '人工选择', path: '/schedule/manual-select' },
    { key: 'schedule-a2a', label: 'A2A 协作', path: '/schedule/a2a' },
    { key: 'analysis', label: '数据分析', path: '/analysis' },
    { key: 'cost-optimization', label: '成本优化', path: '/cost-optimization' },
  ],
};

interface PlatformMenuProps {
  currentModule: string;
}

export default function PlatformMenu({ currentModule }: PlatformMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = modules[currentModule] ?? [];

  const selectedKey = useMemo(() => {
    const pathname = location.pathname;
    let match: MenuItem | undefined;
    for (const item of items) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        if (!match || item.path.length > match.path.length) {
          match = item;
        }
      }
    }
    return match?.key ?? (items[0]?.key || '');
  }, [location.pathname, items]);

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={items.map((i) => ({ key: i.key, label: i.label }))}
      onClick={({ key }) => {
        const target = items.find((i) => i.key === key);
        if (target) navigate(target.path);
      }}
      style={{ background: 'transparent', borderRight: 0 }}
    />
  );
}
