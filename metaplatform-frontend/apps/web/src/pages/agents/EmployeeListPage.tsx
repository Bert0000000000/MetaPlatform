import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Tag,
  Typography,
  App,
  Popconfirm,
  Dropdown,
  Avatar,
  Row,
  Col,
  Table,
  Badge,
  Result,
  Input,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  SearchOutlined,
  RobotOutlined,
  CustomerServiceOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { listEmployees, deleteEmployee, activateEmployee, deactivateEmployee } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
} from '@/api/dw/types';
import type { MenuProps } from 'antd';
import EmployeeCloneButton from './components/EmployeeCloneButton';
import EmployeeCard from './components/EmployeeCard';

const { Text } = Typography;

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '在线', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '草稿', value: 'DRAFT' },
];

const QUICK_TEMPLATES = [
  { icon: <PlusOutlined />, title: '空白模板', desc: '从零开始自定义' },
  { icon: <CustomerServiceOutlined />, title: '客服助手', desc: '智能客服对话' },
  { icon: <FileSearchOutlined />, title: '审核助手', desc: '文档合同审核' },
  { icon: <BarChartOutlined />, title: '分析助手', desc: '数据报告分析' },
];

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleCategory, setRoleCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEmployees({
        keyword,
        status: statusFilter || undefined,
        roleCategory: roleCategory || undefined,
      });
      setEmployees(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载数字员工列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, statusFilter, roleCategory]);

  const handleDelete = async (employee: Employee) => {
    try {
      await deleteEmployee(employee.employeeId);
      message.success('数字员工已删除');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    try {
      if (employee.status === 'ACTIVE') {
        await deactivateEmployee(employee.employeeId);
        message.success('数字员工已停用');
      } else {
        await activateEmployee(employee.employeeId);
        message.success('数字员工已启用');
      }
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleCloned = (newEmployee: Employee) => {
    load();
    navigate(`/agents/${newEmployee.code}`);
  };

  const formatTime = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${d.getMonth() + 1}-${d.getDate()}`;
  };

  const renderActions = (employee: Employee): MenuProps['items'] => [
    { key: 'detail', icon: <EyeOutlined />, label: '查看详情', onClick: () => navigate(`/agents/${employee.code}`) },
    { key: 'edit', icon: <EditOutlined />, label: '编辑配置', onClick: () => navigate(`/agents/${employee.code}/capabilities`) },
    {
      key: 'clone',
      icon: <CopyOutlined />,
      label: <EmployeeCloneButton source={employee} asMenuItem onCloned={handleCloned} />,
    },
    { type: 'divider' },
    {
      key: 'toggle',
      icon: employee.status === 'ACTIVE' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      label: employee.status === 'ACTIVE' ? '停用' : '启用',
      onClick: () => handleToggleStatus(employee),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: (
        <Popconfirm title="确认删除" description={`确定删除「${employee.name}」吗？`} onConfirm={() => handleDelete(employee)}>
          <span>删除</span>
        </Popconfirm>
      ),
    },
  ];

  const stats = {
    active: employees.filter((e) => e.status === 'ACTIVE').length,
    total: employees.length,
    inactive: employees.filter((e) => e.status === 'INACTIVE').length,
    draft: employees.filter((e) => e.status === 'DRAFT').length,
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: Employee) => (
        <Space>
          <Avatar size={32} src={record.avatar} style={{ background: '#1a1a1a', color: '#60a5fa', border: '1px solid #262626' }}>
            {record.name.slice(0, 1)}
          </Avatar>
          <a onClick={() => navigate(`/agents/${record.code}`)} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>
            {record.name}
          </a>
          {record.builtin && <Tag color="gold" style={{ fontSize: 10 }}>内置</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'roleCategory',
      key: 'roleCategory',
      width: 100,
      render: (cat: string) => {
        const role = ROLE_CATEGORY_MAP[cat as Employee['roleCategory']];
        return role ? <Tag color={role.color}>{role.label}</Tag> : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const st = EMPLOYEE_STATUS_MAP[s];
        const isOnline = s === 'ACTIVE';
        return <Badge status={isOnline ? 'success' : s === 'INACTIVE' ? 'warning' : 'default'} text={st?.label ?? s} />;
      },
    },
    {
      title: '角色身份',
      dataIndex: 'roleIdentity',
      key: 'roleIdentity',
      width: 120,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '工具数',
      key: 'tools',
      width: 80,
      render: (_: unknown, record: Employee) => record.capability?.tools?.length ?? 0,
    },
    {
      title: '最近活跃',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (v?: string) => <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(v)}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Employee) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/agents/${record.code}`)} />
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => navigate(`/agents/${record.code}/capabilities`)} />
          <Dropdown menu={{ items: renderActions(record) }}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: '#a1a1a1', marginTop: 4 }}>总数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 24, fontWeight: 700, color: '#62d178' }}>{stats.active}</div>
            <div style={{ fontSize: 12, color: '#a1a1a1', marginTop: 4 }}>在线</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 24, fontWeight: 700, color: '#eab308' }}>{stats.inactive}</div>
            <div style={{ fontSize: 12, color: '#a1a1a1', marginTop: 4 }}>停用</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 24, fontWeight: 700, color: '#737373' }}>{stats.draft}</div>
            <div style={{ fontSize: 12, color: '#a1a1a1', marginTop: 4 }}>草稿</div>
          </Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <Button
                key={f.value}
                size="small"
                type="text"
                onClick={() => setStatusFilter(f.value)}
                style={active ? { background: '#1a1a1a', color: '#fafafa', borderColor: 'transparent' } : undefined}
              >
                {f.label}
              </Button>
            );
          })}
          <Select
            placeholder="全部类型"
            allowClear
            size="small"
            style={{ width: 140 }}
            value={roleCategory || undefined}
            onChange={(v) => setRoleCategory(v || '')}
          >
            {ROLE_CATEGORY_OPTIONS.map((role) => (
              <Select.Option key={role.value} value={role.value}>{role.label}</Select.Option>
            ))}
          </Select>
        </Space>
        <Space>
          <Input
            placeholder="搜索数字员工..."
            prefix={<SearchOutlined style={{ color: '#737373' }} />}
            allowClear
            size="small"
            style={{ width: 220 }}
            onPressEnter={(e) => setKeyword((e.target as HTMLInputElement).value)}
            onChange={(e) => { if (!e.target.value) setKeyword(''); }}
          />
          <Button
            size="small"
            type={viewMode === 'table' ? 'text' : 'default'}
            icon={<UnorderedListOutlined />}
            onClick={() => setViewMode('table')}
          />
          <Button
            size="small"
            type={viewMode === 'card' ? 'default' : 'text'}
            icon={<AppstoreOutlined />}
            onClick={() => setViewMode('card')}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/create')}>
            创建数字员工
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      {loading ? (
        <Card><Spin style={{ display: 'block', margin: '40px auto' }} /></Card>
      ) : error ? (
        <Result
          status="error"
          title="加载失败"
          subTitle={error.message}
          extra={<Button type="primary" icon={<ReloadOutlined />} onClick={load}>重试</Button>}
        />
      ) : employees.length === 0 ? (
        <Card>
          <Empty description="还没有数字员工，点击创建第一位吧" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/create')}>
              创建数字员工
            </Button>
          </Empty>
        </Card>
      ) : viewMode === 'card' ? (
        <Row gutter={[16, 16]}>
          {employees.map((emp) => (
            <Col key={emp.employeeId} xs={24} sm={12} lg={8} xl={6}>
              <EmployeeCard
                employee={emp}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
                onCloned={handleCloned}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Table
          dataSource={employees}
          rowKey="employeeId"
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({ onClick: () => navigate(`/agents/${record.code}`), style: { cursor: 'pointer' } })}
        />
      )}

      {/* 快速创建 */}
      <div style={{ marginTop: 24 }}>
        <Typography.Title level={5}>快速创建</Typography.Title>
        <Row gutter={16}>
          {QUICK_TEMPLATES.map((tpl) => (
            <Col key={tpl.title} span={6}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate('/agents/create')}
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 4,
                  background: 'var(--muted, #1a1a1a)',
                  border: '1px solid var(--border, #262626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  color: 'var(--muted-foreground, #a1a1a1)',
                }}>
                  {tpl.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{tpl.title}</div>
                <div style={{ fontSize: 11, color: '#a1a1a1', marginTop: 2 }}>{tpl.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
