import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { KernelObjectType } from '@/api/ont/kernel';
import type { ModelingSource } from '@/api/ont/modeling';
import PublicationDecisions from './PublicationDecisions';
afterEach(cleanup);
const rid = 'ont.tenant-default.obj.scm.customer.v1';
const prop = 'ont.tenant-default.prop.customer-code.v1';
const target = { rid, display_name: '客户', primary_key: [prop], properties: [{rid: prop, title: '客户编码', type_id: 'string', format: 'string', nullable: false}] } as KernelObjectType;
const source = { resolutions: { customer: {mode: 'reuse', propertyMap: {}} }, publication: null,
  draft: { classes: [{id: 'customer', name: '客户', properties: [{id: 'code', name: '客户编码', dataType: 'text'}]}] }
} as unknown as ModelingSource;
it('选择已有对象自动带出完整 RID 和字段对应，保留复用操作', () => {
  const resolve = vi.fn();
  const {rerender} = render(<PublicationDecisions source={source} types={[target]} onResolve={resolve} />);
  fireEvent.change(screen.getByRole('combobox', {name: '客户 已有对象'}), {target: {value: rid}});
  expect(resolve).toHaveBeenCalledWith('customer', {mode: 'reuse', targetRid: rid, propertyMap: {code: prop}});
  const next = {...source, resolutions: {customer: resolve.mock.calls[0][1]}};
  rerender(<PublicationDecisions source={next} types={[target]} onResolve={resolve} />);
  expect(screen.getByLabelText('客户 目标 RID')).toHaveTextContent(rid);
  fireEvent.change(screen.getByRole('combobox', {name: '客户 发布操作'}), {target: {value: 'extend'}});
  expect(resolve).toHaveBeenLastCalledWith('customer', {mode: 'extend', targetRid: rid, propertyMap: {code: prop}});
});
it('冲突显示在对象行，部分发布后锁定目标', () => {
  const resolve = vi.fn();
  render(<PublicationDecisions source={{...source, publication: {completed: [rid]} as ModelingSource['publication']}} types={[target]} issues={[{item: 'customer', message: '客户标识已被占用'}]} onResolve={resolve} />);
  expect(screen.getByRole('alert')).toHaveTextContent('客户标识已被占用');
  expect(screen.getByRole('combobox', {name: '客户 发布操作'})).toBeDisabled();
  expect(resolve).not.toHaveBeenCalled();
});

it('首个类型 inFlight 且未记完成时仍锁定发布操作、目标和字段对应', () => {
  const resolve = vi.fn(), edit = vi.fn();
  const current = {...source, resolutions:{customer:{mode:'reuse',targetRid:rid,propertyMap:{code:prop}}}, publication:{status:'failed',configHash:'flight-hash',completed:[],inFlight:rid,results:[]}} as ModelingSource;
  render(<PublicationDecisions source={current} types={[target]} issues={[{item:'customer',message:'首项回读未完成'}]} onResolve={resolve} onEditClass={edit} />);
  expect(screen.getByRole('combobox', {name:'客户 发布操作'})).toBeDisabled();
  expect(screen.getByRole('combobox', {name:'客户 已有对象'})).toBeDisabled();
  expect(screen.getByRole('combobox', {name:'客户 发布属性 客户编码'})).toBeDisabled();
  expect(screen.getByRole('button', {name:'修改客户定义'})).toBeDisabled();
  expect(screen.getByLabelText('客户 目标 RID')).toHaveTextContent(rid);
  expect(resolve).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
});
