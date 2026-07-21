import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

const modules: Record<string, { key: string; label: string; path: string }[]> = {
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
};

interface PlatformMenuProps {
  currentModule: string;
}

export default function PlatformMenu({ currentModule }: PlatformMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = modules[currentModule] ?? [];

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname.split('/')[1] || 'concepts']}
      items={items.map((i) => ({ key: i.key, label: i.label }))}
      onClick={({ key }) => {
        const target = items.find((i) => i.key === key);
        if (target) navigate(target.path);
      }}
    />
  );
}
