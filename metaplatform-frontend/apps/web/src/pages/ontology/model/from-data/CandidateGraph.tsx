import { useMemo, useState } from 'react';
import type { KernelObjectType, KernelLinkType } from '@/api/ont/kernel';
import type { ModelingDraft } from '@/api/ont/modeling';
import ModelGraphCanvas from '../graph/ModelGraphCanvas';
import '../graph/model-workbench.css';

/** Local view data only: sharing the native renderer never writes native resources. */
export default function CandidateGraph({ draft }: { draft: ModelingDraft }) {
  const [selectedId, setSelectedId] = useState('');
  const graph = useMemo(() => {
    const types: KernelObjectType[] = draft.classes.map(cls => ({
      rid: cls.id, display_name: cls.name, description: cls.description,
      primary_key: cls.identity, parent_class: cls.parentClassId ?? undefined, interfaces: [],
      properties: cls.properties.map(prop => ({ rid: prop.id, title: prop.name,
        type_id: { text: 'string', number: 'double', date: 'date' }[prop.dataType],
        format: prop.dataType, nullable: !cls.identity.includes(prop.id), primary_key: cls.identity.includes(prop.id) })),
    }));
    const ids = new Set(types.map(type => type.rid));
    const links: KernelLinkType[] = draft.relationships.filter(rel => ids.has(rel.source) && ids.has(rel.target)).map(rel => ({
      rid: rel.id, src: rel.source, dst: rel.target, cardinality: rel.cardinality ?? 'N:N', directionality: 'directed', link_properties: [],
    }));
    const labels = Object.fromEntries(draft.relationships.map(rel => [rel.id, `${rel.name} · ${rel.cardinalityStatus === 'unresolved' || !rel.cardinality ? '基数待确定' : rel.cardinality}`]));
    return { types, links, labels };
  }, [draft]);
  const selected = draft.classes.find(cls => cls.id === selectedId);
  return <section className="fd-card" aria-label="候选本体图谱">
    <h3>本体图谱预览</h3><p className="mp-onto-muted">查看候选对象、属性、业务关系和子类继承。点击或双击卡片查看详情。</p>
    {!graph.types.length ? <p>暂无候选对象类型</p> : <div className="mw-workbench">
      <ModelGraphCanvas types={graph.types} links={graph.links} labelOverrides={graph.labels} showInheritance selectedRid={selectedId} onSelect={setSelectedId} onOpen={setSelectedId} />
      {selected && <section className="fd-card" aria-label="候选模型详情"><h4>{selected.name}</h4><p>{selected.description || '尚未填写业务定义'}</p><p>业务粒度：{selected.grain || '待确认'}</p><p>父类：{draft.classes.find(cls => cls.id === selected.parentClassId)?.name ?? '独立类'}</p><p>业务身份：{selected.identity.map(id => selected.properties.find(p => p.id === id)?.name ?? id).join(' + ') || '未确定，采用来源记录技术身份'}</p><ul>{selected.properties.map(prop => <li key={prop.id}>{prop.name} · {prop.dataType}{selected.identity.includes(prop.id) ? ' · 身份属性' : ''}</li>)}</ul><ul>{draft.relationships.filter(rel => rel.source === selected.id || rel.target === selected.id).map(rel => <li key={rel.id}>{rel.name}：{draft.classes.find(cls => cls.id === rel.source)?.name} → {draft.classes.find(cls => cls.id === rel.target)?.name} · {rel.cardinality ?? '基数待确定'}</li>)}</ul></section>}
    </div>}
  </section>;
}
