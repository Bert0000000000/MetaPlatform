// AnalysisPage - 分析工作台（L6 应用层，Palantir Quiver 对位）。
//
// 点击式图表分析（不写 SQL / DSL，纯点选聚合）：
//   左栏：ObjectType 选择（listObjectTypes）+ 属性清单（getObjectType，
//         显示 title + format；标注维度/度量可用性）
//   中间画布：分组字段（string/date/timestamp）× 度量字段（integer/double）
//         × 聚合函数（sum/count/avg/min/max）
//         → POST /ont/v2/object-query {source, aggregation, paging_limit:100}
//         → {kind:"aggregates", rows:[{维度, 度量名: 值}]}
//   图表：纯 SVG（ChartSvg 共用渲染）——柱状 / 饼图 / 趋势线；
//         维度为 date/timestamp 时自动切折线
//   结论：纯前端计算的文字摘要（组数 / 最大组 / 占比 / 总量）
//   Pin：「Pin 到仪表盘」→ localStorage（ont-analysis-pins），
//         仪表盘按 config 重新聚合渲染实时卡片
//
// 纪律：原生 button/select + 内联样式 + CSS 变量；Semi Card 仅容器。

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { Loader2, Pin, PlayCircle } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  errDetailText, getObjectQueryAggregation, getObjectType, listObjectTypes, propSlug,
  type KernelObjectType, type KernelProperty, type ObjectQueryResult,
} from '@/api/ont/kernel';
import ChartSvg, { formatChartNumber, type ChartDatum, type ChartType } from './components/ChartSvg';
import { saveAnalysisPin } from './components/analysisPins';

/** 可作分组字段的格式（string/date/timestamp；后两者自动切趋势线）。 */
const DIMENSION_FORMATS = new Set(['string', 'date', 'timestamp']);
/** 可作度量字段的格式（integer/double；decimal 的 format 即 double）。 */
const METRIC_FORMATS = new Set(['integer', 'double']);

const FN_LABEL: Record<string, string> = {
  sum: '求和', count: '计数', avg: '平均', min: '最小', max: '最大',
};
const FNS = ['sum', 'count', 'avg', 'min', 'max'] as const;

const CHART_TABS: Array<{ key: ChartType; label: string }> = [
  { key: 'bar', label: '柱状图' },
  { key: 'pie', label: '饼图' },
  { key: 'line', label: '趋势线' },
];

const selectStyle = {
  height: 32, minWidth: 0, flex: 1, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 8px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none', cursor: 'pointer',
} as const;

const runBtnStyle = {
  height: 32, padding: '0 18px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap',
  border: '1px solid var(--primary)', background: 'var(--primary)',
  color: 'var(--primary-foreground)', cursor: 'pointer', flexShrink: 0,
} as const;

const chartTabStyle = (active: boolean) => ({
  height: 30, padding: '0 14px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
  background: active ? 'var(--primary)' : 'var(--card)',
  color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
  cursor: 'pointer',
}) as const;

function isDimensionProp(p: KernelProperty): boolean {
  return DIMENSION_FORMATS.has(p.format);
}

function isMetricProp(p: KernelProperty): boolean {
  return METRIC_FORMATS.has(p.format);
}

/** 属性清单行的格式徽标色。 */
function propChipStyle(kind: 'dim' | 'metric' | 'geo' | 'plain') {
  const color = kind === 'dim' ? '#3b82f6' : kind === 'metric' ? '#10b981'
    : kind === 'geo' ? '#f59e0b' : 'var(--muted-foreground)';
  return {
    fontSize: 10, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
    border: `1px solid ${color}`, color, fontFamily: 'monospace',
  } as const;
}

export default function AnalysisPage() {
  // ── 左栏：类型 + 属性清单 ──
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeError, setTypeError] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [detail, setDetail] = useState<KernelObjectType | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  // ── 分析配置 ──
  const [dimension, setDimension] = useState('');
  const [metric, setMetric] = useState('');
  const [fn, setFn] = useState<string>('sum');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // ── 结果 ──
  const [result, setResult] = useState<{ data: ChartDatum[]; metricKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 类型清单（一次性）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ots = await listObjectTypes();
        if (cancelled) return;
        setTypes(ots);
        if (ots.length > 0) setSelectedType((prev) => prev || ots[0]!.rid);
      } catch (e) {
        if (!cancelled) setTypeError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 选中类型 → getObjectType 详情（属性清单权威数据源）
  useEffect(() => {
    if (!selectedType) return;
    let cancelled = false;
    setDetailBusy(true);
    setResult(null);
    setErr('');
    getObjectType(selectedType)
      .then((ot) => {
        if (cancelled) return;
        setDetail(ot);
        // 默认选中：第一个可用维度 / 度量；date 维度自动切趋势线
        const dims = ot.properties.filter(isDimensionProp);
        const mets = ot.properties.filter(isMetricProp);
        const dimSlug = dims.length > 0 ? propSlug(dims[0]!.rid) : '';
        setDimension(dimSlug);
        setMetric(mets.length > 0 ? propSlug(mets[0]!.rid) : '');
        setChartType(dims[0] && (dims[0].format === 'date' || dims[0].format === 'timestamp')
          ? 'line' : 'bar');
      })
      .catch((e) => {
        if (cancelled) return;
        // 详情失败回退到清单数据（保持可用）
        setDetail(types.find((t) => t.rid === selectedType) ?? null);
        setErr(errDetailText(e, '类型详情加载失败'));
      })
      .finally(() => { if (!cancelled) setDetailBusy(false); });
    return () => { cancelled = true; };
    // types 仅作回退数据源；选中变化才应触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const dimProps = useMemo(() => (detail?.properties ?? []).filter(isDimensionProp), [detail]);
  const metricProps = useMemo(() => (detail?.properties ?? []).filter(isMetricProp), [detail]);

  const onDimensionChange = (slug: string) => {
    setDimension(slug);
    const p = dimProps.find((x) => propSlug(x.rid) === slug);
    if (p && (p.format === 'date' || p.format === 'timestamp')) setChartType('line');
  };

  // count 可无度量字段（count *）；其余 fn 必须选字段
  const canRun = !!selectedType && !!dimension && (fn === 'count' || !!metric);

  const runAnalysis = async () => {
    if (!canRun) return;
    const useField = fn === 'count' ? (metric || null) : metric;
    setBusy(true);
    setErr('');
    try {
      const res: ObjectQueryResult = await getObjectQueryAggregation({
        source: selectedType,
        group_by: [dimension],
        metrics: [{ fn, field: useField }],
        paging_limit: 100,
      });
      const metricKey = useField ? `${fn}_${useField}` : fn;
      const raw = res.kind === 'aggregates' ? res.rows : [];
      let data: ChartDatum[] = raw.map((r) => ({
        label: r[dimension] === null || r[dimension] === undefined || r[dimension] === ''
          ? '（空）'
          : String(r[dimension]),
        value: Number(r[metricKey] ?? 0) || 0,
      }));
      // 排序：趋势线按维度升序（ISO date 字符串序即时间序）；柱/饼按值降序
      data = chartType === 'line'
        ? [...data].sort((a, b) => a.label.localeCompare(b.label))
        : [...data].sort((a, b) => b.value - a.value);
      setResult({ data, metricKey });
    } catch (e) {
      setResult(null);
      setErr(errDetailText(e, '聚合查询失败'));
    } finally {
      setBusy(false);
    }
  };

  // 纯前端结论摘要
  const summary = useMemo(() => {
    if (!result || result.data.length === 0) return '';
    const total = result.data.reduce((s, d) => s + d.value, 0);
    const maxD = result.data.reduce((a, b) => (b.value > a.value ? b : a));
    const pct = total > 0 ? ((maxD.value / total) * 100).toFixed(1) : '0.0';
    return `共 ${result.data.length} 组，最大 ${maxD.label} 是 ${formatChartNumber(maxD.value)}`
      + `（占比 ${pct}%），总量 ${formatChartNumber(total)}`;
  }, [result]);

  const dimTitle = dimProps.find((p) => propSlug(p.rid) === dimension)?.title || dimension;
  const metricTitle = metricProps.find((p) => propSlug(p.rid) === metric)?.title || metric;

  const pinToDashboard = () => {
    if (!selectedType || !dimension || !result) return;
    saveAnalysisPin({
      title: `${detail?.display_name ?? selectedType}：${dimTitle} × `
        + `${FN_LABEL[fn] ?? fn}${metric ? `（${metricTitle}）` : ''}`,
      config: {
        source: selectedType,
        dimension,
        metric: fn === 'count' ? (metric || '') : metric,
        fn,
        chartType,
      },
    });
    toast('已 Pin 到仪表盘', 'success');
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* 左栏：数据源选择 */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>数据源（ObjectType）</h3>
          {loadingTypes ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader2 style={{ width: 12, height: 12, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
            </div>
          ) : typeError ? (
            <div style={{ fontSize: 12, color: 'var(--destructive)' }}>{typeError}</div>
          ) : types.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无类型</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflowY: 'auto' }}>
              {types.map((t) => (
                <li key={t.rid}>
                  <button
                    type="button"
                    onClick={() => setSelectedType(t.rid)}
                    title={t.rid}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', fontSize: 12, textAlign: 'left',
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: t.rid === selectedType ? 'var(--muted)' : 'transparent',
                      color: t.rid === selectedType ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                      background: t.rid === selectedType ? 'var(--primary)' : 'var(--muted-foreground)',
                    }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.display_name || t.rid}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 属性清单 */}
        <Card style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 8 }}>
            属性清单
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 6 }}>
              {detail ? `${detail.properties.length} 项` : ''}
            </span>
          </h3>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            <span style={propChipStyle('dim')}>维度</span> 可分组 ·
            <span style={propChipStyle('metric')}>度量</span> 可聚合
          </div>
          {detailBusy ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader2 style={{ width: 12, height: 12, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
            </div>
          ) : !detail || detail.properties.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>该类型暂无属性</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto' }}>
              {detail.properties.map((p) => {
                const slug = propSlug(p.rid);
                const kind: 'dim' | 'metric' | 'geo' | 'plain' = isDimensionProp(p)
                  ? 'dim' : isMetricProp(p) ? 'metric'
                    : p.format === 'latlon' || p.format === 'geojson' ? 'geo' : 'plain';
                return (
                  <li key={p.rid} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 4px', fontSize: 12,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={`${p.title || slug}（${p.rid}）`}>
                      {p.title || slug}
                    </span>
                    <span style={propChipStyle(kind)}>{p.format}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* 中间：分析画布 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 配置行 */}
        <Card bodyStyle={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>分组字段</span>
            <select
              value={dimension}
              onChange={(e) => onDimensionChange(e.target.value)}
              style={{ ...selectStyle, width: 170 }}
            >
              {dimProps.length === 0 && <option value="">（无可分组属性）</option>}
              {dimProps.map((p) => {
                const slug = propSlug(p.rid);
                return <option key={p.rid} value={slug}>{`${p.title || slug} · ${p.format}`}</option>;
              })}
            </select>

            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>聚合</span>
            <select
              value={fn}
              onChange={(e) => setFn(e.target.value)}
              style={{ ...selectStyle, width: 90 }}
            >
              {FNS.map((f) => <option key={f} value={f}>{FN_LABEL[f]}</option>)}
            </select>

            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>度量字段</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              style={{ ...selectStyle, width: 170 }}
            >
              <option value="">（实例计数 count *）</option>
              {metricProps.map((p) => {
                const slug = propSlug(p.rid);
                return <option key={p.rid} value={slug}>{`${p.title || slug} · ${p.format}`}</option>;
              })}
            </select>

            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={!canRun || busy}
              style={{ ...runBtnStyle, opacity: !canRun || busy ? 0.5 : 1, cursor: !canRun || busy ? 'not-allowed' : 'pointer' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <PlayCircle style={{ width: 13, height: 13 }} />
                {busy ? '分析中…' : '运行分析'}
              </span>
            </button>
          </div>
        </Card>

        {/* 图表 */}
        <Card bodyStyle={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {result
                ? `${detail?.display_name ?? selectedType}：${dimTitle} × ${FN_LABEL[fn] ?? fn}${metric ? `（${metricTitle}）` : ''}`
                : '分析画布'}
            </h4>
            {/* 图表切换按钮组 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {CHART_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChartType(t.key)}
                  style={chartTabStyle(chartType === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {err ? (
            <div style={{
              padding: '10px 14px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--destructive)', color: 'var(--destructive)',
              wordBreak: 'break-all',
            }}>{err}</div>
          ) : busy ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <Loader2 style={{ width: 14, height: 14, animation: 'osp-spin 1s linear infinite' }} /> 聚合查询中…
            </div>
          ) : (
            <ChartSvg type={chartType} data={result?.data ?? []} baseWidth={720} height={300} />
          )}
        </Card>

        {/* 结论 + Pin */}
        {result && (
          <Card bodyStyle={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>分析结论（自动生成）</div>
                <div style={{ fontSize: 13 }}>{summary || '无数据行'}</div>
              </div>
              <button
                type="button"
                onClick={pinToDashboard}
                style={{
                  height: 32, padding: '0 16px', fontSize: 12, borderRadius: 6, flexShrink: 0,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--foreground)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Pin style={{ width: 13, height: 13 }} /> Pin 到仪表盘
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
