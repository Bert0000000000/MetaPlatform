import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { listActionAudit, type ActionAuditRow } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import { ridTail } from '../../rid';
import '../../ontology.css';

const PAGE_SIZE = 20;

/**
 * 执行记录（IA2-5 自 OpsPage 的 audit tab 抽出为唯一权威页）：
 * 正式路由 /ontology/logic/runs。支持 ?action=<rid> 深链过滤
 * （ActionType 详情「运行记录」页签的放大视图）。
 */
export default function ActionRunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const actionFilter = searchParams.get('action') ?? '';

  const [rows, setRows] = useState<ActionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listActionAudit(200, actionFilter || undefined));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, actionFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      `${r.action_rid} ${r.target_iid} ${r.actor_id} ${r.proposal_id}`.toLowerCase().includes(kw),
    );
  }, [rows, keyword]);

  const pageOf = (list: ActionAuditRow[]) =>
    list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearActionFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="执行记录"
        desc={
          actionFilter
            ? `按动作过滤 · ${ridTail(actionFilter)} · ${rows.length} 条（最近 200 条窗口）`
            : `${rows.length} 条 Action 执行记录（最近 200 条窗口）`
        }
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

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索动作、实例、执行者或提案' }}
        filters={
          actionFilter ? (
            <Tag color="blue" type="light" closable onClose={clearActionFilter}>
              动作：{ridTail(actionFilter)}
            </Tag>
          ) : null
        }
      />

      <DataTablePro<ActionAuditRow>
        columns={[
          {
            title: '动作',
            dataIndex: 'action_rid',
            width: 240,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
          },
          {
            title: '目标实例',
            dataIndex: 'target_iid',
            width: 300,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-muted">{ridTail(v)}</span>,
          },
          { title: '执行者', dataIndex: 'actor_id', width: 200, ellipsis: true },
          {
            title: '提案',
            dataIndex: 'proposal_id',
            width: 220,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-faint">{v}</span>,
          },
          {
            title: '结果',
            dataIndex: 'result',
            width: 120,
            render: (v: Record<string, unknown>) => (
              <Tag
                size="small"
                color={Object.keys(v ?? {}).length > 0 ? 'green' : 'grey'}
                type="light"
              >
                {Object.keys(v ?? {}).length > 0 ? '已落库' : '空'}
              </Tag>
            ),
          },
          {
            title: '时间',
            dataIndex: 'created_at',
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-muted">{v}</span>,
          },
        ]}
        dataSource={pageOf(filtered)}
        rowKey="audit_id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          onChange: setPage,
        }}
        empty={
          <EmptyState
            illustration="no-content"
            title={actionFilter ? '该动作还没有执行记录' : '本租户还没有经 Action 落库的变更'}
            desc="经对象浏览执行动作并确认提案后，记录会出现在这里。"
          />
        }
      />
    </>
  );
}
