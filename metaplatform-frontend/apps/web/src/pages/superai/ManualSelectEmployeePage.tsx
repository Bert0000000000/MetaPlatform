import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { listEmployees } from '@/api/dw/employees';
import { EMPLOYEE_STATUS_MAP, ROLE_CATEGORY_MAP, type Employee } from '@/api/dw/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 手动选择员工（执行计划域内的深链子页）。
 *
 * 原页用 15 条写死的 MOCK 员工 + 无 onClick 的确认按钮（纯装饰）。
 * 这里改为读取真实员工列表（/dw/employees）与真实勾选状态；
 * 后端没有「把选择提交到某个计划」的接口，因此不再放无落点的确认按钮，
 * 选择结果由表格底部的「已选 n 项 · 清除」如实呈现。
 */
export default function ManualSelectEmployeePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listEmployees();
      setEmployees(res.items ?? []);
    } catch (e) {
      setEmployees([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        e.code.toLowerCase().includes(kw) ||
        (e.description ?? '').toLowerCase().includes(kw),
    );
  }, [employees, keyword]);

  const columns: ColumnProps<Employee>[] = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', width: 200, ellipsis: true },
      { title: '编码', dataIndex: 'code', width: 180, ellipsis: true },
      {
        title: '角色类别',
        dataIndex: 'roleCategory',
        width: 140,
        render: (v: Employee['roleCategory']) => ROLE_CATEGORY_MAP[v]?.label ?? v,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: Employee['status']) => EMPLOYEE_STATUS_MAP[v]?.label ?? v,
      },
      { title: '职责', dataIndex: 'description', ellipsis: true },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="手动选择员工"
        desc={`从 ${employees.length} 名数字员工中勾选；已选 ${selectedKeys.length} 名`}
        actions={
          <>
            <Button
              icon={<ArrowLeft size={15} strokeWidth={1.5} />}
              onClick={() => navigate('/superai/plans')}
            >
              返回执行计划
            </Button>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、编码或职责…' }}
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="员工列表加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && employees.length === 0 ? (
        <div className="mp-exec-loading">
          <Spin size="middle" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={employees.length === 0 ? 'no-content' : 'no-result'}
          title={employees.length === 0 ? '还没有数字员工' : '没有匹配的员工'}
          desc={employees.length === 0 ? '先在数字员工页招聘员工。' : '调整关键词再试。'}
        />
      ) : (
        <DataTablePro<Employee>
          columns={columns}
          dataSource={filtered}
          rowKey="employeeId"
          loading={loading}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          empty={<EmptyState illustration="no-content" title="还没有数字员工" />}
        />
      )}
    </>
  );
}
