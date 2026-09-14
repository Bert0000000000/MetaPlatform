import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Descriptions, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Eye, Plus, RefreshCw } from 'lucide-react';
import { listCollaborations } from '@/api/dw/collaborations';
import type { CollaborationTask, CollabStatus, SplitStrategy } from '@/api/dw/collaborations';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './agents.css';

/** 一次拉满（后端 size 上限 100），状态与关键词在前端过滤：接口没有这两个查询参数。 */
const FETCH_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

type TagColorName = 'grey' | 'blue' | 'green' | 'red';

const STATUS_META: Record<CollabStatus, { label: string; color: TagColorName }> = {
  pending: { label: '待执行', color: 'grey' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const SPLIT_LABEL: Record<SplitStrategy, string> = {
  sequential: '顺序执行',
  parallel: '并行执行',
  hybrid: '混合',
};

function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

/**
 * 协作编排（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 分页）。
 *
 * 数据面沿用 src/api/dw/collaborations.listCollaborations；
 * 点行弹出非模态 SheetDetail 预检，完整监控页 /agents/collab/:id 仍可深链。
 */
export default function CollaborationListPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<CollaborationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<CollabStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [preview, setPreview] = useState<CollaborationTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listCollaborations({ status: status || undefined, page: 1, pageSize: FETCH_SIZE });
      setRows(res.items ?? []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, status, pageSize]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((t) => {
      if (status && t.status !== status) return false;
      if (!kw) return true;
      return (
        t.title.toLowerCase().includes(kw) ||
        (t.goal ?? '').toLowerCase().includes(kw) ||
        t.collaborationId.toLowerCase().includes(kw)
      );
    });
  }, [rows, keyword, status]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  /**
   * 监控页需要 collaborationId。当前 /dw/collaborations 返回的是 peer-session 形态
   * （id/employee_id/...），没有 collaborationId；缺 id 时不跳转到 /undefined，
   * 而是诚实提示，避免伪造出可用的监控入口。
   */
  const openMonitor = useCallback(
    (task: CollaborationTask) => {
      if (!task.collaborationId) {
        Toast.error('该协作记录未返回 collaborationId，无法打开监控页');
        return;
      }
      navigate(`/agents/collab/${encodeURIComponent(task.collaborationId)}`);
    },
    [navigate],
  );

  const columns = useMemo(
    () => [
      {
        title: '协作任务',
        dataIndex: 'title',
        width: 320,
        ellipsis: true,
        render: (_: unknown, row: CollaborationTask) => (
          <span>
            <span className="mp-agent-name" onClick={() => setPreview(row)}>
              {row.title || row.collaborationId}
            </span>
            {row.goal ? <span className="mp-agent-sub-role"> · {row.goal}</span> : null}
          </span>
        ),
      },
      {
        title: '拆分策略',
        dataIndex: 'splitStrategy',
        width: 120,
        render: (v: SplitStrategy) => <Tag type="light">{SPLIT_LABEL[v] ?? v}</Tag>,
      },
      {
        title: '子任务',
        dataIndex: 'subtasks',
        width: 100,
        render: (_: unknown, row: CollaborationTask) =>
          Array.isArray(row.subtasks) ? (
            <span>{row.subtasks.length} 个</span>
          ) : (
            <span className="mp-agent-line-label">—</span>
          ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: CollabStatus) => (
          <Tag color={STATUS_META[v]?.color ?? 'grey'} type="light">
            {STATUS_META[v]?.label ?? v}
          </Tag>
        ),
      },
      {
        title: '创建',
        dataIndex: 'createdAt',
        width: 180,
        ellipsis: true,
        render: (v?: string) => <span className="mp-agent-line-label">{formatTime(v)}</span>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 120,
        render: (_: unknown, row: CollaborationTask) => (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Eye size={15} strokeWidth={1.5} />}
            onClick={(e) => {
              e.stopPropagation();
              openMonitor(row);
            }}
          >
            监控
          </Button>
        ),
      },
    ],
    [openMonitor],
  );

  const empty = error ? (
    <EmptyState
      illustration="failure"
      title="协作任务加载失败"
      desc={error}
      actions={
        <Button theme="solid" type="primary" onClick={() => void load()}>
          重试
        </Button>
      }
    />
  ) : rows.length === 0 ? (
    <EmptyState
      illustration="no-content"
      title="还没有协作任务"
      desc="创建一个协作任务，让多名数字员工按依赖自动分工。"
      actions={
        <Button theme="solid" type="primary" onClick={() => navigate('/agents/collab/create')}>
          创建协作
        </Button>
      }
    />
  ) : (
    <EmptyState
      illustration="no-result"
      title="没有匹配的协作任务"
      desc="调整关键词或状态筛选。"
    />
  );

  return (
    <>
      <PageHeader
        title="协作编排"
        desc={`${rows.length} 个协作任务 · 系统按员工能力自动分工并生成依赖`}
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
              onClick={() => navigate('/agents/collab/create')}
            >
              创建协作
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索协作任务标题或目标…' }}
        filters={
          <Select value={status} onChange={(v) => setStatus(v as CollabStatus | '')} placeholder="全部状态">
            <Select.Option value="">全部状态</Select.Option>
            {(Object.keys(STATUS_META) as CollabStatus[]).map((s) => (
              <Select.Option key={s} value={s}>
                {STATUS_META[s].label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<CollaborationTask>
        columns={columns}
        dataSource={paged}
        rowKey="collaborationId"
        loading={loading}
        onRow={(row: CollaborationTask) => ({
          onClick: () => setPreview(row),
        })}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        empty={empty}
      />

      <SheetDetail
        title={preview ? `协作任务 · ${preview.title}` : '协作任务'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={
          <>
            <Button onClick={() => setPreview(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => preview && openMonitor(preview)}
            >
              打开监控页
            </Button>
          </>
        }
      >
        {preview ? (
          <Descriptions
            row
            data={[
              { key: '协作 ID', value: preview.collaborationId },
              { key: '标题', value: preview.title || '—' },
              { key: '状态', value: STATUS_META[preview.status]?.label ?? preview.status },
              { key: '拆分策略', value: SPLIT_LABEL[preview.splitStrategy] ?? preview.splitStrategy },
              {
                key: '子任务数',
                value: Array.isArray(preview.subtasks) ? `${preview.subtasks.length} 个` : '—',
              },
              { key: '创建', value: formatTime(preview.createdAt) },
              { key: '开始', value: formatTime(preview.startedAt) },
              { key: '完成', value: formatTime(preview.completedAt) },
              { key: '目标', value: preview.goal || '—' },
              { key: '描述', value: preview.description || '—' },
            ]}
          />
        ) : null}
      </SheetDetail>
    </>
  );
}
