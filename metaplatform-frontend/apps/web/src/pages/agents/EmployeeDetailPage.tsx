import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
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
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  DeleteOutlined,
  SettingOutlined,
  CopyOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { getEmployee, activateEmployee, deactivateEmployee, deleteEmployee, cloneEmployee } from '@/api/dw/employees';
import { listTasks } from '@/api/dw/tasks';
import EmbeddedChat from './components/EmbeddedChat';
import EmployeeVersionHistory from './components/EmployeeVersionHistory';
import OperationLogPanel from './components/OperationLogPanel';
import type { Employee, EmployeeTask } from '@/api/dw/types';
import {
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
  MOCK_MODELS,
} from '@/api/dw/types';
import { useEmployeeOptions, actionName } from './components/useEmployeeOptions';

const { Text } = Typography;

const TAG_COLOR_MAP: Record<string, TagColor> = {
  magenta: 'pink',
  geekblue: 'indigo',
  blue: 'blue',
  cyan: 'cyan',
  green: 'green',
  red: 'red',
  purple: 'purple',
  orange: 'orange',
  yellow: 'yellow',
  gold: 'yellow',
  default: 'grey',
  success: 'green',
  processing: 'blue',
  error: 'red',
  warning: 'orange',
  text: 'grey',
};

const TASK_STATUS_MAP: Record<string, { color: string; label: string; badge: 'success' | 'processing' | 'error' | 'default' | 'warning' }> = {
  pending: { color: 'default', label: '待执行', badge: 'default' },
  running: { color: 'processing', label: '执行中', badge: 'processing' },
  completed: { color: 'success', label: '已完成', badge: 'success' },
  failed: { color: 'error', label: '失败', badge: 'error' },
  cancelled: { color: 'default', label: '已取消', badge: 'default' },
  in_progress: { color: 'processing', label: '执行中', badge: 'processing' },
  done: { color: 'success', label: '已完成', badge: 'success' },
  error: { color: 'error', label: '失败', badge: 'error' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'blue', label: '低' },
};

export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const id = employeeId;
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/agents');
    }
  };

  const loadEmployee = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getEmployee(id);
      setEmployee(data);
      const taskList = await listTasks(id);
      setTasks(taskList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployee();
  }, [id]);

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
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleClone = async () => {
    if (!employee) return;
    try {
      const created = await cloneEmployee(employee, `${employee.name} - 副本`);
      Toast.success(`已克隆为「${created.name}」`);
      navigate(`/agents/${created.code}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '克隆失败');
    }
  };

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<SettingOutlined />} onClick={() => navigate(`/agents/${id}/capabilities`)}>能力配置</Dropdown.Item>
      <Dropdown.Item icon={<CopyOutlined />} onClick={handleClone}>克隆员工</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<DeleteOutlined />}>
        <Popconfirm
          title="确认删除"
          content={`确定删除数字员工「${employee?.name}」吗？`}
          onConfirm={handleDelete}
        >
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', minHeight: 0 }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>返回列表</Button>
        <Space>
          <Button theme="solid" type="primary" icon={<SettingOutlined />} onClick={() => navigate(`/agents/${id}/capabilities`)}>
            能力配置
          </Button>
          <Dropdown render={moreMenu}>
            <Button icon={<MoreOutlined />}>更多操作</Button>
          </Dropdown>
        </Space>
      </div>

      {/* 员工信息卡片 */}
      <Card style={{ marginBottom: 16, flexShrink: 0 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Badge dot type={isRunning ? 'success' : 'tertiary'}>
              <Avatar size="extra-large" src={employee.avatar} style={{ width: 64, height: 64, background: 'var(--semi-color-primary-light-default)', color: 'var(--semi-color-primary)' }}>
                {employee.name.slice(0, 1)}
              </Avatar>
            </Badge>
          </Col>
          <Col style={{ flex: 'auto' }}>
            <Space vertical spacing={4}>
              <Space>
                <Text strong style={{ fontSize: 20 }}>{employee.name}</Text>
                {role && <Tag color={TAG_COLOR_MAP[role.color] ?? 'grey'}>{role.label}</Tag>}
                {status && <Tag color={TAG_COLOR_MAP[status.color] ?? 'grey'}>{status.label}</Tag>}
                {employee.builtin && <Tag color="yellow">内置</Tag>}
              </Space>
              <Space spacing="loose">
                <Text type="tertiary">编码: {employee.code}</Text>
                <Text type="tertiary">角色: {employee.roleIdentity}</Text>
                <Text type="tertiary">
                  创建: {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : '-'}
                </Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="tertiary">{isRunning ? '在线' : '停用'}</Text>
              <Switch checked={isRunning} onChange={handleToggleStatus} loading={toggling} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 三列布局：中间对话 + 右侧分类 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
        {/* 中间：对话交互（撑满） */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card
            title="对话交互"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              <EmbeddedChat employee={employee} heightMode="fill" />
            </div>
          </Card>
        </div>

        {/* 右侧：基本信息 / 版本历史 / 操作日志 分类查看 */}
        <div style={{ width: 380, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            title="基本信息"
            headerExtraContent={
              <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/agents/${id}/capabilities`)}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item itemKey="员工名称">{employee.name}</Descriptions.Item>
              <Descriptions.Item itemKey="员工编码">{employee.code}</Descriptions.Item>
              <Descriptions.Item itemKey="角色分类">{role?.label ?? '-'}</Descriptions.Item>
              <Descriptions.Item itemKey="角色身份">{employee.roleIdentity}</Descriptions.Item>
              <Descriptions.Item itemKey="状态">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? 'var(--semi-color-success)' : 'var(--semi-color-tertiary)' }} />
                  {status?.label}
                </span>
              </Descriptions.Item>
              <Descriptions.Item itemKey="职责描述">{employee.description || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="能力摘要">
            <Descriptions column={1} size="small">
              <Descriptions.Item itemKey="LLM 模型">{modelName}</Descriptions.Item>
              <Descriptions.Item itemKey="Temperature">{employee.capability.temperature}</Descriptions.Item>
              <Descriptions.Item itemKey="Max Tokens">{employee.capability.maxTokens}</Descriptions.Item>
              <Descriptions.Item itemKey="已选工具">
                {toolNames.length > 0 ? toolNames.join('、') : '未选择'}
              </Descriptions.Item>
              <Descriptions.Item itemKey="可触发动作">
                {actionNames.length > 0 ? actionNames.join('、') : '未配置'}
              </Descriptions.Item>
              <Descriptions.Item itemKey="已绑定知识库">
                {kbNames.length > 0 ? kbNames.join('、') : '未绑定'}
              </Descriptions.Item>
              <Descriptions.Item itemKey="系统提示词">
                {employee.capability.systemPrompt ? (
                  <Typography.Paragraph
                    style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                    ellipsis={{ rows: 4, expandable: true, expandText: '展开/收起', collapseText: '展开/收起' }}
                  >
                    {employee.capability.systemPrompt}
                  </Typography.Paragraph>
                ) : (
                  <Text type="tertiary">未配置</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <EmployeeVersionHistory employeeId={employee.employeeId} />
          <OperationLogPanel employeeId={employee.employeeId} />
        </div>
      </div>
    </div>
  );
}
