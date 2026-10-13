import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { precheckObjectTypes, type KernelObjectType } from '@/api/ont/kernel';
import type { ModelingClass } from '@/api/ont/modeling';
import ReuseComparison from './ReuseComparison';
import { suggestResolution } from './candidateMatching';

vi.mock('@/api/ont/kernel', () => ({ precheckObjectTypes: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const cls: ModelingClass = { id: 'customer', name: '客户', description: '购买企业产品的客户', properties: [{ id: 'code', name: '客户编码', dataType: 'text' }], identity: ['code'], labelProperty: 'code', accepted: false };
const target: KernelObjectType = { rid: 'ont.test.obj.crm.customer.v1', display_name: 'Customer', description: '购买企业产品的客户', primary_key: ['ont.test.prop.code.v1'], interfaces: [], properties: [{ rid: 'ont.test.prop.code.v1', title: '客户编码', type_id: 'string', format: 'string', nullable: false, primary_key: true }] };

describe('候选对齐已有企业本体', () => {
  it('客户匹配 Customer 后保留人工选择，点击只提出复用与字段对应', async () => {
    vi.mocked(precheckObjectTypes).mockResolvedValue({ candidates: [{ rid: target.rid, display_name: 'Customer', slug: 'customer', similarity: 0.95, suggested_action: 'merge' }] });
    const onResolve = vi.fn();
    render(<ReuseComparison cls={cls} resolution={{ mode: 'new', propertyMap: {} }} types={[target]} onResolve={onResolve} />);
    await screen.findByText(/相似度 95%/);
    expect(onResolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '选择Customer并核对复用建议' }));
    expect(onResolve).toHaveBeenCalledWith({ mode: 'reuse', targetRid: target.rid, propertyMap: { code: target.primary_key[0] } });
  });

  it('已有 Customer 缺少客户等级时提出扩展，保留已有编码映射', () => {
    const result = suggestResolution({ ...cls, properties: [...cls.properties, { id: 'level', name: '客户等级', dataType: 'text' }] }, target);
    expect(result).toEqual({ mode: 'extend', targetRid: target.rid, propertyMap: { code: target.primary_key[0] } });
  });

  it('歧义字段和类型冲突不能自动对应到已有属性', () => {
    const ambiguous = { ...target, properties: [...target.properties, { ...target.properties[0], rid: 'ont.test.prop.other.v1' }] };
    expect(suggestResolution(cls, ambiguous).propertyMap).toEqual({});
    expect(suggestResolution(cls, { ...target, properties: [{ ...target.properties[0], type_id: 'double' }] }).propertyMap).toEqual({});
  });

  it('匹配失败显示核对提示，已发布候选不能改变处理方式', async () => {
    vi.mocked(precheckObjectTypes).mockRejectedValue(new Error('offline'));
    render(<ReuseComparison cls={cls} resolution={{ mode: 'new', propertyMap: {} }} types={[target]} onResolve={vi.fn()} locked />);
    await screen.findByText(/相似匹配暂时不可用/);
    expect(screen.getByRole('button', { name: '选择Customer并核对复用建议' })).toBeDisabled();
    expect(screen.queryByText(/当前未发现相似建议/)).not.toBeInTheDocument();
  });
});

it('中文字段名通过英文稳定标识对应既有属性，不把已有编码当成新增', () => {
  const supplier = {...cls, id:'supplier', properties:[{id:'supplier_code',name:'供应商编码',dataType:'text' as const}]};
  const native = {...target, rid:'ont.test.obj.scm.supplier.v1',properties:[{...target.properties[0],rid:'ont.test.prop.supplier-supplier-code.v1',title:'supplier code'}]};
  expect(suggestResolution(supplier,native).propertyMap).toEqual({supplier_code:'ont.test.prop.supplier-supplier-code.v1'});
});


it('暂缓的普通属性不参与复用建议，也不能把已匹配类误算为增加属性', () => {
  const candidate = {...cls,properties:[...cls.properties,{id:'level',name:'客户等级',dataType:'text' as const,included:false}]};
  expect(suggestResolution(candidate,target)).toEqual({mode:'reuse',targetRid:target.rid,propertyMap:{code:target.primary_key[0]}});
});
