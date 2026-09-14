import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Tabs, Tag } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, RefreshCw } from 'lucide-react';
import {
  domainOfObjectType,
  getDatasourceSyncStatus,
  listActionAudit,
  listSchemaWip,
  type ActionAuditRow,
  type SchemaWipEntry,
  type SyncStatusRow,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import { ridTail } from '../rid';
import '../ontology.css';

type OpsKey = 'ingest' | 'release' | 'audit';

const PAGE_SIZE = 20;

/** 尚未重写的既有运维面（P2 收编前先保留可达）。 */
const LEGACY_OPS: Array<{ label: string; path: string }> = [
  { label: 'Action 编排', path: '/ontology/ops/actions' },
  { label: '治理', path: '/ontology/ops/governance' },
  { label: '分析应用', path: '/ontology/ops/analytics' },
];

const OPS_LABEL: Record<OpsKey, string> = {
  ingest: '数据接入',
  release: '版本与发布',
  audit: '变更审计',
};

/**
 * 运维（DESIGN-SPEC §5 版式 E）。
 * 三个子 tab 全部落在真实运维面上：同步健康 / Schema WIP / Action 审计，
 * 没有对应数据的场景如实显示空状态（调度器未启动时同步面就是空的）。
 */
export default function OpsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<OpsKey>('ingest');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [syncRows, setSyncRows] = useState<SyncStatusRow[]>([]);
  const [wipRows, setWipRows] = useState<SchemaWipEntry[]>([]);
  const [auditRows, setAuditRows] = useState<ActionAuditRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [sync, wip, audit] = await Promise.allSettled([
      getDatasourceSyncStatus(),
      listSchemaWip(),
      listActionAudit(200),
    ]);
    setSyncRows(sync.status === 'fulfilled' ? sync.value : []);
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

  const filteredSync = useMemo(
    () => syncRows.filter((r) => match(`${r.class_rid} ${domainOfObjectType(r.class_rid)} ${r.last_error ?? ''}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncRows, kw],
  );
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
        tab === 'ingest'
          ? '调度器尚未跑过同步任务，或本租户还没有接数据源。'
          : tab === 'release'
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
          tab === 'ingest'
            ? `${syncRows.length} 个类型的同步健康快照 · 取自 /datasources/sync-status`
            : tab === 'release'
              ? `${wipRows.length} 条 Schema WIP · 应用后按不可变版本发布`
              : `${auditRows.length} 条 Action 执行记录（最近 200 条）`
        }
        actions={
          <>
            {/* 三个尚未重写的既有运维面：保留可达（深链 + 这里入口），P2 收编 */}
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  {LEGACY_OPS.map((item) => (
                    <Dropdown.Item key={item.path} onClick={() => navigate(item.path)}>
                      {item.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button icon={<MoreHorizontal size={15} strokeWidth={1.5} />}>更多运维工具</Button>
            </Dropdown>
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

      <Tabs
        type="button"
        activeKey={tab}
        tabList={[
          { tab: `数据接入 · ${syncRows.length}`, itemKey: 'ingest' },
          { tab: `版本与发布 · ${wipRows.length}`, itemKey: 'release' },
          { tab: `变更审计 · ${auditRows.length}`, itemKey: 'audit' },
        ]}
        onChange={(key) => setTab(key as OpsKey)}
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: `搜索${OPS_LABEL[tab]}` }} />

      {tab === 'ingest' ? (
        <DataTablePro<SyncStatusRow>
          columns={[
            {
              title: '对象类型',
              dataIndex: 'class_rid',
              width: 320,
              ellipsis: true,
              render: (_: unknown, row: SyncStatusRow) => (
                <span>
                  <span className="mp-onto-strong">{ridTail(row.class_rid)}</span>{' '}
                  <Tag type="light">{domainOfObjectType(row.class_rid)}</Tag>
                </span>
              ),
            },
            {
              title: '最近同步',
              dataIndex: 'last_run_at',
              width: 190,
              ellipsis: true,
              render: (v: string | undefined) => <span className="mp-onto-muted">{v ?? '从未'}</span>,
            },
            {
              title: '耗时',
              dataIndex: 'last_duration_ms',
              width: 110,
              render: (v: number | undefined) =>
                v === undefined || v === null ? <span className="mp-onto-faint">—</span> : `${v} ms`,
            },
            {
              title: '连续失败',
              dataIndex: 'consecutive_failures',
              width: 110,
              sorter: (a: SyncStatusRow, b: SyncStatusRow) =>
                (a.consecutive_failures ?? 0) - (b.consecutive_failures ?? 0),
              render: (v: number | undefined) => (
                <span className="mp-onto-num">{v ?? 0}</span>
              ),
            },
            {
              title: '状态',
              dataIndex: 'last_error',
              width: 140,
              render: (v: string | undefined) =>
                v ? (
                  <Tag color="red" type="light">
                    失败
                  </Tag>
                ) : (
                  <Tag color="green" type="light">
                    正常
                  </Tag>
                ),
            },
            {
              title: '最近错误',
              dataIndex: 'last_error',
              ellipsis: true,
              render: (v: string | undefined) => (
                <span className="mp-onto-muted">{v || '—'}</span>
              ),
            },
          ]}
          dataSource={pageOf(filteredSync)}
          rowKey="class_rid"
          loading={loading}
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total: filteredSync.length,
            onChange: setPage,
          }}
          empty={empty}
        />
      ) : tab === 'release' ? (
        <DataTablePro<SchemaWipEntry>
          columns={[
            {
              title: '对象类型',
              dataIndex: 'rid',
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
                <Tag color={Object.keys(v ?? {}).length > 0 ? 'green' : 'grey'} type="light">
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
  );
}
