import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, Dropdown, Popconfirm, Tag, Typography } from '@douyinfe/semi-ui';
import {
  Bot,
  Clock,
  Copy,
  Delete,
  Edit2,
  Eye,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Settings,
  Wrench,
} from 'lucide-react';
import type { Employee } from '@/api/dw/types';
import { EMPLOYEE_STATUS_MAP, ROLE_CATEGORY_MAP } from '@/api/dw/types';
import EmployeeCloneButton from './EmployeeCloneButton';

interface EmployeeCardProps {
  employee: Employee;
  onToggle: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onCloned: (employee: Employee) => void;
  /** 点卡片主体：打开详情浮层（不传则退化为跳转详情页） */
  onPreview?: (employee: Employee) => void;
}

/** 状态 → 圆点样式类（颜色全在 CSS 里）。 */
const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'is-active',
  ENABLED: 'is-active',
  INACTIVE: 'is-inactive',
  DISABLED: 'is-inactive',
};

export default function EmployeeCard({
  employee,
  onToggle,
  onDelete,
  onCloned,
  onPreview,
}: EmployeeCardProps) {
  const navigate = useNavigate();
  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];
  const isOnline = employee.status === 'ACTIVE';

  const openDetail = () => {
    if (onPreview) onPreview(employee);
    else navigate(`/agents/${employee.code}`);
  };

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item
        icon={<Settings size={14} />}
        onClick={() => navigate(`/agents/${employee.code}/capabilities`)}
      >
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

  return (
    <div className="mp-agent-card-wrap">
      <Card shadows="hover" bordered bodyStyle={{ padding: 'var(--mp-space-3)' }}>
        <div className="mp-agent-head">
          <Avatar size="medium" src={employee.avatar} className="mp-agent-avatar">
            <Bot size={18} strokeWidth={1.5} />
          </Avatar>
          <div className="mp-agent-head-main">
            <div className="mp-agent-name-row">
              <a className="mp-agent-name" onClick={openDetail} title={employee.name}>
                {employee.name}
              </a>
              {employee.builtin ? (
                <Tag color="yellow" type="light" size="small">
                  内置
                </Tag>
              ) : null}
            </div>
            <div className="mp-agent-sub">
              <span className={`mp-agent-dot ${STATUS_CLASS[employee.status] ?? ''}`} />
              <span>{status?.label ?? employee.status}</span>
              {role ? (
                <>
                  <span>·</span>
                  <span className="mp-agent-sub-role">{role.label}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {employee.description ? (
          <Typography.Paragraph
            type="tertiary"
            ellipsis={{ rows: 2, showTooltip: true }}
            className="mp-agent-desc"
          >
            {employee.description}
          </Typography.Paragraph>
        ) : null}

        <div className="mp-agent-stats">
          <span className="mp-agent-stat">
            <Wrench size={12} strokeWidth={1.5} />
            {employee.capability?.tools?.length ?? 0}
          </span>
          {employee.capability?.model ? (
            <span className="mp-agent-stat mp-agent-stat-model" title={employee.capability.model}>
              {employee.capability.model}
            </span>
          ) : null}
          {employee.updatedAt ? (
            <span className="mp-agent-stat">
              <Clock size={12} strokeWidth={1.5} />
              {formatTime(employee.updatedAt)}
            </span>
          ) : null}
        </div>

        <div className="mp-agent-actions">
          <Button theme="borderless" type="tertiary" className="mp-agent-action" onClick={openDetail}>
            <Eye size={13} strokeWidth={1.5} />
            详情
          </Button>
          <Button
            theme="borderless"
            type="tertiary"
            className="mp-agent-action mp-agent-action-mid"
            onClick={() => navigate(`/agents/${employee.code}/capabilities`)}
          >
            <Edit2 size={13} strokeWidth={1.5} />
            编辑
          </Button>
          <Dropdown render={moreMenu} trigger="click" position="bottomRight">
            <Button
              theme="borderless"
              type="tertiary"
              className="mp-agent-action"
              aria-label="更多操作"
            >
              <MoreHorizontal size={13} strokeWidth={1.5} />
              更多
            </Button>
          </Dropdown>
        </div>
      </Card>
    </div>
  );
}

function formatTime(v: string): string {
  const d = new Date(v);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${d.getMonth() + 1}-${d.getDate()}`;
}
