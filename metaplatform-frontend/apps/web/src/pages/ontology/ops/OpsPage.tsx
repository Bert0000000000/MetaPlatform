import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tabs, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  listActionAudit,
  listSchemaWip,
  type ActionAuditRow,
  type SchemaWipEntry,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import { ridTail } from '../rid';
import '../ontology.css';

/**
 * 运行治理（DESIGN-SPEC §5 版式 E）。
 *
 * 2026-09-17 IA 重排：
 *  - 「数据接入」搬去「数据中心」tab（同步健康与背挂数据源属于数据面，不属于治理）；
 *  - 「治理」从「更多运维工具」下拉收编为同级子 tab（原三层下拉已删除）；
 *  - 「Action 编排」归「概念建模 · 动作类型」；「分析应用」提升为一级 tab。
 */
const GovernancePage = lazy(() => import('../GovernancePage'));

export type OpsKey = 'release' | 'audit' | 'governance';

const PAGE_SIZE = 20;

const OPS_LABEL: Record<OpsKey, string> = {
  release: '版本与发布',
  audit: '变更审计',
  governance: '治理',
};

export interface OpsPageProps {
  /**
   * 初始 tab（IA v2 过渡 Adapter：governance/drafts=release（Schema WIP 草稿表）、
   * logic/runs=audit（Action 执行记录）；IA2-5/2-6 拆分后随容器退役）。
   */
  initialTab?: OpsKey;
}

export default function OpsPage({ initialTab = 'release' }: OpsPageProps) {
  const [tab, setTab] = useState<OpsKey>(initialTab);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [wipRows, setWipRows] = useState<SchemaWipEntry[]>([]);
  const [auditRows, setAuditRows] = useState<ActionAuditRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [wip, audit] = await Promise.allSettled([listSchemaWip(), listActionAudit(200)]);
    setWipRows(wip.status === 'fulfilled' ? wip.value : []);
    setAuditRows(audit.status === 'fulfilled' ? audit.value : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, keyword]);

  const kw = keyword.trim().toLowerCase();
  const match = (s: string) => !kw || s.toLowerCase().includes(kw);

  const filteredWip = useMemo(
    () => wipRows.filter((r) => match(`${r.rid} ${r.author}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wipRows, kw],
  );
  const filteredAudit = useMemo(
    () => auditRows.filter((r) => match(`${r.action_rid} ${r.target_iid} ${r.actor_id} ${r.proposal_id}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auditRows, kw],
  );

  const pageOf = <T,>(rows: T[]) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const empty = (
    <EmptyState
      illustration="no-content"
      title={`没有${OPS_LABEL[tab]}记录`}
      desc={
        tab === 'release'
          ? '当前没有待发布的 Schema WIP（草稿在类型编辑器里暂存后会出现在这里）。'
          : '本租户还没有经 Action 落库的变更。'
      }
    />
  );

  return (
    <>
      <PageHeader
        title={OPS_LABEL[tab]}
        desc={
          tab === 'release'
            ? `${wipRows.length} 条 Schema WIP · 应用后按不可变版本发布`
            : tab === 'audit'
              ? `${auditRows.length} 条 Action 执行记录（最近 200 条）`
              : '类型版本、使用量、反模式检查与执行审计'
        }
        actions={
          tab === 'governance' ? null : (
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
          )
        }
      />

      <Tabs
        type="button"
        activeKey={tab}
        tabList={[
          { tab: `版本与发布 · ${wipRows.length}`, itemKey: 'release' },
          { tab: `变更审计 · ${auditRows.length}`, itemKey: 'audit' },
          { tab: '治理', itemKey: 'governance' },
        ]}
        onChange={(key) => setTab(key as OpsKey)}
      />

      {tab === 'governance' ? (
        <Suspense fallback={<div className="mp-onto-muted mp-p-6">加载治理面板…</div>}>
          <GovernancePage />
        </Suspense>
      ) : (
        <>
          <FilterBar
            search={{ value: keyword, onChange: setKeyword, placeholder: `搜索${OPS_LABEL[tab]}` }}
          />

          {tab === 'release' ? (
            <DataTablePro<SchemaWipEntry>
              columns={[
                {
                  title: '对象类型',
                  dataIndex: '__label__',
                  width: 260,
                  ellipsis: true,
                  render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
                },
                { title: 'rid', dataIndex: 'rid', width: 320, ellipsis: true },
                { title: '作者', dataIndex: 'author', width: 180, ellipsis: true },
                {
                  title: '草稿字段',
                  dataIndex: 'payload',
                  width: 120,
                  render: (v: Record<string, unknown>) => Object.keys(v ?? {}).length,
                },
                {
                  title: '暂存时间',
                  dataIndex: 'created_at',
                  ellipsis: true,
                  render: (v: string | undefined) => <span className="mp-onto-muted">{v ?? '—'}</span>,
                },
              ]}
              dataSource={pageOf(filteredWip)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredWip.length,
                onChange: setPage,
              }}
              empty={empty}
            />
          ) : (
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
                    <Tag size="small" color={Object.keys(v ?? {}).length > 0 ? 'green' : 'grey'} type="light">
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
              dataSource={pageOf(filteredAudit)}
              rowKey="audit_id"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredAudit.length,
                onChange: setPage,
              }}
              empty={empty}
            />
          )}
        </>
      )}
    </>
  );
}
