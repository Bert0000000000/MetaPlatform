import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listEmployees } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';

/** A2A 注册中心 — 内部数字员工（agent 注册表的内部一侧，连 dw employees）。 */
export default function A2aInternalAgentsPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listEmployees()
      .then((page) => setItems(page.items ?? []))
      .catch(() => message.error('加载内部数字员工失败'))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<Employee> = [
    { title: '员工', key: 'name', render: (_, r) => (
        <Typography.Text strong>{r.name}</Typography.Text>
      ) },
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '角色', dataIndex: 'roleCategory', width: 140, render: (v) => <Tag>{v}</Tag> },
    { title: '身份', dataIndex: 'roleIdentity', width: 140 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => (
        <Tag color={v === 'ACTIVE' ? 'green' : v === 'DRAFT' ? 'orange' : 'default'}>{v}</Tag>
      ) },
    { title: '内置', dataIndex: 'builtin', width: 70, render: (v) => (v ? '✓' : '') },
  ];

  return (
    <Card title="内部数字员工" extra={<Typography.Text type="secondary">A2A 注册中心 — 内部 Agent</Typography.Text>}>
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}
