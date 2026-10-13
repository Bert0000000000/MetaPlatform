import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OntologySchemaGraph from './OntologySchemaGraph';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

it('restores the default full layout when reset is clicked from the local view', () => {
  const key = 'mate-ontology-graph-layout:reset-regression:all';
  const classes = ['设备', '订单', '记录'].map((name, i) => ({
    id: String(i), name, description: '', properties: [],
  }));
  const onSelect = vi.fn(), onRelationSelect = vi.fn();
  const props = { classes, relationships: [], onSelect, onRelationSelect, layoutKey: 'reset-regression' };
  const first = render(<OntologySchemaGraph {...props} />);
  const defaultPosition = screen.getByRole('button', { name: '查看本体类 设备' }).getAttribute('transform');
  first.unmount();
  localStorage.setItem(key, JSON.stringify({ '0': { x: 4000, y: 3000 } }));
  render(<OntologySchemaGraph {...props} selected="0" />);
  expect(screen.getByRole('button', { name: '查看本体类 设备' }).getAttribute('transform')).not.toBe(defaultPosition);
  fireEvent.click(screen.getByRole('button', { name: '局部关联' }));
  expect(screen.queryByRole('button', { name: '查看本体类 订单' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重置本体图' }));
  expect(screen.getByRole('button', { name: '全部类型' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '查看本体类 订单' })).toBeVisible();
  expect(screen.getByRole('button', { name: '查看本体类 设备' }).getAttribute('transform')).toBe(defaultPosition);
  expect(localStorage.getItem(key)).toBeNull();
  expect(onSelect).toHaveBeenLastCalledWith('');
  expect(onRelationSelect).toHaveBeenLastCalledWith('');
});
