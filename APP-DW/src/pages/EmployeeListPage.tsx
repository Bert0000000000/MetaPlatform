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
  message,
  Popconfirm,
  Dropdown,
  Avatar,
  Row,
  Col,
  Statistic,
  Result,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  RobotOutlined,
  ToolOutlined,
  BookOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { listEmployees, deleteEmployee, activateEmployee, deactivateEmployee } from '@/api/employees';
import type { Employee } from '@/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  EMPLOYEE_STATUS_MAP,
} from '@/types';
import type { MenuProps } from 'antd';
import EmployeeCloneButton from '@/components/EmployeeCloneButton';
import { SearchInput } from '@mate/shared';

const { Meta } = Card;

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '在线', value: 'ACTIVE' },
  { label: '已停用', value: 'INACTIVE' },
  { label: '已归档', value: 'ARCHIVED' },
];

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [roleCategory, setRoleCategory] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEmployees({
        keyword,
        status: status || undefined,
        roleCategory: roleCategory || undefined,
      });
      setEmployees(res.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载数字员工列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, status, roleCategory]);

  const handleDelete = async (employee: Employee) => {
    try {
      await deleteEmployee(employee.employeeId);
      message.success('数字员工已删除');
      load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
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
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // V12-07: 克隆成功后跳转到新员工详情页。
  const handleCloned = (newEmployee: Employee) => {
    load();
    navigate(`/dw/employees/${newEmployee.employeeId}`);
  };

  const formatTime = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 更新`;
  };

  const renderCardActions = (employee: Employee): MenuProps['items'] => [
    {
      key: 'detail',
      icon: <RobotOutlined />,
      label: '查看详情',
      onClick: () => navigate(`/dw/employees/${employee.employeeId}`),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑配置',
      onClick: () => message.info('编辑功能可在创建向导基础上扩展'),
    },
    {
      key: 'clone',
      icon: <CopyOutlined />,
      // V12-07: 使用 EmployeeCloneButton 渲染菜单项，弹出确认对话框输入新员工名称/编码。
      label: (
        <EmployeeCloneButton
          source={employee}
          asMenuItem
          onCloned={handleCloned}
        />
      ),
    },
    {
      key: 'toggle',
      label: employee.status === 'ACTIVE' ? '停用' : '启用',
      onClick: () => handleToggleStatus(employee),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除数字员工「${employee.name}」吗？`}
          onConfirm={() => handleDelete(employee)}
        >
          <span>删除</span>
        </Popconfirm>
      ),
    },
  ];

  const renderCapabilityIcons = (employee: Employee) => {
    const icons: React.ReactNode[] = [];
    if (employee.capability.tools.length > 0) {
      icons.push(<ToolOutlined key="tools" title={`${employee.capability.tools.length} 个工具`} />);
    }
    if (employee.capability.ragKnowledgeBaseIds.length > 0) {
      icons.push(<BookOutlined key="rag" title={`${employee.capability.ragKnowledgeBaseIds.length} 个知识库`} />);
    }
    if (employee.capability.model) {
      icons.push(<ApiOutlined key="model" title={`模型: ${employee.capability.model}`} />);
    }
    if (icons.length === 0) {
      icons.push(<ThunderboltOutlined key="default" title="未配置能力" />);
    }
    return icons;
  };

  const stats = {
    activeCount: employees.filter((e) => e.status === 'ACTIVE').length,
    totalCount: employees.length,
    onlineRate: employees.length > 0 ? Math.round((employees.filter((e) => e.status === 'ACTIVE').length / employees.length) * 100) : 0,
    avgScore: 4.3,
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="在线员工数" value={stats.activeCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="员工总数" value={stats.totalCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="在线率" value={stats.onlineRate} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均质量评分" value={stats.avgScore} suffix="/ 5.0" />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <SearchInput
          placeholder="搜索员工名称或角色"
          onSearch={setKeyword}
          width={260}
        />
        <Select
          placeholder="角色分类"
          allowClear
          style={{ width: 160 }}
          value={roleCategory}
          onChange={setRoleCategory}
        >
          {ROLE_CATEGORY_OPTIONS.map((role) => (
            <Select.Option key={role.value} value={role.value}>
              {role.label}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
        >
          {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
            <Select.Option key={o.value} value={o.value}>
              {o.label}
            </Select.Option>
          ))}
        </Select>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dw/employees/create')}
        >
          创建数字员工
        </Button>
      </Space>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} loading>
              <div style={{ height: 120 }} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Result
          status="error"
          title="加载失败"
          subTitle={error.message}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={load}>
              重试
            </Button>
          }
        />
      ) : employees.length === 0 ? (
        <Empty
          description="还没有数字员工，点击创建第一位吧"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/dw/employees/create')}
          >
            创建数字员工
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {employees.map((employee) => {
            const role = ROLE_CATEGORY_MAP[employee.roleCategory];
            const employeeStatus = EMPLOYEE_STATUS_MAP[employee.status];
            return (
              <Card
                key={employee.employeeId}
                hoverable
                onClick={() => navigate(`/dw/employees/${employee.employeeId}`)}
                actions={[
                  <span key="tools">{employee.capability.tools.length} 个工具</span>,
                  <span key="updated">{formatTime(employee.updatedAt)}</span>,
                ]}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Meta
                    avatar={
                      <Avatar
                        size={64}
                        src={employee.avatar}
                        style={{ background: '#f0f5ff', color: '#1677ff' }}
                      >
                        {employee.name.slice(0, 1)}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Typography.Text strong>{employee.name}</Typography.Text>
                        <Tag color={role.color}>{role.label}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {employee.roleIdentity}
                        </Typography.Text>
                        <div>
                          <Typography.Text type="secondary" ellipsis style={{ maxWidth: 220 }}>
                            {employee.description || '-'}
                          </Typography.Text>
                        </div>
                        <Space style={{ marginTop: 8 }}>
                          {renderCapabilityIcons(employee)}
                        </Space>
                      </div>
                    }
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <Tag color={employeeStatus.color}>{employeeStatus.label}</Tag>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Dropdown menu={{ items: renderCardActions(employee) }}>
                        <Button type="text" icon={<MoreOutlined />} />
                      </Dropdown>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
