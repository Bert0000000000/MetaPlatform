import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
} from '@douyinfe/semi-ui';
import { Network, RefreshCw, Rows3, Shuffle } from 'lucide-react';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import type { Capability } from '@/api/arch/types';
import { getCapabilityTree } from '@/api/arch/capabilities';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  SplitPane,
} from '@/components/skeleton';
import { ForceGraph, type ForceGraphEdge, type ForceGraphNode } from '@/components/graph';

const { Text } = Typography;

const PAGE_SIZE = 20;

type ViewMode = 'map' | 'list';
type LevelFilter = 'all' | '1' | '2' | '3';

const VIEW_OPTIONS = [
  { value: 'map', label: '能力地图' },
  { value: 'list', label: '能力列表' },
] as const;

const LEVEL_OPTIONS = [
  { value: 'all', label: '全部层级' },
  { value: '1', label: '仅 L1' },
  { value: '2', label: '仅 L2' },
  { value: '3', label: '仅 L3' },
] as const;

/** 层级 → Semi Tag 语义色（Semi 官方调色板，不写裸色值）。 */
const LEVEL_TAG_COLOR: Record<number, 'blue' | 'green' | 'orange'> = {
  1: 'blue',
  2: 'green',
  3: 'orange',
};

/** 层级 → 图谱节点色（一律取 DSM 注入的 --semi-color-* 令牌）。 */
const GRAPH_TYPES: Record<string, { label: string; color: string }> = {
  L1: { label: 'L1 业务域', color: 'var(--semi-color-primary)' },
  L2: { label: 'L2 能力组', color: 'var(--semi-color-success)' },
  L3: { label: 'L3 能力项', color: 'var(--semi-color-warning)' },
};

const STATUS_META: Record<string, { label: string; color: 'green' | 'blue' | 'grey' }> = {
  active: { label: '已激活', color: 'green' },
  planned: { label: '规划中', color: 'blue' },
  deprecated: { label: '已弃用', color: 'grey' },
};

function statusMeta(status: string | undefined): { label: string; color: 'green' | 'blue' | 'grey' } {
  return STATUS_META[status ?? ''] ?? { label: status ?? '—', color: 'grey' };
}

function levelTagColor(level: number): 'blue' | 'green' | 'orange' | 'grey' {
  return LEVEL_TAG_COLOR[level] ?? 'grey';
}

function formatTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN');
}

/**
 * ARCH 能力树实际下发的节点主键是 `id`（类型声明写的是 `capabilityId`），
 * 且不下发父指针。这里做一次无损归一化：补 capabilityId，父 id 由遍历过程推导，
 * 不新增任何后端没有的字段。
 */
function normalizeTree(nodes: Capability[], parentId?: string): Capability[] {
  return nodes.map((n) => {
    const raw = n as Capability & { id?: string };
    const id = raw.capabilityId ?? raw.id ?? '';
    return {
      ...n,
      capabilityId: id,
      parentCapabilityId: raw.parentCapabilityId ?? parentId,
      children:
        Array.isArray(n.children) && n.children.length > 0
          ? normalizeTree(n.children, id)
          : undefined,
    };
  });
}

/** 前序展平能力树（保留层级顺序，供列表视图与查表使用）。 */
function flattenTree(caps: Capability[]): Capability[] {
  const out: Capability[] = [];
  const walk = (list: Capability[]) => {
    for (const c of list) {
      out.push(c);
      if (c.children?.length) walk(c.children);
    }
  };
  walk(caps);
  return out;
}

/** 含自身在内的子树节点数。 */
function countSubtree(node: Capability): number {
  let count = 1;
  for (const child of node.children ?? []) count += countSubtree(child);
  return count;
}

/**
 * 把 Capability[] 转成 Semi Tree 的 treeData：按关键字保留命中节点及其祖先链。
 * 关键字为空时原样返回，不做任何本地拼装。
 */
function buildTreeData(caps: Capability[], keyword: string): TreeNodeData[] {
  const kw = keyword.trim().toLowerCase();
  const match = (c: Capability) =>
    !kw || c.name.toLowerCase().includes(kw) || (c.code ?? '').toLowerCase().includes(kw);

  const walk = (c: Capability): TreeNodeData | null => {
    const matchedKids = (c.children ?? [])
      .map(walk)
      .filter((n): n is TreeNodeData => n !== null);
    if (!match(c) && matchedKids.length === 0) return null;
    return {
      key: c.capabilityId,
      label: (
        <Space spacing={6}>
          <Tag size="small" color={levelTagColor(c.level)}>
            L{c.level}
          </Tag>
          <span>{c.name}</span>
        </Space>
      ),
      children: matchedKids,
    };
  };

  return caps.map(walk).filter((n): n is TreeNodeData => n !== null);
}

/**
 * 业务架构总览（数据与治理 / 业务架构 主 tab）。
 *
 * 版式：页头 + 筛选栏 + 两栏浏览器（左能力树 / 右能力地图或能力列表），
 * 详情走 456px 非模态 Preview Sheet，选中即可继续浏览，不打断上下文。
 *
 * 数据面只有一条：`getCapabilityTree()`（ARCH 能力树 L1–L3）。
 * 能力地图为共享图组件 ForceGraph（节点 = 能力，边 = 父子关系），不手绘 SVG。
 */
export default function BusinessArchPage() {
  const navigate = useNavigate();

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState<ViewMode>('map');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [relayoutToken, setRelayoutToken] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const caps = await getCapabilityTree();
      setCapabilities(Array.isArray(caps) ? normalizeTree(caps) : []);
    } catch (e) {
      setCapabilities([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, levelFilter, view]);

  const flat = useMemo(() => flattenTree(capabilities), [capabilities]);
  const byId = useMemo(() => new Map(flat.map((c) => [c.capabilityId, c])), [flat]);

  const counts = useMemo(() => {
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    for (const c of flat) {
      if (c.level === 1) l1 += 1;
      else if (c.level === 2) l2 += 1;
      else if (c.level === 3) l3 += 1;
    }
    return { total: flat.length, l1, l2, l3 };
  }, [flat]);

  const treeData = useMemo(() => buildTreeData(capabilities, keyword), [capabilities, keyword]);

  // 数据异步到达时 defaultExpandAll 不会补展开：首屏由受控 expandedKeys 展开 L1。
  useEffect(() => {
    if (capabilities.length === 0) return;
    setExpandedKeys(capabilities.map((c) => c.capabilityId));
    setActiveKey((prev) => prev ?? capabilities[0].capabilityId);
  }, [capabilities]);

  // 搜索时把命中路径全部展开，避免结果藏在折叠节点里。
  useEffect(() => {
    if (!keyword.trim()) return;
    const keys: string[] = [];
    const walk = (nodes: TreeNodeData[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          keys.push(String(n.key));
          walk(n.children);
        }
      }
    };
    walk(treeData);
    setExpandedKeys(keys);
  }, [keyword, treeData]);

  /** 选中任一能力：高亮地图节点 + 打开非模态详情浮层。 */
  const select = useCallback((id: string) => {
    setActiveKey(id);
    setDetailId(id);
  }, []);

  const graphData = useMemo(() => {
    const nodes: ForceGraphNode[] = [];
    const edges: ForceGraphEdge[] = [];
    const walk = (list: Capability[]) => {
      for (const c of list) {
        nodes.push({ id: c.capabilityId, label: c.name, type: `L${c.level}` });
        for (const child of c.children ?? []) {
          edges.push({ source: c.capabilityId, target: child.capabilityId });
        }
        if (c.children?.length) walk(c.children);
      }
    };
    walk(capabilities);
    return { nodes, edges };
  }, [capabilities]);

  const hiddenTypes = useMemo(
    () => (levelFilter === 'all' ? [] : Object.keys(GRAPH_TYPES).filter((t) => t !== `L${levelFilter}`)),
    [levelFilter],
  );

  /** 层级过滤 + 搜索命中后实际可见的节点与父子关系（与 ForceGraph 自身的过滤规则一致）。 */
  const visibleGraph = useMemo(() => {
    const kw = keyword.trim();
    const nodes = graphData.nodes.filter(
      (n) => !hiddenTypes.includes(n.type) && (!kw || n.label.includes(kw)),
    );
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graphData.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges, isFiltered: kw !== '' || levelFilter !== 'all' };
  }, [graphData, hiddenTypes, keyword, levelFilter]);

  const parentNameOf = useCallback(
    (row: Capability): string => {
      if (row.parentName) return row.parentName;
      if (row.parentCapabilityId) return byId.get(row.parentCapabilityId)?.name ?? '—';
      return '—';
    },
    [byId],
  );

  const listRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return flat.filter((c) => {
      if (levelFilter !== 'all' && String(c.level) !== levelFilter) return false;
      if (!kw) return true;
      return c.name.toLowerCase().includes(kw) || (c.code ?? '').toLowerCase().includes(kw);
    });
  }, [flat, keyword, levelFilter]);

  const pagedRows = useMemo(
    () => listRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [listRows, page],
  );

  const detail = detailId ? (byId.get(detailId) ?? null) : null;
  const detailChildren = detail?.children ?? [];

  const columns = useMemo(
    () => [
      {
        title: '能力',
        dataIndex: 'name',
        width: 280,
        render: (_: unknown, row: Capability) => (
          <Space spacing={6}>
            <Tag size="small" color={levelTagColor(row.level)}>
              L{row.level}
            </Tag>
            <span>{row.name}</span>
          </Space>
        ),
      },
      {
        title: '编码',
        dataIndex: 'code',
        width: 190,
        ellipsis: true,
        render: (v: string | undefined) => <Text type="secondary">{v || '—'}</Text>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string | undefined) => {
          const meta = statusMeta(v);
          return (
            <Tag size="small" type="light" color={meta.color}>
              {meta.label}
            </Tag>
          );
        },
      },
      {
        title: '父能力',
        dataIndex: 'parentCapabilityId',
        width: 240,
        ellipsis: true,
        render: (_: unknown, row: Capability) => <Text type="secondary">{parentNameOf(row)}</Text>,
      },
      {
        title: '直接下级',
        dataIndex: 'children',
        width: 100,
        render: (_: unknown, row: Capability) => (
          <Text type="secondary">{row.children?.length ?? 0}</Text>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 200,
        ellipsis: true,
        render: (v: string | undefined) => <Text type="secondary">{formatTime(v)}</Text>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 90,
        render: (_: unknown, row: Capability) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => select(row.capabilityId)}>
            详情
          </Button>
        ),
      },
    ],
    [parentNameOf, select],
  );

  const childColumns = useMemo(
    () => [
      {
        title: '层级',
        dataIndex: 'level',
        width: 80,
        render: (v: number) => (
          <Tag size="small" color={levelTagColor(v)}>
            L{v}
          </Tag>
        ),
      },
      { title: '名称', dataIndex: 'name', ellipsis: true },
      {
        title: '编码',
        dataIndex: 'code',
        width: 150,
        ellipsis: true,
        render: (v: string | undefined) => <Text type="secondary">{v || '—'}</Text>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 70,
        render: (_: unknown, row: Capability) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => select(row.capabilityId)}>
            查看
          </Button>
        ),
      },
    ],
    [select],
  );

  const treePane = (
    <>
      <div className="mp-pane-title">能力树 · L1–L3</div>
      <div className="mp-pane-scroll">
        {error ? (
          <div className="mp-pane-block">
            <EmptyState
              illustration="failure"
              title="能力树加载失败"
              desc={error}
              actions={
                <Button theme="solid" type="primary" onClick={() => void load()}>
                  重试
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="mp-pane-block">
            <Spin spinning />
          </div>
        ) : treeData.length === 0 ? (
          <div className="mp-pane-block">
            <EmptyState
              illustration={keyword.trim() ? 'no-result' : 'no-content'}
              title={keyword.trim() ? '没有匹配的能力' : '暂无能力'}
              desc={
                keyword.trim()
                  ? '调整关键字，或在右侧切换视图继续浏览。'
                  : 'ARCH 能力树尚未登记任何节点。'
              }
            />
          </div>
        ) : (
          <Tree
            treeData={treeData}
            showLine
            value={activeKey ?? undefined}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            onSelect={(key) => {
              const id = typeof key === 'string' ? key : String(key);
              if (id) select(id);
            }}
          />
        )}
      </div>
    </>
  );

  const main = error ? (
    <EmptyState
      illustration="failure"
      title="业务架构加载失败"
      desc={error}
      actions={
        <Button theme="solid" type="primary" onClick={() => void load()}>
          重试
        </Button>
      }
    />
  ) : !loading && capabilities.length === 0 ? (
    <EmptyState
      illustration="no-content"
      title="暂无架构数据"
      desc="ARCH 能力树为空，请先在「业务能力」页登记 L1–L3 能力。"
      actions={
        <Button theme="solid" type="primary" onClick={() => navigate('/gov/business/capabilities')}>
          前往业务能力
        </Button>
      }
    />
  ) : view === 'map' ? (
    <Card
      title="能力地图"
      headerExtraContent={
        <>
          <Tag type="light">
            {visibleGraph.nodes.length}
            {visibleGraph.isFiltered ? ` / ${graphData.nodes.length}` : ''} 个节点 ·{' '}
            {visibleGraph.edges.length} 条父子关系
          </Tag>
          <Button
            icon={<Shuffle size={15} strokeWidth={1.5} />}
            onClick={() => setRelayoutToken((t) => t + 1)}
          >
            重新布局
          </Button>
        </>
      }
    >
      <Spin spinning={loading}>
        {!loading && visibleGraph.nodes.length === 0 ? (
          <EmptyState
            illustration="no-result"
            title={keyword.trim() ? '没有匹配的能力节点' : '当前层级没有节点'}
            desc={
              keyword.trim()
                ? '换个关键字，或清空搜索框。'
                : '把层级过滤切回「全部层级」查看完整地图。'
            }
          />
        ) : (
          <ForceGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            types={GRAPH_TYPES}
            hiddenTypes={hiddenTypes}
            searchQuery={keyword.trim()}
            relayoutToken={relayoutToken}
            selectedId={activeKey ?? undefined}
            onSelect={(node) => {
              if (node) select(node.id);
            }}
            height={560}
          />
        )}
      </Spin>
    </Card>
  ) : (
    <DataTablePro<Capability>
      columns={columns}
      dataSource={pagedRows}
      rowKey="capabilityId"
      loading={loading}
      pagination={{
        currentPage: page,
        pageSize: PAGE_SIZE,
        total: listRows.length,
        onChange: setPage,
      }}
      onRow={(record) => ({ onClick: () => select(record.capabilityId) })}
      empty={
        <EmptyState
          illustration="no-result"
          title="没有匹配的能力"
          desc="调整关键字或层级过滤，或在左侧能力树中换个分支。"
        />
      }
    />
  );

  return (
    <>
      <PageHeader
        title="业务架构"
        desc={
          counts.total
            ? `${counts.l1} 个 L1 业务域 · ${counts.l2} 个 L2 能力组 · ${counts.l3} 个 L3 能力项`
            : 'L1–L3 能力树 · 数据来自 ARCH 服务'
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
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索能力名称 / 编码…' }}
        filters={
          <>
            <Radio.Group
              type="button"
              value={view}
              onChange={(e) => setView(e.target.value as ViewMode)}
              options={VIEW_OPTIONS as unknown as Array<{ value: string; label: string }>}
            />
            <Select
              value={levelFilter}
              onChange={(v) => setLevelFilter(v as LevelFilter)}
              placeholder="全部层级"
            >
              {LEVEL_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>
                  {o.label}
                </Select.Option>
              ))}
            </Select>
          </>
        }
        right={
          <Text type="secondary">
            {view === 'map' ? '拖拽节点可固定位置 · 点击查看详情' : `${listRows.length} 条能力`}
          </Text>
        }
      />

      <SplitPane ariaLabel="业务架构" defaultWidth={300} pane={treePane}>
        {main}
      </SplitPane>

      <SheetDetail
        title={detail ? `能力详情 · ${detail.code || detail.name}` : '能力详情'}
        open={detail !== null}
        onClose={() => setDetailId(null)}
        footer={<Button onClick={() => setDetailId(null)}>关闭</Button>}
      >
        {detail ? (
          <>
            <Space spacing={8} align="center">
              <Tag color={levelTagColor(detail.level)}>L{detail.level}</Tag>
              <Text strong>{detail.name}</Text>
              <Tag type="light" color={statusMeta(detail.status).color}>
                {statusMeta(detail.status).label}
              </Tag>
            </Space>

            <Descriptions
              column={1}
              size="small"
              data={[
                { key: '编码', value: detail.code || '—' },
                { key: '层级', value: `L${detail.level}` },
                { key: '父能力', value: parentNameOf(detail) },
                { key: '直接下级', value: `${detailChildren.length} 个` },
                { key: '子树节点数', value: `${countSubtree(detail) - 1} 个` },
                { key: '更新时间', value: formatTime(detail.updatedAt) },
              ]}
            />

            {detail.description ? (
              <Card title="描述">
                <Text>{detail.description}</Text>
              </Card>
            ) : null}

            <Card title={`直接下级（${detailChildren.length}）`}>
              {detailChildren.length === 0 ? (
                <EmptyState illustration="no-content" title="无下级能力" />
              ) : (
                <DataTablePro<Capability>
                  columns={childColumns}
                  dataSource={detailChildren}
                  rowKey="capabilityId"
                  columnSettings={false}
                  onRow={(record) => ({ onClick: () => select(record.capabilityId) })}
                />
              )}
            </Card>

            <Card title="关联入口">
              <Space spacing={8} wrap>
                <Button
                  icon={<Network size={15} strokeWidth={1.5} />}
                  onClick={() => navigate('/gov/business/processes')}
                >
                  关联流程
                </Button>
                <Button
                  icon={<Rows3 size={15} strokeWidth={1.5} />}
                  onClick={() => navigate('/gov/business/applications')}
                >
                  关联应用
                </Button>
                <Button onClick={() => navigate('/gov/business/value-streams')}>所属价值流</Button>
                <Button onClick={() => navigate('/gov/data')}>关联数据实体</Button>
              </Space>
            </Card>
          </>
        ) : null}
      </SheetDetail>
    </>
  );
}
