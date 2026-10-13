import { describe, expect, it } from 'vitest';
import type { ModelingDraft } from '@/api/ont/modeling';
import { classReviewProblem, confirmCandidates, invalidateSemanticChanges, relationshipReviewProblem, selectedDraft, setIncluded } from './review';

const draft = (): ModelingDraft => ({ schemaVersion: 2, name: '模型', classes: [{ id: 'order', name: '订单', description: '', properties: [{ id: 'code', name: '订单号', dataType: 'text' }], identity: ['code'], identityStatus: 'proposed', identityReason: '订单号在业务中唯一', labelProperty: 'code', accepted: false }], relationships: [{ id: 'r', name: '关联', source: 'order', target: 'order', joins: [{ sourceProperty: 'code', targetProperty: 'code' }], reason: '', cardinality: 'N:1', cardinalityStatus: 'proposed', cardinalityReason: '每个订单对应一个目标订单', targetSelection: 'entity', accepted: false }], mappings: [], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } });

describe('完整审核与发布范围', () => {
  it('一次确认同时记录候选接受和身份/基数审核', () => {
    let value = confirmCandidates(draft(), 'classes', ['order']);
    expect(value.classes[0]).toMatchObject({ accepted: true, identityStatus: 'confirmed' });
    value = confirmCandidates(value, 'relationships', ['r']);
    expect(value.relationships[0]).toMatchObject({ accepted: true, cardinalityStatus: 'confirmed' });
  });
  it('缺依据与不完整关联不能被批量确认', () => {
    const value = draft(); value.classes[0].identityReason = '';
    expect(classReviewProblem(value.classes[0], value)).toContain('依据');
    expect(confirmCandidates(value, 'classes', ['order']).classes[0].accepted).toBe(false);
    value.classes[0].properties.push({ id: 'line', name: '行号', dataType: 'text' });
    value.classes[0].identity.push('line');
    expect(relationshipReviewProblem(value.relationships[0], value)).toContain('行号');
    expect(confirmCandidates(value, 'relationships', ['r']).relationships[0].accepted).toBe(false);
  });
  it('暂缓父类连同后代和端点关系，恢复不自动确认', () => {
    const value = draft(); value.classes.push({ ...structuredClone(value.classes[0]), id: 'child', parentClassId: 'order' });
    const deferred = setIncluded(value, 'classes', 'order', false);
    expect(deferred.classes.every(c => c.included === false)).toBe(true);
    expect(deferred.relationships[0].included).toBe(false);
    expect(selectedDraft(deferred).classes).toHaveLength(0);
    const restored = setIncluded(deferred, 'classes', 'order', true);
    expect(restored.classes[0].accepted).toBe(false);
    expect(restored.classes[1].included).toBe(false);
    expect(value.classes[0].included).toBeUndefined();
  });
});


it('确认对象时一并确认纳入的对象与属性语义，保留其他项和暂缓属性', () => {
  const value = draft();
  value.classes[0].properties.push({ id: 'deferred', name: '暂缓', dataType: 'text', included: false });
  value.semantics.definitions = ['class:order', 'property:order:code', 'property:order:deferred', 'relationship:r'].map(target => ({ target, definition: '业务定义', aliases: [], scope: '', grain: '', unit: '', constraints: '', basis: '业务依据', confirmed: false }));
  const next = confirmCandidates(value, 'classes', ['order']);
  expect(next.semantics.definitions.map(d => d.confirmed)).toEqual([true, true, false, false]);
  expect(value.semantics.definitions.every(d => !d.confirmed)).toBe(true);
  expect(confirmCandidates(next, 'relationships', ['r']).semantics.definitions[3].confirmed).toBe(true);
  value.classes[0].identityReason = '';
  expect(confirmCandidates(value, 'classes', ['order']).semantics.definitions[0].confirmed).toBe(false);
});


it('修改对象内容撤销所属语义，不影响关系语义；单独改语义撤销所属对象', () => {
  let previous = draft();
  previous.semantics.definitions = ['class:order', 'relationship:r'].map(target => ({ target, definition: '定义', aliases: [], scope: '', grain: '', unit: '', constraints: '', basis: '', confirmed: true }));
  previous = confirmCandidates(previous, 'classes', ['order']);
  const next = structuredClone(previous); next.classes[0].description = '新定义';
  invalidateSemanticChanges(previous, next);
  expect(next.classes[0].accepted).toBe(false);
  expect(next.semantics.definitions.map(d => d.confirmed)).toEqual([false, true]);
  const semanticEdit = structuredClone(previous); semanticEdit.semantics.definitions[0].definition = '新语义';
  invalidateSemanticChanges(previous, semanticEdit);
  expect(semanticEdit.classes[0].accepted).toBe(false);
  expect(semanticEdit.semantics.definitions.map(d => d.confirmed)).toEqual([false, true]);
});
