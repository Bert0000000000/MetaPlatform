import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listEmployees } from '@/api/dw/employees';
import { ROLE_CATEGORY_MAP, type Employee, type PageResponse } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · DW 接口消费页（GOVERN-08）。
 *
 * 数据面 src/api/dw/employees（listEmployees）；与 /agents 卡片页并存，本页以表格形态
 * 呈现同一份 Employee 数据，用于核对 DW API 的字段口径。
 */

type Meta = { label: string; color: TagColor };

// 状态 → 展示。含 API 拦截器 remapUserStatus 运行时改写的 ENABLED/DISABLED。
const STATUS_META: Record<string, Meta> = {
  DRAFT: { label: '草稿', color: 'grey' },
  ACTIVE: { label: '在线', color: 'green' },
  INACTIVE: { label: '已停用', color: 'light-blue' },
  ARCHIVED: { label: '已归档', color: 'grey' },
  ENABLED: { label: '在线', color: 'green' },
  DISABLED: { label: '已停用', color: 'light-blue' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: PageResponse<Employee> = await listEmployees();
      setItems(res.items ?? []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableProProps<Employee>['columns'] = [
    { title: '名称', dataIndex: 'name', width: 220, ellipsis: true },
    { title: '编码', dataIndex: 'code', width: 160, ellipsis: true },
    {
      title: '角色类别',
      dataIndex: 'roleCategory',
      width: 130,
      render: (_: unknown, r: Employee) => (
        <Tag size="small" type="light">{ROLE_CATEGORY_MAP[r.roleCategory]?.label ?? (r.roleCategory || '—')}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: unknown, r: Employee) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '职责', dataIndex: 'description', ellipsis: true },
  ];

  return (
    <>
      <PageHeader
        title="数字员工列表"
        desc={error ? undefined : loading ? '正在加载员工数据…' : `共 ${items.length} 名数字员工`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="数字员工列表加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : (
        <Card>
          <DataTablePro<Employee>
            columns={columns}
            dataSource={items}
            rowKey="employeeId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无数字员工"
                desc="招聘第一名数字员工后，这里会列出它。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
