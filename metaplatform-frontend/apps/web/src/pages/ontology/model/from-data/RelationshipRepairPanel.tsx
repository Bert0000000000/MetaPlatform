import { Button, Tag } from '@douyinfe/semi-ui';
import type { ModelingDraft, ModelingRelationship } from '@/api/ont/modeling';
import { relationshipRepair } from './relationshipReadiness';

export default function RelationshipRepair({ relation, draft, locked, onChange, onOpenTarget }: {
  relation: ModelingRelationship; draft: ModelingDraft; locked?: boolean;
  onChange: (draft: ModelingDraft) => void; onOpenTarget?: (id: string) => void;
}) {
  const state = relationshipRepair(relation, draft);
  if (relation.included === false || (state.valid.length === relation.joins.length && state.valid.length && (relation.targetSelection !== 'entity' || state.complete))) return null;
  const label = (id: string) => state.target?.properties.find(p => p.id === id)?.name ?? id;
  return <section className="fd-relationship-repair" aria-label={`${relation.name} 关联修复`}>
    <div className="fd-section-head"><strong>关联字段待完善</strong><Tag color="orange">完成后才能确认</Tag></div>
    <p>{state.source?.name ?? '来源对象'} → {state.target?.name ?? '目标对象'}。{state.key.length ? `目标完整身份：${state.key.map(label).join(' + ')}。` : '目标尚未定义可定位的身份，请先核对目标对象。'}</p>
    <p>{state.missing.length ? `缺少关联字段：${state.missing.map(label).join('、')}。` : '尚未配置有效的关联字段。'}证据中引用了来源列，不代表已经配置关联规则。</p>
    {state.suggestions.length > 0 && <><p>建议补充（待你核对）：{state.suggestions.map(j => `${state.source?.properties.find(p => p.id === j.sourceProperty)?.name} → ${label(j.targetProperty)}`).join('；')}。</p>
      <Button size="small" disabled={locked || state.valid.length + state.suggestions.length > 4} onClick={() => {
        const next = structuredClone(draft); Object.assign(next.relationships.find(r => r.id === relation.id)!, { joins: [...state.valid, ...state.suggestions], accepted: false, cardinalityStatus: 'proposed' }); onChange(next);
      }}>采用建议关联字段</Button></>}
    <p className="mp-onto-muted">采用建议不会确认基数或唯一性。若来源缺少复合身份字段，请补充数据；若某字段业务上全局唯一，可到目标对象配置替代唯一键并填写依据。当前数据无重复不代表长期唯一。</p>
    <div className="fd-actions">
      {onOpenTarget && state.target && <Button size="small" theme="borderless" onClick={() => onOpenTarget(state.target!.id)}>核对目标身份 / 替代唯一键</Button>}
      <Button size="small" disabled={locked} onClick={() => { const next = structuredClone(draft); Object.assign(next.relationships.find(r => r.id === relation.id)!, { included: false, accepted: false }); onChange(next); }}>暂不发布此关系</Button>
    </div>
  </section>;
}
