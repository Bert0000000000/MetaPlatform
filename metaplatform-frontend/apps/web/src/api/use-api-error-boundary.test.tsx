import '@testing-library/jest-dom/vitest';
import { useEffect, useState, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Toast } from '@douyinfe/semi-ui';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiErrorBoundary, type NormalizedError } from '../../../../packages/shared/src/hooks/useApiErrorBoundary';
import { HttpError } from '../../../../packages/shared/src/api/types';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const read = vi.fn<() => Promise<string>>();

function Consumer() {
  const { report } = useApiErrorBoundary();
  const [value, setValue] = useState('');
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    void read().then(result => { if (alive) setValue(result); }).catch(report);
    return () => { alive = false; };
  }, [report]);
  return <>
    <label>已读配置<input value={value} onChange={event => setValue(event.target.value)} /></label>
    <button onClick={() => setCount(previous => previous + 1)}>独立状态 +1</button>
    <output>{count}</output>
  </>;
}
function Router({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Toast, 'error').mockReturnValue('');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useApiErrorBoundary callback dependencies', () => {
  it('does not reread configuration or overwrite input after independent renders with default options', async () => {
    read.mockResolvedValueOnce('source-value').mockResolvedValueOnce('unexpected-reread')
      .mockReturnValue(new Promise(() => {}));
    await act(async () => { render(<Router><Consumer /></Router>); });

    expect(screen.getByRole('textbox', { name: '已读配置' })).toHaveValue('source-value');
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: '已读配置' }), { target: { value: 'user-edit' } });
      fireEvent.click(screen.getByRole('button', { name: '独立状态 +1' }));
    });

    expect(screen.getByRole('textbox', { name: '已读配置' })).toHaveValue('user-edit');
    expect(screen.getByText('1')).toBeVisible();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the same report for equivalent options while calling the latest changed callback', () => {
    const first = vi.fn<(error: NormalizedError) => void>();
    const second = vi.fn<(error: NormalizedError) => void>();
    const { result, rerender } = renderHook(options => useApiErrorBoundary(options), {
      initialProps: { onError: first, silent: true }, wrapper: Router,
    });
    const previousReport = result.current.report;
    rerender({ onError: first, silent: true });
    expect(result.current.report).toBe(previousReport);

    rerender({ onError: second, silent: true });
    act(() => { result.current.report(new HttpError(403, '无权访问', 'source-trace')); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      status: 403, message: '无权访问', traceId: 'source-trace',
    }));
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('honors a changed silent field and preserves the existing normalized error and toast', () => {
    const { result, rerender } = renderHook(options => useApiErrorBoundary(options), {
      initialProps: { silent: true }, wrapper: Router,
    });
    const cause = new HttpError(503, '下游暂不可用', 'source-trace');
    let normalized: NormalizedError | undefined;
    act(() => { normalized = result.current.report(cause); });
    expect(normalized).toEqual(expect.objectContaining({ status: 503, message: '下游暂不可用', raw: cause }));
    expect(Toast.error).not.toHaveBeenCalled();

    rerender({ silent: false });
    act(() => { result.current.report(cause); });

    expect(Toast.error).toHaveBeenCalledExactlyOnceWith('服务异常：下游暂不可用');
    expect(result.current.lastError).toEqual(normalized);
  });
});
