import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MaterializationResult } from '@/api/ont/kernel';
import MaterializationSamples from './MaterializationSamples';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const typeRid = 'ont.t.obj.crm.customer.v1';
function mount(schema: MaterializationResult['schema'], row: Record<string, unknown>) {
  render(<MaterializationSamples typeRid={typeRid} state={{ result: { class_rid: typeRid, count: 1, schema, rows: [row] }, loading: false, error: '', read: vi.fn() }} />);
  return screen.getAllByRole('row');
}
it('shows canonical model columns for RID schema and slug-valued samples without duplicates', () => {
  const rows = mount({
    'ont.t.prop.crm.customer-id.v1': { slug: 'customer-id', title: '客户编号', type_id: 'string' },
    'ont.t.prop.crm.customer-title.v1': { slug: 'customer-title', title: '客户名称', type_id: 'string' },
  }, { 'customer-id': 'c1', 'customer-title': 'Tencent sample', __rid__: 'ont.t.ind.customer.c1' });
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(3);
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['c1', 'Tencent sample', 'ont.t.ind.customer.c1']);
  expect(screen.getByText('客户编号')).toBeVisible();
});
it.each(['ont.t.prop.id', 'ont.t.prop.id.v2', 'ont.t.prop.crm.id', 'ont.t.prop.crm.id.v2'])('resolves an unambiguous canonical slug for %s', rid => {
  const rows = mount({ [rid]: { type_id: 'string' } }, { id: 'c2' });
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(1);
  expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('c2');
});
it('resolves the unique legacy type-prefixed property alias', () => {
  const rows = mount({ 'ont.t.prop.customer-id.v1': { slug: 'customer-id' } }, { id: 'c3' });
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(1);
  expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('c3');
});
it('keeps distinct full RIDs and ambiguous extras separate', () => {
  const first = 'ont.t.prop.crm.name.v1', second = 'ont.t.prop.sales.name.v1';
  const rows = mount({ [first]: { slug: 'name' }, [second]: { slug: 'name' } }, { [first]: 'crm', [second]: 'sales', name: 'extra' });
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(3);
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['crm', 'sales', 'extra']);
});
it('does not replace explicit canonical null or steal a colliding legacy alias', () => {
  const first = 'ont.t.prop.customer-id.v1', second = 'ont.t.prop.id.v1';
  const rows = mount({ [first]: { slug: 'customer-id' }, [second]: { slug: 'id' } }, { [first]: null, 'customer-id': 'alias', id: 'ambiguous' });
  expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('—');
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(3);
});

