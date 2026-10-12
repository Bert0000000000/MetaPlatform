import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ModelingDraft } from '@/api/ont/modeling';
import RelationshipRepair from './RelationshipRepairPanel';
import { relationshipRepair } from './relationshipReadiness';
import { confirmCandidates, relationshipReviewProblem } from './review';
import ReviewBatch from './ReviewBatch';

vi.mock('@douyinfe/semi-ui', () => ({
  Modal: () => null,
  Checkbox: () => null,
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, size: _size, theme: _theme, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; theme?: string }) => <button {...props}>{children}</button>,
}));

afterEach(cleanup);
const fixture = (): ModelingDraft => ({ schemaVersion: 2, name: '采购', classes: [
  { id: 'shipment', name: '发运详情', properties: [{ id: 'detail_ref', name: '采购明细标识', dataType: 'text' }], identity: ['detail_ref'], labelProperty: 'detail_ref', description: '', accepted: false },
  { id: 'detail', name: '采购明细', properties: [{ id: 'detail_id', name: '采购明细标识', dataType: 'text' }, { id: 'order_id', name: '采购单号', dataType: 'text' }], identity: ['detail_id', 'order_id'], labelProperty: 'detail_id', description: '', accepted: false },
], relationships: [{ id: 'r', name: '发运关联采购明细', source: 'shipment', target: 'detail', joins: [], accepted: false, reason: '', targetSelection: 'entity', cardinality: 'N:1', cardinalityStatus: 'proposed', cardinalityReason: '分批发运属于一条采购明细' }], mappings: [], notes: [], instances: [], instanceEdits: [], links: [], semantics: { context: '', questions: [], definitions: [] } });

describe('关系关联修复', () => {
  it('历史已接受但字段无效的关系不计入批量审核通过数量', () => {
    const value = fixture(); Object.assign(value.relationships[0], { accepted: true, cardinalityStatus: 'confirmed' });
    render(<ReviewBatch draft={value} kind="relationships" onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('关系已确认 0 / 1');
    expect(screen.getByRole('button', { name: '全部确认关系' })).toBeEnabled();
  });
  it('明确缺项，仅在采用后修改映射，部分匹配仍不能审核', () => {
    const value = fixture(); const onChange = vi.fn(); const onOpenTarget = vi.fn();
    render(<RelationshipRepair draft={value} relation={value.relationships[0]} onChange={onChange} onOpenTarget={onOpenTarget} />);
    expect(screen.getByText(/缺少关联字段/)).toHaveTextContent('采购单号');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '采用建议关联字段' }));
    const next = onChange.mock.calls[0][0] as ModelingDraft;
    expect(next.relationships[0].joins).toEqual([{ sourceProperty: 'detail_ref', targetProperty: 'detail_id' }]);
    expect(relationshipReviewProblem(next.relationships[0], next)).toContain('采购单号');
    expect(confirmCandidates(next, 'relationships', ['r']).relationships[0].accepted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '核对目标身份 / 替代唯一键' }));
    expect(onOpenTarget).toHaveBeenCalledWith('detail');
    expect(value.relationships[0].joins).toHaveLength(0);
  });
  it('歧义同名属性不建议，候选唯一键不能绕过复合身份', () => {
    const value = fixture(); value.classes[0].properties.push({ id: 'other', name: '采购明细标识', dataType: 'text' });
    value.classes[1].uniqueKeys = [{ properties: ['detail_id'], reason: '尚待确认', confirmed: false }];
    expect(relationshipRepair(value.relationships[0], value).suggestions).toHaveLength(0);
    expect(relationshipRepair(value.relationships[0], value).missing).toEqual(['detail_id', 'order_id']);
  });
  it('暂缓保留完整草稿及其他对象，已发布时不允许变更范围', () => {
    const value = fixture(); const onChange = vi.fn();
    const view = render(<RelationshipRepair draft={value} relation={value.relationships[0]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '暂不发布此关系' }));
    expect(onChange.mock.calls[0][0].relationships[0]).toMatchObject({ included: false, accepted: false });
    expect(onChange.mock.calls[0][0].classes).toEqual(value.classes);
    view.rerender(<RelationshipRepair draft={value} relation={value.relationships[0]} locked onChange={onChange} />);
    expect(screen.getByRole('button', { name: '暂不发布此关系' })).toBeDisabled();
  });
});
