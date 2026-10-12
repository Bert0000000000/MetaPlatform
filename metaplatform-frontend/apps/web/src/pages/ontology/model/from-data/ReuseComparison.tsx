import { useEffect, useState } from 'react';
import { precheckObjectTypes, type KernelObjectType, type ObjectTypeCandidate } from '@/api/ont/kernel';
import type { ModelingClass, ModelingResolution } from '@/api/ont/modeling';
import { localMatches, suggestResolution } from './candidateMatching';

export default function ReuseComparison({ cls, resolution, types, parentRid, onResolve, locked = false }: {
  cls: ModelingClass; resolution: ModelingResolution; types: KernelObjectType[]; parentRid?: string;
  onResolve?: (resolution: ModelingResolution) => void; locked?: boolean;
}) {
  const [matches, setMatches] = useState<ObjectTypeCandidate[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setMatches([]);
    if (!types.length) { setStatus(''); return; }
    setStatus('正在匹配已有企业本体…');
    void (async () => {
      try {
        const result = await precheckObjectTypes({ name: cls.name, slug: cls.id, top_k: 5 });
        if (active) { setMatches(result.candidates.filter(m => m.similarity >= 0.7)); setStatus(''); }
      } catch {
        if (active) setStatus('相似匹配暂时不可用，请手动核对已有类型；这不代表没有相似对象。');
      }
    })();
    return () => { active = false; };
  }, [cls.name, cls.id, types]);
  const target = types.find(t => t.rid === resolution.targetRid);
  const exact = localMatches(cls, types);
  const suggestions = types.filter(t => exact.includes(t) || matches.some(m => m.rid === t.rid));
  return <>
    <aside aria-label={`${cls.name} 同名建议`}>
      <h4>已有本体匹配与合并确认</h4>
      <p>先核对业务含义、粒度和身份，再选择复用、扩展属性或新增；无法判断可暂缓。相似度仅供参考。</p>
      {status && <p role="status">{status}</p>}
      {!status && !suggestions.length && <p>当前未发现相似建议，仍可在目标类型中手动选择。</p>}
      {suggestions.map(t => {
        const suggested = suggestResolution(cls, t);
        const match = matches.find(m => m.rid === t.rid);
        return <section key={t.rid} aria-label={`匹配建议 ${t.display_name}`}>
          <strong>{t.display_name || t.rid}</strong><p>{t.description || '已有类型未填写业务定义，请人工核对。'}</p>
          <p>匹配依据：{exact.includes(t) ? '名称或稳定标识一致' : '平台名称与标识相似匹配'}{match ? `（相似度 ${Math.round(match.similarity * 100)}%）` : ''}；可建议对应 {Object.keys(suggested.propertyMap).length} / {cls.properties.length} 个属性。字段对应仅按名称或标识及类型核对，不证明业务同义。</p>
          {onResolve && <button type="button" disabled={locked} onClick={() => onResolve(suggested)}>选择{t.display_name || t.rid}并核对{suggested.mode === 'reuse' ? '复用' : '扩展'}建议</button>}
        </section>;
      })}
    </aside>
    {resolution.mode !== 'new' && (target ? <aside aria-label={`${cls.name} 复用对比`}>
      <h4>候选与已有本体对比</h4><p>字段对应可修改。复用保留已有定义，扩展只提出新增属性；保存候选不会写入正式本体。</p>
      <table className="fd-table"><thead><tr><th>项目</th><th>候选</th><th>已有目标</th></tr></thead><tbody>
        <tr><th>定义 / 粒度</th><td>{cls.description} / {cls.grain || '未填写'}</td><td>{target.description || '未提供'}</td></tr>
        <tr><th>映射后身份</th><td>{cls.identity.map(p => resolution.propertyMap[p] || `未映射:${p}`).join(' + ')}</td><td>{target.primary_key.join(' + ')}</td></tr>
        <tr><th>父类</th><td>{parentRid || cls.parentClassId || '独立类'}</td><td>{target.parent_class || '独立类'}</td></tr>
        {cls.properties.map(p => { const n = target.properties.find(v => v.rid === resolution.propertyMap[p.id]); return <tr key={p.id}><th>{p.name}</th><td>{p.id} / {p.dataType}</td><td>{n ? `${n.title || n.rid} / ${n.type_id}（请核对业务含义）` : resolution.mode === 'extend' ? '拟新增属性' : '待选择已有属性'}</td></tr>; })}
      </tbody></table>
    </aside> : <p>选择目标后可比较定义与身份。</p>)}
  </>;
}
