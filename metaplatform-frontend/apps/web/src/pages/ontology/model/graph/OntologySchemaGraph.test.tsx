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

it('shows one line per object pair without aggregate counts, including reverse relationships', () => {
  const classes = ['物料', '到货单明细'].map((name, i) => ({ id: String(i), name, description: '', properties: [] }));
  const relationships = [
    { id: 'r1', name: '到货单明细物料', source: '1', target: '0', cardinality: 'N:1' },
    { id: 'r2', name: '到货单明细对应物料', source: '1', target: '0', cardinality: 'N:1' },
    { id: 'r3', name: '物料关联到货明细', source: '0', target: '1', cardinality: '1:N' },
  ];
  const onRelationSelect = vi.fn();
  const view = render(<OntologySchemaGraph classes={classes} relationships={relationships} onSelect={vi.fn()} onRelationSelect={onRelationSelect} />);
  expect(view.container.querySelectorAll('.ms-schema-edge')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '查看关系 到货单明细物料 · N:1' }));
  expect(onRelationSelect).toHaveBeenCalledWith('r1');
  view.rerender(<OntologySchemaGraph classes={classes} relationships={relationships} selectedRelation="r2" onSelect={vi.fn()} onRelationSelect={onRelationSelect} />);
  expect(view.container.querySelectorAll('.ms-schema-edge.is-selected')).toHaveLength(1);
  expect(screen.queryByText(/共 3 条|关联明细|合并展示/)).not.toBeInTheDocument();
  expect(relationships).toHaveLength(3);
});

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
