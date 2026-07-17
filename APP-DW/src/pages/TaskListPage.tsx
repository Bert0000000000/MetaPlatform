import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { listTasks, getTaskStats } from '@/api/tasks';
import { listEmployees } from '@/api/employees';
import TaskAssignment from '@/components/TaskAssignment';
import type { Employee, EmployeeTask } from '@/types';

const STATUS_MAP: Record<EmployeeTask['status'], { label: string; color: string }> = {
  pending: { label: '待处理', color: 'default' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
};

export default function TaskListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>();
  const [employeeId, setEmployeeId] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      const list = await listEmployees({});
      setEmployees(list.items);
      if (list.items.length > 0) {
        const id = employeeId || list.items[0]!.employeeId;
        const t = await listTasks(id);
        setTasks(t);
        const stats = await getTaskStats(id);
        console.info('stats', stats);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employeeId]);

  const columns: ColumnsType<EmployeeTask> = [
    {
      title: '任务',
      key: 'title',
      render: (_, t) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{t.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t.description}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => (
        <Tag color={STATUS_MAP[v as EmployeeTask['status']].color}>
          {STATUS_MAP[v as EmployeeTask['status']].label}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      render: (v) => (
        <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'default'}>{v}</Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      render: (v?: number) => (v !== undefined ? `${v}%` : '-'),
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/dw/tasks/${t.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const filtered = tasks.filter((t) => {
    const matchK = !keyword || t.title.toLowerCase().includes(keyword.toLowerCase());
    const matchS = !status || t.status === status;
    return matchK && matchS;
  });

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          任务列表
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dw/tasks/create')}>
          创建任务
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择数字员工"
          style={{ width: 200 }}
          value={employeeId}
          onChange={setEmployeeId}
          options={employees.map((e) => ({ label: e.name, value: e.employeeId }))}
        />
        <Input.Search
          placeholder="搜索任务"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 140 }}
          value={status}
          onChange={setStatus}
          options={[
            { label: '待处理', value: 'pending' },
            { label: '运行中', value: 'running' },
            { label: '已完成', value: 'completed' },
            { label: '失败', value: 'failed' },
          ]}
        />
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <Card>
          {filtered.length === 0 && !loading ? (
            <Empty description="还没有任务" />
          ) : (
            <Table rowKey="id" dataSource={filtered} columns={columns} loading={loading} />
          )}
        </Card>

        <Card title="分配任务">
          <TaskAssignment employees={employees} onAssigned={load} />
        </Card>
      </div>
    </div>
  );
}
