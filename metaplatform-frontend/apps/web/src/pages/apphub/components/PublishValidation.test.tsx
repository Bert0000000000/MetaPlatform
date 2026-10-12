import { expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
vi.mock('@douyinfe/semi-ui', () => ({ Banner: 'div', Button: 'button', Card: 'div', Space: 'div', Tag: 'span', Typography: {} }));
vi.mock('@douyinfe/semi-ui/lib/es/grid', () => ({ Row: 'div', Col: 'div' }));
import { ApplicationPublishValidation } from './PublishValidation';
it('shows real failed and unknown checks and blocks publication until all pass', () => {
  const onPublish = vi.fn(); const onRetry = vi.fn();
  const result: any = { draft_version: '2.0.0', checked_at: 'now', can_publish: false, checks: [
    { key: 'bindings', status: 'fail', message: 'missing field', next_step: 'repair field' },
    { key: 'runtime', status: 'unknown', message: 'offline', next_step: 'retry connection' }] };
  const view = render(<ApplicationPublishValidation result={result} error="" publishing={false} onPublish={onPublish} onRetry={onRetry} />);
  expect(screen.getByText(/数据绑定：失败/)).toBeTruthy();
  expect(screen.getByText(/可加载运行页：未知/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' })); expect(onPublish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重新检查' })); expect(onRetry).toHaveBeenCalled();
  view.rerender(<ApplicationPublishValidation result={{ ...result, can_publish: true }} error="network failed" publishing={false} onPublish={onPublish} onRetry={onRetry} />);
  fireEvent.click(screen.getByRole('button', { name: '确认发布' })); expect(onPublish).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('当前保存内容保留'); cleanup();
});
