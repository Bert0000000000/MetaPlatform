import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '@/api/client';
import ObjectTypesPage from '../model/object-types/ObjectTypesPage';
import { SettingsProvider } from '@/contexts/SettingsContext';
import ObjectTypeEditorV2Drawer from './ObjectTypeEditorV2Drawer';
import * as kernel from '@/api/ont/kernel';
import { setEditorSessionIdentity } from '../hooks/editorSession';
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { id: 'editor-user', tenantId: 'acme' } }) }));
vi.mock('@/utils/auth', async original => ({ ...(await original<typeof import('@/utils/auth')>()), getTenantId: () => 'acme' }));
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, measureText: () => ({ width: 0 }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext; });
vi.mock('@/api/ont/kernel', async importOriginal => ({ ...(await importOriginal<typeof import('@/api/ont/kernel')>()),
  listObjectTypes: vi.fn(async () => []), listActionTypes: vi.fn(async () => []), listLinkTypes: vi.fn(async () => []),
  listValueTypes: vi.fn(async () => []), listInterfaces: vi.fn(async () => []), getTypeHierarchy: vi.fn(async () => []),
  getObjectBindingUsage: vi.fn(),
  inspectObjectType: vi.fn(async()=>({actions:[]})), assessMigration: vi.fn(async()=>({counts:{instances_affected:2},changes:['说明更新'],warnings:[]})),
  precheckObjectTypes: vi.fn(async () => ({candidates:[]})), getObjectType: vi.fn(), applySchemaWip: vi.fn(), mergeObjectTypes: vi.fn(),
  listSchemaWip: vi.fn(async () => []), saveSchemaWip: vi.fn(async () => ({ status: 'staged' })),
  validateObjectTypeModel: vi.fn(async () => ({ valid: true, errors: [], warnings: [], destructive: [], references: { resolved: [], unresolved: [], dependencies: [] } })),
}));
vi.mock('@/api/ontology-bigdata', () => ({listBigDataSources: vi.fn(async () => [{sourceId:'source-live',name:'实时订单库'}])}));
const onSubmit = vi.fn(async () => null), onClose = vi.fn();
const mount = () => render(<MemoryRouter><ObjectTypeEditorV2Drawer open mode="create" objectType={null}
  objectTypes={[]} linkTypes={[]} interfaces={[]} valueTypes={[]} tenant="acme" domainOptions={[{code:'crm',label:'客户'}]}
  onSubmit={onSubmit} onClose={onClose} /></MemoryRouter>);
const originalAdapter=apiClient.defaults.adapter;
beforeEach(() => { setEditorSessionIdentity(''); vi.clearAllMocks(); vi.mocked(kernel.getObjectBindingUsage).mockResolvedValue([]); const storage=new Map<string,string>(); vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k),clear:()=>storage.clear()}); apiClient.defaults.adapter=async config=>({config,status:200,statusText:'OK',headers:{},data:{}}); vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} }); vi.mocked(kernel.listSchemaWip).mockResolvedValue([]); });
afterEach(() => { cleanup(); apiClient.defaults.adapter=originalAdapter; vi.unstubAllGlobals(); });
const fill = () => { fireEvent.change(screen.getByLabelText('业务名称'), {target:{value:'客户'}}); fireEvent.change(screen.getByLabelText('业务标识'), {target:{value:'customer'}}); };
it('shows business form with technical metadata progressively disclosed', async () => {
  mount();
  expect(screen.getByRole('heading', {name:'新建对象类型'})).toBeInTheDocument();
  expect(screen.queryByText('父类型（parent_class，限 1 层）')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'高级设置'}));
  expect(screen.getByText('父类型（parent_class，限 1 层）')).toBeInTheDocument();
});
it('keeps invalid fields in place and does not submit', () => {
  mount(); fireEvent.click(screen.getByRole('button', {name:'发布对象类型'}));
  expect(screen.getByLabelText('业务名称')).toHaveAttribute('aria-invalid','true');
  expect(onSubmit).not.toHaveBeenCalled();
});
it('saves a real strict-new WIP and restores it after remount', async () => {
  const view=mount(); fill(); fireEvent.click(screen.getByRole('button', {name:'保存草稿'}));
  await waitFor(() => expect(kernel.saveSchemaWip).toHaveBeenCalled());
  const call=vi.mocked(kernel.saveSchemaWip).mock.calls[0];
  expect(call[1]).toBe(true);
  expect(onSubmit).not.toHaveBeenCalled();
  view.unmount();
  vi.mocked(kernel.listSchemaWip).mockResolvedValue([{rid:call[0].rid,author:'u-1',payload:call[0] as unknown as Record<string, unknown>,create_only:true,base_checksum:''}]);
  mount(); fireEvent.click(await screen.findByRole('button', {name:'恢复草稿：客户'}));
  expect(screen.getByLabelText('业务标识')).toHaveValue('customer');
  expect(screen.getByLabelText('业务名称')).toHaveValue('客户');
  fireEvent.change(screen.getByLabelText('业务标识'),{target:{value:'new-customer'}});
  fireEvent.click(screen.getByRole('button',{name:'保存草稿'}));
  await waitFor(()=>expect(kernel.saveSchemaWip).toHaveBeenCalledTimes(2));
  expect(vi.mocked(kernel.saveSchemaWip).mock.calls[1][0].properties[0].rid).toBe('ont.acme.prop.crm.new-customer-id.v1');
});
it('retains input on failed draft save and allows retry', async () => {
  vi.mocked(kernel.saveSchemaWip).mockRejectedValueOnce(new Error('连接中断'));
  mount(); fill(); fireEvent.click(screen.getByRole('button', {name:'保存草稿'}));
  expect(await screen.findByText('连接中断')).toBeInTheDocument();
  expect(screen.getByLabelText('业务名称')).toHaveValue('客户');
  fireEvent.click(screen.getByRole('button', {name:'保存草稿'}));
  await screen.findByText('草稿已保存，刷新后可恢复；尚未发布。');
});
it('warns on unsaved close and undo restores the initial form', async () => {

  mount(); fill(); fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(screen.getByRole('dialog', {name:'未保存的修改'})).toBeVisible(); expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'继续编辑'}));
  fireEvent.click(screen.getByRole('button',{name:'撤销更改'}));
  expect(screen.getByLabelText('业务名称')).toHaveValue('');
});
it('prechecks before publication and shows blocking validation', async () => {
  vi.mocked(kernel.validateObjectTypeModel).mockResolvedValueOnce({valid:false,errors:['属性格式不匹配'],warnings:[],destructive:[],references:{resolved:[],unresolved:[],dependencies:[]},rid:''});
  mount(); fill(); fireEvent.click(screen.getByRole('button',{name:'预检与影响'}));
  expect(await screen.findByText('属性格式不匹配')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});


it('retains input when publication reports duplicate RID', async () => {
  onSubmit.mockResolvedValueOnce('该对象类型已存在' as never);
  mount(); fill(); fireEvent.click(screen.getByRole('button',{name:'发布对象类型'}));
  expect(await screen.findByText('该对象类型已存在')).toBeInTheDocument();
  expect(screen.getByLabelText('业务名称')).toHaveValue('客户');
  expect(onClose).not.toHaveBeenCalled();
});
it('imports actual discovered fields and refuses unverified schema responses', async () => {
  const adapter=apiClient.defaults.adapter;
  let verified=false;
  apiClient.defaults.adapter=async config => ({config,status:200,statusText:'OK',headers:{},data:{tables:[{name:'orders',columns:[{name:'amount',type:'numeric',nullable:false}]}],...(verified?{discovered_at:'2026-10-11T00:00:00Z'}:{})}});
  try {
    mount(); fill(); fireEvent.click(screen.getByRole('button',{name:'读取数据源'}));
    await screen.findByRole('option',{name:'实时订单库'});
    fireEvent.change(screen.getByLabelText('选择数据源'),{target:{value:'source-live'}});
    expect(await screen.findByText('尚未取得可验证的实际字段，请检查数据源连接后重试。')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'添加字段 amount（numeric）'})).not.toBeInTheDocument();
    verified=true;
    fireEvent.change(screen.getByLabelText('选择数据源'),{target:{value:''}});
    fireEvent.change(screen.getByLabelText('选择数据源'),{target:{value:'source-live'}});
    fireEvent.click(await screen.findByRole('button',{name:'添加字段 amount（numeric）'}));
    fireEvent.click(screen.getByRole('button',{name:'保存草稿'}));
    await waitFor(() => expect(kernel.saveSchemaWip).toHaveBeenCalled());
    expect(vi.mocked(kernel.saveSchemaWip).mock.calls[0][0].properties).toEqual(expect.arrayContaining([expect.objectContaining({title:'amount',format:'double',nullable:false})]));
  } finally {apiClient.defaults.adapter=adapter;}
});
const mountPage=() => render(<MemoryRouter><SettingsProvider><ObjectTypesPage /></SettingsProvider></MemoryRouter>);
it('candidate continue and cancel retain the new form; reuse never merges an unsaved source', async () => {
  vi.mocked(kernel.precheckObjectTypes).mockResolvedValue({candidates:[{rid:'ont.demo.obj.crm.existing.v1',display_name:'已有客户',similarity:0.9}]} as never);
  vi.mocked(kernel.getObjectType).mockResolvedValue({rid:'ont.demo.obj.crm.existing.v1',display_name:'已有客户',properties:[],primary_key:[],interfaces:[]} as never);
  mountPage(); fireEvent.click(await screen.findByRole('button',{name:'新建对象类型'})); fill();
  fireEvent.blur(screen.getByLabelText('业务名称'));
  fireEvent.click(await screen.findByRole('button',{name:'继续创建'}));
  expect(screen.getByLabelText('业务名称')).toHaveValue('客户');
  fireEvent.change(screen.getByLabelText('业务名称'),{target:{value:'新客户'}}); fireEvent.blur(screen.getByLabelText('业务名称'));
  fireEvent.click(await screen.findByRole('button',{name:'复用已有类型'}));
  await waitFor(() => expect(screen.queryByRole('heading',{name:'新建对象类型'})).not.toBeInTheDocument());
  expect(kernel.mergeObjectTypes).not.toHaveBeenCalled(); expect(kernel.saveSchemaWip).not.toHaveBeenCalled();
});
it('candidate API failure remains recoverable in the form', async () => {
  vi.mocked(kernel.precheckObjectTypes).mockRejectedValueOnce(new Error('offline'));
  mountPage(); fireEvent.click(await screen.findByRole('button',{name:'新建对象类型'})); fill();
  fireEvent.blur(screen.getByLabelText('业务名称'));
  expect(await screen.findByText('相似候选服务暂不可用，可以重试扫描或继续填写；发布仍会检查重复标识。')).toBeInTheDocument();
  expect(screen.getByLabelText('业务名称')).toHaveValue('客户');
});

const editable={rid:'ont.acme.obj.crm.customer.v1',display_name:'客户',checksum:'baseline',primary_key:['ont.acme.prop.crm.customer-id.v1'],properties:[{rid:'ont.acme.prop.crm.customer-id.v1',title:'id',type_id:'string',format:'string',primary_key:true,nullable:false}],interfaces:[]} as kernel.KernelObjectType;
const mountEdit=()=>render(<MemoryRouter><ObjectTypeEditorV2Drawer open mode="edit" objectType={editable} objectTypes={[editable]} linkTypes={[]} interfaces={[]} valueTypes={[]} tenant="acme" domainOptions={[{code:'crm',label:'客户'}]} onSubmit={onSubmit} onClose={onClose}/></MemoryRouter>);
it('shows actual action references alongside data impact',async()=>{
  vi.mocked(kernel.inspectObjectType).mockResolvedValueOnce({actions:['ont.acme.act.review.v1']});
  mountEdit();fireEvent.click(screen.getByRole('button',{name:'预检与影响'}));
  expect(await screen.findByText('引用动作：ont.acme.act.review.v1')).toBeInTheDocument();
  expect(screen.getByText('受影响数据：2 条')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
it('does not publish or invent zero references when inspection fails',async()=>{
  vi.mocked(kernel.inspectObjectType).mockRejectedValueOnce(new Error('动作引用读取失败'));
  mountEdit();fireEvent.click(screen.getByRole('button',{name:'发布对象类型'}));
  expect(await screen.findByText('动作引用读取失败')).toBeInTheDocument();
  expect(screen.getByText('引用动作：尚未取得，请重试预检')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it.each([false, true])('keeps the compared checksum through destructive confirmation (new conflict: %s)', async (newConflict) => {
  onSubmit.mockReset().mockResolvedValue(null);
  vi.mocked(kernel.getObjectType).mockReset();
  const destructive={error:'destructive_confirm_required',changes:['删除属性'],confirm_with:'客户',hint:'确认名称'};
  onSubmit.mockResolvedValueOnce('草稿基线已过期' as never).mockResolvedValueOnce(destructive as never);
  if (newConflict) onSubmit.mockResolvedValueOnce('模型再次更新，请重新比较' as never).mockResolvedValueOnce(destructive as never);
  onSubmit.mockResolvedValueOnce(null);
  vi.mocked(kernel.getObjectType).mockResolvedValueOnce({...editable,checksum:'B'}).mockResolvedValueOnce({...editable,checksum:'C'});
  mountEdit();
  fireEvent.change(screen.getByLabelText('业务说明'),{target:{value:'保留我的修改'}});
  fireEvent.click(screen.getByRole('button',{name:'发布对象类型'}));
  fireEvent.click(await screen.findByRole('button',{name:'比较最新模型'}));
  fireEvent.click(await screen.findByRole('button',{name:'使用最新基线重试发布'}));
  fireEvent.change(await screen.findByPlaceholderText('输入 客户 以确认'),{target:{value:'客户'}});
  fireEvent.click(screen.getByRole('button',{name:'确认重发'}));
  await waitFor(()=>expect(onSubmit).toHaveBeenCalledTimes(3));
  expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({confirm_name:'客户',description:'保留我的修改'}),'edit','B');
  if (newConflict) {
    await screen.findByText('模型再次更新，请重新比较');
    expect(screen.queryByRole('button',{name:'使用最新基线重试发布'})).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'比较最新模型'}));
    fireEvent.click(await screen.findByRole('button',{name:'使用最新基线重试发布'}));
    fireEvent.change(await screen.findByPlaceholderText('输入 客户 以确认'),{target:{value:'客户'}});
    fireEvent.click(screen.getByRole('button',{name:'确认重发'}));
    await waitFor(()=>expect(onSubmit).toHaveBeenCalledTimes(5));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({confirm_name:'客户',description:'保留我的修改'}),'edit','C');
  }
  await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));
});

it('shows the actual published application reference and navigation target', async () => {
  vi.mocked(kernel.getObjectBindingUsage).mockResolvedValueOnce([{ app_id: 'real-app', app_name: 'Order review', page_id: 'real-page', status: 'PUBLISHED', version_id: 'snapshot-1', model_version: editable.rid, model_checksum: 'baseline', action_rid: 'ont.acme.act.review.v1' }]);
  mountEdit(); fireEvent.click(screen.getByRole('button', { name: '预检与影响' }));
  const link = await screen.findByRole('link', { name: 'Order review' });
  expect(link).toHaveAttribute('href', '/apps/mine?app=real-app');
  expect(screen.getByLabelText('应用引用')).toHaveTextContent('已发布');
  expect(kernel.getObjectBindingUsage).toHaveBeenCalledWith(editable.rid);
});
it('preserves edits and blocks publication when application usage is unknown', async () => {
  vi.mocked(kernel.getObjectBindingUsage).mockRejectedValueOnce(new Error('app usage offline'));
  mountEdit(); fireEvent.change(screen.getByLabelText('业务说明'), { target: { value: 'Keep these edits' } });
  fireEvent.click(screen.getByRole('button', { name: '发布对象类型' }));
  expect(await screen.findByText('应用引用未知，请重试预检')).toBeInTheDocument();
  expect(screen.getByLabelText('业务说明')).toHaveValue('Keep these edits');
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.queryByText('当前租户没有实际应用绑定引用')).not.toBeInTheDocument();
});
