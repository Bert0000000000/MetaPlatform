import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import GenerationProgress from './GenerationProgress';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);
const props = { submitting: false, error: '', sheetCount: 25, hasDraft: true, onRetry: vi.fn() };

it('shows real batch progress after reopening and explains draft preservation', () => {
  render(<GenerationProgress {...props} job={{ id: 'j', kind: 'generate', status: 'running', startedAt: new Date(Date.now() - 65000).toISOString(), progress: { stage: 'mapping', batch: 3, totalBatches: 9 } }} />);
  expect(screen.getByText('生成字段映射 · 第 3 / 9 批').closest('li')).toHaveAttribute('aria-current', 'step');
  expect(screen.getByText(/本次包含 25 张工作表/)).toHaveTextContent('失败时保留原草稿');
  expect(screen.getByText(/已用时 1 分/)).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('shows immediate feedback before a server job exists', () => {
  render(<GenerationProgress {...props} submitting job={null} />);
  expect(screen.getByText('正在生成模型建议')).toBeInTheDocument();
  expect(screen.queryByText('重试生成')).not.toBeInTheDocument();
});

it('shows failure beside retry and terminal success', () => {
  const onRetry = vi.fn();
  const { rerender } = render(<GenerationProgress {...props} onRetry={onRetry} job={{ id: 'j', kind: 'generate', status: 'failed', error: 'AI 服务商网关超时；草稿未修改' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('网关超时');
  fireEvent.click(screen.getByRole('button', { name: '重试生成' }));
  expect(onRetry).toHaveBeenCalledOnce();
  rerender(<GenerationProgress {...props} job={{ id: 'j', kind: 'generate', status: 'succeeded' }} />);
  expect(screen.getByText('建议已生成，请审核')).toBeInTheDocument();
});
