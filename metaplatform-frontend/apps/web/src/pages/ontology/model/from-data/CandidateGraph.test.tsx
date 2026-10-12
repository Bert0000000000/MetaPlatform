import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CandidateGraph from './CandidateGraph';
import type { ModelingDraft } from '@/api/ont/modeling';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
const cls = (id: string, name: string, parentClassId?: string) => ({ id, name, parentClassId, description: `${name}定义`, properties: [{ id: 'code', name: '编码', dataType: 'text' as const }], identity: ['code'], labelProperty: 'code', accepted: true });
const draft: ModelingDraft = { schemaVersion: 2, name: '设备', classes: [cls('equipment', '设备'), cls('cnc', '数控机床', 'equipment')], relationships: [{ id: 'uses', name: '使用设备', source: 'cnc', target: 'equipment', cardinality: 'N:1', joins: [], reason: '', accepted: true }], mappings: [], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } };

it('复用模型工作台关系图，保留继承与候选详情', () => {
  render(<CandidateGraph draft={draft} />);
  expect(screen.getByRole('button', { name: '查看本体类 设备' })).toBeVisible();
  expect(screen.getByRole('button', { name: '查看本体类 数控机床' })).toBeVisible();
  expect(screen.getByRole('button', {name: '查看关系 使用设备 · N:1'})).toBeVisible();
  expect(screen.getByRole('button', {name: '查看关系 继承'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '查看本体类 数控机床' }));
  expect(screen.getByLabelText('候选模型详情')).toHaveTextContent('数控机床定义');
  expect(screen.getByLabelText('候选模型详情')).toHaveTextContent('父类：设备');
  expect(screen.getByRole('button', { name: '适应本体图' })).toBeVisible();
});

it('空候选给出提示且不读取平台已发布模型', () => {
  render(<CandidateGraph draft={{ ...draft, classes: [], relationships: [] }} />);
  expect(screen.getByText('暂无候选对象类型')).toBeVisible();
});

it('搜索、局部关联及关系选择与模型工作台一致，布局不写入正式工作台', () => {
  render(<CandidateGraph draft={draft} layoutKey="source-one" />);
  expect(screen.getByRole('button', {name:'全部类型'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button', {name:'查看本体类 数控机床'}));
  fireEvent.click(screen.getByRole('button', {name:'局部关联'}));
  expect(screen.getByRole('button', {name:'查看本体类 设备'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'查看关系 使用设备 · N:1'}));
  expect(screen.getByRole('button', {name:'使用设备 · N:1 数控机床 → 设备'})).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', {name:'搜索图谱对象'}), {target:{value:'数控'}});
  expect(screen.queryByRole('button', {name:'查看本体类 设备'})).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name:'查看本体类 数控机床'})).toBeVisible();
});
