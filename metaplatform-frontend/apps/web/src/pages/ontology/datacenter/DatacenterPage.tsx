import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Dropdown, Input, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { Filter, RefreshCw, Search, Tag as TagIcon } from 'lucide-react';
import {
  domainOfObjectType,
  listLinkTypes,
  listObjectTypes,
  propSlug,
  type KernelLinkType,
  type KernelObjectType,
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
import { ForceGraph, LineageGraph, type ForceGraphNode, type LineageLayer } from '@/components/graph';
import { DataTablePro, EmptyState } from '@/components/skeleton';
import { ridTail } from '../rid';
import './datacenter.css';
import '../ontology.css';

/** 分类配色：对象域 → 5 个语义/分类 token（DESIGN-SPEC §4.3 分类两色 + 语义三色）。 */
const DOMAIN_COLORS = [
  'var(--semi-color-primary)',
  'var(--semi-color-purple)',
  'var(--semi-color-cyan)',
  'var(--semi-color-warning)',
  'var(--semi-color-success)',
  'var(--semi-color-danger)',
];

const VIEWS = {
  graph: { title: '知识图谱', hint: '拖拽节点可固定位置 · 悬停高亮邻接 · 点击查看详情' },
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
 * 三个视图全部由真实数据驱动：
 *  - 知识图谱：ObjectType 为节点、LinkType 为边（本体即图谱）
 *  - 数据血缘：数据平台控制面 source/CDC/product 派生（deriveLineageGraph）
 *  - 资产清单：listBigDataSources 的表格
 * 原「知识图谱 / 数据中心」两个旧 tab 收敛到这里。
 */
export default function DatacenterPage() {
  const [view, setView] = useState<ViewKey>('graph');

  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [links, setLinks] = useState<KernelLinkType[]>([]);
  const [ontologyError, setOntologyError] = useState('');
  const [ontologyLoading, setOntologyLoading] = useState(true);

  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [lineage, setLineage] = useState<{ nodes: ReturnType<typeof deriveLineageGraph>['nodes']; edges: ReturnType<typeof deriveLineageGraph>['edges'] }>({ nodes: [], edges: [] });
  const [assetsError, setAssetsError] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [hiddenDomains, setHiddenDomains] = useState<string[]>([]);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [relayoutToken, setRelayoutToken] = useState(0);
  const [selected, setSelected] = useState<ForceGraphNode | null>(null);

  // 两条加载链路刻意分开：知识图谱只依赖本体内核，不该被数据平台接口拖住；
  // 数据平台慢/挂时血缘与资产清单各自降级为空态，图谱照常可用。
  const loadOntology = useCallback(async () => {
    setOntologyLoading(true);
    setOntologyError('');
    const [typesRes, linksRes] = await Promise.allSettled([listObjectTypes(), listLinkTypes()]);
    if (typesRes.status === 'fulfilled') {
      setTypes(typesRes.value);
    } else {
      setTypes([]);
      setOntologyError(typesRes.reason instanceof Error ? typesRes.reason.message : String(typesRes.reason));
    }
    setLinks(linksRes.status === 'fulfilled' ? linksRes.value : []);
    setOntologyLoading(false);
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

  const reloadAll = useCallback(() => {
    void loadOntology();
    void loadDataPlatform();
  }, [loadOntology, loadDataPlatform]);

  useEffect(() => {
    void loadOntology();
  }, [loadOntology]);

  useEffect(() => {
    void loadDataPlatform();
  }, [loadDataPlatform]);

  // ── 本体 → 图谱 ──
  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const t of types) set.add(domainOfObjectType(t.rid) || 'other');
    return Array.from(set).sort();
  }, [types]);

  const graphTypes = useMemo(
    () =>
      Object.fromEntries(
        domains.map((d, i) => [d, { label: d, color: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }]),
      ) as Record<string, { label: string; color: string }>,
    [domains],
  );

  const graphData = useMemo(() => {
    const nodes: ForceGraphNode[] = types.map((t) => ({
      id: t.rid,
      label: t.display_name || propSlug(t.rid),
      type: domainOfObjectType(t.rid) || 'other',
    }));
    const known = new Set(nodes.map((n) => n.id));
    const edges = links
      .filter((l) => known.has(l.src) && known.has(l.dst))
      .map((l) => ({ source: l.src, target: l.dst, label: ridTail(l.rid) }));
    return { nodes, edges };
  }, [types, links]);

  const selectedType = useMemo(
    () => types.find((t) => t.rid === selected?.id) ?? null,
    [types, selected],
  );

  // ── 血缘 → 分层 ──
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
            {row.description ? <span className="mp-dc-card-sub"> · {row.description}</span> : null}
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

  return (
    <div className="mp-page-full mp-datacenter">
      <div className="mp-dc-toolbar">
        <h2 className="mp-dc-title">{VIEWS[view].title}</h2>
        <span className="mp-dc-meta">
          {view === 'graph'
            ? `${graphData.nodes.length} 类型 · ${graphData.edges.length} 关系 · 实时读取本体内核`
            : view === 'lineage'
              ? `${lineage.nodes.length} 节点 · ${lineage.edges.length} 条流 · 派生自数据平台控制面`
              : `${sources.length} 个数据源`}
        </span>

        <Tabs
          type="button"
          activeKey={view}
          tabList={[
            { tab: '知识图谱', itemKey: 'graph' },
            { tab: '数据血缘', itemKey: 'lineage' },
            { tab: '资产清单', itemKey: 'assets' },
          ]}
          onChange={(key) => setView(key as ViewKey)}
        />

        {view === 'graph' ? (
          <Input
            className="mp-dc-search"
            prefix={<Search size={14} strokeWidth={1.5} />}
            placeholder="搜索节点…"
            value={query}
            onChange={setQuery}
            showClear
          />
        ) : null}

        <span className="mp-dc-grow" />

        {view === 'graph' ? (
          <>
            {/* 对象域数量随租户增长（本例 27 个），做成下拉而不是铺一行 chip，守住控件预算纪律 */}
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <div className="mp-dc-legend-menu">
                  <div className="mp-dc-legend-head">
                    <span className="mp-dc-legend-title">对象域过滤</span>
                    <Button
                      theme="borderless"
                      type="primary"
                      size="small"
                      onClick={() => setHiddenDomains([])}
                    >
                      全选
                    </Button>
                  </div>
                  <div className="mp-dc-legend-list">
                    {domains.map((d) => (
                      <Checkbox
                        key={d}
                        checked={!hiddenDomains.includes(d)}
                        onChange={() =>
                          setHiddenDomains((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                      >
                        <span className="mp-dc-legend-chip">
                          <span
                            className="mp-dc-legend-dot"
                            ref={(el) => {
                              if (el) {
                                el.style.setProperty('--mp-dc-dot', graphTypes[d]?.color ?? DOMAIN_COLORS[0]);
                              }
                            }}
                          />
                          {d}
                        </span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
              }
            >
              <Button icon={<Filter size={15} strokeWidth={1.5} />}>
                域过滤 · {domains.length - hiddenDomains.length}/{domains.length}
              </Button>
            </Dropdown>
            <Button
              icon={<TagIcon size={15} strokeWidth={1.5} />}
              theme={showEdgeLabels ? 'solid' : 'light'}
              type={showEdgeLabels ? 'primary' : 'tertiary'}
              onClick={() => setShowEdgeLabels((v) => !v)}
            >
              关系标签
            </Button>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              onClick={() => {
                setRelayoutToken((n) => n + 1);
                Toast.info('已重新布局');
              }}
            >
              重新布局
            </Button>
          </>
        ) : (
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            onClick={reloadAll}
            loading={ontologyLoading}
          >
            刷新
          </Button>
        )}
      </div>

      <div className="mp-dc-stage">
        {view === 'graph' ? (
          graphData.nodes.length === 0 ? (
            <div className="mp-dc-stage-scroll">
              <EmptyState
                illustration={ontologyError ? 'failure' : 'no-content'}
                title={ontologyError ? '本体内核读取失败' : '本体里还没有对象类型'}
                desc={ontologyError || '先在「类型建模」里创建 ObjectType 与 LinkType，图谱会自动长出来。'}
                actions={
                  <Button theme="solid" type="primary" onClick={() => void loadOntology()}>
                    重试
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <ForceGraph
                nodes={graphData.nodes}
                edges={graphData.edges}
                types={graphTypes}
                hiddenTypes={hiddenDomains}
                showEdgeLabels={showEdgeLabels}
                searchQuery={query}
                relayoutToken={relayoutToken}
                selectedId={selected?.id}
                onSelect={setSelected}
                height={640}
              />
              <div className="mp-dc-stage-hint">{VIEWS.graph.hint}</div>
              {selected ? (
                <Card
                  className="mp-dc-card"
                  title={
                    <span className="mp-dc-card-head">
                      <span className="mp-dc-card-name">{selected.label}</span>
                      <Button
                        theme="borderless"
                        type="tertiary"
                        size="small"
                        onClick={() => setSelected(null)}
                      >
                        关闭
                      </Button>
                    </span>
                  }
                >
                  <div className="mp-dc-card-sub">
                    {graphTypes[selected.type]?.label ?? selected.type} ·{' '}
                    {graphData.edges.filter((e) => e.source === selected.id || e.target === selected.id).length} 个关系
                  </div>
                  <div className="mp-dc-card-props">
                    {selectedType ? (
                      <>
                        <Tag type="light">{selectedType.properties.length} 属性</Tag>
                        <Tag type="light">{selectedType.primary_key.join(' + ') || '无主键'}</Tag>
                        {selectedType.status ? <Tag type="light">{selectedType.status}</Tag> : null}
                        {(selectedType.interfaces ?? []).slice(0, 3).map((i) => (
                          <Tag key={i} type="light">
                            {ridTail(i)}
                          </Tag>
                        ))}
                      </>
                    ) : null}
                  </div>
                </Card>
              ) : null}
            </>
          )
        ) : null}

        {view === 'lineage' ? (
          lineageLayers.length === 0 ? (
            <div className="mp-dc-stage-scroll">
              <EmptyState
                illustration="no-content"
                title="暂无可派生的血缘"
                desc="数据平台里还没有登记数据源 / CDC 任务 / 数据产品。"
              />
            </div>
          ) : (
            <>
              <LineageGraph layers={lineageLayers} flows={lineageFlows} />
              <div className="mp-dc-stage-hint">{VIEWS.lineage.hint}</div>
            </>
          )
        ) : null}

        {view === 'assets' ? (
          <div className="mp-dc-stage-scroll">
            <DataTablePro<BigDataSource>
              columns={assetsColumns}
              dataSource={sources}
              rowKey="sourceId"
              loading={assetsLoading}
              empty={
                assetsError ? (
                  <EmptyState illustration="failure" title="数据源加载失败" desc={assetsError} />
                ) : (
                  <EmptyState illustration="no-content" title="还没有登记数据源" desc="在数据平台接入第一份数据源后，这里会出现资产清单。" />
                )
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
