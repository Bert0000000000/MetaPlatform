import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ModelInspector from './graph/ModelInspector';
import MaterializationSamples from '../data/mappings/MaterializationSamples';
import type { KernelObjectType } from '@/api/ont/kernel';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
afterEach(cleanup);
it('keeps domain-bearing resource and property identifiers distinguishable without a machine-name assumption', () => {
  const rid = 'ont.tenant.obj.crm.customer.v1';
  const property = 'ont.tenant.prop.crm.customer-id.v1';
  render(<ModelInspector type={{ rid, primary_key: [property], properties: [{ rid: property, format: 'string' }] } as KernelObjectType} links={[]} onOpen={() => {}} onBinding={() => {}} onExplore={() => {}} />);
  expect(screen.getByRole('heading', { name: rid })).toBeVisible();
  expect(screen.getAllByText(property).length).toBeGreaterThan(0);
  expect(screen.queryByText('crm')).toBeNull();
});
it('renders contracted materialization descriptor labels with full identifiers available as details, preserving unknown actual columns', () => {
  render(<MaterializationSamples typeRid="ont.t.obj.crm.customer.v1" state={{ loading: false, error: '', read: vi.fn(), result: { count: 1, schema: { customer_id: { title: '客户编号', slug: 'customer-id', type: 'string', rid: 'ont.t.prop.crm.customer-id.v1' } }, rows: [{ customer_id: 'C-1', extra_actual: 7 }] } as never }} />);
  expect(screen.getByRole('columnheader', { name: /客户编号/ })).toBeVisible();
  expect(screen.getByRole('columnheader', { name: /extra_actual/ })).toBeVisible();
  expect(screen.getByText('C-1')).toBeVisible();
  expect(screen.queryByText(/"title":/)).toBeNull();
  expect(screen.getByText('ont.t.prop.crm.customer-id.v1')).toBeInTheDocument();
});
