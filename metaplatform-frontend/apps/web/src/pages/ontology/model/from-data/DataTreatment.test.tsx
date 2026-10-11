import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ModelingSource } from '@/api/ont/modeling';
import DataTreatment from './DataTreatment';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({data:new Uint8ClampedArray(4)}) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);
const report={errors:0,warnings:0,issues:[],configHash:'hash',counts:{nodes:1,edges:0,classes:1},quarantine:{rows:2,entities:1,relationships:0,groups:[]}};
function source(): ModelingSource {
  return {id:'s',name:'费用.xlsx',revision:1,context:'',questions:[],resolutions:{},profile:{rowCount:3,sheets:[]},draft:null,job:null,validation:null,review:null,preview:null,publication:null,plan:null,sync:null,dataRepair:{status:'succeeded',proposal:{id:'p',before:report,after:{...report,counts:{...report.counts,nodes:2},quarantine:{...report.quarantine,rows:0}},repairs:[{
    key:'entity:fee:1',name:'费用明细',identity:['A','10'],values:{amount:999},reason:'核对来源修订值后采用',properties:{amount:'金额'},
    before:{amount:[{value:100,rows:[{sheet:'费用',row:2}]},{value:999,rows:[{sheet:'费用',row:3}]}]},
  }]}}};
}
it('修复方案默认不执行，展示来源差异并由用户明确确认所选组',()=>{
  const onConfirm=vi.fn();const onAnalyze=vi.fn();
  render(<DataTreatment source={source()} busy={false} onConfirm={onConfirm} onAnalyze={onAnalyze} />);
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByText('100 / 999 → 999')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox',{name:'采用修复 费用明细 A + 10'}));
  expect(screen.getByRole('button',{name:'确认采用 0 组修复并重新检查'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'采用修复 费用明细 A + 10'}));
  fireEvent.click(screen.getByRole('button',{name:'确认采用 1 组修复并重新检查'}));
  expect(onConfirm).toHaveBeenCalledWith(['entity:fee:1']);
});
it('后台分析期间展示状态并防止重复请求，失败保留错误说明',()=>{
  const value=source();value.dataRepair={status:'running'};
  render(<DataTreatment source={value} busy onAnalyze={vi.fn()} />);
  expect(screen.getByRole('button',{name:'AI 正在分析…'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('尚未修改数据');
});
