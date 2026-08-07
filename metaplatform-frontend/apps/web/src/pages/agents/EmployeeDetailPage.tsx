import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Tag,
  Space,
  Avatar,
  Typography,
  App,
  Spin,
  Descriptions,
  Switch,
  Popconfirm,
  Dropdown,
  Badge,
  Row,
  Col,
  Input,
  Select,
  Form,
} from 'antd';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  DeleteOutlined,
  SettingOutlined,
  CopyOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { getEmployee, updateEmployee, activateEmployee, deactivateEmployee, deleteEmployee, cloneEmployee } from '@/api/dw/employees';
import { listTasks } from '@/api/dw/tasks';
import EmbeddedChat from './components/EmbeddedChat';
import EmployeeVersionHistory from './components/EmployeeVersionHistory';
import OperationLogPanel from './components/OperationLogPanel';
import type { Employee, EmployeeTask } from '@/api/dw/types';
import {
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
  ROLE_CATEGORY_OPTIONS,
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
} from '@/api/dw/types';
import type { MenuProps } from 'antd';

const { Text } = Typography;

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
  const { message } = App.useApp();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [editing, setEditing] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoForm] = Form.useForm();

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
        message.success('数字员工已启用');
      } else {
        await deactivateEmployee(id);
        message.success('数字员工已停用');
      }
      loadEmployee();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEmployee(id);
      message.success('数字员工已删除');
      goBack();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleClone = async () => {
    if (!employee) return;
    try {
      const created = await cloneEmployee(employee, `${employee.name} - 副本`);
      message.success(`已克隆为「${created.name}」`);
      navigate(`/agents/${created.code}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '克隆失败');
    }
  };

  const startEdit = () => {
    if (!employee) return;
    infoForm.setFieldsValue({
      name: employee.name,
      description: employee.description,
      roleCategory: employee.roleCategory,
      roleIdentity: employee.roleIdentity,
    });
    setEditing(true);
  };

  const handleSaveInfo = async () => {
    if (!id || !employee) return;
    try {
      const values = await infoForm.validateFields();
      setSavingInfo(true);
      await updateEmployee(id, {
        name: values.name,
        roleCategory: values.roleCategory,
        roleIdentity: values.roleIdentity,
        description: values.description,
        avatar: employee.avatar,
        capability: employee.capability,
      });
      message.success('基本信息已更新');
      setEditing(false);
      loadEmployee();
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingInfo(false);
    }
  };

  const moreItems: MenuProps['items'] = [
    {
      key: 'config',
      icon: <SettingOutlined />,
      label: '能力配置',
      onClick: () => navigate(`/agents/${id}/capabilities`),
    },
    {
      key: 'clone',
      icon: <CopyOutlined />,
      label: '克隆员工',
      onClick: handleClone,
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除数字员工「${employee?.name}」吗？`}
          onConfirm={handleDelete}
        >
          <span>删除</span>
        </Popconfirm>
      ),
    },
  ];

  if (loading || !employee) {
    return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  }

  const role = ROLE_CATEGORY_MAP[employee.roleCategory];
  const status = EMPLOYEE_STATUS_MAP[employee.status];
  const isRunning = employee.status === 'ACTIVE';
  const modelName = MOCK_MODELS.find((m) => m.id === employee.capability.model)?.name || employee.capability.model;
  const toolNames = employee.capability.tools.map((tid) => MOCK_TOOLS.find((t) => t.id === tid)?.name).filter(Boolean);
  const kbNames = employee.capability.ragKnowledgeBaseIds.map((kid) => MOCK_KNOWLEDGE_BASES.find((k) => k.id === kid)?.name).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', minHeight: 0 }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>返回列表</Button>
        <Space>
          <Button type="primary" icon={<SettingOutlined />} onClick={() => navigate(`/agents/${id}/capabilities`)}>
            能力配置
          </Button>
          <Dropdown menu={{ items: moreItems }}>
            <Button icon={<MoreOutlined />}>更多操作</Button>
          </Dropdown>
        </Space>
      </div>

      {/* 员工信息卡片 */}
      <Card style={{ marginBottom: 16, flexShrink: 0 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Badge status={isRunning ? 'success' : 'default'}>
              <Avatar size={64} src={employee.avatar} style={{ background: '#f0f5ff', color: '#1677ff' }}>
                {employee.name.slice(0, 1)}
              </Avatar>
            </Badge>
          </Col>
          <Col flex="auto">
            <Space orientation="vertical" size={4}>
              <Space>
                <Text strong style={{ fontSize: 20 }}>{employee.name}</Text>
                {role && <Tag color={role.color}>{role.label}</Tag>}
                {status && <Tag color={status.color}>{status.label}</Tag>}
                {employee.builtin && <Tag color="gold">内置</Tag>}
              </Space>
              <Space size="large">
                <Text type="secondary">编码: {employee.code}</Text>
                <Text type="secondary">角色: {employee.roleIdentity}</Text>
                <Text type="secondary">
                  创建: {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : '-'}
                </Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">{isRunning ? '在线' : '停用'}</Text>
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
            size="small"
            title="对话交互"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              <EmbeddedChat employee={employee} heightMode="fill" />
            </div>
          </Card>
        </div>

        {/* 右侧：基本信息 / 版本历史 / 操作日志 分类查看 */}
        <div style={{ width: 380, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card size="small" title="基本信息">
            {!editing ? (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="员工名称">{employee.name}</Descriptions.Item>
                <Descriptions.Item label="员工编码">{employee.code}</Descriptions.Item>
                <Descriptions.Item label="角色分类">{role?.label ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="角色身份">{employee.roleIdentity}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Badge status={isRunning ? 'success' : 'default'} text={status?.label} />
                </Descriptions.Item>
                <Descriptions.Item label="职责描述">{employee.description || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Form form={infoForm} layout="vertical" size="small">
                <Form.Item name="name" label="员工名称" rules={[{ required: true }]}>
                  <Input placeholder="请输入员工名称" />
                </Form.Item>
                <Form.Item name="roleCategory" label="角色分类" rules={[{ required: true }]}>
                  <Select>
                    {ROLE_CATEGORY_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="roleIdentity" label="角色身份">
                  <Input placeholder="请输入角色身份" />
                </Form.Item>
                <Form.Item name="description" label="职责描述">
                  <Input.TextArea rows={3} placeholder="请输入职责描述" />
                </Form.Item>
                <Space>
                  <Button size="small" icon={<CheckOutlined />} type="primary" loading={savingInfo} onClick={handleSaveInfo}>保存</Button>
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(false)}>取消</Button>
                </Space>
              </Form>
            )}
            {!editing && (
              <Button size="small" icon={<EditOutlined />} onClick={startEdit} style={{ marginTop: 8 }}>编辑</Button>
            )}
          </Card>

          <Card size="small" title="能力摘要">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="LLM 模型">{modelName}</Descriptions.Item>
              <Descriptions.Item label="Temperature">{employee.capability.temperature}</Descriptions.Item>
              <Descriptions.Item label="Max Tokens">{employee.capability.maxTokens}</Descriptions.Item>
              <Descriptions.Item label="已选工具">
                {toolNames.length > 0 ? toolNames.join('、') : '未选择'}
              </Descriptions.Item>
              <Descriptions.Item label="已绑定知识库">
                {kbNames.length > 0 ? kbNames.join('、') : '未绑定'}
              </Descriptions.Item>
              <Descriptions.Item label="系统提示词">
                {employee.capability.systemPrompt ? (
                  <Typography.Paragraph
                    style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                    ellipsis={{ rows: 4, expandable: true, symbol: '展开/收起' }}
                  >
                    {employee.capability.systemPrompt}
                  </Typography.Paragraph>
                ) : (
                  <Text type="secondary">未配置</Text>
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
