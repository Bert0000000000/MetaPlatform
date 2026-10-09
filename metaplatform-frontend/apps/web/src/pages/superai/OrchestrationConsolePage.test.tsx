import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../../../packages/shared/src/api/types';
import * as orchestration from '@/api/superai/orchestration';
import OrchestrationConsolePage from './OrchestrationConsolePage';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
// The HTTP service and user settings are external; the page and Semi controls stay real.
vi.mock('@/api/superai/orchestration', () => ({
  evolutionStatus: vi.fn(), openSession: vi.fn(), closeSession: vi.fn(),
  mountCapability: vi.fn(), proposeEvolution: vi.fn(), approveEvolution: vi.fn(),
  submitPlanTemporal: vi.fn(), reviewStep: vi.fn(),
}));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

const SESSION = 'emp-console-1';
const unopenedDetail = `session '${SESSION}' not open`;
const loadedStatus: orchestration.EvolutionStatus = {
  session_id: SESSION, tenant_id: 'source-tenant', snapshot_roles: ['source-role'],
  mounted: { 'source-capability': 'source-ref' }, fibers: {},
};

function httpFailure(status: number, detail: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, {
    status, statusText: 'Failed', headers: {}, config, data: { detail },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  vi.mocked(orchestration.evolutionStatus).mockRejectedValue(httpFailure(404, unopenedDetail));
  vi.mocked(orchestration.openSession).mockResolvedValue({ session_id: SESSION });
  vi.mocked(orchestration.closeSession).mockResolvedValue({ session_id: SESSION, closed: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderPage() {
  await act(async () => { render(<OrchestrationConsolePage />); });
}

describe('orchestration session read states', () => {
  it('waits for the first read without claiming an unopened session or creating one', async () => {
    let resolve!: (status: orchestration.EvolutionStatus) => void;
    vi.mocked(orchestration.evolutionStatus).mockReturnValue(new Promise(done => { resolve = done; }));
    await renderPage();

    expect(screen.queryByText('会话尚未打开')).not.toBeInTheDocument();
    expect(screen.queryByText('正在读取会话状态')).toBeVisible();
    expect(screen.getByRole('button', { name: '打开会话' })).toBeDisabled();
    expect(orchestration.openSession).not.toHaveBeenCalled();
    await act(async () => { resolve(loadedStatus); });
    expect(screen.getByText('source-capability')).toBeVisible();
  });

  it('presents the documented unopened-session 404 as an idle state with an explicit open action', async () => {
    await renderPage();

    expect(screen.queryByText('会话尚未打开')).toBeVisible();
    expect(screen.queryByText(/未能读取会话状态/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开会话' })).toBeEnabled();
    expect(screen.queryByPlaceholderText('能力名（如 hot_skill）')).not.toBeInTheDocument();
    expect(orchestration.openSession).not.toHaveBeenCalled();
  });

  it('recognizes the same unopened-session response when carried by a shared HttpError', async () => {
    vi.mocked(orchestration.evolutionStatus).mockRejectedValue(
      new HttpError(404, 'Request failed with status code 404', undefined, { detail: unopenedDetail }),
    );
    await renderPage();

    expect(screen.queryByText('会话尚未打开')).toBeVisible();
    expect(screen.queryByText(/未能读取会话状态/)).not.toBeInTheDocument();
    expect(orchestration.openSession).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'Not Found'],
    [403, 'cross-tenant session denied'],
    [503, 'orchestration service unavailable'],
  ])('keeps an unrelated HTTP %i visible as a read failure', async (status, detail) => {
    vi.mocked(orchestration.evolutionStatus).mockRejectedValue(httpFailure(status, detail));
    await renderPage();

    expect(screen.queryByText(/未能读取会话状态/)).toBeVisible();
    expect(screen.queryByText('会话尚未打开')).not.toBeInTheDocument();
    expect(screen.queryByText('会话状态读取失败')).toBeVisible();
    const open = screen.getByRole('button', { name: '打开会话' });
    expect(open).toBeDisabled();
    await act(async () => { fireEvent.click(open); });
    expect(orchestration.openSession).not.toHaveBeenCalled();
  });

  it('does not retain permission to open when an unopened session reread fails', async () => {
    vi.mocked(orchestration.evolutionStatus)
      .mockRejectedValueOnce(httpFailure(404, unopenedDetail))
      .mockRejectedValueOnce(httpFailure(503, 'service unavailable'));
    await renderPage();
    expect(screen.getByRole('button', { name: '打开会话' })).toBeEnabled();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '刷新' })); });

    const open = screen.getByRole('button', { name: '打开会话' });
    expect(open).toBeDisabled();
    await act(async () => { fireEvent.click(open); });
    expect(orchestration.openSession).not.toHaveBeenCalled();
    expect(screen.queryByText('会话状态读取失败')).toBeVisible();
  });

  it('does not mistake an unknown failure with no message for confirmation that the session is absent', async () => {
    vi.mocked(orchestration.evolutionStatus).mockRejectedValue(new Error(''));
    await renderPage();

    expect(screen.queryByText('会话状态读取失败')).toBeVisible();
    const open = screen.getByRole('button', { name: '打开会话' });
    expect(open).toBeDisabled();
    await act(async () => { fireEvent.click(open); });
    expect(orchestration.openSession).not.toHaveBeenCalled();
  });

  it('creates the session only after the user opens it, then displays the returned capabilities', async () => {
    vi.mocked(orchestration.evolutionStatus)
      .mockRejectedValueOnce(httpFailure(404, unopenedDetail)).mockResolvedValueOnce(loadedStatus);
    await renderPage();
    expect(screen.queryByText('会话尚未打开')).toBeVisible();
    expect(orchestration.openSession).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '打开会话' })); });

    expect(orchestration.openSession).toHaveBeenCalledExactlyOnceWith(SESSION);
    expect(orchestration.evolutionStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText('source-capability')).toBeVisible();
    expect(screen.getByText('source-ref')).toBeVisible();
    expect(screen.getByRole('button', { name: '关闭会话（还原）' })).toBeEnabled();
    expect(screen.queryByText('会话尚未打开')).not.toBeInTheDocument();
  });

  it('returns to the normal unopened state when a successful close removes the session', async () => {
    vi.mocked(orchestration.evolutionStatus)
      .mockResolvedValueOnce(loadedStatus).mockRejectedValueOnce(httpFailure(404, unopenedDetail));
    await renderPage();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '关闭会话（还原）' })); });

    expect(orchestration.closeSession).toHaveBeenCalledExactlyOnceWith(SESSION);
    expect(screen.queryByText('会话尚未打开')).toBeVisible();
    expect(screen.queryByText(/未能读取会话状态/)).not.toBeInTheDocument();
    expect(screen.queryByText('source-capability')).not.toBeInTheDocument();
    expect(orchestration.openSession).not.toHaveBeenCalled();
  });
});
