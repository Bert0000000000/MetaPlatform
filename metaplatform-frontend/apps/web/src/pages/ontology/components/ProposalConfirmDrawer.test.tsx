import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProposalConfirmDrawer from './ProposalConfirmDrawer';

const {
  getProposalPreview,
  confirmProposal,
  executeProposal,
  getProposal,
  rejectProposal,
} = vi.hoisted(() => ({
  getProposalPreview: vi.fn(),
  confirmProposal: vi.fn(),
  executeProposal: vi.fn(),
  getProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

vi.mock('@/api/ont/kernel', () => ({
  getProposalPreview,
  confirmProposal,
  executeProposal,
  getProposal,
  rejectProposal,
}));

vi.mock('./OntologyStagingPreview', () => ({
  default: ({ preview }: { preview: { title?: string } }) => <div>预览：{preview.title}</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const preview = {
  id: 'proposal-action-1',
  kind: 'action' as const,
  title: '复核高风险订单',
  approval_ttl_seconds: 600,
  action: {
    action_rid: 'ont.acme.act.review-order.v1',
    target_objects: [{ rid: 'ont.acme.ind.order-42.v1', primary_key: 'ORDER-42' }],
    parameters: {},
  },
};

describe('ProposalConfirmDrawer', () => {
  it('only reports success after the authoritative confirmation and execution states, then shows audit evidence', async () => {
    const expectedDeadline = new Date(Date.now() + 600000).toISOString();
    getProposalPreview.mockResolvedValue(preview);
    confirmProposal.mockResolvedValue({ id: preview.id, status: 'confirmed' });
    getProposal
      .mockResolvedValueOnce({proposal_id:preview.id,kind:'action',status:'pending'})
      .mockResolvedValueOnce({
        proposal_id: preview.id,
        kind: 'action',
        status: 'confirmed',
        approval_expires_at: expectedDeadline,
        confirmed_by: 'ontology-operator',
        confirmed_at: '2026-08-31T12:00:00Z',
      })
      .mockResolvedValueOnce({
        proposal_id: preview.id,
        kind: 'action',
        status: 'executed',
        approval_expires_at: expectedDeadline,
        confirmed_by: 'ontology-operator',
        confirmed_at: '2026-08-31T12:00:00Z',
      });
    executeProposal.mockResolvedValue({
      id: preview.id,
      status: 'executed',
      audit_id: 'audit-42',
      outbox_event_ids: ['outbox-42'],
    });

    render(<ProposalConfirmDrawer open proposalId={preview.id} />);
    await screen.findByText('预览：复核高风险订单');
    expect(screen.getByText(/批准有效期：10 分钟/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认并执行' }));

    await waitFor(() => expect(executeProposal).toHaveBeenCalledWith(preview.id));
    expect(getProposal).toHaveBeenNthCalledWith(1, preview.id);
    expect(getProposal).toHaveBeenNthCalledWith(2, preview.id);
    expect(getProposal).toHaveBeenNthCalledWith(3, preview.id);
    expect(screen.getByText(/批准有效期：10 分钟/)).toBeInTheDocument();
    expect(await screen.findByText('已执行成功')).toBeInTheDocument();
    expect(screen.getByText('executed')).toBeInTheDocument();
    expect(screen.getByText(/批准有效期/)).toHaveTextContent(expectedDeadline);
    expect(screen.getByText('ontology-operator')).toBeInTheDocument();
    expect(screen.getByText('2026-08-31T12:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('audit-42')).toBeInTheDocument();
    expect(screen.getByText('outbox-42')).toBeInTheDocument();
  });

  it('does not execute if the confirmation endpoint returns before the server reaches confirmed', async () => {
    getProposalPreview.mockResolvedValue(preview);
    confirmProposal.mockResolvedValue({ id: preview.id, status: 'confirmed' });
    getProposal.mockResolvedValue({ proposal_id: preview.id, kind: 'action', status: 'pending' });

    render(<ProposalConfirmDrawer open proposalId={preview.id} />);
    await screen.findByText('预览：复核高风险订单');
    fireEvent.click(screen.getByRole('button', { name: '确认并执行' }));

    expect(await screen.findByText('服务端确认状态异常：pending')).toBeInTheDocument();
    expect(executeProposal).not.toHaveBeenCalled();
  });

  it('disables duplicate confirmation clicks while the command is in flight', async () => {
    getProposalPreview.mockResolvedValue(preview);
    confirmProposal.mockReturnValue(new Promise(() => {}));

    render(<ProposalConfirmDrawer open proposalId={preview.id} />);
    await screen.findByText('预览：复核高风险订单');
    const confirmButton = screen.getByRole('button', { name: '确认并执行' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    fireEvent.click(confirmButton);
    expect(confirmProposal).toHaveBeenCalledTimes(1);
  });
});


it.each([null, '2000-01-01T00:00:00Z'])('refuses missing or expired authoritative deadline %s', async deadline => {
  getProposalPreview.mockResolvedValue(preview);
  getProposal.mockResolvedValueOnce({proposal_id:preview.id,kind:'action',status:'pending'})
    .mockResolvedValueOnce({proposal_id:preview.id,kind:'action',status:'confirmed',approval_expires_at:deadline});
  confirmProposal.mockResolvedValue({id:preview.id,status:'confirmed'});
  render(<ProposalConfirmDrawer open proposalId={preview.id} />);
  await screen.findByText('预览：复核高风险订单');
  fireEvent.click(screen.getByRole('button',{name:'确认并执行'}));
  await screen.findByText('批准已过期或缺少期限，请创建新提案重新批准');
  expect(executeProposal).not.toHaveBeenCalled();
});
