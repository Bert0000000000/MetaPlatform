import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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

  const tagColor: Record<string, TagColor> = {
    magenta: 'pink',
    geekblue: 'indigo',
    blue: 'blue',
    cyan: 'cyan',
    green: 'green',
    red: 'red',
    purple: 'purple',
    default: 'grey',
  };

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<SettingOutlined />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>
        编辑配置
      </Dropdown.Item>
      <Dropdown.Item icon={<RobotOutlined />}>
        <EmployeeCloneButton source={employee} asMenuItem onCloned={onCloned} />
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item icon={isOnline ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => onToggle(employee)}>
        {isOnline ? '停用' : '启用'}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<DeleteOutlined />}>
        <Popconfirm
          title="确认删除"
          content={`确定删除「${employee.name}」吗？`}
          onConfirm={() => onDelete(employee)}
        >
          <span>删除</span>
        </Popconfirm>
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  return (
    <Card
      shadows="hover"
      style={{ height: '100%' }}
      bodyStyle={{ padding: 16 }}
      actions={[
        <Button key="detail" theme="borderless" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/agents/${employee.code}`)}>
          详情
        </Button>,
        <Button key="edit" theme="borderless" size="small" icon={<EditOutlined />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>
          编辑
        </Button>,
        <Dropdown key="more" render={moreMenu}>
          <Button theme="borderless" size="small" icon={<MoreOutlined />} />
        </Dropdown>,
      ]}
    >
      <Space align="start" style={{ width: '100%' }} wrap>
        <Avatar
          size="extra-large"
          src={employee.avatar}
          style={{ width: 44, height: 44, background: 'var(--semi-color-bg-2)', color: '#60a5fa', border: '1px solid var(--semi-color-border)', flexShrink: 0 }}
        >
          <RobotOutlined />
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <a
              onClick={() => navigate(`/agents/${employee.code}`)}
              style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
            >
              {employee.name}
            </a>
            {employee.builtin && <Tag color="yellow" style={{ fontSize: 10, margin: 0 }}>内置</Tag>}
          </div>
          <Space spacing={6} style={{ marginTop: 4 }}>
            {role && <Tag color={tagColor[role.color] ?? 'grey'} style={{ fontSize: 10 }}>{role.label}</Tag>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isOnline ? 'var(--semi-color-success)' : employee.status === 'INACTIVE' ? 'var(--semi-color-warning)' : 'var(--semi-color-tertiary)',
                }}
              />
              <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                {status?.label ?? employee.status}
              </Typography.Text>
            </span>
          </Space>
          <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {employee.roleIdentity || '-'}
          </Typography.Text>
        </div>
      </Space>

      <Typography.Paragraph
        type="tertiary"
        ellipsis={{ rows: 2 }}
        style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}
      >
        {employee.description || '暂无描述'}
      </Typography.Paragraph>

      <Space spacing={8}>
        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
          <ToolOutlined /> {employee.capability?.tools?.length ?? 0} 工具
        </Typography.Text>
        {employee.capability?.model && (
          <Typography.Text type="tertiary" style={{ fontSize: 12 }} ellipsis>
            {employee.capability.model}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}
