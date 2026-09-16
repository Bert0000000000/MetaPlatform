import { useEffect, useMemo, useState } from 'react';
import { Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { listEmployees } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** A2A 注册中心 — 内部数字员工（agent 注册表的内部一侧，连 dw employees）。 */
export default function A2aInternalAgentsPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    listEmployees()
      .then((res) => setItems(res.items ?? []))
      .catch(() => Toast.error('加载内部数字员工失败'))
      .finally(() => setLoading(false));
  }, []);

  const paged = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  const columns: ColumnProps<Employee>[] = [
    {
      title: '员工',
      key: 'name',
      render: (_, r) => <Typography.Text strong>{r.name}</Typography.Text>,
    },
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '角色', dataIndex: 'roleCategory', width: 140, render: (v) => <Tag size="small">{v}</Tag> },
    { title: '身份', dataIndex: 'roleIdentity', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => (
        <Tag size="small" color={v === 'ACTIVE' ? 'green' : v === 'DRAFT' ? 'orange' : 'grey'}>
          {v}
        </Tag>
      ),
    },
    { title: '内置', dataIndex: 'builtin', width: 70, render: (v) => (v ? '✓' : '') },
  ];

  return (
    <div>
      <PageHeader
        title="内部数字员工"
        desc="A2A 注册中心 — 平台内置 Agent，可被外部智能体按 A2A 协议发现与调用。"
      />

      {!loading && items.length === 0 ? (
        <EmptyState illustration="no-content" title="暂无内部数字员工" desc="在「数字员工」域创建员工后会出现在这里。" />
      ) : (
        <DataTablePro<Employee>
          rowKey="employeeId"
          loading={loading}
          dataSource={paged}
          columns={columns}
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total: items.length,
            onChange: setPage,
          }}
        />
      )}
    </div>
  );
}
