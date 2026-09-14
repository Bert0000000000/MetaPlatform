import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Select, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import {
  activateEmployee,
  deactivateEmployee,
  deleteEmployee,
  listEmployees,
} from '@/api/dw/employees';
import {
  EMPLOYEE_STATUS_MAP,
  ROLE_CATEGORY_MAP,
  type Employee,
  type EmployeeStatus,
  type RoleCategory,
} from '@/api/dw/types';
import { EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import EmployeeCard from './components/EmployeeCard';
import EmployeeCreateDrawer from './components/EmployeeCreateDrawer';
import './agents.css';

/**
 * 数字员工 · 员工（DESIGN-SPEC §5 版式 C：页头 + 筛选栏 + 卡片网格 + 虚线新建卡）。
 *
 * 数据面沿用 src/api/dw/employees；详情走右侧非模态 SheetDetail（完整页 /agents/:code 仍可深链）。
 * 说明：原页在页内还有一套「内部/外部」作用域切换，与新 IA 的「员工 / 外部员工 · A2A」两个
 * 顶级 tab 重复（控件预算 ≤2），这里去掉页内切换，外部员工交给隔壁 tab。
 */
export default function EmployeeListPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('');
  const [roleCategory, setRoleCategory] = useState<RoleCategory | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<Employee | null>(null);

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
    return employees.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (roleCategory && e.roleCategory !== roleCategory) return false;
      if (!kw) return true;
      return (
        e.name.toLowerCase().includes(kw) ||
        e.code.toLowerCase().includes(kw) ||
        (e.description ?? '').toLowerCase().includes(kw)
      );
    });
  }, [employees, keyword, statusFilter, roleCategory]);

  // 注意：EMPLOYEE_STATUS_MAP 里还有 ENABLED/DISABLED，那是 API 拦截器
  // remapUserStatus 运行时改写出来的值，不在 EmployeeStatus 类型里。
  const onlineCount = useMemo(() => employees.filter((e) => e.status === 'ACTIVE').length, [employees]);

  const toggle = useCallback(
    async (employee: Employee) => {
      try {
        if (employee.status === 'ACTIVE') await deactivateEmployee(employee.code);
        else await activateEmployee(employee.code);
        Toast.success(employee.status === 'ACTIVE' ? `已停用「${employee.name}」` : `已启用「${employee.name}」`);
        await load();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [load],
  );

  const remove = useCallback(
    async (employee: Employee) => {
      try {
        await deleteEmployee(employee.code);
        Toast.success(`已删除「${employee.name}」`);
        setPreview((p) => (p?.code === employee.code ? null : p));
        await load();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [load],
  );

  return (
    <>
      <PageHeader
        title="数字员工"
        desc={`${employees.length} 名员工 · ${onlineCount} 名在线`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => setCreateOpen(true)}
            >
              招聘新员工
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、编码或职责…' }}
        filters={
          <>
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as EmployeeStatus | '')}
              placeholder="全部状态"
            >
              <Select.Option value="">全部状态</Select.Option>
              {(Object.keys(EMPLOYEE_STATUS_MAP) as string[])
                .filter((k) => !['ENABLED', 'DISABLED'].includes(k))
                .map((k) => (
                  <Select.Option key={k} value={k}>
                    {EMPLOYEE_STATUS_MAP[k].label}
                  </Select.Option>
                ))}
            </Select>
            <Select
              value={roleCategory}
              onChange={(v) => setRoleCategory(v as RoleCategory | '')}
              placeholder="全部角色类别"
            >
              <Select.Option value="">全部角色类别</Select.Option>
              {(Object.keys(ROLE_CATEGORY_MAP) as RoleCategory[]).map((k) => (
                <Select.Option key={k} value={k}>
                  {ROLE_CATEGORY_MAP[k].label}
                </Select.Option>
              ))}
            </Select>
          </>
        }
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
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : filtered.length === 0 && !loading ? (
        <EmptyState
          illustration="no-result"
          title={employees.length === 0 ? '还没有数字员工' : '没有匹配的员工'}
          desc={employees.length === 0 ? '招聘第一名数字员工，让它开始接活。' : '调整关键词、状态或角色类别。'}
          actions={
            <Button theme="solid" type="primary" onClick={() => setCreateOpen(true)}>
              招聘新员工
            </Button>
          }
        />
      ) : (
        <div className="mp-agents-grid">
          {filtered.map((e) => (
            <EmployeeCard
              key={e.employeeId}
              employee={e}
              onToggle={(emp) => void toggle(emp)}
              onDelete={(emp) => void remove(emp)}
              onCloned={() => void load()}
              onPreview={setPreview}
            />
          ))}
          <button type="button" className="mp-agents-new" onClick={() => setCreateOpen(true)}>
            <span className="mp-agents-new-icon">
              <Plus size={18} strokeWidth={1.5} />
            </span>
            招聘新员工
          </button>
        </div>
      )}

      <EmployeeCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(code) => {
          setCreateOpen(false);
          void load();
          if (code) navigate(`/agents/${code}`);
        }}
      />

      <SheetDetail
        title={preview ? `员工详情 · ${preview.name}` : '员工详情'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={
          <>
            {preview ? (
              <Button onClick={() => navigate(`/agents/${encodeURIComponent(preview.code)}/capabilities`)}>
                编辑配置
              </Button>
            ) : null}
            <Button onClick={() => setPreview(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => preview && navigate(`/agents/${encodeURIComponent(preview.code)}`)}
            >
              打开完整页
            </Button>
          </>
        }
      >
        {preview ? (
          <>
            <Descriptions
              row
              data={[
                { key: '名称', value: preview.name },
                { key: '编码', value: preview.code },
                {
                  key: '角色类别',
                  value: ROLE_CATEGORY_MAP[preview.roleCategory]?.label ?? preview.roleCategory,
                },
                { key: '角色身份', value: preview.roleIdentity || '—' },
                {
                  key: '状态',
                  value: EMPLOYEE_STATUS_MAP[preview.status]?.label ?? preview.status,
                },
                { key: '模型', value: preview.capability?.model ?? '—' },
                { key: '工具数', value: String(preview.capability?.tools?.length ?? 0) },
                { key: '更新时间', value: preview.updatedAt ?? '—' },
                { key: '职责', value: preview.description || '—' },
              ]}
            />
            <div className="mp-agent-chips">
              {preview.builtin ? (
                <Tag color="yellow" type="light">
                  内置员工
                </Tag>
              ) : null}
              {(preview.capability?.tools ?? []).slice(0, 12).map((t) => (
                <Tag key={String(t)} type="light">
                  {String(t)}
                </Tag>
              ))}
            </div>
          </>
        ) : null}
      </SheetDetail>
    </>
  );
}
