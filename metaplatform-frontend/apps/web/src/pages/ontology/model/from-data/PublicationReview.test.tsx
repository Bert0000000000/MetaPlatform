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

it.each([false, true])('自动匹配已有对象，缺少属性=%s 时默认采用对应操作，取消不保存', async missing => {
  const code = {id:'code',name:'客户编码',dataType:'text'};
  const current = {...source,resolutions:{customer:{mode:'new',propertyMap:{}}},draft:{classes:[{
    id:'customer',name:'客户',accepted:true,identity:['code'],properties:missing ? [code,{id:'level',name:'客户等级',dataType:'text'}] : [code],
  }]}} as unknown as ModelingSource;
  const native = {...target,display_name:'客户',primary_key:['ont.test.prop.customer-code.v1'],properties:[{
    rid:'ont.test.prop.customer-code.v1',title:'客户编码',type_id:'string',format:'string',nullable:false,primary_key:true,
  }]} as KernelObjectType;
  render(<PublicationReview source={current} types={[native]} disabled={false} onPrepare={async () => current} onChanged={vi.fn()} onPublished={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  expect(await screen.findByRole('combobox',{name:'客户 发布操作'})).toHaveValue(missing ? 'extend' : 'reuse');
  expect(screen.getByRole('combobox',{name:'客户 已有对象'})).toHaveValue(rid);
  if (missing) expect(screen.getByText(/新增 1 个属性：客户等级/)).toBeInTheDocument();
  expect(saveModelingSource).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(runModelingOperation).not.toHaveBeenCalled();
});

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

it('部分发布后重开保留原方案，只继续剩余资源', async () => {
  const partial = {...checked, plan:{...checked.plan,types:[{rid}],relationships:[{rid:'link'}]}, publication:{
    status:'failed',configHash:'hash',completed:[rid],results:[],error:'关系发布暂时失败',
  }} as unknown as ModelingSource;
  vi.mocked(runModelingOperation).mockResolvedValueOnce({...partial,publication:{...partial.publication!,status:'succeeded',completed:[rid,'link'],error:undefined}});
  const published=vi.fn();
  render(<PublicationReview source={partial} types={[target]} disabled={false} onPrepare={async () => partial} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  expect(await screen.findByText('关系发布暂时失败')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'校验发布方案'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'继续发布剩余项'}));
  await waitFor(()=>expect(published).toHaveBeenCalledTimes(1));
  expect(runModelingOperation).toHaveBeenCalledWith(partial,'publish',{configHash:'hash',acknowledgeWarnings:true});
});

it('资源均已处理但核验失败时显示具体对象并允许安全重试', async () => {
  const failed = {...checked,plan:{...checked.plan,types:[{rid}],relationships:[]},publication:{
    status:'failed',configHash:'hash',completed:[rid],results:[],error:'发布后核验未通过',acceptance:{
      status:'drifted',sourceRevision:3,checkedAt:'now',counts:{types:1,relationships:0,drifted:1},limitations:[],
      types:[{classId:'customer',name:'客户',rid,status:'changed'}],relationships:[],
    },
  }} as unknown as ModelingSource;
  vi.mocked(runModelingOperation).mockResolvedValueOnce({...failed,publication:{...failed.publication!,status:'succeeded',acceptance:{...failed.publication!.acceptance!,status:'passed',counts:{types:1,relationships:0,drifted:0},types:[{classId:'customer',name:'客户',rid,status:'matched'}]}}});
  const published=vi.fn();
  render(<PublicationReview source={failed} types={[target]} disabled={false} onPrepare={async () => failed} onChanged={vi.fn()} onPublished={published} />);
  fireEvent.click(screen.getByRole('button',{name:'发布本体'}));
  expect(await screen.findByText(/客户（已变化）/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'重新核验发布结果'}));
  await waitFor(()=>expect(published).toHaveBeenCalledTimes(1));
  expect(runModelingOperation).toHaveBeenCalledWith(failed,'publish',{configHash:'hash',acknowledgeWarnings:true});
});
