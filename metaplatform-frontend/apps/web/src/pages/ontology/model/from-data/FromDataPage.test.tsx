import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getModelingSource, listModelingSources, runModelingOperation, saveModelingSource } from '@/api/ont/modeling';
import type { ModelingSource } from '@/api/ont/modeling';
import FromDataPage from './FromDataPage';
import { renameConcept } from './renameConcept';
import { applyParent } from './hierarchy';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/ont/modeling', () => ({ getModelingSource: vi.fn(), listModelingSources: vi.fn(), runModelingOperation: vi.fn(), saveModelingSource: vi.fn(), uploadModelingSource: vi.fn() }));
vi.mock('@/api/ont/kernel', () => ({ listObjectTypes: vi.fn().mockResolvedValue([]) }));
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
  vi.clearAllMocks();
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

describe('从数据建模独立辅助入口', () => {
  it('发布中的状态、请求失败和成功结果都显示在发布按钮旁，生成历史不隐藏发布错误', async () => {
    const source = fixture();
    source.job = { id: 'job-old', kind: 'generate', status: 'succeeded' };
    vi.mocked(getModelingSource).mockResolvedValue(source);
    let rejectPublish!: (reason: unknown) => void;
    vi.mocked(runModelingOperation).mockImplementationOnce(() => new Promise((_, reject) => { rejectPublish = reject; }));
    open();
    await screen.findByRole('button', { name: '已保存' });
    fireEvent.click(screen.getByRole('button', { name: /本体发布与验收/ }));
    const confirm = () => {
      fireEvent.click(screen.getByRole('checkbox', { name: '我已核对校验警告，理解分步发布可能保留部分已完成结果' }));
      fireEvent.click(screen.getByRole('checkbox', { name: '我确认业务定义和身份规则，发布到平台原生本体' }));
    };
    confirm();
    fireEvent.click(screen.getByRole('button', { name: '确认发布原生模型' }));
    const feedback = screen.getByLabelText('发布操作反馈');
    expect(within(feedback).getByRole('status')).toHaveTextContent('正在发布原生模型');
    expect(screen.getByRole('button', { name: '正在发布…' })).toBeDisabled();
    rejectPublish(new Error('发布连接失败，请重试'));
    await waitFor(() => expect(within(feedback).getByRole('alert')).toHaveTextContent('发布连接失败，请重试'));
    expect(screen.getAllByText('发布连接失败，请重试')).toHaveLength(1);
    vi.mocked(runModelingOperation).mockResolvedValueOnce({ ...source, publication: { status: 'succeeded', configHash: 'hash3', completed: ['ont.test.obj.material.v1'], results: [] } });
    fireEvent.click(screen.getByRole('button', { name: '确认发布原生模型' }));
    await waitFor(() => expect(within(feedback).getByText('本次所选本体已发布')).toBeVisible());
    expect(within(feedback).queryByText('发布连接失败，请重试')).not.toBeInTheDocument();
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
    await screen.findByText('数据接入检查 · 可同步');
    expect(runModelingOperation).toHaveBeenCalledWith(source, 'sync-check', {});
    fireEvent.click(screen.getByRole('checkbox', { name: '我已核对同步范围，确认写入正式实例' }));
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
    fireEvent.click(await screen.findByRole('button', { name: '生成模型建议' }));
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
    fireEvent.click(screen.getByRole('button', { name: /本体校验与接入预览/ }));
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
    expect(screen.getByRole('button', { name: '开始同步' })).toBeDisabled();
    expect(screen.getByText(/数据问题不影响已发布的本体/)).toBeVisible();
    expect(screen.getByText('633')).toBeVisible();
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
    expect(screen.getByText(/已有审查与校验结果已过期/)).toBeVisible();
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
    expect(screen.queryByText(/已有审查与校验结果已过期/)).not.toBeInTheDocument();
  });
  it('没有来源时引导真实文件导入，不伪造候选模型', async () => {
    open('/ontology/model/from-data');
    expect(await screen.findByRole('button', { name: '选择 Excel 文件' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '生成模型建议' })).not.toBeInTheDocument();
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
    expect(screen.getByText(/已有审查与校验结果已过期/)).toBeVisible();
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
    expect(screen.getByText('发布方案不存在或已经过期，请先重新校验。')).toBeVisible();
    expect(screen.queryByRole('button', { name: '确认发布原生模型' })).not.toBeInTheDocument();
    expect(runModelingOperation).not.toHaveBeenCalled();
  });

  it('发布同时需要人工确认与警告确认，并携带当前方案指纹', async () => {
    open(); await openObject(); await screen.findByRole('textbox', { name: '业务名称' });
    fireEvent.click(screen.getByRole('button', { name: /4.*本体发布与验收/ }));
    const publish = screen.getByRole('button', { name: '确认发布原生模型' });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '我确认业务定义和身份规则，发布到平台原生本体' }));
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '我已核对校验警告，理解分步发布可能保留部分已完成结果' }));
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(runModelingOperation).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }), 'publish', { configHash: 'hash3', acknowledgeWarnings: true }));
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
    fireEvent.click(screen.getByRole('button', { name: /1.*数据与建模范围/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '业务背景' }), { target: { value: '库存改为按批次区分' } });
    fireEvent.click(screen.getByRole('button', { name: /2.*候选本体审核/ }));
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
    expect(screen.getByRole('checkbox', { name: '已确认对象定义' })).not.toBeChecked();
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
    fireEvent.click(screen.getByRole('button', { name: /2.*候选本体审核/ }));
    await openObject();
    await screen.findByRole('textbox', { name: '业务名称' });
    expect(screen.getByRole('button', { name: '修改稳定标识' })).toBeDisabled();
    expect(screen.getByText(/稳定标识与发布范围已锁定/)).toBeVisible();
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
