import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { getModelingSource, listModelingSources, runModelingOperation, saveModelingSource } from '@/api/ont/modeling';
import type { ModelingSource } from '@/api/ont/modeling';
import { listObjectTypes } from '@/api/ont/kernel';
import FromDataPage from './FromDataPage';
import { renameConcept } from './renameConcept';
import { applyParent } from './hierarchy';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/ont/modeling', () => ({ getModelingSource: vi.fn(), listModelingSources: vi.fn(), runModelingOperation: vi.fn(), saveModelingSource: vi.fn(), uploadModelingSource: vi.fn() }));
vi.mock('@/api/ont/kernel', () => ({ listObjectTypes: vi.fn().mockResolvedValue([]), precheckObjectTypes: vi.fn().mockResolvedValue({ candidates: [] }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

function fixture(): ModelingSource {
  return {
    id: 'source-one', name: '库存.xlsx', revision: 3, context: '物料库存', questions: [{ id: 'q1', question: '物料库存是多少？', expected: '按工厂汇总' }], resolutions: {},
    profile: { rowCount: 2, sheets: [{ name: '库存', rows: 2, columns: [{ name: '物料编码', dataType: 'text', nonNull: 2, uniqueCount: 2, unique: true, samples: ['A', 'B'] }] }] },
    draft: { schemaVersion: 2, name: '库存模型', classes: [{ id: 'material', name: '物料', description: '可采购的物料', properties: [{ id: 'code', name: '编码', dataType: 'text' }], identity: ['code'], labelProperty: 'code', accepted: true, identityStatus: 'confirmed', identityReason: 'Code is a business identifier' }], mappings: [{ id: 'mapping1', classId: 'material', sheet: '库存', bindings: { code: '物料编码' }, reason: '编码对应', accepted: true }], relationships: [], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } },
    job: null, review: null, validation: { scope: 'ontology', errors: 0, warnings: 1, canPublish: true, configHash: 'hash3', issues: [{ severity: 'warning', item: 'material', message: '请确认业务唯一性' }], counts: { nodes: 2, edges: 0, classes: 1 } },
    plan: { configHash: 'hash3', types: [{ classId: 'material', name: '物料', rid: 'ont.test.obj.material.v1', mode: 'new', propertyMap: { code: 'ont.test.prop.code.v1' } }], relationships: [], warnings: [] }, preview: null, publication: null, sync: null,
  };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(listObjectTypes).mockReset().mockResolvedValue([]);
  vi.mocked(getModelingSource).mockResolvedValue(fixture());
  vi.mocked(listModelingSources).mockResolvedValue([fixture()]);
  vi.mocked(saveModelingSource).mockImplementation(async source => ({ ...source, revision: source.revision + 1, validation: null, plan: null, review: null }));
  vi.mocked(runModelingOperation).mockResolvedValue(fixture());
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const open = (path = '/ontology/model/from-data?source=source-one') => render(<MemoryRouter initialEntries={[path]}><FromDataPage /></MemoryRouter>);
const openObject = async (name = '物料') => { fireEvent.click(await screen.findByRole('button', { name: `审核${name}` })); };
const showMappings = () => fireEvent.click(screen.getByRole('tab', { name: /数据映射/ }));

it('history options distinguish imports with the same file name', async () => {
  vi.mocked(listModelingSources).mockResolvedValue([
    { ...fixture(), id: 'source-11111111', name: '同名资料.xlsx', revision: 3 },
    { ...fixture(), id: 'source-22222222', name: '同名资料.xlsx', revision: 4 },
  ]);
  open('/ontology/model/from-data');
  expect(await screen.findByRole('option', { name: '同名资料.xlsx · 修订 3 · 11111111' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '同名资料.xlsx · 修订 4 · 22222222' })).toBeInTheDocument();
});

it('history loading never claims that the import list is empty', () => {
  vi.mocked(listModelingSources).mockReturnValue(new Promise(() => {}));
  open('/ontology/model/from-data');
  expect(screen.getByRole('option', { name: '正在读取导入历史…' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '暂无导入记录' })).toBeNull();
});

describe('逆向发现本体独立辅助入口', () => {
  it.each([[1, 0], [2, 0], [2, 1]])('发布 %i 个类型后，第 %i 个入口跳转到对应详情', async (count, index) => {
    const source = fixture();
    source.plan!.types.push({ ...source.plan!.types[0], classId: 'warehouse', name: '仓库', rid: 'ont.test.obj.warehouse.v1' });
    source.publication = { status: 'succeeded', configHash: 'hash3', completed: source.plan!.types.slice(0, count).map(type => type.rid), results: [] };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    function Location() { return <output aria-label="当前路由">{useLocation().pathname}</output>; }
    render(<MemoryRouter initialEntries={['/ontology/model/from-data?source=source-one']}><FromDataPage /><Location /></MemoryRouter>);
    await screen.findByText('本次所选本体已发布');
    for (const type of source.plan!.types.slice(0, count)) {
      expect(screen.getByRole('link', { name: `进入平台本体模型：${type.name}` })).toHaveAttribute('href', `/ontology/model/object-types/${encodeURIComponent(type.rid)}`);
    }
    if (count === 1) expect(screen.queryByRole('link', { name: '进入平台本体模型：仓库' })).not.toBeInTheDocument();
    const target = source.plan!.types[index];
    fireEvent.click(screen.getByRole('link', { name: `进入平台本体模型：${target.name}` }));
    expect(screen.getByLabelText('当前路由')).toHaveTextContent(`/ontology/model/object-types/${encodeURIComponent(target.rid)}`);
    expect(saveModelingSource).not.toHaveBeenCalled();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('回到候选审核刷新目录，在实际详情中独立显示全部同名对象', async () => {
    open();
    await openObject();
    fireEvent.click(screen.getByRole('button', { name: /资料与业务范围/ }));
    const same = Array.from({ length: 6 }, (_, i) => ({ rid: `ont.test.obj.crm.material-${i}.v1`, display_name: '物料', description: `定义${i}`, properties: [], primary_key: [], interfaces: [] }));
    vi.mocked(listObjectTypes).mockResolvedValue(same);
    fireEvent.click(screen.getByRole('button', { name: /候选匹配与合并确认/ }));
    await openObject();
    const exact = await screen.findByRole('region', { name: '物料 精确同名对象' });
    same.forEach(t => expect(exact).toHaveTextContent(t.rid));
    expect(saveModelingSource).not.toHaveBeenCalled();
  });

  it('发布前重新读取完整目录，读取失败不能展示旧目录继续确认', async () => {
    open();
    await screen.findByRole('button', { name: '已保存' });
    fireEvent.click(screen.getByRole('button', { name: /本体发布与验收/ }));
    vi.mocked(listObjectTypes).mockRejectedValue(new Error('catalog offline'));
    fireEvent.click(screen.getByRole('button', { name: '发布本体' }));
    await screen.findByText('平台对象类型读取失败：catalog offline', { exact: true });
    expect(screen.queryByRole('combobox', { name: '物料 发布操作' })).not.toBeInTheDocument();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });
  it('离开后从默认入口返回，恢复当前来源、资料步骤及未保存业务背景', async () => {
    const first = open();
    await screen.findByRole('button', { name: '已保存' });
    fireEvent.click(screen.getByRole('button', { name: /1.*资料与业务范围/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '业务背景' }), { target: { value: '尚未保存的客户业务说明' } });
    first.unmount();
    open('/ontology/model/from-data');
    expect(await screen.findByRole('textbox', { name: '业务背景' })).toHaveValue('尚未保存的客户业务说明');
    expect(screen.getByRole('button', { name: /1.*资料与业务范围/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('combobox', { name: '选择历史导入' })).toHaveValue('source-one');
    expect(screen.getByRole('button', { name: '保存修改' })).toBeEnabled();
  });

  it('恢复时服务端修订变化，保留未保存编辑及旧修订并提示冲突', async () => {
    const first = open();
    await openObject();
    fireEvent.change(screen.getByRole('textbox', { name: '业务名称' }), { target: { value: '我的客户定义' } });
    first.unmount();
    vi.mocked(getModelingSource).mockResolvedValue({ ...fixture(), revision: 4 });
    open('/ontology/model/from-data');
    await screen.findByText(/服务端修订已变化/);
    await openObject('我的客户定义');
    expect(screen.getByRole('textbox', { name: '业务名称' })).toHaveValue('我的客户定义');
    expect(screen.getByText('修订 3 · 未保存')).toBeVisible();
  });

  it('候选页隐藏质量预检与语义审查，资料页隐藏业务问题但保存时保留历史问题', async () => {
    const source = fixture();
    source.review = { summary: '旧语义报告' };
    source.generation = { fingerprint: 'test', policyVersion: 'test', origin: 'generated', rounds: 1, structureErrors: 0, dataErrors: 0, findings: [], changes: [], notices: [], capabilities: {} };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    await screen.findByRole('button', { name: '已保存' });
    expect(screen.queryByText(/生成质量预检|AI 语义审查|旧语义报告/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1.*资料与业务范围/ }));
    expect(screen.queryByRole('button', { name: '添加业务问题' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /业务问题/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '业务背景' }), { target: { value: '新的业务说明' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
    expect(vi.mocked(saveModelingSource).mock.calls[0][0].questions).toEqual(source.questions);
  });

  it('候选定义审核不显示发布选择，进入发布窗口才提供操作', async () => {
    open();
    await openObject();
    expect(screen.queryByLabelText('物料 候选处理方式')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '已确认对象定义' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', {name: /本体发布与验收/}));
    expect(screen.queryByRole('combobox', {name: '物料 发布操作'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '发布本体'}));
    expect(await screen.findByRole('combobox', {name: '物料 发布操作'})).toHaveValue('');
    expect(saveModelingSource).not.toHaveBeenCalled();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });
  it('结构校验无发布方案也能进入发布步骤，不提前要求复用配置', async () => {
    const source = {...fixture(), plan: null};
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    await screen.findByRole('button', {name: '已保存'});
    fireEvent.click(screen.getByRole('button', {name: /变更草稿与校验/}));
    expect(screen.getByRole('button', {name: '查看发布方案'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button', {name: '查看发布方案'}));
    expect(screen.getByRole('button', {name: '发布本体'})).toBeEnabled();
  });

  it('发布后的独立数据检查不重建发布方案，显式确认后才提交后台同步', async () => {
    const source = fixture();
    source.publication = { status: 'succeeded', configHash: 'hash3', completed: ['ont.test.obj.material.v1'], results: [] };
    const checked: ModelingSource = { ...source, syncCheck: { sourceRevision: source.revision, checkedAt: '2026-10-11T06:00:00Z', canSync: true, baselineError: null, preview: { nodes: 2, edges: 0 }, report: { scope: 'data', errors: 0, warnings: 0, canSync: true, issues: [], configHash: 'data', counts: { classes: 1, nodes: 2, edges: 0 } } } };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    vi.mocked(runModelingOperation).mockImplementation(async (_, operation) => operation === 'sync-check' ? checked : { ...checked, sync: { status: 'running', stage: 'preparing', types: [], links: 0 } });
    open();
    fireEvent.click(await screen.findByRole('button', { name: '同步本次数据' }));
    expect(runModelingOperation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '检查本次数据' }));
    await screen.findByText('数据接入检查 · 全部可同步');
    expect(runModelingOperation).toHaveBeenCalledWith(source, 'sync-check', {});
    fireEvent.click(screen.getByRole('checkbox', { name: '我已确认同步范围，写入正式实例' }));
    fireEvent.click(screen.getByRole('button', { name: '开始同步' }));
    await waitFor(() => expect(runModelingOperation).toHaveBeenCalledWith(checked, 'sync', { background: true }));
    expect(saveModelingSource).not.toHaveBeenCalled();
  });

  it('默认显示分类列表，搜索和键盘切换不修改候选', async () => {
    open();
    const objects = await screen.findByRole('tab', { name: /对象类型/ });
    expect(objects).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('textbox', { name: '业务名称' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '搜索候选' }), { target: { value: '不存在的对象' } });
    expect(screen.getByText('没有符合筛选条件的候选。')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '查看全部' }));
    expect(screen.getByRole('button', { name: '审核物料' })).toBeVisible();
    fireEvent.keyDown(objects, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /业务关系/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /业务关系/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('checkbox', { name: '确认映射 库存 → 物料' })).toBeChecked();
    expect(screen.getByRole('button', { name: '已保存' })).toBeDisabled();
    expect(saveModelingSource).not.toHaveBeenCalled();
  });

  it('在列表直接提示缺少身份依据并阻止无效确认', async () => {
    const source = fixture();
    source.draft!.classes[0].accepted = false;
    source.draft!.classes[0].identityReason = '';
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    expect(await screen.findByText('请填写身份依据')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '待审核' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('textbox', { name: '业务名称' })).not.toBeInTheDocument();
  });

  it('点击生成立即在按钮附近展示进度并防止重复提交', async () => {
    vi.mocked(getModelingSource).mockResolvedValue({ ...fixture(), draft: null, job: null });
    vi.mocked(runModelingOperation).mockImplementation(() => new Promise(() => {}));
    open();
    fireEvent.click(await screen.findByRole('button', { name: '发现本体候选' }));
    expect(await screen.findByRole('button', { name: '正在生成建议…' })).toBeDisabled();
    expect(screen.getByLabelText('建议生成进度')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('正在生成模型建议')).toBeVisible();
    expect(runModelingOperation).toHaveBeenCalledTimes(1);
  });

  it('已保存且已确认的候选在发布按钮旁解释原生冲突，并定位对应对象', async () => {
    const source = fixture();
    source.validation = { ...source.validation!, errors: 1, canPublish: false, issues: [
      { severity: 'error', item: 'material', message: '物料的稳定标识已存在，请选择复用或扩展' },
    ] };
    source.plan = null;
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    await screen.findByRole('button', { name: '已保存' });
    fireEvent.click(screen.getByRole('button', { name: /变更草稿与校验/ }));
    const blockers = screen.getByRole('region', { name: '发布阻断原因' });
    expect(blockers).toHaveTextContent('物料的稳定标识已存在');
    expect(screen.getByRole('button', { name: '查看发布方案' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '处理物料' }));
    await waitFor(() => expect(screen.getByRole('region', { name: '对象类型 物料' })).toHaveFocus());
    expect(saveModelingSource).not.toHaveBeenCalled();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });
  it('数据身份缺值不阻止结构发布，发布完成后同步保持禁用并解释原因', async () => {
    const source = fixture();
    source.validation = { ...source.validation!, scope: 'ontology', dataValidation: {
      scope: 'data', canSync: false, errors: 633, warnings: 0,
      issues: [{ severity: 'error', item: 'mapping1', message: 'identity 身份属性存在空值' }],
      issueGroups: [{ severity: 'error', item: 'mapping1', message: 'identity 身份属性存在空值', count: 633 }],
      counts: { nodes: 0, edges: 0, classes: 1 }, configHash: 'datahash',
    } };
    source.publication = { status: 'succeeded', configHash: 'hash3', completed: ['ont.test.obj.material.v1'], results: [] };
    source.syncCheck = { sourceRevision: source.revision, checkedAt: '2026-10-11T06:00:00Z', report: source.validation.dataValidation!, preview: null, baselineError: null, canSync: false };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    expect(await screen.findByText('本次所选本体已发布')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '同步本次数据' }));
    expect(screen.getByText('当前还不能同步实例')).toBeVisible();
    expect(screen.getByRole('button', { name: 'AI 分析批量修复' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '开始同步' })).not.toBeInTheDocument();
    expect(screen.getAllByText('633')).toHaveLength(2);
    expect(runModelingOperation).not.toHaveBeenCalled();
  });
  it('按类别批量确认与撤销，保存后重新校验且不自动发布', async () => {
    const source = fixture();
    source.draft!.classes[0].accepted = false;
    source.draft!.classes[0].identityStatus = 'proposed';
    source.draft!.classes[0].identityReason = '物料编码在业务中唯一';
    source.draft!.mappings[0].accepted = false;
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    fireEvent.click(await screen.findByRole('button', { name: '全部确认对象' }));
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).not.toBeChecked();
    fireEvent.click(await screen.findByRole('button', { name: '确认所选 1 项' }));
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).toBeChecked();
    expect(screen.getByText(/已有校验结果已过期/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '取消确认对象' }));
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).not.toBeChecked();
    showMappings();
    expect(screen.getByRole('checkbox', { name: '确认映射 库存 → 物料' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '全部确认映射' }));
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
    expect(vi.mocked(saveModelingSource).mock.calls[0][0].draft!.mappings[0].accepted).toBe(true);
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('对象详情按需打开，关闭后保留内容且不制造修改', async () => {
    open();
    await openObject();
    await screen.findByRole('textbox', { name: '业务名称' });
    fireEvent.click(screen.getByRole('button', { name: '完成查看' }));
    expect(screen.queryByRole('textbox', { name: '业务名称' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).toBeChecked();
    await openObject();
    expect(screen.getByRole('textbox', { name: '业务名称' })).toHaveValue('物料');
    expect(screen.queryByText(/已有校验结果已过期/)).not.toBeInTheDocument();
  });
  it('没有来源时引导真实文件导入，不伪造候选模型', async () => {
    open('/ontology/model/from-data');
    expect(await screen.findByRole('button', { name: '选择 Excel 文件' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '发现本体候选' })).not.toBeInTheDocument();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('从来源深链恢复修订，并以表单审核对象和映射', async () => {
    open();
    await openObject();
    expect(await screen.findByRole('textbox', { name: '业务名称' })).toBeVisible();
    expect(screen.getByText('修订 3')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: '已确认对象定义' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '完成查看' })); showMappings();
    expect(screen.getByRole('checkbox', { name: '确认映射 库存 → 物料' })).toBeChecked();
    expect(getModelingSource).toHaveBeenCalledWith('source-one');
  });

  it('修改对象定义立即取消确认，保存使用当前修订并清除旧校验', async () => {
    open(); await openObject();
    fireEvent.change(await screen.findByRole('textbox', { name: '业务名称' }), { target: { value: '库存物料' } });
    expect(screen.getByRole('checkbox', { name: '已确认对象定义' })).not.toBeChecked();
    expect(screen.getByText(/已有校验结果已过期/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
    const saved = vi.mocked(saveModelingSource).mock.calls[0][0];
    expect(saved.revision).toBe(3);
    expect(saved.draft?.classes[0]).toMatchObject({ name: '库存物料', accepted: false });
    expect(await screen.findByText('修订 4')).toBeVisible();
  });

  it('修改后即使旧校验通过也不能发布', async () => {
    open(); await openObject();
    fireEvent.change(await screen.findByRole('textbox', { name: '业务名称' }), { target: { value: '修改后的物料' } });
    fireEvent.click(screen.getByRole('button', { name: /4.*本体发布与验收/ }));
    fireEvent.click(screen.getByRole('button', {name: '发布本体'}));
    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.getByRole('button', {name: '确认发布本体'})).toBeEnabled());
    expect(screen.queryByRole('button', { name: '确认发布原生模型' })).not.toBeInTheDocument();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('发布窗口显式确认后携带当前方案指纹', async () => {
    const initial = fixture();
    const prepared = {...initial, revision:5, resolutions:{material:{mode:'new',propertyMap:{}}}, validation:{...initial.validation!,configHash:'hash5'}, plan:{...initial.plan!,configHash:'hash5'}} as ModelingSource;
    vi.mocked(runModelingOperation).mockResolvedValueOnce(prepared).mockResolvedValueOnce({...prepared,publication:{status:'succeeded',configHash:'hash5',completed:['ont.test.obj.material.v1'],results:[]}});
    open(); await openObject();
    fireEvent.click(screen.getByRole('button', {name: /4.*本体发布与验收/}));
    fireEvent.click(screen.getByRole('button', {name: '发布本体'}));
    const publish = await screen.findByRole('button', {name: '确认发布本体'});
    expect(publish).toBeEnabled();
    fireEvent.change(screen.getByRole('combobox', {name: '物料 发布操作'}), {target:{value:'new'}});
    fireEvent.click(screen.getByRole('button', {name: '校验发布方案'}));
    await screen.findByText('发布方案校验通过，请核对操作及属性对应后确认发布。');
    expect(publish).toBeEnabled();
    expect(runModelingOperation).toHaveBeenCalledWith(expect.objectContaining({revision: 4}), 'validate', {preparePublication: true});
    fireEvent.click(publish);
    await waitFor(() => expect(runModelingOperation).toHaveBeenCalledWith(expect.objectContaining({revision: 5}), 'publish', {configHash: 'hash5', acknowledgeWarnings: true}));
  });

  it('并发保存冲突保留用户输入，提示刷新而非静默覆盖', async () => {
    vi.mocked(saveModelingSource).mockRejectedValue({ response: { status: 409 } });
    open(); await openObject();
    fireEvent.change(await screen.findByRole('textbox', { name: '业务名称' }), { target: { value: '我的修改' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    expect(await screen.findByText(/当前修订已过期/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: '业务名称' })).toHaveValue('我的修改');
    expect(screen.getByText('修订 3 · 未保存')).toBeVisible();
  });

  it('业务背景改变后要求重新人工确认已有模型与映射', async () => {
    open(); await openObject(); await screen.findByRole('textbox', { name: '业务名称' });
    fireEvent.click(screen.getByRole('button', { name: /1.*资料与业务范围/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '业务背景' }), { target: { value: '库存改为按批次区分' } });
    fireEvent.click(screen.getByRole('button', { name: /2.*候选匹配与合并确认/ }));
    expect(screen.getByRole('checkbox', { name: '确认对象 物料' })).not.toBeChecked();
    showMappings();
    expect(screen.getByRole('checkbox', { name: /确认映射 库存 →/ })).not.toBeChecked();
  });

  it('重新打开来源仍展示失败的任务和可重试入口', async () => {
    vi.mocked(getModelingSource).mockResolvedValue({ ...fixture(), job: { id: 'failed-job', kind: 'generate', status: 'failed', error: '模型供应商暂时不可用' } });
    open();
    expect(await screen.findByText('模型供应商暂时不可用')).toBeVisible();
    expect(screen.getByRole('button', { name: '刷新' })).toBeEnabled();
  });

  it('重命名稳定标识同步所有引用与接入决策，并重新要求审核', async () => {
    const source = fixture();
    source.resolutions.material = { mode: 'new', propertyMap: {} };
    source.draft!.relationships.push({ id: 'same_material', name: '相同物料', source: 'material', target: 'material', joins: [{ sourceProperty: 'code', targetProperty: 'code' }], reason: '测试双端引用', accepted: true });
    source.draft!.semantics.definitions.push({ target: 'property:material:code', definition: '物料编码', aliases: [], scope: '', grain: '', unit: '', constraints: '', basis: '', confirmed: true });
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open(); await openObject(); await screen.findByRole('textbox', { name: '业务名称' });
    fireEvent.click(screen.getByRole('button', { name: '修改稳定标识' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '新的稳定模型标识' }), { target: { value: 'manufacturing-material' } });
    fireEvent.click(screen.getByRole('button', { name: '修改标识及引用' }));
    await waitFor(() => expect(screen.getByText('manufacturing-material')).toBeVisible());
    expect(screen.getByRole('checkbox', { name: '确认对象及业务语义' })).not.toBeChecked();
    showMappings();
    expect(screen.getByRole('checkbox', { name: /确认映射 库存 →/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: /业务关系/ }));
    expect(screen.getByRole('checkbox', { name: '确认关系 相同物料' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
    const saved = vi.mocked(saveModelingSource).mock.calls[0][0];
    expect(saved.draft!.classes[0].id).toBe('manufacturing-material');
    expect(saved.draft!.mappings[0].classId).toBe('manufacturing-material');
    expect(saved.draft!.relationships[0]).toMatchObject({ source: 'manufacturing-material', target: 'manufacturing-material', accepted: false });
    expect(saved.draft!.semantics.definitions[0]).toMatchObject({ target: 'property:manufacturing-material:code', confirmed: false });
    expect(saved.resolutions.material).toBeUndefined();
    expect(saved.resolutions['manufacturing-material']).toMatchObject({ mode: 'new' });
  });

  it('已有发布结果时锁定稳定标识，明确引导另建候选', async () => {
    const source = fixture();
    source.publication = { status: 'succeeded', configHash: 'hash3', completed: ['ont.test.obj.material.v1'], results: [] };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open(); await screen.findByText('本次所选本体已发布');
    fireEvent.click(screen.getByRole('button', { name: /2.*候选匹配与合并确认/ }));
    await openObject();
    await screen.findByRole('textbox', { name: '业务名称' });
    expect(screen.getByRole('button', { name: '修改稳定标识' })).toBeDisabled();
    expect(screen.getByText(/稳定标识与发布范围已锁定/)).toBeVisible();
  });

  it('首项 inFlight 保留失败重试但锁定候选，不能被当成发布成功或开放同步', async () => {
    const source = {...fixture(),validation:{...fixture().validation!,canPublish:false,errors:1,issues:[{item:'material',severity:'error',message:'首项回读未完成'}]},publication:{status:'failed',configHash:'hash3',completed:[],inFlight:'ont.test.obj.material.v1',results:[],error:'首项回读未完成'}} as ModelingSource;
    vi.mocked(getModelingSource).mockResolvedValue(source);
    vi.mocked(runModelingOperation).mockImplementationOnce(async value => ({...value,validation:{...source.validation!,canPublish:false,issues:[{item:'material',severity:'error',message:'首项回读未完成'}]}}));
    open();
    await screen.findByRole('button', {name:'已保存'});
    expect(screen.queryByRole('button', {name:'一次处理并确认'})).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name:'确认对象 物料'})).toBeDisabled();
    expect(screen.getByRole('button', {name:'全部确认对象'})).toBeDisabled();
    await openObject();
    const name = screen.getByRole('textbox', {name:'业务名称'});
    expect(name).toBeDisabled();
    expect(screen.getByRole('button', {name:'修改稳定标识'})).toBeDisabled();
    fireEvent.change(name, {target:{value:'不能重定向的物料'}});
    expect(name).toHaveValue('物料');
    fireEvent.click(screen.getByRole('button', {name:'完成查看'}));
    fireEvent.click(screen.getByRole('button', {name:/1.*资料与业务范围/}));
    expect(screen.getByRole('textbox', {name:'业务背景'})).toBeDisabled();
    expect(screen.getByRole('button', {name:'重新发现候选'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name:/4.*本体发布与验收/}));
    expect(screen.getByRole('heading', {name:'发布结果 · failed'})).toBeVisible();
    expect(screen.queryByText('本次所选本体已发布')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:/同步本次数据/})).not.toBeInTheDocument();
    const retry = screen.getByRole('button', {name:'发布本体'});
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(await screen.findByRole('combobox', {name:'物料 发布操作'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name:'继续发布剩余项'}));
    await screen.findByText('校验未通过：首项回读未完成');
    expect(runModelingOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({revision:3,resolutions:{},publication:source.publication,plan:source.plan}), 'validate', {preparePublication:true});
    expect(saveModelingSource).not.toHaveBeenCalled();
  });

  it('正式发布成功后仍可修正数据映射，保留已有类型的稳定标识保护', async () => {
    const source = {...fixture(),publication:{status:'succeeded',configHash:'hash3',completed:['ont.test.obj.material.v1'],inFlight:null,results:[]}} as ModelingSource;
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    await screen.findByText('本次所选本体已发布');
    fireEvent.click(screen.getByRole('button', {name:/2.*候选匹配与合并确认/}));
    showMappings();
    const mapping = screen.getByRole('checkbox', {name:'确认映射 库存 → 物料'});
    expect(mapping).toBeEnabled();
    fireEvent.click(mapping);
    expect(mapping).not.toBeChecked();
    expect(screen.getByRole('button', {name:'保存修改'})).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', {name:/对象类型/}));
    await openObject();
    expect(screen.getByRole('button', {name:'修改稳定标识'})).toBeDisabled();
    expect(saveModelingSource).not.toHaveBeenCalled();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('展示真实三级继承，并阻止选择自身或后代作为父类', async () => {
    const source = fixture();
    const parent = source.draft!.classes[0];
    source.draft!.classes.push({ ...structuredClone(parent), id: 'component', name: '组件', parentClassId: 'material', inheritanceReason: '组件是一种物料' }, { ...structuredClone(parent), id: 'motor', name: '电机组件', parentClassId: 'component', inheritanceReason: '电机组件是一种组件' });
    vi.mocked(getModelingSource).mockResolvedValue(source);
    open();
    fireEvent.click(await screen.findByText('查看概念层次'));
    expect(await screen.findByText('第 3 层')).toBeVisible();
    expect(screen.getAllByText('是一种 物料').some(el => el.closest('details')?.open)).toBe(true);
    expect(screen.getAllByText('是一种 组件').some(el => el.closest('details')?.open)).toBe(true);
    await openObject();
    const parents = screen.getByRole('combobox', { name: '物料 父类' }) as HTMLSelectElement;
    expect(Array.from(parents.options).map(option => option.value)).toEqual(['']);
    fireEvent.click(screen.getByRole('button', { name: '完成查看' })); await openObject('电机组件');
    fireEvent.change(screen.getByRole('combobox', { name: '电机组件 父类' }), { target: { value: 'material' } });
    expect(screen.queryByText('第 3 层')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
    expect(vi.mocked(saveModelingSource).mock.calls[0][0].draft!.classes[2]).toMatchObject({ parentClassId: 'material', accepted: false });
  });

  it('父类重命名只更新直接父引用，保留三级结构且不误改同前缀类', () => {
    const draft = fixture().draft!;
    const parent = draft.classes[0];
    draft.classes.push({ ...structuredClone(parent), id: 'component', name: '组件', parentClassId: 'material', inheritanceReason: '是一种物料' }, { ...structuredClone(parent), id: 'motor', name: '电机组件', parentClassId: 'component', inheritanceReason: '是一种组件' }, { ...structuredClone(parent), id: 'material_other', name: '其他概念', parentClassId: null });
    const renamed = renameConcept(draft, { material: { mode: 'new', propertyMap: {} } }, 'material', 'manufacturing-material');
    expect(renamed.draft.classes[1]).toMatchObject({ parentClassId: 'manufacturing-material', accepted: false });
    expect(renamed.draft.classes[2].parentClassId).toBe('component');
    expect(renamed.draft.classes[3].id).toBe('material_other');
    expect(draft.classes[1].parentClassId).toBe('material');
  });

  it('选择父类补齐共有属性与身份，保留类型冲突供校验，并取消关联审核', () => {
    const draft = fixture().draft!;
    draft.classes[0].properties.push({ id: 'name', name: '物料名称', dataType: 'text' });
    draft.classes.push({ id: 'component', name: '组件', description: '', properties: [{ id: 'code', name: '组件编号', dataType: 'number' }, { id: 'axis', name: '轴数', dataType: 'number' }], identity: ['axis'], labelProperty: 'code', accepted: true, identityStatus: 'confirmed', identityReason: 'Code is a business identifier' });
    draft.mappings.push({ id: 'component_map', classId: 'component', sheet: '库存', bindings: { code: '物料编码' }, reason: '', accepted: true });
    draft.relationships.push({ id: 'belongs', name: '归属', source: 'component', target: 'material', joins: [{ sourceProperty: 'code', targetProperty: 'code' }], reason: '', accepted: true });
    applyParent(draft, 'component', 'material');
    expect(draft.classes[1]).toMatchObject({ parentClassId: 'material', identity: ['code'], accepted: false });
    expect(draft.classes[1].properties).toEqual([{ id: 'code', name: '组件编号', dataType: 'number' }, { id: 'axis', name: '轴数', dataType: 'number' }, { id: 'name', name: '物料名称', dataType: 'text' }]);
    expect(draft.mappings[1].accepted).toBe(false);
    expect(draft.relationships[0].accepted).toBe(false);
  });
});


it('对象审核展示并一并确认相关语义，定义编辑只撤销相关确认', async () => {
  const value = fixture();
  value.draft!.semantics.definitions = [{ target: 'class:material', definition: '按物料编码识别的采购物料', aliases: [], scope: '采购', grain: '一种物料', unit: '', constraints: '', basis: '业务规则', confirmed: false }];
  vi.mocked(getModelingSource).mockResolvedValue(value);
  open();
  expect(await screen.findByText(/待审核语义 1 项/)).toBeVisible();
  expect(screen.getByText('定义：按物料编码识别的采购物料')).toBeVisible();
  await openObject();
  expect(screen.getByRole('textbox', { name: 'class:material 定义' })).toHaveValue('按物料编码识别的采购物料');
  fireEvent.click(screen.getByRole('checkbox', { name: '确认对象及业务语义' }));
  expect(screen.getByRole('checkbox', { name: '确认对象及业务语义' })).toBeChecked();
  expect(screen.getByText(/待审核语义 0 项/)).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'class:material 定义' }), { target: { value: '按工厂区分的物料' } });
  expect(screen.getByRole('checkbox', { name: '确认对象及业务语义' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() => expect(saveModelingSource).toHaveBeenCalled());
  const saved = vi.mocked(saveModelingSource).mock.calls.at(-1)![0];
  expect(saved.draft!.classes[0].accepted).toBe(false);
  expect(saved.draft!.semantics.definitions[0].confirmed).toBe(false);
  expect(saved.draft!.mappings[0].accepted).toBe(true);
});

it('校验警告原地审核并先保存再校验，不返回第二步', async () => {
  const value = fixture();
  value.draft!.semantics.definitions = [{ target: 'class:material', definition: '采购物料', aliases: [], scope: '', grain: '', unit: '', constraints: '', basis: '业务规则', confirmed: false }];
  value.validation!.issues = [{ severity: 'warning', item: 'class:material', message: '语义口径尚未业务确认' }];
  vi.mocked(getModelingSource).mockResolvedValue(value);
  open();
  await screen.findByRole('button', { name: '已保存' });
  fireEvent.click(screen.getByRole('button', { name: /3.*变更草稿与校验/ }));
  fireEvent.click(await screen.findByRole('button', { name: '查看并处理' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '确认对象及业务语义' }));
  fireEvent.click(screen.getByRole('button', { name: '保存并重新校验' }));
  await waitFor(() => expect(runModelingOperation).toHaveBeenCalled());
  expect(saveModelingSource).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveModelingSource).mock.calls[0][0].draft!.semantics.definitions[0].confirmed).toBe(true);
  expect(vi.mocked(runModelingOperation).mock.calls[0][0].revision).toBe(4);
  expect(screen.getByRole('button', { name: /3.*变更草稿与校验/ })).toHaveAttribute('aria-current', 'step');
});
