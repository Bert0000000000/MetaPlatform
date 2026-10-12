import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { getModelingAcceptance, type ModelingAcceptance } from '@/api/ont/modeling';
import PublicationAcceptance from './PublicationAcceptance';

vi.mock('@/api/ont/modeling', () => ({ getModelingAcceptance: vi.fn() }));
vi.mock('@douyinfe/semi-ui', () => ({
  Banner: ({ description }: { description: string }) => <p>{description}</p>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const report: ModelingAcceptance = { status: 'passed', sourceRevision: 3, checkedAt: '2026-10-10', counts: { types: 1, relationships: 1, drifted: 0 }, types: [], relationships: [], limitations: ['核验不证明业务语义'] };

it('发布验收按需只读刷新并显示后续原生修改的基数差异', async () => {
  vi.mocked(getModelingAcceptance).mockResolvedValue({ ...report, status: 'drifted', counts: { ...report.counts, drifted: 1 }, relationships: [{ relationId: 'belongs_to', rid: 'ont.r.v1', status: 'changed', expectedCardinality: 'N:1', actualCardinality: 'N:N' }] });
  render(<PublicationAcceptance sourceId="fixture" initial={report} />);
  expect(screen.getByText('原生定义与已审核发布方案一致')).toBeVisible();
  expect(getModelingAcceptance).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重新核验原生定义' }));
  await waitFor(() => expect(screen.getByText(/方案基数 N:1，当前 N:N/)).toBeVisible());
  expect(getModelingAcceptance).toHaveBeenCalledWith('fixture');
});

it('核验失败保留上次证据并支持重试', async () => {
  vi.mocked(getModelingAcceptance).mockRejectedValue(new Error('network'));
  render(<PublicationAcceptance sourceId="fixture" initial={report} />);
  fireEvent.click(screen.getByRole('button', { name: '重新核验原生定义' }));
  await waitFor(() => expect(screen.getByText('原生定义核验失败，请稍后重试。')).toBeVisible());
  expect(screen.getByText('原生定义与已审核发布方案一致')).toBeVisible();
});
