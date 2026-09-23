import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, RefreshCw } from 'lucide-react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { listActionAudit, type ActionAuditRow } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import { ridTail } from '../../rid';
import '../governance.css';
import '../../ontology.css';

/**
 * 审计（IA2-6 治理组）：正式路由 /ontology/governance/audit。
 *
 * <p>**平台级审计汇总**（设计规格 §7.6：治理审计页只做平台级汇总，不能重复一份
 * 独立状态）：统计摘要（总量 / 按动作分布 / 最近活动）+ top 记录速览；
 * Action 执行的**完整明细**在「动作与函数 · 执行记录」（/ontology/logic/runs）
 * ——那里是唯一权威页（IA2-5），本页不复制。
 */
export default function AuditPage() {
  const [rows, setRows] = useState<ActionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listActionAudit(200));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byAction = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.action_rid, (counts.get(r.action_rid) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const landed = rows.filter((r) => Object.keys(r.result ?? {}).length > 0).length;
  const latest = rows[0]?.created_at ?? '—';

  return (
    <>
      <PageHeader
        title="审计"
        desc={`平台级审计汇总 · ${rows.length} 条（最近 200 条窗口）· 明细在执行记录页`}
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
      <div className="mp-gov-card">
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>审计记录（窗口）</dt>
            <dd>{rows.length}</dd>
            <dt>已落库</dt>
            <dd>{landed} / {rows.length}</dd>
            <dt>最近活动</dt>
            <dd>{latest}</dd>
            <dt>动作种类</dt>
            <dd>{byAction.length}</dd>
          </dl>
        </div>

        <div>
          <div className="mp-fw-600 mp-text-sm mp-mb-2">按动作分布（top 8）</div>
          {byAction.length === 0 ? (
            <div className="mp-text-sm mp-text-2">窗口内无审计记录。</div>
          ) : (
            <div className="mp-flex mp-wrap mp-gap-2">
              {byAction.map(([rid, n]) => (
                <Link
                  key={rid}
                  to={`/ontology/logic/runs?action=${encodeURIComponent(rid)}`}
                  className="mp-clickable"
                  title={`查看 ${rid} 的执行明细`}
                >
                  <Tag size="small" type="light">
                    {ridTail(rid)} · {n}
                  </Tag>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mp-fw-600 mp-text-sm mp-mb-2">最近记录速览（前 10 条）</div>
          <DataTablePro<ActionAuditRow>
            columns={[
              {
                title: '时间',
                dataIndex: 'created_at',
                width: 180,
                ellipsis: true,
                render: (v: string) => <span className="mp-onto-muted">{v}</span>,
              },
              {
                title: '动作',
                dataIndex: 'action_rid',
                ellipsis: true,
                render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
              },
              {
                title: '目标实例',
                dataIndex: 'target_iid',
                width: 280,
                ellipsis: true,
                render: (v: string) => <span className="mp-onto-muted">{ridTail(v)}</span>,
              },
            ]}
            dataSource={rows.slice(0, 10)}
            rowKey="audit_id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="窗口内无审计记录"
                desc="经对象浏览执行动作并确认提案后，记录会出现在这里。"
              />
            }
          />
        </div>

        <div className="mp-text-sm mp-text-2 mp-flex-center mp-gap-1">
          <History size={12} />
          完整明细与按动作过滤在
          <Link to="/ontology/logic/runs" className="mp-clickable">
            动作与函数 · 执行记录
          </Link>
        </div>
      </div>
    </>
  );
}
