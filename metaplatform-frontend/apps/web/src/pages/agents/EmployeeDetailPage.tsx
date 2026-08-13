import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Dropdown,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Settings,
  Copy,
  Edit2,
} from 'lucide-react';
import { getEmployee, activateEmployee, deactivateEmployee, deleteEmployee, cloneEmployee } from '@/api/dw/employees';
import EmbeddedChat from './components/EmbeddedChat';
import EmployeeVersionHistory from './components/EmployeeVersionHistory';
import OperationLogPanel from './components/OperationLogPanel';
import type { Employee } from '@/api/dw/types';
import {
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
  MOCK_MODELS,
} from '@/api/dw/types';
import { useEmployeeOptions, actionName } from './components/useEmployeeOptions';
import { PageHeader } from '@mate/shared';

const { Text } = Typography;

const TAG_COLOR_MAP: Record<string, TagColor> = {
  magenta: 'pink', geekblue: 'indigo', blue: 'blue', cyan: 'cyan', green: 'green',
  red: 'red', purple: 'purple', orange: 'orange', yellow: 'yellow', gold: 'yellow',
  default: 'grey', success: 'green', processing: 'blue', error: 'red', warning: 'orange', text: 'grey',
};

const STATUS_DOT_COLOR: Record<string, string> = {
  ACTIVE: 'var(--semi-color-success)',
  INACTIVE: 'var(--semi-color-warning)',
};

function formatDateTime(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const id = employeeId;
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/agents');
  };

  const loadEmployee = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getEmployee(id);
      setEmployee(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmployee(); }, [id]);

  const handleToggleStatus = async (checked: boolean) => {
    if (!id) return;
    setToggling(true);
    try {
      if (checked) { await activateEmployee(id); Toast.success('数字员工已启用'); }
      else { await deactivateEmployee(id); Toast.success('数字员工已停用'); }
      loadEmployee();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '操作失败');
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
    } catch (error) { Toast.error(error instanceof Error ? error.message : '删除失败'); }
  };

  const handleClone = async () => {
    if (!employee) return;
    try {
      const created = await cloneEmployee(employee, `${employee.name} - 副本`);
      Toast.success(`已克隆为「${created.name}」`);
      navigate(`/agents/${created.code}`);
    } catch (error) { Toast.error(error instanceof Error ? error.message : '克隆失败'); }
  };

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<Settings size={14} />} onClick={() => navigate(`/agents/${id}/capabilities`)}>能力配置</Dropdown.Item>
      <Dropdown.Item icon={<Copy size={14} />} onClick={handleClone}>克隆员工</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<Trash2 size={14} />}>
        <Popconfirm title="确认删除" content={`确定删除数字员工「${employee?.name}」吗？`} onConfirm={handleDelete}>
          <span>删除</span>
        </Popconfirm>
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  if (loading || !employee) {
    return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  }

  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];
  const isRunning = employee.status === 'ACTIVE';
  const modelName = MOCK_MODELS.find((m) => m.id === employee.capability.model)?.name || employee.capability.model;
  const toolNames = employee.capability.tools.map((tid) => realTools.find((t) => t.code === tid)?.name || tid).filter(Boolean);
  const actionNames = (employee.capability.actionRids || []).map((rid) => realActions.find((a) => a.rid === rid)?.name || actionName(rid)).filter(Boolean);
  const kbNames = employee.capability.ragKnowledgeBaseIds.map((kid) => realKb.find((k) => k.id === kid)?.name || kid).filter(Boolean);

  return (
    <ConfigProvider>
      <style>{`
        .edp-desc.semi-descriptions {
          font-size: 12px;
        }
        .edp-desc .semi-descriptions-item-label {
          color: var(--semi-color-text-2) !important;
          font-size: 12px !important;
          padding-bottom: 4px !important;
        }
        .edp-desc .semi-descriptions-item-value {
          color: var(--semi-color-text-0) !important;
          font-size: 13px !important;
          padding-bottom: 8px !important;
          word-break: break-word;
        }
        .edp-chat-wrap {
          background: var(--semi-color-bg-1);
          border-radius: 8px;
          padding: 8px;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 600, width: '100%', gap: 12, flex: 1 }}>
        <PageHeader
          title={
            <Space spacing={10} align="center">
              <Badge dot type={isRunning ? 'success' : 'tertiary'}>
                <Avatar
                  size="default"
                  src={employee.avatar}
                  style={{
                    width: 32, height: 32,
                    background: 'var(--semi-color-primary-light-default)',
                    color: 'var(--semi-color-primary)',
                    border: '1px solid var(--semi-color-border)',
                    fontSize: 13,
                  }}
                >
                  {employee.name.slice(0, 1)}
                </Avatar>
              </Badge>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{employee.name}</span>
              {role && <Tag color={TAG_COLOR_MAP[role.color] ?? 'grey'} size="small" style={{ margin: 0 }}>{role.label}</Tag>}
              {status && <Tag color={TAG_COLOR_MAP[status.color] ?? 'grey'} size="small" style={{ margin: 0 }}>{status.label}</Tag>}
              {employee.builtin && <Tag color="yellow" size="small" style={{ margin: 0 }}>内置</Tag>}
            </Space>
          }
          description={
            <Text type="tertiary" ellipsis style={{ fontSize: 12 }}>
              {employee.description || '暂无描述'}
            </Text>
          }
          extra={
            <Space spacing={8}>
              <Button
                size="small"
                theme="borderless"
                type="tertiary"
                icon={<ArrowLeft size={14} />}
                onClick={goBack}
              >
                返回
              </Button>
              <Space spacing={6} align="center">
                <Text type="tertiary" style={{ fontSize: 12 }}>{isRunning ? '在线' : '停用'}</Text>
                <Switch
                  size="small"
                  checked={isRunning}
                  onChange={handleToggleStatus}
                  loading={toggling}
                />
              </Space>
              <Button
                size="small"
                type="primary"
                theme="solid"
                icon={<Settings size={14} />}
                onClick={() => navigate(`/agents/${id}/capabilities`)}
              >
                能力配置
              </Button>
              <Dropdown render={moreMenu} position="bottomRight">
                <Button
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  icon={<MoreHorizontal size={14} />}
                  aria-label="更多操作"
                />
              </Dropdown>
            </Space>
          }
        />

        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0, height: 'calc(100vh - 200px)' }}>
          {/* 左侧：对话交互 */}
          <Card
            bordered
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}
          >
            <div className="edp-chat-wrap">
              <EmbeddedChat employee={employee} heightMode="fill" />
            </div>
          </Card>

          {/* 右侧：基本信息 / 能力摘要 / 版本 / 日志 */}
          <div style={{ width: 360, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title="基本信息" bordered bodyStyle={{ padding: '12px 16px' }}>
              <Descriptions column={1} size="small" className="edp-desc">
                <Descriptions.Item itemKey="员工编码">
                  <Text type="tertiary" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{employee.code}</Text>
                </Descriptions.Item>
                <Descriptions.Item itemKey="角色身份">{employee.roleIdentity || '-'}</Descriptions.Item>
                <Descriptions.Item itemKey="状态">
                  <Space spacing={6} align="center">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT_COLOR[employee.status] ?? 'var(--semi-color-tertiary)' }} />
                    <span style={{ fontSize: 12 }}>{status?.label}</span>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item itemKey="创建时间">{formatDateTime(employee.createdAt)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title="能力摘要"
              bordered
              headerExtraContent={
                <Button
                  size="small"
                  type="tertiary"
                  theme="borderless"
                  icon={<Edit2 size={14} />}
                  onClick={() => navigate(`/agents/${id}/capabilities`)}
                >
                  编辑
                </Button>
              }
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Descriptions column={1} size="small" className="edp-desc">
                <Descriptions.Item itemKey="LLM 模型">
                  <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{modelName}</Text>
                </Descriptions.Item>
                <Descriptions.Item itemKey="Temperature">{employee.capability.temperature}</Descriptions.Item>
                <Descriptions.Item itemKey="Max Tokens">{employee.capability.maxTokens}</Descriptions.Item>
                <Descriptions.Item itemKey="已选工具">
                  {toolNames.length > 0
                    ? toolNames.map((n) => <Tag key={n} color="blue" size="small" style={{ margin: '1px 4px 1px 0' }}>{n}</Tag>)
                    : <Text type="tertiary" style={{ fontSize: 12 }}>未选择</Text>}
                </Descriptions.Item>
                <Descriptions.Item itemKey="可触发动作">
                  {actionNames.length > 0
                    ? actionNames.map((n) => <Tag key={n} color="purple" size="small" style={{ margin: '1px 4px 1px 0' }}>{n}</Tag>)
                    : <Text type="tertiary" style={{ fontSize: 12 }}>未配置</Text>}
                </Descriptions.Item>
                <Descriptions.Item itemKey="已绑定知识库">
                  {kbNames.length > 0
                    ? kbNames.map((n) => <Tag key={n} color="cyan" size="small" style={{ margin: '1px 4px 1px 0' }}>{n}</Tag>)
                    : <Text type="tertiary" style={{ fontSize: 12 }}>未绑定</Text>}
                </Descriptions.Item>
                <Descriptions.Item itemKey="系统提示词">
                  {employee.capability.systemPrompt ? (
                    <Typography.Paragraph
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      ellipsis={{ rows: 3, expandable: true, expandText: '展开', collapseText: '收起' }}
                    >
                      {employee.capability.systemPrompt}
                    </Typography.Paragraph>
                  ) : (
                    <Text type="tertiary" style={{ fontSize: 12 }}>未配置</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <EmployeeVersionHistory employeeId={employee.employeeId} />
            <OperationLogPanel employeeId={employee.employeeId} />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
