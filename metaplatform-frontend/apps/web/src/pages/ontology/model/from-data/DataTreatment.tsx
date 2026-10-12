import { useEffect, useState } from 'react';
import { Banner, Button, Checkbox, Spin, Tag } from '@douyinfe/semi-ui';
import type { ModelingSource } from '@/api/ont/modeling';

const valueText = (value: unknown) => value == null ? '空值' : String(value);

export default function DataTreatment({ source, busy, onAnalyze, onConfirm, onExport }: {
  source: ModelingSource; busy: boolean; onAnalyze?: () => void; onConfirm?: (keys: string[]) => void; onExport?: () => void;
}) {
  const state = source.dataRepair;
  const proposal = state?.status === 'succeeded' ? state.proposal : undefined;
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected(proposal?.repairs.map(r => r.key) ?? []); }, [proposal?.id, source.revision]);
  const partial = source.syncCheck?.sourceRevision === source.revision ? source.syncCheck?.partial : null;
  const running = state?.status === 'running';
  return <section className="fd-card" aria-label="AI 修复与暂缓处理">
    <div className="fd-section-head"><div><h3>AI 修复与暂缓处理</h3><p className="mp-onto-muted">AI 提出有来源依据的修复，确认后重新检查。无法可靠修复的记录暂缓，其余合格数据可单独同步。</p></div>
      <Button loading={running} disabled={busy || running || !onAnalyze} onClick={onAnalyze}>{running ? 'AI 正在分析…' : 'AI 分析修复方案'}</Button></div>
    {running && <div className="fd-status" role="status"><Spin size="small" />正在分析冲突及可修复范围，尚未修改数据；可以稍后回来查看。</div>}
    {state?.error && <Banner type="danger" description={state.error} closeIcon={null} />}
    {state?.notice && <p className="mp-onto-muted">{state.notice}</p>}
    {proposal && <div aria-label="待确认修复方案">
      <p>本批建议修复 <strong>{proposal.repairs.length}</strong> 组。全部采用后，预计可入库对象 {proposal.before.counts.nodes} → {proposal.after.counts.nodes}，暂缓来源行 {proposal.before.quarantine.rows} → {proposal.after.quarantine.rows}。</p>
      {!!proposal.repairs.length ? <>
        <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>采用</th><th>对象及身份</th><th>修复前 → 建议值</th><th>依据</th></tr></thead><tbody>{proposal.repairs.map(repair => <tr key={repair.key}>
          <td><Checkbox aria-label={`采用修复 ${repair.name} ${repair.identity.map(valueText).join(' + ')}`} disabled={busy} checked={selected.includes(repair.key)} onChange={e => setSelected(keys => e.target.checked ? [...keys, repair.key] : keys.filter(k => k !== repair.key))} /></td>
          <td><strong>{repair.name}</strong><p>{repair.identity.map(valueText).join(' + ')}</p></td>
          <td>{Object.entries(repair.values).map(([prop,value]) => <div key={prop}><strong>{repair.properties[prop] ?? prop}</strong><p>{repair.before[prop].map(v => valueText(v.value)).join(' / ')} → {valueText(value)}</p><details><summary>来源依据</summary>{repair.before[prop].map((variant,i) => <p key={i}>{valueText(variant.value)}：{variant.rows.map(r => `${r.sheet}:${r.row}`).join('、')}</p>)}</details></div>)}</td>
          <td>{repair.reason}</td></tr>)}</tbody></table></div>
        <div className="fd-actions"><Button theme="solid" disabled={busy || !selected.length || !onConfirm} onClick={() => onConfirm?.(selected)}>确认采用 {selected.length} 组修复并重新检查</Button></div>
      </> : <p>本批没有足够依据的修复建议。可确认暂缓问题记录，先同步合格数据；身份或粒度变更需按平台建模与迁移流程处理。</p>}
    </div>}
    {state?.status === 'confirmed' && <p role="status">所选修复已确认，已保留修复依据与审核记录。请查看最新数据检查结果；剩余冲突可再次分析。</p>}
    {!!source.dataTreatment?.audit.length && <details><summary>查看已确认修复记录（{source.dataTreatment.audit.length}）</summary>{source.dataTreatment.audit.map((item,i) => <p key={i}>{new Date(item.at).toLocaleString()} · {item.actor} · {item.reason}</p>)}</details>}
    {partial && <div aria-label="暂缓数据范围"><div className="fd-section-head"><h3>暂缓数据 <Tag color="orange">涉及 {partial.quarantine.rows.toLocaleString()} 行</Tag></h3><Button disabled={busy || !onExport} onClick={onExport}>导出全部暂缓明细</Button></div>
      <p className="mp-onto-muted">按当前规则隔离问题来源行或整个冲突身份组；无法建立的关系也不写入。原始 Excel 保留，暂缓不删除平台已有实例或旧关系。</p>
      {!!partial.quarantine.groups.length && <details><summary>查看暂缓原因（{partial.quarantine.groups.length}{partial.quarantine.groupsTruncated ? '+' : ''} 组）</summary><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>对象 / 关系</th><th>原因</th><th>涉及数量</th><th>示例来源行</th></tr></thead><tbody>{partial.quarantine.groups.map((g,i) => <tr key={i}><td>{g.name}</td><td>{g.reason}</td><td>{g.count.toLocaleString()}</td><td>{g.examples.map(r => `${r.sheet}:${r.row}`).join('、') || '关系暂缓'}</td></tr>)}</tbody></table></div></details>}
    </div>}
  </section>;
}
