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
