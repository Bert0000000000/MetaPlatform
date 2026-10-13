import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Button, Checkbox, Spin, Tag } from '@douyinfe/semi-ui';
import type { ModelingSource } from '@/api/ont/modeling';
import DataReadiness from './DataReadiness';
import DataTreatment from './DataTreatment';

export default function SyncWorkspace({ source, dirty, busy, published, error, onCheck, onSync, onLocate, onRefresh, onBack, onAnalyze, onConfirmRepairs, onExport }: {
  source: ModelingSource; dirty: boolean; busy: boolean; published: boolean;
  error?: string; onCheck: () => void; onSync: (options?: {allowPartial: boolean;checkHash: string}) => void; onLocate: (id: string) => void; onRefresh: () => void; onBack: () => void;
  onAnalyze?: () => void; onConfirmRepairs?: (keys: string[]) => void; onExport?: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const check = !dirty && source.syncCheck?.sourceRevision === source.revision ? source.syncCheck : null;
  const sync = source.sync;
  const subset = !check?.canSync ? check?.partial : undefined;
  const eligible = subset?.preview ?? check?.preview;
  const running = sync?.status === 'running';
  useEffect(() => { setConfirmed(false); }, [source.id, source.revision, check?.checkedAt]);
  const reason = !published ? '请先完成当前本体发布。' : dirty ? '存在未保存修改，请先保存并重新检查。' : !check ? '请先检查本次数据。' : check.baselineError || (!check.canSync && !subset?.canSync ? subset && !subset.preview.nodes ? '本次没有可同步的合格实例，请先处理问题记录或建模规则。' : '数据存在阻断，请处理后重新检查。' : running ? '同步正在执行，请等待结果。' : '');
  const gateAction = !published ? { label: '去发布本体', run: onBack }
    : !dirty && !check ? { label: '检查本次数据', run: onCheck }
      : !dirty && check?.baselineError ? { label: '重新检查数据', run: onCheck }
        : !dirty && check && !check.canSync && !subset?.canSync && onAnalyze ? { label: 'AI 分析批量修复', run: onAnalyze }
          : null;
  const typeName = (id: unknown) => source.plan?.types.find(t => t.classId === id || t.rid === id)?.name ?? String(id ?? '');
  const typeLink = (rid: string, path: string, sourceRef?: unknown) => `${path}?${new URLSearchParams({ typeRef: rid, ...(typeof sourceRef === 'string' ? { sourceRef } : {}), returnTo: `/ontology/model/from-data?source=${source.id}&step=sync` })}`;
  return <div className="fd-sync-workspace">
    <section className="fd-card"><div className="fd-section-head"><div><h2>同步本次数据 <Tag>可选</Tag></h2><p>使用已上传的 {source.name}，同步到平台正式实例。</p></div>{!reason && <Button disabled={busy || running} onClick={onCheck}>{check ? '重新检查数据' : '检查本次数据'}</Button>}</div>
      <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>对象类型</th><th>来源表</th><th>来源行数</th></tr></thead><tbody>{source.plan?.types.map(type => {
        const mappings = source.draft?.mappings.filter(m => m.classId === type.classId) ?? [];
        return <tr key={type.classId}><td>{type.name}</td><td>{mappings.map(m => m.sheet).join('、') || '无映射'}</td><td>{[...new Set(mappings.map(m => m.sheet))].reduce((sum, name) => sum + (source.profile.sheets.find(s => s.name === name)?.rows ?? 0), 0).toLocaleString()}</td></tr>;
      })}</tbody></table></div><p className="mp-onto-muted">来源行数不等于实例数；同身份记录会合并。范围沿用本次发布方案。</p>
      {eligible && (check?.canSync || subset?.canSync) && <p>预计生成或更新 <strong>{eligible.nodes.toLocaleString()}</strong> 个对象、<strong>{eligible.edges.toLocaleString()}</strong> 条关系。{subset && `问题数据涉及 ${subset.quarantine.rows.toLocaleString()} 行，确认后暂缓入库。`}</p>}
      {reason && <p role="status" className="fd-warning">{reason}</p>}
    </section>
    <DataTreatment source={source} busy={busy || dirty || Boolean(running)} onAnalyze={onAnalyze} onConfirm={onConfirmRepairs} onExport={onExport} />
    {check && <DataReadiness report={check.report} draft={source.draft} onLocate={onLocate} partialAvailable={Boolean(subset?.canSync)} />}
    {check && <p className="mp-onto-muted">检查时间：{new Date(check.checkedAt).toLocaleString()} · 来源修订 {check.sourceRevision}</p>}
    <section className="fd-card"><h3>执行同步</h3><p>按业务身份新增或更新，来源中缺失的旧实例会保留。中途失败可能保留已写入结果，可核对后重试。</p>
      {error && <Banner type="danger" description={error} closeIcon={null} />}
      {reason ? <div className="fd-sync-gate" role="status"><strong>当前还不能同步实例</strong><p>{reason}{!published && ' 本体发布成功后，再检查并同步实例。'}</p>{gateAction && <Button theme="solid" disabled={busy} onClick={gateAction.run}>{gateAction.label}</Button>}</div> : <>
        {subset && <div className="fd-sync-ready" role="status"><strong>合格数据可以直接同步，无需逐条核对</strong><p>系统将写入 {subset.preview.nodes.toLocaleString()} 个对象、{subset.preview.edges.toLocaleString()} 条关系，并自动暂缓涉及 {subset.quarantine.rows.toLocaleString()} 行的问题数据。暂缓明细会保留，可后续批量修复后重试。</p></div>}
        <Checkbox disabled={busy} checked={confirmed} onChange={e => setConfirmed(Boolean(e.target.checked))}>{subset ? '我确认自动暂缓问题数据，仅同步合格实例及关系' : '我已确认同步范围，写入正式实例'}</Checkbox>
        <div className="fd-actions"><Button onClick={onBack}>返回发布结果</Button><Button theme="solid" disabled={busy || !confirmed} onClick={() => { setConfirmed(false); if (subset) onSync({allowPartial: true, checkHash: subset.checkHash}); else onSync(); }}>{subset ? '同步合格数据' : sync ? '重新同步本次数据' : '开始同步'}</Button></div>
      </>}
    </section>
    {sync && <section className="fd-card" aria-label="同步执行结果"><div className="fd-section-head"><h3>同步结果 · {({ running: '进行中', succeeded: '已完成', failed: '未完成', interrupted: '已中断' } as Record<string, string>)[sync.status] ?? '待核实'}</h3><Button onClick={onRefresh} disabled={busy}>刷新结果</Button></div>
      {running && <div role="status"><Spin size="small" /> {({ preparing: '正在准备数据', objects: '正在同步对象', relationships: '正在建立关系' } as Record<string, string>)[sync.stage ?? 'preparing']} · 已处理 {sync.types.length} / {sync.totalTypes ?? source.plan?.types.length ?? '—'} 个类型，已建立关系 {String(sync.links ?? 0)} 条。可以稍后回来查看。</div>}
      {sync.allowPartial && sync.quarantine && <p>本次按已确认范围同步合格数据；暂缓来源行 {sync.quarantine.rows.toLocaleString()}，涉及关系 {sync.quarantine.relationships} 类。暂缓明细保留，可后续修复并重新同步。</p>}
      {sync.error && <Banner type="danger" description={sync.error} closeIcon={null} />}
      {sync.status !== 'succeeded' && <p className="mp-onto-muted">以下是已回报的结果，失败不代表全部回滚；请先刷新核实状态。</p>}
      <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>对象类型</th><th>已同步</th><th>失败</th><th>查看</th></tr></thead><tbody>{sync.types.map((item, i) => {
        const rid = typeof item.rid === 'string' ? item.rid : source.plan?.types.find(t => t.classId === item.classId)?.rid;
        const sources = item.sources && typeof item.sources === 'object' ? Object.entries(item.sources as Record<string, { synced?: number; failed?: number; failures?: Array<{ pk?: unknown; error?: string }> }>) : [];
        return <tr key={rid ?? i}><td>{typeName(item.classId ?? rid)}</td><td>{String(item.total_synced ?? '未回报')}</td><td>{String(item.total_failed ?? '未回报')}</td><td>{rid && <div className="fd-inline"><Link to={typeLink(rid, '/ontology/explore/objects')}>查看实例</Link><Link to={typeLink(rid, '/ontology/data/mappings', item.sourceRef)}>查看数据映射</Link></div>}{sources.length > 0 && <details><summary>来源执行详情</summary>{sources.map(([name, result]) => <div key={name}><p>{name}：同步 {result.synced ?? '未回报'}，失败 {result.failed ?? '未回报'}</p>{result.failures?.map((failure, n) => <p key={n}>记录 {String(failure.pk ?? '')}：{failure.error}</p>)}</div>)}</details>}</td></tr>;
      })}</tbody></table></div><p>已建立关系：{String(sync.links ?? 0)} 条</p>
      <div className="fd-inline"><Link to="/ontology/explore/objects">打开对象浏览</Link><Link to="/ontology/data/sync">查看原生同步状态</Link></div>
      <p className="mp-onto-muted">原生映射修改与本次逆向方案分别保存。继续从此处同步会沿用本次方案，请先核对来源配置。</p>
    </section>}
  </div>;
}
