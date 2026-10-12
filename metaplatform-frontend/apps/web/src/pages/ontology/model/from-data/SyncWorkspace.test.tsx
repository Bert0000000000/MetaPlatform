import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ModelingSource } from '@/api/ont/modeling';
import SyncWorkspace from './SyncWorkspace';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(cleanup);
function fixture(): ModelingSource {
  return { id: 's1', name: '物料.xlsx', revision: 3, context: '', questions: [], resolutions: {}, profile: { rowCount: 4, sheets: [{ name: '物料', rows: 4, columns: [] }] },
    draft: { schemaVersion: 2, name: '', classes: [{ id: 'item', name: '物料', description: '', properties: [], identity: [], labelProperty: '', accepted: true }], relationships: [], mappings: [{ id: 'map', classId: 'item', sheet: '物料', bindings: {}, reason: '', accepted: true }], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } },
    plan: { configHash: 'hash', types: [{ classId: 'item', name: '物料', rid: 'ont.test.obj.item.v1', mode: 'new', propertyMap: {} }], relationships: [], warnings: [] },
    publication: { status: 'succeeded', configHash: 'hash', completed: [], results: [] }, job: null, review: null, preview: null, validation: null, sync: null,
    syncCheck: { sourceRevision: 3, checkedAt: '2026-10-11T06:00:00Z', canSync: true, baselineError: null, preview: { nodes: 2, edges: 0 }, report: { scope: 'data', errors: 0, warnings: 0, canSync: true, counts: { classes: 1, nodes: 2, edges: 0 }, configHash: 'data', issues: [] } } };
}
function show(source: ModelingSource, dirty = false) {
  const actions = { onCheck: vi.fn(), onSync: vi.fn(), onLocate: vi.fn(), onRefresh: vi.fn(), onBack: vi.fn() };
  render(<MemoryRouter><SyncWorkspace source={source} dirty={dirty} busy={false} published {...actions} /></MemoryRouter>);
  return actions;
}
it('查看与检查不自动同步，用户确认范围后才允许提交', () => {
  const actions = show(fixture());
  expect(screen.getByText('4')).toBeVisible();
  expect(screen.getByRole('button', { name: '开始同步' })).toBeDisabled();
  expect(actions.onSync).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重新检查数据' }));
  expect(actions.onCheck).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '开始同步' }));
  expect(actions.onSync).toHaveBeenCalledOnce();
});
it('过期检查不能授权同步或展示预计数量', () => {
  const source = fixture(); source.revision++;
  show(source);
  expect(screen.getByText('请先检查本次数据。')).toBeVisible();
  expect(screen.queryByText(/预计生成或更新/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '开始同步' })).toBeDisabled();
});
it('归并同对象冲突并定位审核详情，不显示虚假零预览', () => {
  const source = fixture(); source.syncCheck!.canSync = false; source.syncCheck!.preview = null;
  source.syncCheck!.report = { ...source.syncCheck!.report, errors: 2, canSync: false, issueGroups: [
    { severity: 'error', item: 'entity:item:1', message: '同身份属性冲突；来源行 1', count: 1 },
    { severity: 'error', item: 'entity:item:2', message: '同身份属性冲突；来源行 2', count: 1 },
  ] };
  const actions = show(source);
  expect(screen.getAllByText('同身份属性冲突')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '去核对' }));
  expect(actions.onLocate).toHaveBeenCalledWith('fd-class-item');
  expect(screen.queryByText(/预计生成或更新/)).not.toBeInTheDocument();
});
it('中途失败保留实际结果和按类型查看入口', () => {
  const source = fixture(); source.sync = { status: 'failed', error: '关系写入失败', types: [{ classId: 'item', rid: 'ont.test.obj.item.v1', sourceRef: 'ont.test.bds.item-excel-modeling', total_synced: 2, total_failed: 0 }], links: 1 };
  const actions = show(source);
  expect(screen.getByText(/失败不代表全部回滚/)).toBeVisible();
  expect(screen.getByRole('link', { name: '查看实例' }).getAttribute('href')).toContain('typeRef=ont.test.obj.item.v1');
  expect(screen.getByRole('link', { name: '查看数据映射' }).getAttribute('href')).toContain('sourceRef=ont.test.bds.item-excel-modeling');
  fireEvent.click(screen.getByRole('button', { name: '刷新结果' }));
  expect(actions.onRefresh).toHaveBeenCalledOnce();
  expect(actions.onSync).not.toHaveBeenCalled();
});
it('定义漂移禁止确认与执行', () => {
  const source = fixture(); source.syncCheck!.baselineError = '原生定义已变化'; source.syncCheck!.canSync = false;
  show(source);
  expect(screen.getByText('原生定义已变化')).toBeVisible();
  expect(screen.getByRole('checkbox')).toBeDisabled();
});

it('问题暂缓后必须明确确认，提交当前检查哈希才能同步合格数据', () => {
  const source=fixture();
  source.syncCheck!.canSync=false;source.syncCheck!.preview=null;
  source.syncCheck!.partial={canSync:true,checkHash:'current-check',preview:{nodes:1,edges:0},report:source.syncCheck!.report,
    quarantine:{rows:3,entities:1,relationships:1,groups:[{kind:'entity',item:'item',name:'物料',reason:'同身份冲突',count:3,examples:[{sheet:'物料',row:2}]}]}};
  const actions=show(source);
  expect(screen.getByRole('button',{name:'同步合格数据'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'我已核对暂缓范围，确认仅写入合格实例及关系'}));
  fireEvent.click(screen.getByRole('button',{name:'同步合格数据'}));
  expect(actions.onSync).toHaveBeenCalledWith({allowPartial:true,checkHash:'current-check'});
});
