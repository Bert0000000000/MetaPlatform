import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  deriveLineageGraph,
  listBigDataSources,
  listCDCTasks,
  listDataProducts,
} from '@/api/ontology-bigdata';
import { LineageGraph, type LineageLayer } from '@/components/graph';
import { EmptyState, PageHeader } from '@/components/skeleton';
import '../../canvas.css';
import '../../ontology.css';

/**
 * 本体血缘（IA2-3 从 DatacenterPage 的 lineage 视图独立成页）：
 * 正式路由 /ontology/data/lineage。
 *
 * <p>血缘派生自数据平台控制面（数据源 → CDC → Paimon 明细 → Iceberg 应用）。
 * 设计规格的「只显示与 ObjectType / Mapping 相关的链路」需要血缘数据带
 * ObjectType 关联——当前派生端点尚无该维度，第一版为整图（与拆分前一致，
 * 不造假过滤）；待数据平台血缘接口补 ObjectType 维度后收紧。
 */
export default function OntologyLineagePage() {
  const [lineage, setLineage] = useState<{
    nodes: ReturnType<typeof deriveLineageGraph>['nodes'];
    edges: ReturnType<typeof deriveLineageGraph>['edges'];
  }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [sourcesRes, tasksRes, productsRes] = await Promise.allSettled([
      listBigDataSources({}),
      listCDCTasks({}),
      listDataProducts(),
    ]);
    if (sourcesRes.status !== 'fulfilled') {
      setError(
        sourcesRes.reason instanceof Error ? sourcesRes.reason.message : String(sourcesRes.reason),
      );
    }
    setLineage(
      deriveLineageGraph(
        sourcesRes.status === 'fulfilled' ? sourcesRes.value : [],
        tasksRes.status === 'fulfilled' ? tasksRes.value : [],
        productsRes.status === 'fulfilled' ? productsRes.value : [],
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const layers = useMemo<LineageLayer[]>(() => {
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

  const flows = useMemo<Array<[string, string]>>(
    () => lineage.edges.map((e) => [e.source, e.target] as [string, string]),
    [lineage],
  );

  return (
    <>
      <PageHeader
        title="本体血缘"
        desc={`${lineage.nodes.length} 节点 · ${lineage.edges.length} 条流 · 派生自数据平台控制面`}
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

      <div className="mp-onto-canvas-stage">
        {error ? (
          <div className="mp-onto-canvas-scroll">
            <EmptyState illustration="failure" title="数据平台控制面读取失败" desc={error} />
          </div>
        ) : layers.length === 0 ? (
          <div className="mp-onto-canvas-scroll">
            <EmptyState
              illustration="no-content"
              title="暂无可派生的血缘"
              desc="数据平台里还没有登记数据源 / CDC 任务 / 数据产品。"
            />
          </div>
        ) : (
          <>
            <LineageGraph layers={layers} flows={flows} />
            <div className="mp-onto-canvas-hint">
              源系统 → 接入 → Paimon → Iceberg · 端到端数据流
            </div>
          </>
        )}
      </div>
    </>
  );
}
