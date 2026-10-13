import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { confirmProposal, executeProposal, rejectProposal } from '@/api/ont/kernel';
import { draftFromProperty, emptyPropertyDraft } from './PropertyEditorV2';
import { readAnalysisPins, saveAnalysisPin } from './analysisPins';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, measureText: () => ({ width: 0 }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext; });
const originalAdapter = apiClient.defaults.adapter;
beforeEach(() => {
  // HTTP browsers provide random bytes but omit the secure-context-only UUID API.
  vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  localStorage.clear();
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

it('creates independent property drafts on HTTP without changing the model RID', () => {
  const first = emptyPropertyDraft('id'), second = emptyPropertyDraft('amount');
  const restored = draftFromProperty({ rid: 'ont.acme.prop.crm.order-id.v1', title: '订单号',
    type_id: 'string', format: 'string', nullable: false, primary_key: true });
  for (const draft of [first, second, restored]) expect(draft.uid).toMatch(uuidV4);
  expect(new Set([first.uid, second.uid, restored.uid]).size).toBe(3);
  expect(restored.rid).toBe('ont.acme.prop.crm.order-id.v1');
  expect(restored.primaryKey).toBe(true);
});

it('persists an analysis pin on HTTP with its original query configuration', () => {
  const pin = saveAnalysisPin({ title: '订单统计', config: { source: 'ont.acme.obj.crm.order.v1',
    dimension: 'status', metric: '', fn: 'count', chartType: 'bar' } });
  expect(pin.id).toMatch(uuidV4);
  expect(readAnalysisPins()).toEqual([pin]);
});

it('sends confirm, execute and reject proposals on HTTP with independent idempotency keys', async () => {
  const requests: { url: string; key: string }[] = [];
  apiClient.defaults.adapter = async config => {
    requests.push({ url: config.url!, key: String(config.headers.get('Idempotency-Key')) });
    return { config, status: 200, statusText: 'OK', headers: {}, data: { status: 'ok' } };
  };
  await confirmProposal('proposal-1'); await executeProposal('proposal-1'); await rejectProposal('proposal-2');
  expect(requests.map(r => r.url)).toEqual(['/ont/v2/proposals/proposal-1/confirm',
    '/ont/v2/proposals/proposal-1/execute', '/ont/v2/proposals/proposal-2/reject']);
  for (const request of requests) expect(request.key).toMatch(uuidV4);
  expect(new Set(requests.map(r => r.key)).size).toBe(3);
});
