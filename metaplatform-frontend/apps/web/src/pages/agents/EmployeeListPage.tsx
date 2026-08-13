import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  BorderlessTableOutlined,
  AppstoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Copy,
  Trash2,
  Bot,
  Headphones,
  FileSearch,
  BarChart3,
} from 'lucide-react';
import { listEmployees, deleteEmployee, activateEmployee, deactivateEmployee } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
} from '@/api/dw/types';
import EmployeeCloneButton from './components/EmployeeCloneButton';
import EmployeeCard from './components/EmployeeCard';
import ExternalAgentsPanel from './components/ExternalAgentsPanel';
import EmployeeCreateDrawer from './components/EmployeeCreateDrawer';
import {
  PageRoot,
  PlatformSegmented,
  PlatformPagination,
  SearchInput,
} from '@mate/shared';

const { Text } = Typography;

type ScopeTab = 'internal' | 'external';
type StatusValue = '' | 'ACTIVE' | 'INACTIVE' | 'DRAFT';

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

const STATUS_OPTIONS: PlatformSegmentedOption<StatusValue>[] = [
  { label: '全部', value: '' },
  { label: '在线', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '草稿', value: 'DRAFT' },
];

const QUICK_TEMPLATES = [
  { icon: <Plus size={20} />, title: '空白模板', desc: '从零开始自定义' },
  { icon: <Headphones size={20} />, title: '客服助手', desc: '智能客服对话' },
  { icon: <FileSearch size={20} />, title: '审核助手', desc: '文档合同审核' },
  { icon: <BarChart3 size={20} />, title: '分析助手', desc: '数据报告分析' },
];

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<ScopeTab>('internal');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusValue>('');
  const [roleCategory, setRoleCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleCreated = (code: string) => navigate(`/agents/${code}`);

  const load = async () => {
    if (scope !== 'internal') return;
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
    setPage(1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, statusFilter, roleCategory]);

  useEffect(() => {
    if (scope !== 'internal') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

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
      <Dropdown.Item icon={<Eye size={14} />} onClick={() => navigate(`/agents/${employee.code}`)}>查看详情</Dropdown.Item>
      <Dropdown.Item icon={<Edit2 size={14} />} onClick={() => navigate(`/agents/${employee.code}/capabilities`)}>编辑配置</Dropdown.Item>
      <Dropdown.Item icon={<Copy size={14} />}>
        <EmployeeCloneButton source={employee} asMenuItem onCloned={handleCloned} />
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item
        icon={employee.status === 'ACTIVE' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
        onClick={() => handleToggleStatus(employee)}
      >
        {employee.status === 'ACTIVE' ? '停用' : '启用'}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" icon={<Trash2 size={14} />}>
        <Popconfirm title="确认删除" content={`确定删除「${employee.name}」吗？`} onConfirm={() => handleDelete(employee)}>
          <span>删除</span>
        </Popconfirm>
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  const stats = useMemo(() => ({
    active: employees.filter((e) => e.status === 'ACTIVE').length,
    total: employees.length,
    inactive: employees.filter((e) => e.status === 'INACTIVE').length,
    draft: employees.filter((e) => e.status === 'DRAFT').length,
  }), [employees]);

  const columns = useMemo(() => ([
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_: string, record: Employee) => (
        <Space spacing={8}>
          <Avatar
            size="default"
            src={record.avatar}
            style={{
              width: 28,
              height: 28,
              background: 'var(--semi-color-primary-light-default)',
              color: 'var(--semi-color-primary)',
              border: '1px solid var(--semi-color-border)',
              fontSize: 12,
            }}
          >
            {record.name.slice(0, 1)}
          </Avatar>
          <a
            onClick={() => navigate(`/agents/${record.code}`)}
            style={{ color: 'inherit', textDecoration: 'none', fontWeight: 400, fontSize: 13 }}
          >
            {record.name}
          </a>
          {record.builtin && <Tag color="yellow" style={{ fontSize: 10, margin: 0 }}>内置</Tag>}
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
      width: 110,
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
                background: isOnline
                  ? 'var(--semi-color-success)'
                  : s === 'INACTIVE'
                  ? 'var(--semi-color-warning)'
                  : 'var(--semi-color-tertiary)',
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
      width: 140,
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
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: Employee) => (
        <Space spacing={4}>
          <Button theme="borderless" size="small" icon={<Eye size={14} />} onClick={() => navigate(`/agents/${record.code}`)} />
          <Button theme="borderless" size="small" icon={<Edit2 size={14} />} onClick={() => navigate(`/agents/${record.code}/capabilities`)} />
          <Dropdown render={renderActionsMenu(record)}>
            <Button theme="borderless" size="small" icon={<MoreHorizontal size={14} />} />
          </Dropdown>
        </Space>
      ),
    },
  ]), [navigate]);

  const paged = useMemo(() => employees.slice((page - 1) * pageSize, page * pageSize), [employees, page, pageSize]);

  const renderTable = () => (
    <Card bodyStyle={{ padding: 0 }} bordered={false} style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
      <Table
        dataSource={paged}
        rowKey="employeeId"
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => record && navigate(`/agents/${record.code}`),
          style: { cursor: 'pointer' },
        })}
      />
      {employees.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
          <PlatformPagination
            total={employees.length}
            currentPage={page}
            pageSize={pageSize}
            size="small"
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </Card>
  );

  const renderCards = () => (
    <Card bodyStyle={{ padding: 16 }} bordered={false} style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
      <Row gutter={[16, 16]}>
        {paged.map((emp) => (
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
      {employees.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
          <PlatformPagination
            total={employees.length}
            currentPage={page}
            pageSize={pageSize}
            size="small"
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </Card>
  );

  return (
    <PageRoot>
      {/* 顶部标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space align="center" spacing={8}>
          <Bot size={18} />
          <Typography.Title heading={6} style={{ margin: 0 }}>数字员工</Typography.Title>
        </Space>
        <Button theme="solid" type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
          创建数字员工
        </Button>
      </div>

      {/* 内部 / 外部 Tab（页面内嵌） */}
      <Tabs
        type="line"
        activeKey={scope}
        onChange={(k) => setScope(k as ScopeTab)}
        tabList={[
          { itemKey: 'internal', tab: '内部员工' },
          { itemKey: 'external', tab: '外部员工' },
        ]}
      />

      {scope === 'external' ? (
        <ExternalAgentsPanel />
      ) : (
        <>
          {/* 统计卡片 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card bodyStyle={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>总数</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bodyStyle={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--semi-color-success)' }}>{stats.active}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>在线</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bodyStyle={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--semi-color-warning)' }}>{stats.inactive}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>停用</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bodyStyle={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--muted-foreground)' }}>{stats.draft}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>草稿</div>
              </Card>
            </Col>
          </Row>

          {/* 工具栏：状态分段 + 类型 + 搜索 + 视图切换，两端对齐 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space align="center" spacing={12}>
              <PlatformSegmented<StatusValue>
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
              <Select
                placeholder="全部类型"
                showClear
                style={{ width: 140 }}
                value={roleCategory || undefined}
                onChange={(v) => setRoleCategory((v as string) || '')}
                optionList={ROLE_CATEGORY_OPTIONS}
              />
            </Space>
            <Space align="center" spacing={8}>
              <SearchInput
                placeholder="搜索数字员工..."
                width={240}
                defaultValue={keyword}
                onSearch={setKeyword}
              />
              <Button
                theme={viewMode === 'table' ? 'solid' : 'borderless'}
                type={viewMode === 'table' ? 'primary' : 'tertiary'}
                icon={<BorderlessTableOutlined />}
                onClick={() => setViewMode('table')}
              />
              <Button
                theme={viewMode === 'card' ? 'solid' : 'borderless'}
                type={viewMode === 'card' ? 'primary' : 'tertiary'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('card')}
              />
            </Space>
          </div>

          {/* 列表 / 卡片 */}
          {loading ? (
            <Card bodyStyle={{ padding: 48 }}>
              <Spin style={{ display: 'block', margin: '0 auto' }} />
            </Card>
          ) : error ? (
            <Card bodyStyle={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>加载失败</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>{error.message}</div>
              <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>重试</Button>
            </Card>
          ) : employees.length === 0 ? (
            <Card bodyStyle={{ padding: 48 }}>
              <Empty description="还没有数字员工，点击创建第一位吧">
                <Button theme="solid" type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                  创建数字员工
                </Button>
              </Empty>
            </Card>
          ) : viewMode === 'card' ? renderCards() : renderTable()}

          {/* 快速创建模板 */}
          <div style={{ marginTop: 8 }}>
            <Typography.Title heading={6} style={{ margin: '8px 0' }}>快速创建</Typography.Title>
            <Row gutter={[16, 16]}>
              {QUICK_TEMPLATES.map((tpl) => (
                <Col key={tpl.title} xs={12} sm={12} md={6} lg={6}>
                  <Card
                    shadows="hover"
                    bodyStyle={{ padding: 20, textAlign: 'center' }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setCreateOpen(true)}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'var(--semi-color-primary-light-default)',
                        color: 'var(--semi-color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px',
                      }}
                    >
                      {tpl.icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{tpl.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{tpl.desc}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </>
      )}

      <EmployeeCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </PageRoot>
  );
}
