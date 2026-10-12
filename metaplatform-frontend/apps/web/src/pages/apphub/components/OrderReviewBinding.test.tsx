import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OrderReviewBinding from './OrderReviewBinding';
const api = vi.hoisted(() => ({ models: vi.fn(), links: vi.fn(), actions: vi.fn() }));
vi.mock('@/api/ont/kernel', () => ({
  listAllObjectTypes: api.models, listLinkTypes: api.links, listActionTypes: api.actions,
}));
afterEach(cleanup);
it('uses selected published model fields rather than fixed sample fields', async () => {
  api.models.mockResolvedValue([{ rid: 'order', display_name: 'Order', status: 'active', checksum: 'sha',
    properties: [{ rid: 'amount', title: 'Actual amount', format: 'decimal' }] }]);
  api.actions.mockResolvedValue([]); api.links.mockResolvedValue([]);
  const change = vi.fn();
  render(<OrderReviewBinding onChange={change} />);
  fireEvent.change(await screen.findByLabelText('订单对象'), { target: { value: 'order' } });
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ object_type: 'order', model_checksum: 'sha', fields: ['amount'] }));
  expect(screen.queryByText('申请人')).toBeNull();
});
it('shows metadata query failures with retry', async () => {
  api.models.mockRejectedValue(new Error('metadata unavailable'));
  api.actions.mockResolvedValue([]); api.links.mockResolvedValue([]);
  render(<OrderReviewBinding onChange={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('metadata unavailable');
  expect(screen.getByRole('button', { name: '重试元数据' })).toBeTruthy();
});
