import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DraftEditor from './DraftEditor';
import IdentityReview from './IdentityReview';
import RelationshipReview from './RelationshipReview';
import ReuseComparison from './ReuseComparison';
import type { ModelingClass, ModelingRelationship } from '@/api/ont/modeling';
vi.mock('@douyinfe/semi-ui', () => ({ Modal: () => null, Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>, Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>, Checkbox: ({ children, checked, disabled, onChange, ...props }: { children: React.ReactNode; checked: boolean; disabled?: boolean; onChange: React.ChangeEventHandler<HTMLInputElement> }) => <label><input {...props} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />{children}</label> }));
afterEach(cleanup);
const cls: ModelingClass = { id: 'lot', name: '批次', description: '工厂批次', properties: [{ id: 'plant', name: '工厂', dataType: 'text' }, { id: 'code', name: '编码', dataType: 'text' }], identity: ['plant', 'code'], identityStatus: 'confirmed', identityReason: '各工厂内编码唯一', labelProperty: 'code', accepted: true };
const profile = { rowCount: 0, sheets: [] };
describe('逆向规则人工审核', () => {
 it('未确定身份保留候选且清空业务身份，不由空样本自动决定', () => { const onChange = vi.fn(); render(<IdentityReview cls={cls} profile={profile} locked={false} onChange={onChange} />); expect(screen.getByLabelText('批次 身份状态')).toHaveValue('confirmed'); fireEvent.change(screen.getByLabelText('批次 身份状态'), { target: { value: 'unresolved' } }); expect(onChange).toHaveBeenCalledWith({ identityStatus: 'unresolved', identity: [], identityCandidate: ['plant', 'code'] }); });
 it('身份依据修改退回候选，已发布身份选项锁定', () => { const onChange = vi.fn(); render(<IdentityReview cls={cls} profile={profile} locked onChange={onChange} />); expect(screen.getByLabelText('批次 身份状态')).toBeDisabled(); expect(screen.getByLabelText('批次 候选身份')).toBeDisabled(); fireEvent.change(screen.getByLabelText('批次 身份依据'), { target: { value: '待复核' } }); expect(onChange).toHaveBeenCalledWith({ identityReason: '待复核', identityStatus: 'proposed' }); });
 it('单实体关联指出缺失复合身份，候选基数可编辑但不会自动确认', () => { const relation: ModelingRelationship = { id: 'r', name: '归属', source: 'source', target: 'lot', joins: [{ sourceProperty: 'code', targetProperty: 'code' }], accepted: true, reason: '', cardinality: 'N:1', cardinalityStatus: 'confirmed', targetSelection: 'entity' }; const onChange = vi.fn(); render(<RelationshipReview relation={relation} target={cls} profile={profile} onChange={onChange} />); expect(screen.getByRole('alert')).toHaveTextContent('完整目标身份'); expect(screen.getByText(/plant \+ code/)).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('归属 关系基数'), { target: { value: 'N:N' } }); expect(onChange).toHaveBeenCalledWith({ cardinality: 'N:N', cardinalityStatus: 'proposed' }); });
 it('同名模型仅提示而不自动选择目标', () => { render(<ReuseComparison cls={cls} resolution={{ mode: 'new', propertyMap: {} }} types={[{ rid: 'ont.lot.v1', display_name: '批次', primary_key: [], properties: [], interfaces: [], description: '供应商批次' }]} />); expect(screen.getByLabelText('批次 同名建议')).toHaveTextContent('供应商批次'); expect(screen.queryByRole('button')).not.toBeInTheDocument(); });
});

it('草稿身份修改取消对象和相关关系确认；已发布身份不可勾选', () => {
 const draft = { schemaVersion: 2 as const, name: '模型', classes: [cls], mappings: [], relationships: [{ id: 'r', name: '关系', source: 'lot', target: 'lot', joins: [], reason: '', accepted: true }], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } };
 const onChange = vi.fn(); const props = { draft, profile, types: [], resolutions: {}, onChange, onResolve: vi.fn(), onRename: vi.fn() };
 const view = render(<DraftEditor {...props} />);
 fireEvent.click(screen.getByLabelText('批次 工厂 作为身份'));
 expect(onChange.mock.calls[0][0].classes[0]).toMatchObject({ identity: ['code'], identityStatus: 'proposed', accepted: false });
 expect(onChange.mock.calls[0][0].relationships[0].accepted).toBe(false);
 view.rerender(<DraftEditor {...props} identityLocked />);
 expect(screen.getByLabelText('批次 工厂 作为身份')).toBeDisabled();
});
