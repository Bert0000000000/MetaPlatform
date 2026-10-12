import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ModelingSource } from '@/api/ont/modeling';
import GenerationQuality from './GenerationQuality';

vi.mock('@douyinfe/semi-ui', () => ({
  Tag: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
  Button: ({children,onClick}: {children: React.ReactNode;onClick:()=>void}) => <button onClick={onClick}>{children}</button>,
}));
afterEach(cleanup);
const source = { generation: { fingerprint:'f',policyVersion:'excel-native-v1',origin:'reused',rounds:1,structureErrors:0,dataErrors:2,
  findings:[{kind:'identity',item:'line',name:'费用明细',message:'身份缺失 2 行'}],changes:[{kind:'identity',item:'line',reason:'明细编号由单据限定',before:[],after:[]}],notices:[],capabilities:{} },
  draft: { classes:[{id:'line',name:'费用明细'}],relationships:[],mappings:[] } } as unknown as ModelingSource;
it('区分稳定基线、修正记录和剩余阻断并定位审核，不暗示已批准', () => {
  const onLocate=vi.fn();render(<GenerationQuality source={source} dirty={false} onLocate={onLocate} />);
  expect(screen.getByText('沿用相同输入的生成基线')).toBeInTheDocument();
  expect(screen.getByText(/0 项结构问题/)).toHaveTextContent('2 项数据校验阻断');
  fireEvent.click(screen.getByText('查看待处理项（1）'));
  fireEvent.click(screen.getByRole('button',{name:'去核对'}));expect(onLocate).toHaveBeenCalledWith('fd-class-line');
  expect(screen.getByText(/规则调整仍需业务审核/)).toBeInTheDocument();
});
it('人工修改后把生成预检标为历史记录', () => {
  render(<GenerationQuality source={source} dirty onLocate={vi.fn()} />);
  expect(screen.getByText(/以下为生成时的检查记录/)).toBeInTheDocument();
});
