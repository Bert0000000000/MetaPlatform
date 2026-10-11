import { useCallback, useEffect, useState } from 'react';
import { listObjectTypes, listLinkTypes, listActionTypes, type KernelObjectType, type KernelLinkType, type KernelActionType } from '@/api/ont/kernel';
import type { OrderBinding } from '@/api/apphub/pages';

const empty: OrderBinding = { object_type: '', model_checksum: '', customer_type: '', customer_checksum: '', fields: [], link_type: '', action_rid: '', object_set: { filter_expr: '', paging_limit: 100 } };

export default function OrderReviewBinding({ value, onChange }: { value?: OrderBinding; onChange: (value: OrderBinding) => void }) {
  const [models, setModels] = useState<KernelObjectType[]>([]);
  const [links, setLinks] = useState<KernelLinkType[]>([]);
  const [actions, setActions] = useState<KernelActionType[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const binding = value ?? empty;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [m, l, a] = await Promise.all([listObjectTypes(), listLinkTypes(), listActionTypes()]);
      setModels(m.filter(x => x.status === 'active' && x.checksum)); setLinks(l); setActions(a);
    } catch (e) { setError(e instanceof Error ? e.message : '元数据加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const order = models.find(m => m.rid === binding.object_type);
  const change = (patch: Partial<OrderBinding>) => onChange({ ...binding, ...patch, action_checksum: undefined, link_checksum: undefined });
  return <section aria-label="订单审核绑定" className="mp-p-4">
    <h3>订单审核应用</h3>
    <p>选择已发布对象、真实字段、客户关联和审核动作。发布时服务端会再次核验版本与权限。</p>
    {error && <div role="alert">{error}<button onClick={() => void load()}>重试元数据</button></div>}
    {loading ? <p>加载元数据…</p> : !error && <>
      <label>订单对象<select aria-label="订单对象" value={binding.object_type} onChange={e => {
        const m = models.find(x => x.rid === e.target.value);
        if (m) change({ object_type: m.rid, model_checksum: m.checksum!, fields: m.properties.map(p => p.rid), action_rid: '', link_type: '' });
      }}><option value="">选择已发布订单对象</option>{models.map(m => <option key={m.rid} value={m.rid}>{m.display_name || m.rid}</option>)}</select></label>
      <p>模型指纹：{binding.model_checksum || '未选择'}</p>
      {order && <fieldset><legend>运行页字段（只读，修改通过人工审核动作）</legend>{order.properties.map(p => <label key={p.rid} className="mp-mr-3">
        <input type="checkbox" checked={binding.fields.includes(p.rid)} onChange={e => change({ fields: e.target.checked ? [...binding.fields, p.rid] : binding.fields.filter(f => f !== p.rid) })} />
        {p.title || p.rid}（{p.format}）
      </label>)}</fieldset>}
      <label>客户对象<select aria-label="客户对象" value={binding.customer_type} onChange={e => {
        const m = models.find(x => x.rid === e.target.value);
        if (m) change({ customer_type: m.rid, customer_checksum: m.checksum!, link_type: '' });
      }}><option value="">选择客户对象</option>{models.filter(m => m.rid !== binding.object_type).map(m => <option key={m.rid} value={m.rid}>{m.display_name || m.rid}</option>)}</select></label>
      <label>客户关系<select aria-label="客户关系" value={binding.link_type} onChange={e => change({ link_type: e.target.value })}>
        <option value="">选择已定义关系</option>{links.filter(l => [l.src, l.dst].includes(binding.object_type) && [l.src, l.dst].includes(binding.customer_type)).map(l => <option key={l.rid} value={l.rid}>{l.rid}</option>)}
      </select></label>
      <label>审核动作<select aria-label="审核动作" value={binding.action_rid} onChange={e => change({ action_rid: e.target.value })}>
        <option value="">选择已注册动作</option>{actions.filter(a => a.on.includes(binding.object_type)).map(a => <option key={a.rid} value={a.rid}>{a.title || a.rid}</option>)}
      </select></label>
      <label>ObjectSet 筛选表达式<input aria-label="ObjectSet 筛选表达式" value={binding.object_set.filter_expr} onChange={e => change({ object_set: { ...binding.object_set, filter_expr: e.target.value } })} /></label>
      <button type="button" onClick={() => {
        const customer = models.find(m => m.rid === binding.customer_type);
        if (order && customer) change({ model_checksum: order.checksum!, customer_checksum: customer.checksum!, fields: binding.fields.filter(f => order.properties.some(p => p.rid === f)) });
      }}>采用当前已发布模型版本</button>
    </>}
  </section>;
}
