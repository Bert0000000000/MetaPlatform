import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KernelObjectType } from '@/api/ont/kernel';
import { runModelingOperation, saveModelingSource, type ModelingSource } from '@/api/ont/modeling';
import PublicationReview from './PublicationReview';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({fillRect() {},clearRect() {},getImageData:() => ({data:new Uint8ClampedArray(4)})})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/ont/modeling', () => ({runModelingOperation: vi.fn(), saveModelingSource: vi.fn()}));
const rid = 'ont.test.obj.scm.customer.v1';
const source = {id:'source', revision:2, resolutions:{}, publication:null, plan:null, validation:null,
  draft:{classes:[{id:'customer',name:'客户',accepted:true,properties:[]}]}} as unknown as ModelingSource;
const target = {rid, display_name:'已有客户', primary_key:[], properties:[]} as unknown as KernelObjectType;
const checked = {...source, revision:3, validation:{canPublish:true,issues:[]}, plan:{configHash:'hash',warnings:[]}} as unknown as ModelingSource;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
  vi.mocked(saveModelingSource).mockImplementation(async value => ({...value,revision:value.revision+1}));
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

it('同名新建只阻止发布，在窗口改为复用后保留审批并显式发布', async () => {
  vi.mocked(runModelingOperation).mockResolvedValueOnce({...source,revision:3,validation:{canPublish:false,issues:[{item:'customer',message:'已有客户不能重复新建',severity:'error'}]}} as ModelingSource);
  const changed = vi.fn(), published = vi.fn();
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={changed} onPublished={published} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  await screen.findByRole('combobox',{name:'客户 发布操作'});
  expect(saveModelingSource).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'校验发布方案'}));
  await screen.findByText('已有客户不能重复新建');
  expect(screen.getByRole('button',{name:'确认发布本体'})).toBeEnabled();
  fireEvent.change(screen.getByRole('combobox',{name:'客户 发布操作'}),{target:{value:'reuse'}});
  fireEvent.change(screen.getByRole('combobox',{name:'客户 已有对象'}),{target:{value:rid}});
  expect(screen.getByLabelText('客户 目标 RID')).toHaveTextContent(rid);
  vi.mocked(runModelingOperation).mockResolvedValueOnce(checked);
  fireEvent.click(screen.getByRole('button',{name:'校验发布方案'}));
  await screen.findByText('发布方案校验通过，请核对操作及属性对应后确认发布。');
  expect(vi.mocked(saveModelingSource).mock.lastCall?.[0].draft?.classes[0].accepted).toBe(true);
  expect(vi.mocked(saveModelingSource).mock.lastCall?.[0].resolutions.customer).toEqual({mode:'reuse',targetRid:rid,propertyMap:{}});
  expect(screen.getByRole('button',{name:'确认发布本体'})).toBeEnabled();
  expect(published).not.toHaveBeenCalled();
  vi.mocked(runModelingOperation).mockResolvedValueOnce({...checked,publication:{status:'succeeded',configHash:'hash',completed:[rid],results:[]}});
  fireEvent.click(screen.getByRole('button',{name:'确认发布本体'}));
  await waitFor(() => expect(published).toHaveBeenCalledTimes(1));
  expect(runModelingOperation).toHaveBeenLastCalledWith(checked,'publish',{configHash:'hash',acknowledgeWarnings:true});
});

it('发布失败在窗口提示且要求重新校验，取消窗口不保存选择', async () => {
  vi.mocked(runModelingOperation).mockResolvedValueOnce(checked).mockRejectedValueOnce(new Error('连接失败'));
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  await screen.findByRole('combobox',{name:'客户 发布操作'});
  fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(saveModelingSource).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  await screen.findByRole('combobox',{name:'客户 发布操作'});
  fireEvent.click(screen.getByRole('button',{name:'校验发布方案'}));
  await screen.findByText('发布方案校验通过，请核对操作及属性对应后确认发布。');
  fireEvent.click(screen.getByRole('button',{name:'确认发布本体'}));
  await screen.findByText('连接失败');
  expect(screen.getByRole('button',{name:'确认发布本体'})).toBeEnabled();
});

it('直接确认发布会先校验，通过才发布；无需隐藏的额外勾选', async () => {
  vi.mocked(runModelingOperation).mockResolvedValueOnce(checked).mockResolvedValueOnce({...checked,publication:{status:'succeeded',configHash:'hash',completed:[rid],results:[]}});
  const published = vi.fn();
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  const button=await screen.findByRole('button',{name:'确认发布本体'});
  await waitFor(()=>expect(button).toBeEnabled());
  expect(runModelingOperation).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(()=>expect(published).toHaveBeenCalledTimes(1));
  expect(vi.mocked(runModelingOperation).mock.calls.map(call=>call[1])).toEqual(['validate','publish']);
});
it('直接发布遇到校验阻断时不写正式本体，按钮旁显示原因', async () => {
  vi.mocked(runModelingOperation).mockResolvedValueOnce({...source,validation:{canPublish:false,issues:[{item:'customer',severity:'error',message:'业务身份与原生主键不一致'}]}} as ModelingSource);
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  await screen.findByRole('combobox',{name:'客户 发布操作'});
  fireEvent.click(screen.getByRole('button',{name:'确认发布本体'}));
  await screen.findByText('校验未通过：业务身份与原生主键不一致');
  expect(runModelingOperation).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runModelingOperation).mock.calls[0][1]).toBe('validate');
});

it('打开发布窗口保留未决策状态，不把已有相似对象默认为新建', async () => {
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  expect(await screen.findByRole('combobox', {name:'客户 发布操作'})).toHaveValue('');
  expect(source.resolutions).toEqual({});
  expect(saveModelingSource).not.toHaveBeenCalled();
  expect(runModelingOperation).not.toHaveBeenCalled();
});

it('未选择操作直接确认仍交由服务端检查相似候选，不保存隐式新建决定', async () => {
  const blocked = {...source, validation:{canPublish:false,issues:[{item:'customer',severity:'error',message:'已有高相似对象，请明确选择复用、增加属性或新建'}]}} as ModelingSource;
  vi.mocked(runModelingOperation).mockResolvedValueOnce(blocked);
  const published = vi.fn();
  render(<PublicationReview source={source} types={[target]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  await screen.findByRole('combobox', {name:'客户 发布操作'});
  fireEvent.click(screen.getByRole('button', {name:'确认发布本体'}));
  await screen.findByText('已有高相似对象，请明确选择复用、增加属性或新建');
  expect(saveModelingSource).not.toHaveBeenCalled();
  expect(runModelingOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({resolutions:{}}), 'validate', {preparePublication:true});
  expect(published).not.toHaveBeenCalled();
});

it('用户明确选择新建才保存新建决定，并使用校验返回的修订与 hash 发布', async () => {
  const prepared = {...checked, revision:5, resolutions:{customer:{mode:'new',propertyMap:{}}}} as ModelingSource;
  vi.mocked(runModelingOperation).mockResolvedValueOnce(prepared).mockResolvedValueOnce({...prepared, publication:{status:'succeeded',configHash:'hash',completed:[rid],results:[]}});
  const published = vi.fn();
  render(<PublicationReview source={source} types={[]} disabled={false} onPrepare={async () => source} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  const operation = await screen.findByRole('combobox', {name:'客户 发布操作'});
  fireEvent.change(operation, {target:{value:'new'}});
  fireEvent.click(screen.getByRole('button', {name:'确认发布本体'}));
  await waitFor(() => expect(published).toHaveBeenCalledTimes(1));
  expect(saveModelingSource).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({revision:2, resolutions:{customer:{mode:'new',propertyMap:{}}}}));
  expect(runModelingOperation).toHaveBeenNthCalledWith(1, expect.objectContaining({revision:3,resolutions:prepared.resolutions}), 'validate', {preparePublication:true});
  expect(runModelingOperation).toHaveBeenNthCalledWith(2, prepared, 'publish', {configHash:'hash',acknowledgeWarnings:true});
});

it('保留已选复用的精确字段建议，不替未选择的另一类决定新增', async () => {
  const prop = 'ont.test.prop.customer-code.v1';
  const matchingTarget = {...target, properties:[{rid:prop,title:'客户编号',type_id:'string'}]} as KernelObjectType;
  const current = {...source, resolutions:{customer:{mode:'reuse',targetRid:rid,propertyMap:{}}}, draft:{...source.draft!,classes:[{...source.draft!.classes[0],properties:[{id:'code',name:'客户编号',dataType:'text'}]}, {id:'supplier',name:'供应商',properties:[],included:true}]}} as ModelingSource;
  vi.mocked(runModelingOperation).mockImplementationOnce(async value => ({...value, validation:{canPublish:false,issues:[{item:'supplier',severity:'error',message:'供应商需选择发布操作'}]}} as ModelingSource));
  render(<PublicationReview source={current} types={[matchingTarget]} disabled={false} onPrepare={async () => current} onChanged={vi.fn()} onPublished={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  await screen.findByRole('combobox', {name:'客户 发布操作'});
  expect(screen.getByRole('combobox', {name:'客户 发布属性 客户编号'})).toHaveValue(prop);
  fireEvent.click(screen.getByRole('button', {name:'校验发布方案'}));
  await screen.findByText('供应商需选择发布操作');
  expect(vi.mocked(saveModelingSource).mock.lastCall?.[0].resolutions).toEqual({customer:{mode:'reuse',targetRid:rid,propertyMap:{code:prop}}});
});

it.each([false, true])('部分发布重开与失败重试使用服务端实际修订与 hash，保留已锁定目标与字段对应（返回变化：%s）', async changed => {
  const resolutions = {customer:{mode:'extend',targetRid:rid,propertyMap:{code:'ont.test.prop.confirmed-code.v1'}}} as const;
  const partial = {...checked, revision:7, resolutions, plan:{...checked.plan!,configHash:'partial-hash'}, publication:{status:'failed',configHash:'partial-hash',completed:[rid],results:[],error:'关系发布失败'}} as ModelingSource;
  const prepared = {...partial,revision:changed ? 8 : 7,plan:{...partial.plan!,configHash:changed ? 'retry-hash' : 'partial-hash'}} as ModelingSource;
  const rechecked = {...prepared,revision:changed ? 9 : 7,plan:{...prepared.plan!,configHash:changed ? 'fresh-retry-hash' : 'partial-hash'}} as ModelingSource;
  const completed = {...rechecked,publication:{...partial.publication!,status:'succeeded',configHash:rechecked.plan!.configHash}} as ModelingSource;
  vi.mocked(runModelingOperation).mockResolvedValueOnce(prepared).mockRejectedValueOnce(new Error('重试网络失败')).mockResolvedValueOnce(rechecked).mockResolvedValueOnce(completed);
  const published = vi.fn(), prepare = vi.fn().mockResolvedValue(partial);
  render(<PublicationReview source={partial} types={[target]} disabled={false} onPrepare={prepare} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  expect(await screen.findByRole('combobox', {name:'客户 发布操作'})).toBeDisabled();
  expect(screen.getByRole('combobox', {name:'客户 已有对象'})).toBeDisabled();
  expect(screen.getByLabelText('客户 目标 RID')).toHaveTextContent(rid);
  fireEvent.click(screen.getByRole('button', {name:'关闭'}));
  fireEvent.click(screen.getByRole('button', {name:'发布本体'}));
  await screen.findByRole('combobox', {name:'客户 发布操作'});
  fireEvent.click(screen.getByRole('button', {name:'确认发布本体'}));
  await screen.findByText('重试网络失败');
  expect(screen.getByRole('combobox', {name:'客户 发布操作'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'确认发布本体'}));
  await waitFor(() => expect(published).toHaveBeenCalledExactlyOnceWith(completed));
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(saveModelingSource).not.toHaveBeenCalled();
  expect(runModelingOperation).toHaveBeenNthCalledWith(1, expect.objectContaining({revision:7,resolutions,publication:partial.publication,plan:null}), 'validate', {preparePublication:true});
  expect(runModelingOperation).toHaveBeenNthCalledWith(2, prepared, 'publish', {configHash:prepared.plan!.configHash,acknowledgeWarnings:true});
  expect(runModelingOperation).toHaveBeenNthCalledWith(3, expect.objectContaining({revision:prepared.revision,resolutions,publication:partial.publication,plan:null}), 'validate', {preparePublication:true});
  expect(runModelingOperation).toHaveBeenNthCalledWith(4, rechecked, 'publish', {configHash:rechecked.plan!.configHash,acknowledgeWarnings:true});
});
