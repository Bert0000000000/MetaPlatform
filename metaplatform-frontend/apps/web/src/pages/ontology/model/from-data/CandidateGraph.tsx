import { useMemo, useState } from 'react';
import type { ModelingDraft } from '@/api/ont/modeling';
import OntologySchemaGraph from '../graph/OntologySchemaGraph';

/** Local view data only: sharing the native renderer never writes native resources. */
export default function CandidateGraph({ draft, layoutKey }: { draft: ModelingDraft; layoutKey?: string }) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('');
  const graph = useMemo(() => {
    const classes = draft.classes.filter(cls => cls.included !== false);
    const ids = new Set(classes.map(cls => cls.id));
    const relationships = draft.relationships.filter(rel => rel.included !== false && ids.has(rel.source) && ids.has(rel.target)).map(rel => ({
      ...rel, name: `${rel.name} · ${rel.cardinalityStatus === 'unresolved' || !rel.cardinality ? '基数待确定' : rel.cardinality}`,
    }));
    const inheritance = classes.filter(cls => cls.parentClassId && ids.has(cls.parentClassId)).map(cls => ({
      id: `inheritance:${cls.id}`, name: '继承', source: cls.id, target: cls.parentClassId!,
    }));
    return { classes, relationships: [...relationships, ...inheritance] };
  }, [draft]);
  const selected = draft.classes.find(cls => cls.id === selectedId);
  return <section className="fd-card" aria-label="候选本体图谱">
    <h3>本体图谱预览</h3><p className="mp-onto-muted">查看候选对象、属性、业务关系和子类继承。与模型工作台使用同一图谱，支持搜索、拖动、缩放及局部关联；点击对象查看候选详情。</p>
    {!graph.classes.length ? <p>暂无候选对象类型</p> : <div>
      <OntologySchemaGraph classes={graph.classes} relationships={graph.relationships} selected={selectedId}
        onSelect={id => { setSelectedId(id); setSelectedRelation(''); }} onOpen={setSelectedId}
        selectedRelation={selectedRelation} onRelationSelect={setSelectedRelation}
        layoutKey={`ontology-discovery:${layoutKey ?? draft.name + ':' + graph.classes.map(cls => cls.id).join(',')}`} compact />
      {selected && <section className="fd-card" aria-label="候选模型详情"><h4>{selected.name}</h4><p>{selected.description || '尚未填写业务定义'}</p><p>业务粒度：{selected.grain || '待确认'}</p><p>父类：{draft.classes.find(cls => cls.id === selected.parentClassId)?.name ?? '独立类'}</p><p>业务身份：{selected.identity.map(id => selected.properties.find(p => p.id === id)?.name ?? id).join(' + ') || '未确定，采用来源记录技术身份'}</p><ul>{selected.properties.map(prop => <li key={prop.id}>{prop.name} · {prop.dataType}{selected.identity.includes(prop.id) ? ' · 身份属性' : ''}{prop.included === false ? ' · 本次暂缓' : ''}</li>)}</ul><ul>{draft.relationships.filter(rel => rel.source === selected.id || rel.target === selected.id).map(rel => <li key={rel.id}>{rel.name}：{draft.classes.find(cls => cls.id === rel.source)?.name} → {draft.classes.find(cls => cls.id === rel.target)?.name} · {rel.cardinality ?? '基数待确定'}</li>)}</ul></section>}
    </div>}
  </section>;
}
