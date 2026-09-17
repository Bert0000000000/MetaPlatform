import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tabs, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  domainOfObjectType,
  getDatasourceSyncStatus,
  type SyncStatusRow,
} from '@/api/ont/kernel';
import {
  deriveLineageGraph,
  listBigDataSources,
  listCDCTasks,
  listDataProducts,
  SOURCE_TYPE_META,
  type BigDataSource,
  type BigDataSourceStatus,
} from '@/api/ontology-bigdata';
import { LineageGraph, type LineageLayer } from '@/components/graph';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import BackingDatasourcePanel from './BackingDatasourcePanel';
import { ridTail } from '../rid';
import '../canvas.css';
import './datacenter.css';
import '../ontology.css';

const VIEWS = {
  ingest: { title: '数据接入', hint: '同步健康与背挂数据源声明' },
  lineage: { title: '数据血缘', hint: '源系统 → 接入 → Paimon → Iceberg · 端到端数据流' },
  assets: { title: '资产清单', hint: '数据平台控制面登记的数据源' },
} as const;

type ViewKey = keyof typeof VIEWS;

const STATUS_COLOR: Record<BigDataSourceStatus, 'green' | 'red' | 'amber' | 'grey' | 'blue'> = {
  ACTIVE: 'green',
  ERROR: 'red',
  DRAFT: 'amber',
  INACTIVE: 'grey',
  DELETED: 'grey',
};

/**
 * 数据中心（DESIGN-SPEC §5 版式 F：工具条 + 全幅画布 + 浮层详情卡）。
 *
 * 2026-09-17 IA 重排：
 *  - 原「知识图谱」视图迁去「概念建模」（图里画的是模型层，不是数据层）；
 *  - 原在「运维」的「数据接入」迁入本 tab —— 它是数据面的事，不是治理的事；
 *  - 本 tab 因此收敛为纯数据面：接入 / 血缘 / 资产。
 */
export default function DatacenterPage() {
  const [view, setView] = useState<ViewKey>('ingest');

  const [syncRows, setSyncRows] = useState<SyncStatusRow[]>([]);
  const [syncLoading, setSyncLoading] = useState(true);

  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [lineage, setLineage] = useState<{
    nodes: ReturnType<typeof deriveLineageGraph>['nodes'];
    edges: ReturnType<typeof deriveLineageGraph>['edges'];
  }>({ nodes: [], edges: [] });
  const [assetsError, setAssetsError] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [syncKeyword, setSyncKeyword] = useState('');

  // 三条链路刻意分开：同步健康只依赖本体内核，不该被数据平台接口拖住。
  const loadSync = useCallback(async () => {
    setSyncLoading(true);
    const res = await getDatasourceSyncStatus();
    setSyncRows(res);
    setSyncLoading(false);
  }, []);

  const loadDataPlatform = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError('');
    const [sourcesRes, tasksRes, productsRes] = await Promise.allSettled([
      listBigDataSources({}),
      listCDCTasks({}),
      listDataProducts(),
    ]);
    const src = sourcesRes.status === 'fulfilled' ? sourcesRes.value : [];
    setSources(src);
    if (sourcesRes.status !== 'fulfilled') {
      setAssetsError(
        sourcesRes.reason instanceof Error ? sourcesRes.reason.message : String(sourcesRes.reason),
      );
    }
    setLineage(
      deriveLineageGraph(
        src,
        tasksRes.status === 'fulfilled' ? tasksRes.value : [],
        productsRes.status === 'fulfilled' ? productsRes.value : [],
      ),
    );
    setAssetsLoading(false);
  }, []);

  useEffect(() => {
    void loadSync();
  }, [loadSync]);

  useEffect(() => {
    void loadDataPlatform();
  }, [loadDataPlatform]);

  const lineageLayers = useMemo<LineageLayer[]>(() => {
    const titles: Record<string, string> = {
      source: '源系统',
      cdc: '接入 / ODS',
      ods: 'Paimon 明细层',
      ads: 'Iceberg 应用层',
    };
    const order = ['source', 'cdc', 'ods', 'ads'];
    const groups = new Map<string, LineageLayer['nodes']>();
    for (const n of lineage.nodes) {
      const bucket = groups.get(n.layer) ?? [];
      bucket.push({ id: n.id, label: n.name, sub: n.system, highlight: n.layer === 'ods' });
      groups.set(n.layer, bucket);
    }
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({ title: titles[k] ?? k, nodes: groups.get(k) ?? [] }));
  }, [lineage]);

  const lineageFlows = useMemo<Array<[string, string]>>(
    () => lineage.edges.map((e) => [e.source, e.target] as [string, string]),
    [lineage],
  );

  const filteredSync = useMemo(() => {
    const kw = syncKeyword.trim().toLowerCase();
    if (!kw) return syncRows;
    return syncRows.filter((r) =>
      `${r.class_rid} ${domainOfObjectType(r.class_rid)} ${r.last_error ?? ''}`
        .toLowerCase()
        .includes(kw),
    );
  }, [syncRows, syncKeyword]);

  const assetsColumns = useMemo(
    () => [
      {
        title: '数据资产',
        dataIndex: 'name',
        width: 240,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => (
          <span>
            <span className="mp-onto-strong">{row.name}</span>
            {row.description ? <span className="mp-onto-canvas-card-sub"> · {row.description}</span> : null}
          </span>
        ),
      },
      {
        title: '类型',
        dataIndex: 'sourceType',
        width: 120,
        render: (v: BigDataSource['sourceType']) => (
          <Tag size="small" type="light">{SOURCE_TYPE_META[v]?.label ?? v}</Tag>
        ),
      },
      {
        title: '地址',
        dataIndex: 'host',
        width: 220,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => `${row.host}:${row.port}`,
      },
      {
        title: '库 / Schema',
        dataIndex: 'database',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => row.database ?? row.schema ?? '—',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: BigDataSourceStatus) => (
          <Tag size="small" color={STATUS_COLOR[v] ?? 'grey'} type="light">
            {v}
          </Tag>
        ),
      },
      { title: '负责人', dataIndex: 'ownerUserId', width: 160, ellipsis: true },
      { title: '创建时间', dataIndex: 'createdAt', width: 180, ellipsis: true },
    ],
    [],
  );

  const meta = VIEWS[view];
  const syncFailures = syncRows.filter((r) => (r.consecutive_failures ?? 0) > 0).length;

  return (
    <>
      <PageHeader
        title={meta.title}
        desc={
          view === 'ingest'
            ? syncRows.length === 0
              ? '还没有同步记录'
              : `${syncRows.length} 个类型的同步健康快照 · ${syncFailures} 个异常`
            : view === 'lineage'
              ? `${lineage.nodes.length} 节点 · ${lineage.edges.length} 条流 · 派生自数据平台控制面`
              : `${sources.length} 个数据源`
        }
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={view === 'ingest' ? syncLoading : assetsLoading}
            onClick={() => {
              if (view === 'ingest') void loadSync();
              else void loadDataPlatform();
            }}
          >
            刷新
          </Button>
        }
      />

      <Tabs
        type="button"
        activeKey={view}
        tabList={[
          { tab: '数据接入', itemKey: 'ingest' },
          { tab: '数据血缘', itemKey: 'lineage' },
          { tab: '资产清单', itemKey: 'assets' },
        ]}
        onChange={(key) => setView(key as ViewKey)}
      />

      <div className="mp-onto-canvas-stage">
        {view === 'ingest' ? (
          <div className="mp-onto-canvas-scroll">
            <section className="mp-dc-section">
              <h3 className="mp-dc-section-title">背挂数据源</h3>
              <p className="mp-dc-section-desc">{VIEWS.ingest.hint}</p>
              <BackingDatasourcePanel />
            </section>

            <section className="mp-dc-section">
              <h3 className="mp-dc-section-title">同步健康</h3>
              <p className="mp-dc-section-desc">
                每个对象类型的最近一轮同步结果；调度器未启动时为空。
              </p>
              <FilterBar
                search={{
                  value: syncKeyword,
                  onChange: setSyncKeyword,
                  placeholder: '过滤类型、域或错误信息',
                }}
              />
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
                        <Tag size="small" type="light">{domainOfObjectType(row.class_rid)}</Tag>
                      </span>
                    ),
                  },
                  {
                    title: '最近同步',
                    dataIndex: 'last_run_at',
                    width: 190,
                    ellipsis: true,
                    render: (v: string | undefined) => (
                      <span className="mp-onto-muted">{v ?? '从未'}</span>
                    ),
                  },
                  {
                    title: '耗时',
                    dataIndex: 'last_duration_ms',
                    width: 110,
                    render: (v: number | undefined) =>
                      v === undefined || v === null ? (
                        <span className="mp-onto-faint">—</span>
                      ) : (
                        `${v} ms`
                      ),
                  },
                  {
                    title: '连续失败',
                    dataIndex: 'consecutive_failures',
                    width: 110,
                    sorter: (a: SyncStatusRow, b: SyncStatusRow) =>
                      (a.consecutive_failures ?? 0) - (b.consecutive_failures ?? 0),
                    render: (v: number | undefined) => <span className="mp-onto-num">{v ?? 0}</span>,
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
                dataSource={filteredSync}
                rowKey="class_rid"
                loading={syncLoading}
                empty={
                  <EmptyState
                    illustration="no-content"
                    title="还没有同步记录"
                    desc="在上方声明背挂数据源并触发同步后，这里会出现健康快照。"
                  />
                }
              />
            </section>
          </div>
        ) : null}

        {view === 'lineage' ? (
          lineageLayers.length === 0 ? (
            <div className="mp-onto-canvas-scroll">
              <EmptyState
                illustration="no-content"
                title="暂无可派生的血缘"
                desc="数据平台里还没有登记数据源 / CDC 任务 / 数据产品。"
              />
            </div>
          ) : (
            <>
              <LineageGraph layers={lineageLayers} flows={lineageFlows} />
              <div className="mp-onto-canvas-hint">{VIEWS.lineage.hint}</div>
            </>
          )
        ) : null}

        {view === 'assets' ? (
          <div className="mp-onto-canvas-scroll">
            <DataTablePro<BigDataSource>
              columns={assetsColumns}
              dataSource={sources}
              rowKey="sourceId"
              loading={assetsLoading}
              empty={
                assetsError ? (
                  <EmptyState illustration="failure" title="数据源加载失败" desc={assetsError} />
                ) : (
                  <EmptyState
                    illustration="no-content"
                    title="还没有登记数据源"
                    desc="在数据平台接入第一份数据源后，这里会出现资产清单。"
                  />
                )
              }
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
