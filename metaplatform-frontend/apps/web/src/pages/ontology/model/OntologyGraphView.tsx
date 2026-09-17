import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Dropdown, Input, Tag, Toast } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Filter, RefreshCw, Search, Tag as TagIcon } from 'lucide-react';
import {
  domainOfObjectType,
  listLinkTypes,
  listObjectTypes,
  propSlug,
  type KernelLinkType,
  type KernelObjectType,
} from '@/api/ont/kernel';
import { ForceGraph, type ForceGraphNode } from '@/components/graph';
import { EmptyState } from '@/components/skeleton';
import { ridTail } from '../rid';
import '../canvas.css';
import '../ontology.css';

/**
 * 本体图谱视图：节点 = ObjectType，边 = LinkType。
 *
 * 2026-09-17 IA 重排：原在「数据中心」tab，但图里画的是**模型层**（类型与类型的关系），
 * 不是数据层，因此随概念建模一起走。
 */

const DOMAIN_COLORS = [
  'var(--semi-color-primary)',
  'var(--semi-color-purple)',
  'var(--semi-color-cyan)',
  'var(--semi-color-warning)',
  'var(--semi-color-success)',
  'var(--semi-color-danger)',
];

export default function OntologyGraphView() {
  const navigate = useNavigate();

  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [links, setLinks] = useState<KernelLinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [hiddenDomains, setHiddenDomains] = useState<string[]>([]);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [relayoutToken, setRelayoutToken] = useState(0);
  const [selected, setSelected] = useState<ForceGraphNode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [typesRes, linksRes] = await Promise.allSettled([listObjectTypes(), listLinkTypes()]);
    if (typesRes.status === 'fulfilled') {
      setTypes(typesRes.value);
    } else {
      setTypes([]);
      setError(typesRes.reason instanceof Error ? typesRes.reason.message : String(typesRes.reason));
    }
    setLinks(linksRes.status === 'fulfilled' ? linksRes.value : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (loading) {
    return <div className="mp-onto-muted mp-p-6">正在读取本体内核…</div>;
  }

  if (graphData.nodes.length === 0) {
    return (
      <EmptyState
        illustration={error ? 'failure' : 'no-content'}
        title={error ? '本体内核读取失败' : '本体里还没有对象类型'}
        desc={error || '先创建对象类型与关系类型，图谱会自动长出来。'}
        actions={
          <Button theme="solid" type="primary" onClick={() => void load()}>
            重试
          </Button>
        }
      />
    );
  }

  return (
    <div className="mp-onto-graph">
      <div className="mp-onto-graph-bar">
        <Input
          className="mp-onto-canvas-search"
          prefix={<Search size={14} strokeWidth={1.5} />}
          placeholder="搜索节点…"
          value={query}
          onChange={setQuery}
          showClear
        />
        <span className="mp-onto-canvas-meta">
          {graphData.nodes.length} 类型 · {graphData.edges.length} 关系 · 实时读取本体内核
        </span>
        <span className="mp-onto-canvas-grow" />

        <Dropdown
          trigger="click"
          position="bottomRight"
          render={
            <div className="mp-onto-canvas-legend-menu">
              <div className="mp-onto-canvas-legend-head">
                <span className="mp-onto-canvas-legend-title">对象域过滤</span>
                <Button
                  theme="borderless"
                  type="primary"
                  size="small"
                  onClick={() => setHiddenDomains([])}
                >
                  全选
                </Button>
              </div>
              <div className="mp-onto-canvas-legend-list">
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
                    <span className="mp-onto-canvas-legend-chip">
                      <span
                        className="mp-onto-canvas-legend-dot"
                        ref={(el) => {
                          if (el) {
                            el.style.setProperty(
                              '--mp-onto-canvas-dot',
                              graphTypes[d]?.color ?? DOMAIN_COLORS[0],
                            );
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
      </div>

      <div className="mp-onto-canvas-stage">
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
        <div className="mp-onto-canvas-hint">
          拖拽节点可固定位置 · 悬停高亮邻接 · 点击查看详情
        </div>
        {selected ? (
          <Card
            className="mp-onto-canvas-card"
            title={
              <span className="mp-onto-canvas-card-head">
                <span className="mp-onto-canvas-card-name">{selected.label}</span>
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
            <div className="mp-onto-canvas-card-sub">
              {graphTypes[selected.type]?.label ?? selected.type} ·{' '}
              {
                graphData.edges.filter(
                  (e) => e.source === selected.id || e.target === selected.id,
                ).length
              }{' '}
              个关系
            </div>
            <div className="mp-onto-canvas-card-props">
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
            {selectedType ? (
              <Button
                theme="borderless"
                type="primary"
                size="small"
                icon={<ExternalLink size={14} strokeWidth={1.5} />}
                onClick={() =>
                  navigate(`/ontology/objects?class=${encodeURIComponent(selectedType.rid)}`)
                }
              >
                看这个类型的实例
              </Button>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
