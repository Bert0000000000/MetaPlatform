import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Dropdown,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { ArrowLeft, Copy, MoreHorizontal, Settings, Trash2 } from 'lucide-react';
import {
  activateEmployee,
  cloneEmployee,
  deactivateEmployee,
  deleteEmployee,
  getEmployee,
} from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';
import { EMPLOYEE_STATUS_MAP, ROLE_CATEGORY_MAP } from '@/api/dw/types';
import { EmptyState, PageHeader } from '@/components/skeleton';
import EmbeddedChat from './components/EmbeddedChat';
import EmployeeVersionHistory from './components/EmployeeVersionHistory';
import OperationLogPanel from './components/OperationLogPanel';
import { useEmployeeOptions, actionName } from './components/useEmployeeOptions';
import './agents.css';

/** 旧版颜色词 → Semi Tag 颜色词（ROLE_CATEGORY_MAP / EMPLOYEE_STATUS_MAP 沿用旧命名） */
const TAG_COLOR_MAP: Record<string, TagColor> = {
  magenta: 'pink', geekblue: 'indigo', blue: 'blue', cyan: 'cyan', green: 'green',
  red: 'red', purple: 'purple', orange: 'orange', yellow: 'yellow', gold: 'yellow',
  default: 'grey', success: 'green', processing: 'blue', error: 'red', warning: 'orange', text: 'grey',
};

function formatDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 数字员工 · 员工详情（DESIGN-SPEC §5：页头 + Tabs(type=button) 子视图）。
 *
 * 数据面：getEmployee 详情 + 版本历史 / 操作日志 / 内嵌对话（各自独立取数）。
 * 子视图改为页内 button Tabs：对话 / 属性 / 版本历史 / 操作日志，替代原来的左右分栏。
 */
export default function EmployeeDetailPage() {
  const { employeeId: id } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/agents');
  };

  const loadEmployee = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('缺少员工参数');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setEmployee(await getEmployee(id));
    } catch (e) {
      setEmployee(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  const handleToggleStatus = async (checked: boolean) => {
    if (!id) return;
    setToggling(true);
    try {
      if (checked) {
        await activateEmployee(id);
        Toast.success('数字员工已启用');
      } else {
        await deactivateEmployee(id);
        Toast.success('数字员工已停用');
      }
      await loadEmployee();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEmployee(id);
      Toast.success('数字员工已删除');
      goBack();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleClone = async () => {
    if (!employee) return;
    try {
      const created = await cloneEmployee(employee, `${employee.name} - 副本`);
      Toast.success(`已克隆为「${created.name}」`);
      navigate(`/agents/${created.code}`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '克隆失败');
    }
  };

  if (loading && !employee) {
    return (
      <>
        <PageHeader title="员工详情" />
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="员工详情" />
        <EmptyState
          illustration="failure"
          title="员工详情加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadEmployee()}>
              重试
            </Button>
          }
        />
      </>
    );
  }

  if (!employee) {
    return (
      <>
        <PageHeader title="员工详情" />
        <EmptyState
          illustration="no-content"
          title="未找到该数字员工"
          desc="它可能已被删除，返回列表查看其他员工。"
          actions={
            <Button theme="solid" type="primary" onClick={() => navigate('/agents')}>
              返回列表
            </Button>
          }
        />
      </>
    );
  }

  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];
  const isRunning = employee.status === 'ACTIVE';
  const toolNames = employee.capability.tools
    .map((tid) => realTools.find((t) => t.code === tid)?.name ?? tid)
    .filter(Boolean);
  const actionNames = (employee.capability.actionRids || [])
    .map((rid) => realActions.find((a) => a.rid === rid)?.name ?? actionName(rid))
    .filter(Boolean);
  const kbNames = employee.capability.ragKnowledgeBaseIds
    .map((kid) => realKb.find((k) => k.id === kid)?.name ?? kid)
    .filter(Boolean);

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item
        icon={<Settings size={14} strokeWidth={1.5} />}
        onClick={() => navigate(`/agents/${id}/capabilities`)}
      >
        能力配置
      </Dropdown.Item>
      <Dropdown.Item icon={<Copy size={14} strokeWidth={1.5} />} onClick={() => void handleClone()}>
        克隆员工
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<Trash2 size={14} strokeWidth={1.5} />}>
        <Popconfirm
          title="确认删除"
          content={`确定删除数字员工「${employee.name}」吗？`}
          onConfirm={() => void handleDelete()}
        >
          <span>删除</span>
        </Popconfirm>
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  return (
    <>
      <PageHeader
        title={employee.name}
        desc={employee.description || '暂无描述'}
        actions={
          <>
            <Button icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={goBack}>
              返回
            </Button>
            <Space spacing={6} align="center">
              <Typography.Text type="tertiary">{isRunning ? '在线' : '停用'}</Typography.Text>
              <Switch size="small" checked={isRunning} loading={toggling} onChange={(c) => void handleToggleStatus(c)} />
            </Space>
            <Button
              theme="solid"
              type="primary"
              icon={<Settings size={15} strokeWidth={1.5} />}
              onClick={() => navigate(`/agents/${id}/capabilities`)}
            >
              能力配置
            </Button>
            <Dropdown render={moreMenu} position="bottomRight">
              <Button
                theme="borderless"
                type="tertiary"
                icon={<MoreHorizontal size={15} strokeWidth={1.5} />}
                aria-label="更多操作"
              />
            </Dropdown>
          </>
        }
      />

      <div className="mp-agent-chips">
        {role ? <Tag color={TAG_COLOR_MAP[role.color] ?? 'grey'} type="light">{role.label}</Tag> : null}
        <Tag color={TAG_COLOR_MAP[status?.color ?? 'default'] ?? 'grey'} type="light">
          {status?.label ?? employee.status}
        </Tag>
        {employee.builtin ? <Tag color="yellow" type="light">内置员工</Tag> : null}
      </div>

      <Tabs type="button" keepDOM>
        <Tabs.TabPane itemKey="chat" tab="对话">
          <EmbeddedChat employee={employee} />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="attrs" tab="属性">
          <Space vertical spacing={16}>
            <Card title="基本信息">
              <Descriptions
                row
                data={[
                  { key: '员工编码', value: employee.code },
                  { key: '角色身份', value: employee.roleIdentity || '—' },
                  { key: '状态', value: status?.label ?? employee.status },
                  { key: '创建时间', value: formatDateTime(employee.createdAt) },
                  { key: '更新时间', value: formatDateTime(employee.updatedAt) },
                ]}
              />
            </Card>

            <Card
              title="能力摘要"
              headerExtraContent={
                <Button
                  size="small"
                  theme="borderless"
                  type="primary"
                  onClick={() => navigate(`/agents/${id}/capabilities`)}
                >
                  编辑
                </Button>
              }
            >
              <Descriptions
                row
                data={[
                  { key: 'LLM 模型', value: employee.capability.model || '—' },
                  { key: 'Temperature', value: String(employee.capability.temperature) },
                  { key: 'Max Tokens', value: String(employee.capability.maxTokens) },
                  { key: 'Top P', value: String(employee.capability.topP) },
                ]}
              />
              <div className="mp-agent-section-label">已选工具</div>
              <div className="mp-agent-chips">
                {toolNames.length > 0
                  ? toolNames.map((n) => <Tag key={n} type="light">{n}</Tag>)
                  : <Typography.Text type="tertiary">未选择</Typography.Text>}
              </div>
              <div className="mp-agent-section-label">可触发动作</div>
              <div className="mp-agent-chips">
                {actionNames.length > 0
                  ? actionNames.map((n) => <Tag key={n} type="light">{n}</Tag>)
                  : <Typography.Text type="tertiary">未配置</Typography.Text>}
              </div>
              <div className="mp-agent-section-label">已绑定知识库</div>
              <div className="mp-agent-chips">
                {kbNames.length > 0
                  ? kbNames.map((n) => <Tag key={n} type="light">{n}</Tag>)
                  : <Typography.Text type="tertiary">未绑定</Typography.Text>}
              </div>
              <div className="mp-agent-section-label">系统提示词</div>
              {employee.capability.systemPrompt ? (
                <Typography.Paragraph
                  ellipsis={{ rows: 3, expandable: true, expandText: '展开', collapseText: '收起' }}
                >
                  {employee.capability.systemPrompt}
                </Typography.Paragraph>
              ) : (
                <Typography.Text type="tertiary">未配置</Typography.Text>
              )}
            </Card>
          </Space>
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="versions" tab="版本历史">
          <EmployeeVersionHistory employeeId={employee.employeeId} />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="logs" tab="操作日志">
          <OperationLogPanel employeeId={employee.employeeId} />
        </Tabs.TabPane>
      </Tabs>
    </>
  );
}
