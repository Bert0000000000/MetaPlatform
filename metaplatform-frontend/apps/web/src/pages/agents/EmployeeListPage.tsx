import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Popconfirm,
  Dropdown,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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
import EmployeeCloneButton from './components/EmployeeCloneButton';
import EmployeeCard from './components/EmployeeCard';
import EmployeeCreateDrawer from './components/EmployeeCreateDrawer';

const { Text } = Typography;

const TAG_COLOR_MAP: Record<string, TagColor> = {
  magenta: 'pink',
  geekblue: 'indigo',
  blue: 'blue',
  cyan: 'cyan',
  green: 'green',
  red: 'red',
  purple: 'purple',
  default: 'grey',
};

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleCategory, setRoleCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreated = (code: string) => {
    navigate(`/agents/${code}`);
  };

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
      Toast.success('数字员工已删除');
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    try {
      if (employee.status === 'ACTIVE') {
        await deactivateEmployee(employee.employeeId);
        Toast.success('数字员工已停用');
      } else {
        await activateEmployee(employee.employeeId);
        Toast.success('数字员工已启用');
      }
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '操作失败');
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

  const renderActionsMenu = (employee: Employee) => (
    <Dropdown.Menu>
      <Dropdown.Item icon={<EyeOutlined />} onClick={() => navigate(`/agents/${employee.code}`)}>查看详情</Dropdown.Item>
      <Dropdown.Item icon={<EditOutlined />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>编辑配置</Dropdown.Item>
      <Dropdown.Item icon={<CopyOutlined />}>
        <EmployeeCloneButton source={employee} asMenuItem onCloned={handleCloned} />
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item icon={employee.status === 'ACTIVE' ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => handleToggleStatus(employee)}>
        {employee.status === 'ACTIVE' ? '停用' : '启用'}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<DeleteOutlined />}>
        <Popconfirm title="确认删除" content={`确定删除「${employee.name}」吗？`} onConfirm={() => handleDelete(employee)}>
          <span>删除</span>
        </Popconfirm>
      </Dropdown.Item>
    </Dropdown.Menu>
  );

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
          <Avatar size="extra-large" src={record.avatar} style={{ width: 32, height: 32, background: 'var(--semi-color-bg-2)', color: '#60a5fa', border: '1px solid var(--semi-color-border)' }}>
            {record.name.slice(0, 1)}
          </Avatar>
          <a onClick={() => navigate(`/agents/${record.code}`)} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>
            {record.name}
          </a>
          {record.builtin && <Tag color="yellow" style={{ fontSize: 10 }}>内置</Tag>}
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
        return role ? <Tag color={TAG_COLOR_MAP[role.color] ?? 'grey'}>{role.label}</Tag> : '-';
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
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isOnline ? 'var(--semi-color-success)' : s === 'INACTIVE' ? 'var(--semi-color-warning)' : 'var(--semi-color-tertiary)',
              }}
            />
            <Text type="tertiary" style={{ fontSize: 12 }}>{st?.label ?? s}</Text>
          </span>
        );
      },
    },
    {
      title: '角色身份',
      dataIndex: 'roleIdentity',
      key: 'roleIdentity',
      width: 120,
      render: (v: string) => <Text type="tertiary">{v || '-'}</Text>,
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
      render: (v?: string) => <Text type="tertiary" style={{ fontSize: 12 }}>{formatTime(v)}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Employee) => (
        <Space spacing={4}>
          <Button theme="borderless" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/agents/${record.code}`)} />
          <Button theme="borderless" size="small" icon={<EditOutlined />} onClick={() => navigate(`/agents/${record.code}/capabilities`)} />
          <Dropdown render={renderActionsMenu(record)}>
            <Button theme="borderless" size="small" icon={<MoreOutlined />} />
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
          <Card>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>总数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--semi-color-success)' }}>{stats.active}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>在线</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--semi-color-warning)' }}>{stats.inactive}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>停用</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--muted-foreground)' }}>{stats.draft}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>草稿</div>
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
                theme="borderless"
                onClick={() => setStatusFilter(f.value)}
                style={active ? { background: 'var(--muted)', color: 'var(--foreground)', borderColor: 'transparent' } : undefined}
              >
                {f.label}
              </Button>
            );
          })}
          <Select
            placeholder="全部类型"
            showClear
            size="small"
            style={{ width: 140 }}
            value={roleCategory || undefined}
            onChange={(v) => setRoleCategory((v as string) || '')}
            optionList={ROLE_CATEGORY_OPTIONS}
          />
        </Space>
        <Space>
          <Input
            placeholder="搜索数字员工..."
            prefix={<SearchOutlined style={{ color: 'var(--muted-foreground)' }} />}
            showClear
            size="small"
            style={{ width: 220 }}
            onEnterPress={(e) => setKeyword((e.target as HTMLInputElement).value)}
            onChange={(v: string) => { if (!v) setKeyword(''); }}
          />
          <Button
            size="small"
            theme={viewMode === 'table' ? 'borderless' : 'light'}
            icon={<UnorderedListOutlined />}
            onClick={() => setViewMode('table')}
          />
          <Button
            size="small"
            theme={viewMode === 'card' ? 'light' : 'borderless'}
            icon={<AppstoreOutlined />}
            onClick={() => setViewMode('card')}
          />
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建数字员工
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      {loading ? (
        <Card><Spin style={{ display: 'block', margin: '40px auto' }} /></Card>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>加载失败</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>{error.message}</div>
          <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>重试</Button>
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <Empty description="还没有数字员工，点击创建第一位吧">
            <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/create')}>
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
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: true }}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => {
              if (record) navigate(`/agents/${record.code}`);
            },
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {/* 快速创建 */}
      <div style={{ marginTop: 24 }}>
        <Typography.Title heading={5}>快速创建</Typography.Title>
        <Row gutter={16}>
          {QUICK_TEMPLATES.map((tpl) => (
            <Col key={tpl.title} span={6}>
              <Card
                shadows="hover"
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <div onClick={() => setCreateOpen(true)}>
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
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{tpl.desc}</div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <EmployeeCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
