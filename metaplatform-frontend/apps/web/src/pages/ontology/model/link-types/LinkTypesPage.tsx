import { useCallback, useEffect, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { useSearchParams } from 'react-router-dom';
import { errDetailText, getLinkInstanceStats, listLinkInstances, listLinkTypes, type KernelLinkInstance, type KernelLinkType } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, SheetDetail } from '@/components/skeleton';
import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import LinkTypeEditor from './LinkTypeEditor';
import LinkInstanceEditor from './LinkInstanceEditor';
import { ridTail } from '../../rid';
import '../../ontology.css';

export default function LinkTypesPage() {
  const [params, setParams] = useSearchParams();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [statsError, setStatsError] = useState('');
  const [openType, setOpenType] = useState<KernelLinkType | null>(null);
  const [editor, setEditor] = useState<KernelLinkType | 'create' | null>(() => params.get('create') === '1' ? 'create' : null);
  const [refresh, setRefresh] = useState(0);
  const [existingRids, setExistingRids] = useState<string[]>([]);
  const loadStats = useCallback(async () => {
    setStatsError('');
    try { setCounts((await getLinkInstanceStats()).by_link_type); }
    catch (e) { setCounts(null); setStatsError(errDetailText(e, '统计不可用')); }
  }, []);
  useEffect(() => { void loadStats(); }, [loadStats]);
  const load = useCallback(async () => {
    const rows = await listLinkTypes(); setExistingRids(rows.map(r => r.rid)); return rows;
  }, [refresh]);
  const closeEditor = () => {
    setEditor(null);
    if (params.has('create')) { const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true }); }
  };
  const savedType = () => { closeEditor(); setRefresh(v => v + 1); void loadStats(); };
  return <>
    <KernelPrimitiveListPage<KernelLinkType>
      title="关系类型" load={load} rowKey={row => row.rid}
      searchText={l => l.rid + ' ' + l.src + ' ' + l.dst + ' ' + (l.src_display_name || '') + ' ' + (l.dst_display_name || '')}
      searchPlaceholder="搜索关系类型"
      actions={<Button theme="solid" onClick={() => setEditor('create')}>新建关系</Button>}
      columns={[
        { title: '关系', dataIndex: 'rid', width: 200, render: (_: unknown, row: KernelLinkType) => <span className="mp-onto-strong">{ridTail(row.rid)}</span> },
        { title: '源 → 目标', dataIndex: 'src', width: 280, render: (_: unknown, row: KernelLinkType) => ridTail(row.src) + ' → ' + ridTail(row.dst) },
        { title: '两端名称', dataIndex: 'src_display_name', width: 220, render: (_: unknown, row: KernelLinkType) => (row.src_display_name || '—') + ' / ' + (row.dst_display_name || '—') },
        { title: '基数', dataIndex: 'cardinality', width: 100 },
        { title: '方向性', dataIndex: 'directionality', width: 120 },
        { title: '链属性', dataIndex: 'link_properties', width: 90, render: (v: KernelLinkType['link_properties']) => v.length },
        { title: '实例数', dataIndex: '__instances', width: 90, render: (_: unknown, row: KernelLinkType) =>
          statsError ? '不可用' : counts === null ? '…' : <span className="mp-onto-num">{counts[row.rid] || 0}</span> },
        { title: '操作', dataIndex: '__ops', width: 180, render: (_: unknown, row: KernelLinkType) => <>
          <Button theme="light" onClick={() => setEditor(row)}>编辑关系</Button>
          <Button theme="light" type="secondary" onClick={() => setOpenType(row)}>实例</Button>
        </> },
      ]}
    />
    {statsError ? <div role="alert">统计读取失败：{statsError} <Button onClick={() => void loadStats()}>重试统计</Button></div> : null}
    <SheetDetail title={editor === 'create' ? '新建关系' : '编辑关系'} open={editor !== null} onClose={closeEditor} width={600}>
      {editor ? <LinkTypeEditor key={editor === 'create' ? 'create' : editor.rid} initial={editor === 'create' ? undefined : editor}
        source={params.get('source') || ''} existingRids={existingRids}
        protectedStructure={counts === null || Boolean(statsError) || (editor !== 'create' && (counts[editor.rid] || 0) > 0)}
        onSaved={savedType} onCancel={closeEditor} /> : null}
    </SheetDetail>
    <SheetDetail title={openType ? '关系实例 · ' + ridTail(openType.rid) : '关系实例'} open={openType !== null} onClose={() => setOpenType(null)} width={600}>
      {openType ? <LinkInstanceList key={openType.rid} linkType={openType} onSaved={() => void loadStats()} /> : null}
    </SheetDetail>
  </>;
}
const LINK_PAGE_SIZE = 200;
function LinkInstanceList({ linkType, onSaved }: { linkType: KernelLinkType; onSaved: () => void }) {
  const [rows, setRows] = useState<KernelLinkInstance[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false), [refresh, setRefresh] = useState(0), [page, setPage] = useState(1);
  useEffect(() => {
    let alive = true; setRows(null); setError('');
    listLinkInstances({ linkTypeRid: linkType.rid, limit: LINK_PAGE_SIZE, offset: (page - 1) * LINK_PAGE_SIZE })
      .then(r => { if (alive) setRows(r); }).catch(e => { if (alive) setError(errDetailText(e, '关系实例读取失败')); });
    return () => { alive = false; };
  }, [linkType.rid, refresh, page]);
  const shown = rows || [];
  return <>
    <div className="mp-flex mp-gap-2 mp-mb-4 mp-wrap">
      <Tag color="blue">{ridTail(linkType.src)} → {ridTail(linkType.dst)}</Tag><Tag>{linkType.cardinality}</Tag>
      <Tag>{error ? '实例不可用' : rows === null ? '加载中…' : shown.length + ' 条实例'}</Tag>
      <Button onClick={() => setEditing(true)} disabled={editing}>关联对象</Button>
    </div>
    {editing ? <LinkInstanceEditor linkType={linkType} onCancel={() => setEditing(false)}
      onSaved={() => { setEditing(false); setPage(1); setRefresh(v => v + 1); onSaved(); }} /> : null}
    {error ? <div role="alert">{error}<Button onClick={() => setRefresh(v => v + 1)}>重试实例</Button></div> :
      <DataTablePro<KernelLinkInstance> columns={[
        { title: '源实例', dataIndex: 'src', width: 160, render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span> },
        { title: '目标实例', dataIndex: 'dst', width: 160, render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span> },
        { title: '链属性', dataIndex: 'props', render: (v: Record<string, unknown>) => Object.entries(v).map(([k, val]) => ridTail(k) + '=' + JSON.stringify(val)).join('; ') || '—' },
        { title: '创建时间', dataIndex: 'created_at', width: 150, render: (v: string | undefined) => v || '—' },
      ]} dataSource={shown} rowKey="rid" loading={rows === null}
        empty={<EmptyState illustration="no-content" title="该关系类型还没有实例" desc="选择关联对象创建业务关联。" />} />}
    {page > 1 || shown.length === LINK_PAGE_SIZE ? <div className="mp-flex mp-gap-2">
      <Button disabled={rows === null || page === 1} onClick={() => setPage(v => v - 1)}>上一页实例</Button>
      <span>第 {page} 页</span><Button disabled={rows === null || shown.length < LINK_PAGE_SIZE} onClick={() => setPage(v => v + 1)}>下一页实例</Button>
    </div> : null}
  </>;
}
