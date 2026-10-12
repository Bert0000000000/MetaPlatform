import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ModelingDraft, ModelingProfile } from '@/api/ont/modeling';
import ParentIdentityRepair from './ParentIdentityRepair';
import { classReviewProblem } from './review';

afterEach(cleanup);
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
function fixture(): ModelingDraft {
  return { schemaVersion: 2, name: '模型', classes: [
    { id: 'material', name: '物料', description: '', properties: [{ id: 'material_code', name: '物料编码', dataType: 'text' }], identity: ['material_code'], labelProperty: 'material_code', accepted: true },
    { id: 'product', name: '产成品', description: '', parentClassId: 'material', inheritanceReason: '产成品是一种物料', properties: [{ id: 'product_code', name: '产品编码', dataType: 'text' }], identity: ['product_code'], labelProperty: 'product_code', identityReason: '产品编码为业务标识', identityStatus: 'confirmed', accepted: true },
  ], mappings: [{ id: 'map', classId: 'product', sheet: '产成品', bindings: { product_code: '产品编码' }, accepted: true, reason: '' }], relationships: [{ id: 'rel', name: '关联产品', source: 'material', target: 'product', joins: [{ sourceProperty: 'material_code', targetProperty: 'product_code' }], accepted: true, cardinalityStatus: 'confirmed', reason: '' }], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [{ target: 'class:product', definition: '', aliases: [], scope: '', grain: '', unit: '', constraints: '', basis: '', confirmed: true }] } };
}
const profile: ModelingProfile = { rowCount: 3, sheets: [{ name: '产成品', rows: 3, columns: [{ name: '产品编码', dataType: 'text', nonNull: 3, uniqueCount: 3, unique: true, samples: [] }] }] };

it('用户明确确认来源列后沿用父类身份，保留原属性并使关联审核失效', () => {
  const draft = fixture(); const onChange = vi.fn();
  render(<ParentIdentityRepair cls={draft.classes[1]} draft={draft} profile={profile} locked={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: '沿用父类身份' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('combobox', { name: 'map material_code 对应来源列' })).toHaveValue('产品编码');
  fireEvent.click(screen.getByRole('button', { name: '应用并重新审核' }));
  const next = onChange.mock.calls[0][0] as ModelingDraft;
  expect(classReviewProblem(next.classes[1], next)).toBe('');
  expect(next.classes[1]).toMatchObject({ identity: ['material_code'], identityStatus: 'proposed', accepted: false });
  expect(next.classes[1].properties.map(p => p.id)).toEqual(['product_code', 'material_code']);
  expect(next.mappings[0]).toMatchObject({ accepted: false, bindings: { product_code: '产品编码', material_code: '产品编码' } });
  expect(next.relationships[0]).toMatchObject({ accepted: false, cardinalityStatus: 'proposed' });
  expect(next.semantics.definitions[0].confirmed).toBe(false);
  expect(draft.classes[1].identity).toEqual(['product_code']);
});

it('复合身份不能自动猜测来源列，缺少映射时禁止应用', () => {
  const draft = fixture(); draft.classes[0].properties.push({ id: 'org', name: '组织', dataType: 'text' }); draft.classes[0].identity.push('org');
  render(<ParentIdentityRepair cls={draft.classes[1]} draft={draft} profile={profile} locked={false} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '沿用父类身份' }));
  expect(screen.getByRole('combobox', { name: 'map material_code 对应来源列' })).toHaveValue('');
  expect(screen.getByRole('button', { name: '应用并重新审核' })).toBeDisabled();
});

it('已发布候选禁止修改身份', () => {
  const draft = fixture();
  render(<ParentIdentityRepair cls={draft.classes[1]} draft={draft} profile={profile} locked onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: '沿用父类身份' })).toBeDisabled();
});
