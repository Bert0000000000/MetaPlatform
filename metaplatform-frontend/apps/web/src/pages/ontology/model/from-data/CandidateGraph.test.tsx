import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import CandidateGraph from './CandidateGraph';
import type { ModelingDraft } from '@/api/ont/modeling';

afterEach(cleanup);
const cls = (id: string, name: string, parentClassId?: string) => ({ id, name, parentClassId, description: `${name}定义`, properties: [{ id: 'code', name: '编码', dataType: 'text' as const }], identity: ['code'], labelProperty: 'code', accepted: true });
const draft: ModelingDraft = { schemaVersion: 2, name: '设备', classes: [cls('equipment', '设备'), cls('cnc', '数控机床', 'equipment')], relationships: [{ id: 'uses', name: '使用设备', source: 'cnc', target: 'equipment', cardinality: 'N:1', joins: [], reason: '', accepted: true }], mappings: [], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } };

it('复用原生模型卡片，显示关系与继承，点击只查看候选详情', () => {
  render(<CandidateGraph draft={draft} />);
  expect(screen.getByRole('button', { name: '选择模型 设备' })).toBeVisible();
  expect(screen.getByRole('button', { name: '选择模型 数控机床' })).toBeVisible();
  expect(screen.getByText('使用设备 · N:1')).toBeVisible();
  expect(screen.getByText('继承')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '选择模型 数控机床' }));
  expect(screen.getByLabelText('候选模型详情')).toHaveTextContent('数控机床定义');
  expect(screen.getByLabelText('候选模型详情')).toHaveTextContent('父类：设备');
  expect(screen.getByRole('button', { name: '适应画布' })).toBeVisible();
});

it('空候选给出提示且不读取平台已发布模型', () => {
  render(<CandidateGraph draft={{ ...draft, classes: [], relationships: [] }} />);
  expect(screen.getByText('暂无候选对象类型')).toBeVisible();
});
