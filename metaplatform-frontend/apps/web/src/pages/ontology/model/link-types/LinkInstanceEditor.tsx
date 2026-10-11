import { useEffect, useRef, useState } from 'react';
import { createLinkInstance, errDetailText, listIndividuals, type KernelIndividual, type KernelLinkType } from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';

export default function LinkInstanceEditor({ linkType, onSaved, onCancel }: {
  linkType: KernelLinkType; onSaved: () => void; onCancel: () => void;
}) {
  const [sources, setSources] = useState<KernelIndividual[]>([]), [targets, setTargets] = useState<KernelIndividual[]>([]);
  const [src, setSrc] = useState(''), [dst, setDst] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [retry, setRetry] = useState(0);
  const [sourceOffset, setSourceOffset] = useState(0), [targetOffset, setTargetOffset] = useState(0);
  const [moreSource, setMoreSource] = useState(false), [moreTarget, setMoreTarget] = useState(false);
  const submitting = useRef(false);
  // Retain the operation RID for a network retry, preventing duplicate persisted associations.
  const [rid] = useState(() => 'ont.' + (getTenantId() || linkType.rid.split('.')[1]) + '.lnk.' + crypto.randomUUID());
  useEffect(() => {
    let alive = true; setLoading(true); setLoadError('');
    Promise.all([listIndividuals({ classRid: linkType.src, limit: 200, offset: sourceOffset }),
      listIndividuals({ classRid: linkType.dst, limit: 200, offset: targetOffset })]).then(([s, t]) => {
      if (!alive) return;
      setSources(old => sourceOffset ? [...new Map([...old, ...s].map(v => [v.rid, v])).values()] : s);
      setTargets(old => targetOffset ? [...new Map([...old, ...t].map(v => [v.rid, v])).values()] : t);
      setMoreSource(s.length === 200); setMoreTarget(t.length === 200);
    }).catch(e => { if (alive) setLoadError(errDetailText(e, '对象读取失败')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [linkType.src, linkType.dst, sourceOffset, targetOffset, retry]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (submitting.current || loading || loadError) return;
    if (!src || !dst) { setError('请选择两端实际对象'); return; }
    const props: Record<string, { value: unknown }> = {};
    try {
      for (const p of linkType.link_properties) {
        const input = values[p.rid] || '';
        if (!input) { if (!p.nullable) throw new Error('请填写关系属性：' + p.title); continue; }
        let value: unknown = input;
        if (p.array || p.format === 'struct' || p.format === 'vector') value = JSON.parse(input);
        else if (['integer', 'float', 'double', 'number', 'decimal'].includes(p.format)) {
          value = Number(input); if (!Number.isFinite(value) || (p.format === 'integer' && !Number.isInteger(value))) throw new Error(p.title + '需要有效数字');
        } else if (p.format === 'boolean') {
          if (!['true', 'false'].includes(input)) throw new Error(p.title + '需要 true 或 false'); value = input === 'true';
        }
        props[p.rid] = { value };
      }
    } catch (e) { setError(errDetailText(e, '属性值无效')); return; }
    submitting.current = true; setSaving(true); setError('');
    try { await createLinkInstance({ rid, link_type_rid: linkType.rid, src, dst, props, marking: [] }); onSaved(); }
    catch (e) { setError(errDetailText(e, '保存关联失败')); }
    finally { submitting.current = false; setSaving(false); }
  };
  return <form aria-label="关联对象表单" onSubmit={e => void save(e)} className="mp-flex mp-flex-col mp-gap-3">
    {loadError ? <div role="alert">{loadError}<button type="button" onClick={() => setRetry(v => v + 1)}>重试对象</button></div> : null}
    <fieldset disabled={saving || loading || Boolean(loadError)}>
      <label>源对象<select className="mp-onto-input" required value={src} onChange={e => setSrc(e.target.value)}>
        <option value="">选择源对象</option>{sources.map(i => <option key={i.rid} value={i.rid}>{i.primary_key}</option>)}
      </select></label>
      {moreSource ? <button type="button" onClick={() => setSourceOffset(v => v + 200)}>加载更多源对象</button> : null}
      <label>目标对象<select className="mp-onto-input" required value={dst} onChange={e => setDst(e.target.value)}>
        <option value="">选择目标对象</option>{targets.map(i => <option key={i.rid} value={i.rid}>{i.primary_key}</option>)}
      </select></label>
      {moreTarget ? <button type="button" onClick={() => setTargetOffset(v => v + 200)}>加载更多目标对象</button> : null}
      {linkType.link_properties.map(p => <label key={p.rid}>{p.title || p.rid}
        <input className="mp-onto-input" required={!p.nullable} value={values[p.rid] || ''}
          placeholder={p.array || p.format === 'struct' ? 'JSON' : p.format}
          onChange={e => setValues(old => ({ ...old, [p.rid]: e.target.value }))} /></label>)}
    </fieldset>
    {error ? <div role="alert">{error}</div> : null}
    <button type="submit" disabled={saving || loading || Boolean(loadError)}>{saving ? '保存中…' : '保存关联'}</button>
    <button type="button" disabled={saving} onClick={onCancel}>取消关联</button>
  </form>;
}
