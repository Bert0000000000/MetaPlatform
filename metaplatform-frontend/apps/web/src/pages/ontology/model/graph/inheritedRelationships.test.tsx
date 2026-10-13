import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KernelObjectType, KernelLinkType } from '@/api/ont/kernel';
import SchemaGraphCanvas from './SchemaGraphCanvas';
import ModelInspector from './ModelInspector';
import { applicableRelationships } from './relationshipInheritance';

const type = (id: string, name: string, parent?: string): KernelObjectType => ({ rid: `ont.test.obj.${id}`, display_name: name, parent_class: parent ? `ont.test.obj.${parent}` : '', properties: [], primary_key: [], interfaces: [] });
const types = [type('plant', '植物标本'), type('tree', '乔木标本', 'plant'), type('leaf', '落叶乔木标本', 'tree'), type('site', '采样点')];
const link: KernelLinkType = { rid: 'ont.test.link.sampled', src: types[0].rid, dst: types[3].rid, cardinality: 'N:1', directionality: 'directed', src_display_name: '采样于', link_properties: [] };
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('工作台复用空心继承箭头，继承适用线按需展开且点击原关系', () => {
  const onSelect = vi.fn(), onRelationSelect = vi.fn();
  render(<SchemaGraphCanvas types={types} links={[link]} selectedRid={types[2].rid} onSelect={onSelect} onOpen={vi.fn()} onRelationSelect={onRelationSelect} />);
  const inheritance = screen.getAllByRole('button', { name: '查看关系 继承 · 是一种' });
  expect(inheritance).toHaveLength(2);
  expect(inheritance[0]).toHaveClass('is-inheritance');
  expect(inheritance[0].querySelector('polyline:not(.ms-schema-edge-hit)')?.getAttribute('marker-end')).toContain('inheritance');
  expect(screen.queryByRole('button', { name: '查看关系 采样于 · 继承适用 · N:1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示继承适用关系' }));
  const inherited = screen.getByRole('button', { name: '查看关系 采样于 · 继承适用 · N:1' });
  expect(inherited.querySelector('polyline:not(.ms-schema-edge-hit)')).toHaveAttribute('stroke-dasharray', '5 4');
  fireEvent.click(inherited);
  expect(onRelationSelect).toHaveBeenLastCalledWith(link.rid);
  fireEvent.click(inheritance[0]);
  expect(onSelect).toHaveBeenCalled();
});

it('子类详情列出继承适用关系及声明父类', () => {
  render(<ModelInspector type={types[2]} objectTypes={types} links={[link]} onOpen={vi.fn()} onBinding={vi.fn()} onExplore={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '关联模型 · 1' })).toBeVisible();
  expect(screen.getByText('关系声明于：植物标本')).toBeVisible();
  expect(screen.getByText(/继承适用/)).toBeVisible();
});

it('隐藏声明父类后仍可展开子类关系并选中原定义', () => {
  render(<SchemaGraphCanvas types={[types[2], types[3]]} links={[]} catalogTypes={types} catalogLinks={[link]} selectedRid={types[2].rid} selectedRelation={link.rid} onSelect={vi.fn()} onOpen={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '显示继承适用关系' }));
  expect(screen.getByRole('button', { name: '查看关系 采样于 · 继承适用 · N:1' })).toHaveClass('is-selected');
});

it('继承断链、循环及跨租户不推断关系，直接关系保留', () => {
  const relationships = [{ id: 'business', source: 'root', target: 'site' }];
  expect(applicableRelationships('leaf', [{ id: 'leaf', parentId: 'missing' }], relationships)).toEqual([]);
  expect(applicableRelationships('leaf', [{ id: 'leaf', parentId: 'root' }, { id: 'root', parentId: 'leaf' }], relationships)).toEqual([]);
  const foreign = [{ id: 'ont.test.obj.leaf', parentId: 'ont.other.obj.root' }, { id: 'ont.other.obj.root' }];
  expect(applicableRelationships(foreign[0].id, foreign, [{ id: 'foreign', source: foreign[1].id, target: 'site' }])).toEqual([]);
  expect(applicableRelationships('root', [], relationships)).toHaveLength(1);
});
