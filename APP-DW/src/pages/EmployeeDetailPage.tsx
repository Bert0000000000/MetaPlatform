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
  message,
  Spin,
  Descriptions,
  Switch,
  Popconfirm,
  Dropdown,
  Table,
  Badge,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  DeleteOutlined,
  SettingOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { getEmployee, activateEmployee, deactivateEmployee, deleteEmployee, cloneEmployee } from '@/api/employees';
import { listTasks } from '@/api/tasks';
import EmbeddedChat from '@/components/EmbeddedChat';
import DocumentUpload from '@/components/DocumentUpload';
import ExtractionPanel from '@/components/ExtractionPanel';
import EmployeeVersionHistory from '@/components/EmployeeVersionHistory';
import OperationLogPanel from '@/components/OperationLogPanel';
import type { Employee, EmployeeTask, TaskStatus } from '@/types';
import {
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
} from '@/types';
import type { MenuProps } from 'antd';

const TASK_STATUS_MAP: Record<TaskStatus, { color: string; label: string; badge: 'success' | 'processing' | 'error' | 'default' | 'warning' }> = {
  pending: { color: 'default', label: '待执行', badge: 'default' },
  running: { color: 'processing', label: '执行中', badge: 'processing' },
  completed: { color: 'success', label: '已完成', badge: 'success' },
  failed: { color: 'error', label: '失败', badge: 'error' },
  cancelled: { color: 'default', label: '已取消', badge: 'default' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'blue', label: '低' },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);

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
      navigate('/dw');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleClone = async () => {
    if (!employee) return;
    try {
      const created = await cloneEmployee(
        employee,
        `${employee.name} - 副本`,
        `${employee.code}_copy`,
      );
      message.success(`已克隆为「${created.name}」`);
      navigate(`/dw/employees/${created.employeeId}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '克隆失败');
    }
  };

  const moreItems: MenuProps['items'] = [
    {
      key: 'config',
      icon: <SettingOutlined />,
      label: '能力配置',
      onClick: () => navigate(`/dw/employees/${id}/capability`),
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

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card
        loading={loading}
        title={
          <Space>
            <Badge
              status={isRunning ? 'success' : 'default'}
              offset={[0, 30]}
            >
              <Avatar size={64} src={employee.avatar} style={{ background: '#f0f5ff', color: '#1677ff' }}>
                {employee.name.slice(0, 1)}
              </Avatar>
            </Badge>
            <div>
              <Typography.Text strong style={{ fontSize: 18, display: 'block' }}>
                {employee.name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {employee.code}
              </Typography.Text>
            </div>
            <Tag color={role.color}>{role.label}</Tag>
            <Tag color={status.color}>{status.label}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate(`/dw/employees/${id}/capability`)}
            >
              能力配置
            </Button>
            <Space>
              <span>{isRunning ? '在线' : '停用'}</span>
              <Switch
                checked={isRunning}
                onChange={handleToggleStatus}
                loading={toggling}
              />
            </Space>
            <Dropdown menu={{ items: moreItems }}>
              <Button icon={<MoreOutlined />}>更多</Button>
            </Dropdown>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <div>
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="员工名称">{employee.name}</Descriptions.Item>
                    <Descriptions.Item label="员工编码">{employee.code}</Descriptions.Item>
                    <Descriptions.Item label="角色分类">{role.label}</Descriptions.Item>
                    <Descriptions.Item label="角色身份">{employee.roleIdentity}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Badge
                        status={isRunning ? 'success' : 'default'}
                        text={status.label}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {employee.createdAt ? new Date(employee.createdAt).toLocaleString() : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="职责描述" span={2}>
                      {employee.description}
                    </Descriptions.Item>
                  </Descriptions>

                  <Typography.Title level={5} style={{ marginTop: 16 }}>
                    能力摘要
                  </Typography.Title>
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="已选工具">
                      {employee.capability.tools.length} 个
                    </Descriptions.Item>
                    <Descriptions.Item label="已绑定知识库">
                      {employee.capability.ragKnowledgeBaseIds.length} 个
                    </Descriptions.Item>
                    <Descriptions.Item label="当前模型">
                      {MOCK_MODELS.find((m) => m.id === employee.capability.model)?.name ||
                        employee.capability.model}
                    </Descriptions.Item>
                    <Descriptions.Item label="Temperature">
                      {employee.capability.temperature}
                    </Descriptions.Item>
                  </Descriptions>

                  <Typography.Title level={5} style={{ marginTop: 16 }}>
                    最近任务
                  </Typography.Title>
                  <Table
                    size="small"
                    dataSource={tasks.slice(0, 5)}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      { title: '任务', dataIndex: 'title', key: 'title' },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        render: (s: TaskStatus) => (
                          <Badge status={TASK_STATUS_MAP[s].badge} text={TASK_STATUS_MAP[s].label} />
                        ),
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
                </div>
              ),
            },
            {
              key: 'capability',
              label: '能力配置',
              children: (
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="模型">
                    {MOCK_MODELS.find((m) => m.id === employee.capability.model)?.name ||
                      employee.capability.model}
                  </Descriptions.Item>
                  <Descriptions.Item label="Temperature">
                    {employee.capability.temperature}
                  </Descriptions.Item>
                  <Descriptions.Item label="Max Tokens">
                    {employee.capability.maxTokens}
                  </Descriptions.Item>
                  <Descriptions.Item label="Top P">{employee.capability.topP}</Descriptions.Item>
                  <Descriptions.Item label="已选工具">
                    {employee.capability.tools.length > 0
                      ? employee.capability.tools
                          .map((tid) => MOCK_TOOLS.find((t) => t.id === tid)?.name)
                          .join('、')
                      : '未选择'}
                  </Descriptions.Item>
                  <Descriptions.Item label="System Prompt" span={2}>
                    {employee.capability.systemPrompt}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'knowledge',
              label: '知识库',
              children: (
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="已绑定知识库">
                    {employee.capability.ragKnowledgeBaseIds.length > 0
                      ? employee.capability.ragKnowledgeBaseIds
                          .map((kid) => MOCK_KNOWLEDGE_BASES.find((k) => k.id === kid)?.name)
                          .join('、')
                      : '未绑定'}
                  </Descriptions.Item>
                  <Descriptions.Item label="检索策略">
                    {employee.capability.retrievalMethod === 'hybrid'
                      ? '混合检索'
                      : employee.capability.retrievalMethod === 'vector'
                        ? '纯向量检索'
                        : '纯关键词检索'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Top-K">{employee.capability.topK}</Descriptions.Item>
                  <Descriptions.Item label="重排序">
                    {employee.capability.rerank ? '开启' : '关闭'}
                  </Descriptions.Item>
                </Descriptions>
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
                  columns={[
                    { title: '任务', dataIndex: 'title', key: 'title' },
                    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 100,
                      render: (s: TaskStatus) => (
                        <Badge status={TASK_STATUS_MAP[s].badge} text={TASK_STATUS_MAP[s].label} />
                      ),
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
