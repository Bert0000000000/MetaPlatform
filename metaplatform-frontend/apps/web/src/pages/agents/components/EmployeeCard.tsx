import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Popconfirm,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  Bot,
  Delete,
  Edit2,
  Eye,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Settings,
  Copy,
  Wrench,
  Clock,
} from 'lucide-react';
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

const STATUS_DOT_COLOR: Record<string, string> = {
  ACTIVE: 'var(--semi-color-success)',
  INACTIVE: 'var(--semi-color-warning)',
};

export default function EmployeeCard({ employee, onToggle, onDelete, onCloned }: EmployeeCardProps) {
  const navigate = useNavigate();
  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];

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

  const isOnline = employee.status === 'ACTIVE';

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<Settings size={14} />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>
        编辑配置
      </Dropdown.Item>
      <Dropdown.Item icon={<Copy size={14} />}>
        <EmployeeCloneButton source={employee} asMenuItem onCloned={onCloned} />
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item
        icon={isOnline ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
        onClick={() => onToggle(employee)}
      >
        {isOnline ? '停用' : '启用'}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<Delete size={14} />}>
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

  // 操作行 — 三等份、垂直水平居中、统一 32px 高
  const actionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    height: 32,
    fontSize: 12,
    color: 'var(--semi-color-text-2)',
  };

  return (
    <Card
      shadows="hover"
      bordered
      style={{ height: '100%' }}
      bodyStyle={{ padding: 12 }}
      headerLine={false}
    >
      {/* 头部：头像 + 标题/状态一行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <Avatar
          size="default"
          src={employee.avatar}
          style={{
            width: 36,
            height: 36,
            background: 'var(--semi-color-primary-light-default)',
            color: 'var(--semi-color-primary)',
            border: '1px solid var(--semi-color-border)',
            flexShrink: 0,
            fontSize: 13,
          }}
        >
          <Bot size={18} />
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <a
              onClick={() => navigate(`/agents/${employee.code}`)}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
              title={employee.name}
            >
              {employee.name}
            </a>
            {employee.builtin && (
              <Tag color="yellow" style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>内置</Tag>
            )}
          </div>
          <div
            style={{
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--muted-foreground)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: STATUS_DOT_COLOR[employee.status] ?? 'var(--semi-color-tertiary)',
                flexShrink: 0,
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>{status?.label ?? employee.status}</span>
            {role && (
              <>
                <span style={{ color: 'var(--semi-color-border)' }}>·</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {role.label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 描述：1 行省略 */}
      {employee.description && (
        <Typography.Paragraph
          type="tertiary"
          ellipsis={{ rows: 1, showTooltip: true }}
          style={{ fontSize: 12, margin: 0, marginBottom: 8, lineHeight: 1.5 }}
        >
          {employee.description}
        </Typography.Paragraph>
      )}

      {/* Meta 行：工具数 / 模型 / 最近活跃 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Wrench size={12} />
          {employee.capability?.tools?.length ?? 0}
        </span>
        {employee.capability?.model && (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
            title={employee.capability.model}
          >
            {employee.capability.model}
          </span>
        )}
        {employee.updatedAt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Clock size={12} />
            {formatTime(employee.updatedAt)}
          </span>
        )}
      </div>

      {/* 操作行：固定三等份 + 居中 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          marginTop: 12,
          marginLeft: -12,
          marginRight: -12,
          marginBottom: -12,
          borderTop: '1px solid var(--semi-color-border)',
        }}
      >
        <Button
          theme="borderless"
          type="tertiary"
          onClick={() => navigate(`/agents/${employee.code}`)}
          style={{ ...actionBtnStyle, borderRadius: 0 }}
        >
          <Eye size={13} />
          详情
        </Button>
        <Button
          theme="borderless"
          type="tertiary"
          onClick={() => navigate(`/agents/${employee.code}/capabilities`)}
          style={{
            ...actionBtnStyle,
            borderRadius: 0,
            borderLeft: '1px solid var(--semi-color-border)',
            borderRight: '1px solid var(--semi-color-border)',
          }}
        >
          <Edit2 size={13} />
          编辑
        </Button>
        <Dropdown render={moreMenu} trigger="click" position="bottomRight">
          <Button
            theme="borderless"
            type="tertiary"
            style={{ ...actionBtnStyle, borderRadius: 0 }}
            aria-label="更多操作"
          >
            <MoreHorizontal size={13} />
            更多
          </Button>
        </Dropdown>
      </div>
    </Card>
  );
}

function formatTime(v: string): string {
  const d = new Date(v);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${d.getMonth() + 1}-${d.getDate()}`;
}
