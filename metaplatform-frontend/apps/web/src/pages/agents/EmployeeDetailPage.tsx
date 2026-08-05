import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Tabs,
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
  Table,
  Badge,
  Empty,
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
import DocumentUpload from './components/DocumentUpload';
import ExtractionPanel from './components/ExtractionPanel';
import EmployeeVersionHistory from './components/EmployeeVersionHistory';
import OperationLogPanel from './components/OperationLogPanel';
import LearningRecordsPanel from './components/LearningRecordsPanel';
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
    <div>
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
      <Card style={{ marginBottom: 16 }}>
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

      {/* 详情 Tabs */}
      <Card>
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                  {/* 基本信息 - 支持编辑模式 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 14 }}>配置信息</Text>
                      {!editing ? (
                        <Button size="small" icon={<EditOutlined />} onClick={startEdit}>编辑</Button>
                      ) : (
                        <Space>
                          <Button size="small" icon={<CheckOutlined />} type="primary" loading={savingInfo} onClick={handleSaveInfo}>保存</Button>
                          <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(false)}>取消</Button>
                        </Space>
                      )}
                    </div>
                    {!editing ? (
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="员工名称">{employee.name}</Descriptions.Item>
                        <Descriptions.Item label="员工编码">{employee.code}</Descriptions.Item>
                        <Descriptions.Item label="角色分类">{role?.label ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="角色身份">{employee.roleIdentity}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Badge status={isRunning ? 'success' : 'default'} text={status?.label} />
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {employee.createdAt ? new Date(employee.createdAt).toLocaleString() : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="职责描述" span={2}>
                          {employee.description || '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Form form={infoForm} layout="vertical">
                        <Row gutter={24}>
                          <Col span={12}>
                            <Form.Item name="name" label="员工名称" rules={[{ required: true }]}>
                              <Input placeholder="请输入员工名称" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="roleCategory" label="角色分类" rules={[{ required: true }]}>
                              <Select>
                                {ROLE_CATEGORY_OPTIONS.map((opt) => (
                                  <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={24}>
                          <Col span={12}>
                            <Form.Item name="roleIdentity" label="角色身份">
                              <Input placeholder="请输入角色身份" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="员工编码">
                              <Input value={employee.code} disabled />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item name="description" label="职责描述">
                          <Input.TextArea rows={3} placeholder="请输入职责描述" />
                        </Form.Item>
                      </Form>
                    )}
                  </div>

                  {/* 能力摘要 */}
                  <div>
                    <Text strong style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>能力摘要</Text>
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="LLM 模型">{modelName}</Descriptions.Item>
                      <Descriptions.Item label="Temperature">{employee.capability.temperature}</Descriptions.Item>
                      <Descriptions.Item label="Max Tokens">{employee.capability.maxTokens}</Descriptions.Item>
                      <Descriptions.Item label="Top P">{employee.capability.topP}</Descriptions.Item>
                      <Descriptions.Item label="已选工具" span={2}>
                        {toolNames.length > 0 ? toolNames.join('、') : '未选择'}
                      </Descriptions.Item>
                      <Descriptions.Item label="System Prompt" span={2}>
                        {employee.capability.systemPrompt || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>

                  {/* 知识库配置 */}
                  <div>
                    <Text strong style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>知识库配置</Text>
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="已绑定知识库" span={2}>
                        {kbNames.length > 0 ? kbNames.join('、') : '未绑定'}
                      </Descriptions.Item>
                      <Descriptions.Item label="检索策略">
                        {employee.capability.retrievalMethod === 'hybrid' ? '混合检索' :
                         employee.capability.retrievalMethod === 'vector' ? '纯向量检索' : '纯关键词检索'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Top-K">{employee.capability.topK}</Descriptions.Item>
                      <Descriptions.Item label="重排序" span={2}>
                        {employee.capability.rerank ? '开启' : '关闭'}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>

                  {/* 最近任务 */}
                  <div>
                    <Text strong style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>最近任务</Text>
                    {tasks.length === 0 ? (
                      <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Table
                        size="small"
                        dataSource={tasks.slice(0, 5)}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        columns={[
                          { title: '任务', dataIndex: 'title', key: 'title' },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            key: 'status',
                            width: 100,
                            render: (s: string) => {
                              const m = TASK_STATUS_MAP[s] ?? { color: 'default', label: s, badge: 'default' as const };
                              return <Badge status={m.badge} text={m.label} />;
                            },
                          },
                          {
                            title: '优先级',
                            dataIndex: 'priority',
                            key: 'priority',
                            width: 80,
                            render: (p: string) => <Tag color={PRIORITY_MAP[p]?.color}>{PRIORITY_MAP[p]?.label}</Tag>,
                          },
                          {
                            title: '创建时间',
                            dataIndex: 'createdAt',
                            key: 'createdAt',
                            width: 160,
                            render: (v: string) => new Date(v).toLocaleString(),
                          },
                        ]}
                      />
                    )}
                  </div>
                </Space>
              ),
            },
            {
              key: 'tasks',
              label: `任务列表 (${tasks.length})`,
              children: tasks.length === 0 ? (
                <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  size="small"
                  dataSource={tasks}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: '任务', dataIndex: 'title', key: 'title' },
                    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 100,
                      render: (s: string) => {
                        const m = TASK_STATUS_MAP[s] ?? { color: 'default', label: s, badge: 'default' as const };
                        return <Badge status={m.badge} text={m.label} />;
                      },
                    },
                    {
                      title: '优先级',
                      dataIndex: 'priority',
                      key: 'priority',
                      width: 80,
                      render: (p: string) => <Tag color={PRIORITY_MAP[p]?.color}>{PRIORITY_MAP[p]?.label}</Tag>,
                    },
                    {
                      title: '进度',
                      dataIndex: 'progress',
                      key: 'progress',
                      width: 100,
                      render: (v?: number) => (v !== undefined ? `${v}%` : '-'),
                    },
                    {
                      title: '创建时间',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      width: 160,
                      render: (v: string) => new Date(v).toLocaleString(),
                    },
                    {
                      title: '结果',
                      dataIndex: 'result',
                      key: 'result',
                      ellipsis: true,
                      render: (v?: string) => v || '-',
                    },
                  ]}
                />
              ),
            },
            {
              key: 'chat',
              label: '对话交互',
              children: <EmbeddedChat employee={employee} />,
            },
            {
              key: 'documents',
              label: '知识文档',
              children: <DocumentUpload employeeId={employee.employeeId} />,
            },
            {
              key: 'extraction',
              label: 'AI 抽取',
              children: <ExtractionPanel employeeId={employee.employeeId} />,
            },
            {
              key: 'learning',
              label: '学习记录',
              children: <LearningRecordsPanel employee={employee} />,
            },
            {
              key: 'versions',
              label: '版本历史',
              children: <EmployeeVersionHistory employeeId={employee.employeeId} />,
            },
            {
              key: 'logs',
              label: '操作日志',
              children: <OperationLogPanel employeeId={employee.employeeId} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
