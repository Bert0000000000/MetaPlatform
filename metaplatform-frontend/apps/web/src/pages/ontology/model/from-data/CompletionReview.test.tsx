import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { confirmModelingCompletion, prepareModelingCompletion, saveModelingSource, type ModelingCompletionPlan, type ModelingSource } from '@/api/ont/modeling';
import CompletionReview from './CompletionReview';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({fillRect() {},clearRect() {},getImageData:() => ({data:new Uint8ClampedArray(4)})})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/ont/modeling', () => ({confirmModelingCompletion:vi.fn(),prepareModelingCompletion:vi.fn(),saveModelingSource:vi.fn()}));
const source={id:'source',revision:2,publication:null} as ModelingSource;
const plan:ModelingCompletionPlan={hash:'a'.repeat(64),canApply:true,
  candidates:[{id:'line',name:'费用明细',identity:['单号','明细号'],reason:'单据内唯一',included:true,originallyIncluded:true,parent:null,problem:'',deferredProperties:[]}],
  relationships:[],changes:[],remaining:[],counts:{classes:1,relationships:0,deferred:0},data:{nodes:2,edges:0,rows:0,errors:0,canSync:true}};
beforeEach(() => {
  vi.resetAllMocks();vi.mocked(prepareModelingCompletion).mockResolvedValue(plan);
  vi.mocked(confirmModelingCompletion).mockResolvedValue({...source,revision:3});
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
});
afterEach(() => {cleanup();vi.unstubAllGlobals();});

it('选择不发布类时自动重算范围，一次确认提交同一方案和排除范围',async () => {
  const applied=vi.fn();const prepare=vi.fn().mockResolvedValue(source);
  render(<CompletionReview source={source} disabled={false} onPrepare={prepare} onApplied={applied} />);
  fireEvent.click(screen.getByRole('button',{name:'一次处理并确认'}));
  await screen.findByRole('combobox',{name:'费用明细 本次处理'});
  expect(confirmModelingCompletion).not.toHaveBeenCalled();
  vi.mocked(prepareModelingCompletion).mockResolvedValue({...plan,hash:'b'.repeat(64),canApply:false,candidates:[{...plan.candidates[0],included:false}],remaining:[{item:'draft',message:'至少保留一个类',severity:'error'}]});
  fireEvent.change(screen.getByRole('combobox',{name:'费用明细 本次处理'}),{target:{value:'defer'}});
  await waitFor(() => expect(prepareModelingCompletion).toHaveBeenLastCalledWith(source,['line']));
  await screen.findByText('至少保留一个类');
  expect(screen.getByRole('button',{name:'确认方案并重新校验'})).toBeDisabled();
  vi.mocked(prepareModelingCompletion).mockResolvedValue(plan);
  fireEvent.change(screen.getByRole('combobox',{name:'费用明细 本次处理'}),{target:{value:'complete'}});
  await waitFor(() => expect(screen.getByRole('button',{name:'确认方案并重新校验'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'确认方案并重新校验'}));
  await waitFor(() => expect(applied).toHaveBeenCalledWith({...source,revision:3}));
  expect(confirmModelingCompletion).toHaveBeenCalledTimes(1);
  expect(confirmModelingCompletion).toHaveBeenCalledWith(source,plan.hash,[]);
});

it('过期确认在弹窗显示原因并要求重新查看，不重复提交旧方案',async () => {
  vi.mocked(confirmModelingCompletion).mockRejectedValue({response:{data:{detail:'完整处理方案已变化，请重新查看方案'}}});
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'一次处理并确认'}));
  await waitFor(() => expect(screen.getByRole('button',{name:'确认方案并重新校验'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'确认方案并重新校验'}));
  await screen.findByText('完整处理方案已变化，请重新查看方案');
  expect(screen.getByRole('button',{name:'确认方案并重新校验'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'重新查看最新方案'})).toBeEnabled();
});

it('父类暂缓时子类明确随父类暂缓，不显示可独立发布的选择',async () => {
  vi.mocked(prepareModelingCompletion).mockResolvedValue({...plan,candidates:[
    {...plan.candidates[0],included:false},
    {...plan.candidates[0],id:'child',name:'费用子类',parent:'line',included:false,problem:'父类未纳入本次发布'},
  ]});
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'一次处理并确认'}));
  const child=await screen.findByRole('combobox',{name:'费用子类 本次处理'});
  expect(child).toBeDisabled();expect(child).toHaveValue('parent');
  expect(screen.getByRole('option',{name:'随父类暂缓（含实例）'})).toBeInTheDocument();
});

it('无法自动补全时可直接定位补充信息，离开方案不修改审核状态',async () => {
  vi.mocked(prepareModelingCompletion).mockResolvedValue({...plan,candidates:[{...plan.candidates[0],included:false,problem:'缺少身份依据'}]});
  const edit=vi.fn();
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} onEditClass={edit} />);
  fireEvent.click(screen.getByRole('button',{name:'一次处理并确认'}));
  fireEvent.click(await screen.findByRole('button',{name:'补充费用明细信息'}));
  expect(edit).toHaveBeenCalledWith('line');expect(confirmModelingCompletion).not.toHaveBeenCalled();
});


it('批量审批弹窗不要求选择新建或复用', async () => {
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: '一次处理并确认'}));
  await waitFor(() => expect(screen.getByRole('button', {name: '确认方案并重新校验'})).toBeEnabled());
  expect(screen.queryByRole('region', {name: '本体候选发布处理'})).not.toBeInTheDocument();
  expect(saveModelingSource).not.toHaveBeenCalled();
});

it('首项 inFlight 且完成列表为空时不能重新审批候选', () => {
  const current = {...source,publication:{status:'failed',configHash:'flight-hash',completed:[],inFlight:'ont.test.obj.customer.v1',results:[]}} as ModelingSource;
  const prepare = vi.fn();
  render(<CompletionReview source={current} disabled={false} onPrepare={prepare} onApplied={vi.fn()} />);
  const button = screen.getByRole('button', {name:'一次处理并确认'});
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(prepare).not.toHaveBeenCalled();
  expect(prepareModelingCompletion).not.toHaveBeenCalled();
  expect(confirmModelingCompletion).not.toHaveBeenCalled();
});

it('兼容尚未返回暂缓属性字段的旧服务数据', async () => {
  vi.mocked(prepareModelingCompletion).mockResolvedValue({
    ...plan,
    candidates: [{...plan.candidates[0], deferredProperties: undefined}],
  });
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: '一次处理并确认'}));
  expect(await screen.findByRole('combobox', {name: '费用明细 本次处理'})).toBeVisible();
  expect(screen.getByRole('button', {name: '确认方案并重新校验'})).toBeEnabled();
});


it('一次处理方案在最终确认前展示将确认的完整业务语义', async () => {
  vi.mocked(prepareModelingCompletion).mockResolvedValue({ ...plan, semantics: [{ target: 'class:line', definition: '一张单据中的费用明细', aliases: ['费用行'], scope: '财务', grain: '一行费用', unit: '元', constraints: '单据内编号唯一', basis: '财务制度', confirmed: true }] });
  render(<CompletionReview source={source} disabled={false} onPrepare={async () => source} onApplied={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '一次处理并确认' }));
  expect(await screen.findByText('定义：一张单据中的费用明细')).toBeVisible();
  expect(screen.getByText('依据：财务制度')).toBeVisible();
  expect(screen.getByText('别名：费用行')).toBeVisible();
  expect(confirmModelingCompletion).not.toHaveBeenCalled();
});
