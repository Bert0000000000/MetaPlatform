import { useCallback, useEffect, useState } from 'react';
import { getOrderRuntimeData, getOrderRuntimeHistory, previewOrderPage, proposeOrderReview, type OrderRuntimeData } from '@/api/apphub/runtime';
import { type ActionAuditRow } from '@/api/ont/kernel';
import type { OrderBinding, PageDesignerConfig } from '@/api/apphub/pages';
import ProposalConfirmDrawer from '@/pages/ontology/components/ProposalConfirmDrawer';

function display(value: unknown): string {
  if (value && typeof value === 'object' && 'value' in value) return display((value as { value: unknown }).value);
  return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export default function OrderReviewRuntime({ appId, pageId, binding, previewConfig }: { appId: string; pageId: string; binding: OrderBinding; previewConfig?: PageDesignerConfig }) {
  const [data, setData] = useState<OrderRuntimeData | null>(null);
  const [audit, setAudit] = useState<ActionAuditRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const actual = await (previewConfig ? previewOrderPage(pageId, previewConfig) : getOrderRuntimeData(appId, pageId));
      const receipts = previewConfig ? [] : await getOrderRuntimeHistory(appId, pageId);
      setData(actual);
      setAudit(receipts);
    } catch (e) { setData(null); setError(e instanceof Error ? e.message : '订单数据不可用，请重试'); }
    finally { setBusy(false); }
  }, [appId, pageId, binding.action_rid, previewConfig]);
  useEffect(() => { void load(); }, [load]);
  const propose = async (rid: string) => {
    setBusy(true); setError('');
    try {
      const result = await proposeOrderReview(appId, pageId, rid, parameters);
      if (!result.success || !result.data?.proposal_id) throw new Error(result.error || '未返回提案，未执行审核');
      setProposal(String(result.data.proposal_id));
    } catch (e) { setError(e instanceof Error ? e.message : '创建提案失败'); }
    finally { setBusy(false); }
  };
  return <section aria-label="订单审核运行页">
    <h2>{previewConfig ? '订单审核草稿预览' : '订单审核'}</h2>{previewConfig && <p>预览读取当前绑定数据。保存并发布后可创建审核提案。</p>}<p>运行版本：{data?.version || '加载中'}</p>
    {error && <div role="alert">{error}</div>}
    <button onClick={() => void load()} disabled={busy}>刷新订单与执行回执</button>
    {data && <>
      <p>订单 {data.orders.length} 条 · 客户 {data.customers.length} 条 · 关联 {data.links.length} 条</p>
      {(data.binding.action_parameters ?? []).map(p => <label key={p.rid}>{p.title || p.rid}
        <input aria-label={p.title || p.rid} value={String(parameters[p.rid] ?? '')} required={!p.nullable}
          onChange={e => setParameters({ ...parameters, [p.rid]: ['integer', 'number', 'decimal', 'float'].includes(p.format) ? Number(e.target.value) : e.target.value })} />
      </label>)}
      <table><thead><tr><th>订单</th>{(data.binding.field_metadata ?? []).map(f => <th key={f.rid}>{f.title || f.rid}</th>)}<th>关联客户</th><th>审核</th></tr></thead>
        <tbody>{data.orders.map(order => {
          const customerIds = data.links.filter(l => l.src === order.rid || l.dst === order.rid).map(l => l.src === order.rid ? l.dst : l.src);
          return <tr key={order.rid}><td>{order.primary_key}</td>{data.binding.fields.map(f => <td key={f}>{display(order.props[f])}</td>)}
            <td>{data.customers.filter(c => customerIds.includes(c.rid)).map(c => c.primary_key).join('、') || '尚无客户关联实例'}</td>
            <td><button disabled={busy || !!previewConfig} onClick={() => void propose(order.rid)}>创建审核提案</button></td></tr>;
        })}</tbody></table>
      {!data.orders.length && <p>当前 ObjectSet 无订单。请调整筛选或完成数据导入。</p>}
      <h3>实际执行回执</h3>
      {audit.length ? audit.map(r => <article key={r.audit_id}><p>回执 {r.audit_id} · 提案 {r.proposal_id}</p><p>执行人 {r.actor_id} · {r.created_at}</p><pre>{JSON.stringify(r.result, null, 2)}</pre></article>) : <p>当前页面发布版本尚无执行回执</p>}
    </>}
    <ProposalConfirmDrawer open={!!proposal} proposalId={proposal} initialKind="action"
      onClosed={() => setProposal(null)} onExecuted={() => { void load(); }} />
  </section>;
}
