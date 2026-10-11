import { useEffect, useRef, useState } from 'react';
import { createLinkType, errDetailText, listObjectTypes, listValueTypes, type KernelLinkType, type KernelObjectType, type KernelValueType } from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';
import { ridTail } from '../../rid';
import PropertyEditorV2, { draftFromProperty, draftToPropertyDTO, emptyPropertyDraft, validatePropertyDraft, type PropertyDraft } from '../../components/PropertyEditorV2';

const slug = (name: string) => name.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');
export default function LinkTypeEditor({ initial, source = '', protectedStructure, existingRids, catalogReady, catalogError, onRetryCatalog, onSaved, onCancel }: {
  initial?: KernelLinkType; source?: string; protectedStructure: boolean; existingRids: string[];
  catalogReady: boolean; catalogError: string; onRetryCatalog: () => void;
  onSaved: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.src_display_name || '');
  const [identifier, setIdentifier] = useState(initial ? ridTail(initial.rid) : '');
  const [identifierEdited, setIdentifierEdited] = useState(false);
  const [advancedRid, setAdvancedRid] = useState(initial?.rid || '');
  const [src, setSrc] = useState(initial?.src || source), [dst, setDst] = useState(initial?.dst || '');
  const [cardinality, setCardinality] = useState(initial?.cardinality || '1:N');
  const [directionality, setDirectionality] = useState(initial?.directionality || 'directed');
  const [dstName, setDstName] = useState(initial?.dst_display_name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [properties, setProperties] = useState<PropertyDraft[]>(() => (initial?.link_properties || []).map(draftFromProperty));
  const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const [valueTypes, setValueTypes] = useState<KernelValueType[]>([]);
  const [loadError, setLoadError] = useState(''), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const tenant = getTenantId() || src.split('.')[1] || '';
  const rid = advancedRid || ('ont.' + tenant + '.link.' + identifier);
  const locked = Boolean(initial && protectedStructure);
  useEffect(() => {
    let alive = true; setLoading(true); setLoadError('');
    const loadTypes = async () => {
      const found = new Map<string, KernelObjectType>();
      for (let offset = 0; alive; offset += 100) {
        const page = await listObjectTypes({ limit: 100, offset });
        if (page.length === 100 && page.every(t => found.has(t.rid))) throw new Error('对象类型分页未前进，请重试');
        page.forEach(t => found.set(t.rid, t));
        if (page.length < 100) break;
      }
      return [...found.values()];
    };
    Promise.all([loadTypes(), listValueTypes()]).then(([ots, vts]) => {
      if (alive) { setObjectTypes(ots); setValueTypes(vts); }
    }).catch(e => { if (alive) setLoadError(errDetailText(e, '对象类型读取失败')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [retry]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (submitting.current || loading || loadError || (!initial && !catalogReady)) return;
    const drafts = properties.map(p => ({ ...p, rid: p.isNew ? rid + '.prop.' + p.name : p.rid }));
    const errors = drafts.flatMap(p => validatePropertyDraft(p, valueTypes));
    if (!name.trim() || !identifier.trim() || !src || !dst) errors.push('请填写关系名称、标识和两端对象类型');
    if (!initial && existingRids.includes(rid)) errors.push('关系标识已存在，请修改标识或使用编辑关系');
    if (errors.length) { setError(errors.join('；')); return; }
    submitting.current = true; setSaving(true); setError('');
    try {
      await createLinkType({ rid, src, dst, cardinality, directionality, src_display_name: name.trim(),
        dst_display_name: dstName.trim(), description: description.trim(), link_properties: drafts.map(p => draftToPropertyDTO(p, valueTypes)) }, !initial);
      onSaved();
    } catch (e) { setError(errDetailText(e, '保存关系失败')); }
    finally { submitting.current = false; setSaving(false); }
  };
  return <form aria-label="关系定义表单" onSubmit={e => void save(e)} className="mp-flex mp-flex-col mp-gap-3">
    {loadError ? <div role="alert">{loadError}<button type="button" onClick={() => setRetry(v => v + 1)}>重试对象类型</button></div> : null}
    {locked ? <p>已有实例或统计不可用：源、目标、基数和方向受保护。名称与说明仍可编辑，服务端会复核保护状态。</p> : null}
    <fieldset disabled={saving} className="mp-flex mp-flex-col mp-gap-3">
      <label>关系名称（源端名称）<input aria-label="关系名称" className="mp-onto-input" required value={name} onChange={e => {
        setName(e.target.value); if (!identifierEdited && !initial) setIdentifier(slug(e.target.value));
      }} /></label>
      <label>关系标识<input className="mp-onto-input" required disabled={Boolean(initial)} value={identifier} onChange={e => { setIdentifierEdited(true); setIdentifier(e.target.value); }} /></label>
      <label>源对象类型<select className="mp-onto-input" required disabled={locked || loading || Boolean(loadError)} value={src} onChange={e => setSrc(e.target.value)}>
        <option value="">选择源类型</option>{objectTypes.map(t => <option key={t.rid} value={t.rid}>{t.display_name || ridTail(t.rid)}</option>)}
      </select></label>
      <label>目标对象类型<select className="mp-onto-input" required disabled={locked || loading || Boolean(loadError)} value={dst} onChange={e => setDst(e.target.value)}>
        <option value="">选择目标类型</option>{objectTypes.map(t => <option key={t.rid} value={t.rid}>{t.display_name || ridTail(t.rid)}</option>)}
      </select></label>
      <label>基数<select className="mp-onto-input" disabled={locked} value={cardinality} onChange={e => setCardinality(e.target.value)}>
        <option value="1:1">一对一</option><option value="1:N">一对多</option><option value="N:1">多对一</option><option value="N:N">多对多</option>
      </select></label>
      <label>方向<select className="mp-onto-input" disabled={locked} value={directionality} onChange={e => setDirectionality(e.target.value)}>
        <option value="directed">有向</option><option value="undirected">无向</option><option value="bidirectional">双向</option>
      </select></label>
      <label>目标端名称<input className="mp-onto-input" value={dstName} onChange={e => setDstName(e.target.value)} /></label>
      <label>说明<textarea className="mp-onto-input" value={description} onChange={e => setDescription(e.target.value)} /></label>
      <details><summary>高级：技术 RID</summary><label>技术 RID<input className="mp-onto-input" value={advancedRid || rid} disabled={Boolean(initial)} onChange={e => setAdvancedRid(e.target.value)} /></label></details>
      <h3>关系属性</h3>
      {properties.map((p, index) => <div key={p.uid}>
        <PropertyEditorV2 draft={{ ...p, rid: p.isNew ? rid + '.prop.' + p.name : p.rid }} valueTypes={valueTypes} objectTypes={objectTypes}
          linkTypes={initial ? [initial] : []} currentTypeRid={src} onChange={next => setProperties(ps => ps.map((q, i) => i === index ? next : q))} />
        <button type="button" onClick={() => setProperties(ps => ps.filter((_, i) => i !== index))}>移除属性</button>
      </div>)}
      <button type="button" onClick={() => setProperties(ps => [...ps, emptyPropertyDraft()])}>添加关系属性</button>
    </fieldset>
    {!initial && !catalogReady ? <div role={catalogError ? 'alert' : 'status'}>
      {catalogError ? '关系目录读取失败：' + catalogError : '关系目录加载中…'}
      {catalogError ? <button type="button" onClick={onRetryCatalog}>重试关系目录</button> : null}
    </div> : null}
    {error ? <div role="alert">{error}</div> : null}
    <p>关系定义描述业务关联；继承属于对象类型层级。普通 customer_id 属性不会自动生成关联。</p>
    <div className="mp-flex mp-gap-2"><button type="submit" disabled={saving || loading || Boolean(loadError) || (!initial && !catalogReady)}>{saving ? '保存中…' : '保存关系'}</button>
      <button type="button" disabled={saving} onClick={onCancel}>取消</button></div>
  </form>;
}
