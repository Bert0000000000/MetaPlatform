import { expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('@/api/apphub/runtime', () => ({ getOrderRuntimeData: vi.fn(), getOrderRuntimeHistory: vi.fn(), previewOrderPage: vi.fn(), proposeOrderReview: vi.fn() }));
vi.mock('@/api/ont/kernel', () => ({ listActionAudit: vi.fn().mockResolvedValue([]) }));
vi.mock('@/pages/ontology/components/ProposalConfirmDrawer', () => ({ default: () => null }));
import { getOrderRuntimeData, getOrderRuntimeHistory } from '@/api/apphub/runtime';
import OrderReviewRuntime from './OrderReviewRuntime';
it('reopens a filtered empty ObjectSet with its attributed persisted receipt', async () => {
  vi.mocked(getOrderRuntimeData).mockResolvedValue({ version: '1.0.0', orders: [], customers: [], links: [], binding: { fields: [] } } as any);
  vi.mocked(getOrderRuntimeHistory).mockResolvedValue([{ audit_id: 'persisted-receipt', proposal_id: 'proposal', actor_id: 'human', created_at: 'now', target_iid: 'order-now-approved', result: {} }] as any);
  const binding = { action_rid: 'review' } as any;
  render(<OrderReviewRuntime appId="app" pageId="page" binding={binding} />);
  await waitFor(() => expect(screen.getByText(/persisted-receipt/)).toBeTruthy());
  expect(getOrderRuntimeHistory).toHaveBeenCalledWith('app', 'page');
  cleanup();
  render(<OrderReviewRuntime appId="app" pageId="page" binding={binding} />);
  await waitFor(() => expect(screen.getByText(/persisted-receipt/)).toBeTruthy());
  cleanup();
});
