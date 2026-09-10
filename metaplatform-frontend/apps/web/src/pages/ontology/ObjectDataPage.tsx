// ObjectDataPage - 对象数据（ONT-UI-01，Palantir Object Explorer 对位）。
//
// 布局（对齐 OntologyModelingPage 的左右分栏惯例）：
//   左栏：类型层级树（GET /object-types/hierarchy；接口失败/空时回退
//         按领域平铺 —— 与概念模型页同规则）
//   右栏：
//     - 顶部语义搜索（POST /object-search → 对象卡片，点击直开对象主页）
//     - 实例表：listIndividuals(class_rid) + 关键词客户端过滤 + 分页
//     - 行点击 → ObjectHomeDrawer（关联对象可继续跳转，栈式导航）
//
// 严格原生 button/input（dev 模式 Semi 交互组件被截 noop 的纪律只涉及
// 事件绑定；表格用 Semi Table 只读渲染）。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ChevronRight, Hexagon, Loader2, Search, Sparkles } from 'lucide-react';
import {
  getTypeHierarchy, listIndividuals, listObjectTypes, propSlug, searchObjectsSemantic,
  type KernelIndividual, type KernelObjectType, type SemanticSearchCard,
  type TypeHierarchyNode,
} from '@/api/ont/kernel';
import ObjectHomeDrawer from './components/ObjectHomeDrawer';

const PAGE_SIZE = 50;

interface FlatType {
  rid: string;
  label: string;
  depth: number;
}

function flattenTree(nodes: TypeHierarchyNode[], depth = 0, out: FlatType[] = []): FlatType[] {
  nodes.forEach((n) => {
    out.push({ rid: n.rid, label: n.display_name || n.rid, depth });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  });
  return out;
}

export default function ObjectDataPage() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [flatTypes, setFlatTypes] = useState<FlatType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeError, setTypeError] = useState('');

  const [individuals, setIndividuals] = useState<KernelIndividual[]>([]);
  const [loadingInds, setLoadingInds] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // 语义搜索
  const [semanticText, setSemanticText] = useState('');
  const [semanticCards, setSemanticCards] = useState<SemanticSearchCard[] | null>(null);
  const [semanticBusy, setSemanticBusy] = useState(false);

  // 对象主页栈
  const [homeStack, setHomeStack] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ots, tree] = await Promise.all([
          listObjectTypes(),
          getTypeHierarchy().catch(() => [] as TypeHierarchyNode[]),
        ]);
        if (cancelled) return;
        setTypes(ots);
        const flat = tree.length
          ? flattenTree(tree)
          : groupByDomain(ots);
        setFlatTypes(flat);
        if (flat.length > 0) setSelectedType((prev) => prev || flat[0]!.rid);
      } catch (e) {
        if (!cancelled) setTypeError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadIndividuals = useCallback(async (classRid: string) => {
    if (!classRid) return;
    setLoadingInds(true);
    try {
      const items = await listIndividuals({ classRid, limit: 500, offset: 0 });
      setIndividuals(items);
      setTotal(items.length);
      setPage(0);
    } catch {
      setIndividuals([]);
      setTotal(0);
    } finally {
      setLoadingInds(false);
    }
  }, []);

  useEffect(() => {
    if (selectedType) void loadIndividuals(selectedType);
  }, [selectedType, loadIndividuals]);

  const selectedOt = useMemo(
    () => types.find((t) => t.rid === selectedType) ?? null,
    [types, selectedType],
  );

  // 列：ObjectType properties（slug 短键）+ created_at
  const columns = useMemo<ColumnProps<KernelIndividual>[]>(() => {
    const propCols: ColumnProps<KernelIndividual>[] = (selectedOt?.properties ?? [])
      .slice(0, 8)
      .map((p) => ({
        title: p.title || propSlug(p.rid),
        dataIndex: propSlug(p.rid),
        render: (_: unknown, row: KernelIndividual) => {
          const v = row.props[p.rid];
          if (v === undefined || v === null) return <span style={{ color: 'var(--muted-foreground)' }}>—</span>;
          const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return <span title={text}>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span>;
        },
      }));
    return [
      {
        title: '主键',
        dataIndex: 'primary_key',
        width: 180,
        render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
      },
      ...propCols,
      {
        title: '',
        dataIndex: '__open__',
        width: 60,
        render: (_: unknown, row: KernelIndividual) => (
          <button
            type="button"
            onClick={() => setHomeStack([row.rid])}
            style={{
              border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card)',
              color: 'var(--muted-foreground)', cursor: 'pointer', padding: '2px 8px',
              fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            主页 <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        ),
      },
    ];
  }, [selectedOt]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return individuals;
    const kw = keyword.trim().toLowerCase();
    return individuals.filter((i) => {
      if (i.primary_key?.toLowerCase().includes(kw)) return true;
      if (i.rid.toLowerCase().includes(kw)) return true;
      return Object.values(i.props).some((v) =>
        String(v ?? '').toLowerCase().includes(kw));
    });
  }, [individuals, keyword]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const runSemantic = async () => {
    if (!semanticText.trim()) { setSemanticCards(null); return; }
    setSemanticBusy(true);
    try {
      const cards = await searchObjectsSemantic({ text: semanticText.trim(), top_k: 8 });
      setSemanticCards(cards);
    } catch {
      setSemanticCards([]);
    } finally {
      setSemanticBusy(false);
    }
  };

  const currentHomeRid = homeStack.length ? homeStack[homeStack.length - 1]! : null;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* 左栏：类型层级树 */}
      <div style={{ width: 250, flexShrink: 0 }}>
        <Card style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>对象类型</h3>
          {loadingTypes ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader2 style={{ width: 12, height: 12, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
            </div>
          ) : typeError ? (
            <div style={{ fontSize: 12, color: 'var(--destructive)' }}>{typeError}</div>
          ) : flatTypes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无类型</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 560, overflowY: 'auto' }}>
              {flatTypes.map((t) => (
                <li key={t.rid}>
                  <button
                    type="button"
                    onClick={() => setSelectedType(t.rid)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', fontSize: 12, textAlign: 'left',
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: t.rid === selectedType ? 'var(--muted)' : 'transparent',
                      color: t.rid === selectedType ? 'var(--foreground)' : 'var(--muted-foreground)',
                      paddingLeft: 10 + t.depth * 14,
                    }}
                    title={t.rid}
                  >
                    <Hexagon style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 右栏 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 语义搜索 */}
        <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Sparkles style={{ width: 16, height: 16, color: '#fbbf24', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="语义搜索对象（自然语言，如「上海的头部客户」）…"
              value={semanticText}
              onChange={(e) => setSemanticText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runSemantic(); }}
              style={{
                flex: 1, height: 34, background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13,
                color: 'var(--foreground)', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void runSemantic()}
              disabled={semanticBusy}
              style={{
                height: 34, padding: '0 16px', fontSize: 13, borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--card)',
                color: 'var(--foreground)', cursor: semanticBusy ? 'wait' : 'pointer',
              }}
            >
              {semanticBusy ? '检索中…' : '搜索'}
            </button>
          </div>
          {semanticCards !== null && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {semanticCards.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无语义匹配对象</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {semanticCards.map((c) => (
                    <button
                      key={c.individual_rid}
                      type="button"
                      onClick={() => setHomeStack([c.individual_rid])}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', fontSize: 12, borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--card)',
                        cursor: 'pointer', color: 'var(--foreground)', maxWidth: 420,
                      }}
                      title={c.individual_rid}
                    >
                      <Tag size="small" color="amber">{(c.score * 100).toFixed(0)}%</Tag>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.matched[0]?.value_text ?? c.individual_rid}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 实例表 */}
        <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {selectedOt?.display_name || selectedType || '对象'} 实例
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 8 }}>
                共 {filtered.length}
              </span>
            </h4>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="过滤主键 / 属性值…"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
                style={{
                  width: 240, height: 32, background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '0 10px 0 32px', fontSize: 12,
                  color: 'var(--foreground)', outline: 'none',
                }}
              />
            </div>
          </div>
          <Table<KernelIndividual>
            columns={columns}
            dataSource={paged}
            loading={loadingInds}
            rowKey="rid"
            pagination={{
              currentPage: page + 1,
              pageSize: PAGE_SIZE,
              total: filtered.length,
              onPageChange: (p) => setPage(p - 1),
            }}
            empty="该类型下暂无实例"
            size="small"
          />
        </Card>
      </div>

      {/* 对象主页抽屉（栈式导航） */}
      <ObjectHomeDrawer
        open={homeStack.length > 0}
        rid={currentHomeRid}
        stack={homeStack}
        onNavigate={(rid) => setHomeStack((s) => [...s, rid])}
        onBack={() => setHomeStack((s) => s.slice(0, -1))}
        onClose={() => setHomeStack([])}
      />
    </div>
  );
}

// 领域平铺回退（层级接口空/失败时）—— 与 OntologyModelingPage 的分组口径一致。
function groupByDomain(ots: KernelObjectType[]): FlatType[] {
  const out: FlatType[] = [];
  const byDomain = new Map<string, KernelObjectType[]>();
  ots.forEach((ot) => {
    const parts = ot.rid.split('.');
    const objIdx = parts.indexOf('obj');
    const domain = objIdx >= 0 && parts.length > objIdx + 2 ? parts[objIdx + 1]! : 'other';
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(ot);
  });
  byDomain.forEach((items) => {
    items.forEach((ot) => {
      out.push({ rid: ot.rid, label: ot.display_name || ot.rid, depth: 0 });
    });
  });
  return out;
}
