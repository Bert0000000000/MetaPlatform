import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Employee } from '@/api/dw/types';
import {
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
} from '@/api/dw/types';
import EmployeeCloneButton from './EmployeeCloneButton';

interface EmployeeCardProps {
  employee: Employee;
  onToggle: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onCloned: (employee: Employee) => void;
}

export default function EmployeeCard({ employee, onToggle, onDelete, onCloned }: EmployeeCardProps) {
  const navigate = useNavigate();
  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];
  const isOnline = employee.status === 'ACTIVE';

  const moreItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <SettingOutlined />,
      label: '编辑配置',
      onClick: () => navigate(`/agents/${employee.code}/capabilities`),
    },
    {
      key: 'clone',
      icon: <RobotOutlined />,
      label: <EmployeeCloneButton source={employee} asMenuItem onCloned={onCloned} />,
    },
    { type: 'divider' },
    {
      key: 'toggle',
      icon: isOnline ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      label: isOnline ? '停用' : '启用',
      onClick: () => onToggle(employee),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除「${employee.name}」吗？`}
          onConfirm={() => onDelete(employee)}
        >
          <span>删除</span>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      styles={{ body: { padding: 16 } }}
      actions={[
        <Button key="detail" type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/agents/${employee.code}`)}>
          详情
        </Button>,
        <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>
          编辑
        </Button>,
        <Dropdown key="more" menu={{ items: moreItems }}>
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>,
      ]}
    >
      <Space align="start" style={{ width: '100%' }} wrap>
        <Avatar
          size={44}
          src={employee.avatar}
          style={{ background: '#1a1a1a', color: '#60a5fa', border: '1px solid #262626', flexShrink: 0 }}
          icon={<RobotOutlined />}
        >
          {employee.name.slice(0, 1)}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <a
              onClick={() => navigate(`/agents/${employee.code}`)}
              style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
            >
              {employee.name}
            </a>
            {employee.builtin && <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>内置</Tag>}
          </div>
          <Space size={6} style={{ marginTop: 4 }}>
            {role && <Tag color={role.color} style={{ fontSize: 10 }}>{role.label}</Tag>}
            <Badge status={isOnline ? 'success' : employee.status === 'INACTIVE' ? 'warning' : 'default'} text={status?.label ?? employee.status} />
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {employee.roleIdentity || '-'}
          </Typography.Text>
        </div>
      </Space>

      <Typography.Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}
      >
        {employee.description || '暂无描述'}
      </Typography.Paragraph>

      <Space size={8}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <ToolOutlined /> {employee.capability?.tools?.length ?? 0} 工具
        </Typography.Text>
        {employee.capability?.model && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {employee.capability.model}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}
