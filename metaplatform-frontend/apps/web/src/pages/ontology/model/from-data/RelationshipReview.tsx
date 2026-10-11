import type { ModelingClass, ModelingProfile, ModelingRelationship } from '@/api/ont/modeling';
import EvidenceEditor from './EvidenceEditor';
export default function RelationshipReview({ relation, target, profile, onChange }: { relation: ModelingRelationship; target?: ModelingClass; profile: ModelingProfile; onChange: (patch: Partial<ModelingRelationship>) => void }) {
  const covered = new Set(relation.joins.map(j => j.targetProperty));
  const keys = [target?.identity ?? [], ...(target?.uniqueKeys ?? []).filter(k => k.confirmed && k.reason.trim()).map(k => k.properties)].filter(k => k.length);
  const complete = keys.some(k => k.every(p => covered.has(p)));
  const edit = (patch: Partial<ModelingRelationship>) => onChange({ ...patch, ...(relation.cardinalityStatus === 'confirmed' ? { cardinalityStatus: 'proposed' as const } : {}) });
  return <fieldset><legend>关联规则审核</legend><p className="mp-onto-muted">关联字段不证明业务基数。填写规则与依据后，勾选上方确认关系即可同时确认基数。</p>
    {(relation.cardinalityStatus ?? 'legacy') === 'legacy' && <p className="fd-warning">历史关系缺少基数审核证据。</p>}
    <div className="fd-grid"><label>关系基数<select aria-label={`${relation.name} 关系基数`} value={relation.cardinality ?? 'N:N'} onChange={e => edit({ cardinality: e.target.value as ModelingRelationship['cardinality'] })}>{Object.entries({ '1:1': '一对一（1:1）', '1:N': '一对多（1:N）', 'N:1': '多对一（N:1）', 'N:N': '多对多（N:N）' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>基数审核状态<select aria-label={`${relation.name} 基数审核状态`} value={relation.cardinalityStatus ?? 'legacy'} onChange={e => onChange({ cardinalityStatus: e.target.value as ModelingRelationship['cardinalityStatus'] })}>{(relation.cardinalityStatus ?? 'legacy') === 'legacy' && <option value="legacy">历史未审核</option>}<option value="proposed">候选待确认</option><option value="unresolved">尚未确定</option><option value="confirmed" disabled>业务已确认（通过确认按钮）</option></select></label>
    <label>目标选择方式<select aria-label={`${relation.name} 目标选择方式`} value={relation.targetSelection ?? 'legacy'} onChange={e => edit({ targetSelection: e.target.value as ModelingRelationship['targetSelection'] })}>{(relation.targetSelection ?? 'legacy') === 'legacy' && <option value="legacy">历史未审核</option>}<option value="entity">单个业务实体</option><option value="group">匹配目标集合</option></select></label>
    <label>基数依据<textarea aria-label={`${relation.name} 基数依据`} value={relation.cardinalityReason ?? ''} onChange={e => edit({ cardinalityReason: e.target.value })} /></label></div>
    <p>目标完整身份 / 已确认替代键：{keys.map(k => k.join(' + ')).join('；') || '尚未定义'}。当前关联目标属性：{[...covered].join(' + ') || '无'}。</p>
    {relation.targetSelection === 'entity' && !complete && <p role="alert">单实体关联必须覆盖完整目标身份或已确认替代唯一键，不能只匹配复合键的一部分。</p>}
    {relation.targetSelection === 'group' && ['N:1', '1:1'].includes(relation.cardinality ?? '') && <p role="alert">集合匹配不能声明每个来源仅有一个目标。</p>}
    <EvidenceEditor label={`${relation.name}关系`} evidence={relation.evidence} profile={profile} onChange={evidence => edit({ evidence })} />
  </fieldset>;
}
