vi.mock('@/api/apphub/apps', () => ({ listApps: vi.fn(), getApp: vi.fn() }));
vi.mock('@/api/apphub/runtime', () => ({ getAppRuntime: vi.fn() }));
vi.mock('@/api/ontology-bigdata', () => ({ listBigDataSources: vi.fn() }));
vi.mock('@/api/ont/kernel', () => ({ listAllObjectTypes: vi.fn(), listLinkTypes: vi.fn(), listBackingDatasources: vi.fn(), listIndividuals: vi.fn(), listLinkInstances: vi.fn() }));
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
const auth = vi.hoisted(() => ({ user: { id: 'one', tenantId: 'a' } }));
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: auth.user }) }));
import ProductOnboarding, { deriveOnboardingEvidence, onboardingKey } from './ProductOnboarding';

describe('artifact-based first use', () => {
  it('isolates resume position by tenant and user', () => {
    expect(onboardingKey('a', 'one')).not.toBe(onboardingKey('a', 'two'));
    expect(onboardingKey('a', 'one')).not.toBe(onboardingKey('b', 'one'));
  });
  it('does not complete from registered sources, seed models or unrelated successful imports', () => {
    const selected = { flow: 'data' as const, sourceId: 'source-real', modelRid: 'Order', mappingRid: 'map-real', runId: 'run-chosen', linkRid: 'link-real', appId: 'app-real', position: 0 };
    const result = deriveOnboardingEvidence(selected, {
      sourceId: 'source-real', modelRid: 'Order', modelStatus: 'active', mappingRid: 'map-real',
      mappingSourceId: 'source-real', runs: [{ run_id: 'other-run', status: 'succeeded', ok: true, total_synced: 3 }],
      dataCount: 3, linkRid: 'link-real', relatedCount: 2, appId: 'app-real', publishedVersionId: 'v1', boundModelRid: 'Order', boundLinkRid: 'link-real',
    });
    expect(result.every(Boolean)).toBe(false);
    expect(result[0]).toBe(false);
  });
  it('completes only with selected successful import and its actual connected artifacts', () => {
    const selected = { flow: 'data' as const, sourceId: 'src', modelRid: 'Order', mappingRid: 'map', runId: 'run', linkRid: 'link', appId: 'app', position: 0 };
    const evidence = { sourceId: 'src', modelRid: 'Order', modelStatus: 'active', mappingRid: 'map', mappingSourceId: 'src',
      runs: [{ run_id: 'run', status: 'succeeded', ok: true, total_synced: 2 }], dataCount: 2,
      linkRid: 'link', relatedCount: 1, appId: 'app', publishedVersionId: 'v', boundModelRid: 'Order', boundLinkRid: 'link' };
    expect(deriveOnboardingEvidence(selected, evidence)).toEqual([true, true, true, true, true]);
    expect(deriveOnboardingEvidence(selected, { ...evidence, dataCount: 0 })[0]).toBe(false);
  });
});




import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { listApps } from '@/api/apphub/apps';
import { listBigDataSources } from '@/api/ontology-bigdata';
import { listAllObjectTypes, listLinkTypes } from '@/api/ont/kernel';
it('renders each user and tenant resume state independently', async () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', { clear: () => saved.clear(), getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
  localStorage.clear();
  vi.mocked(listApps).mockResolvedValue({ items: [], total: 0 } as any);
  vi.mocked(listBigDataSources).mockResolvedValue([]);
  vi.mocked(listAllObjectTypes).mockResolvedValue([]);
  vi.mocked(listLinkTypes).mockResolvedValue([]);
  auth.user = { id: 'one', tenantId: 'a' };
  const view = render(<MemoryRouter><ProductOnboarding /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '接入真实数据' }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(onboardingKey('a', 'one'))!).flow).toBe('data'));
  auth.user = { id: 'two', tenantId: 'a' };
  view.rerender(<MemoryRouter><ProductOnboarding /></MemoryRouter>);
  expect(screen.queryByLabelText('本次数据源')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '打开已有应用' }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(onboardingKey('a', 'two'))!).flow).toBe('existing'));
  auth.user = { id: 'one', tenantId: 'b' };
  view.rerender(<MemoryRouter><ProductOnboarding /></MemoryRouter>);
  expect(screen.queryByLabelText('本次应用')).toBeNull();
  auth.user = { id: 'one', tenantId: 'a' };
  view.rerender(<MemoryRouter><ProductOnboarding /></MemoryRouter>);
  expect(screen.getByLabelText('本次数据源')).toBeTruthy();
  expect(screen.getByRole('button', { name: '接入真实数据' }).getAttribute('aria-pressed')).toBe('true');
  cleanup();
  vi.unstubAllGlobals();
});
