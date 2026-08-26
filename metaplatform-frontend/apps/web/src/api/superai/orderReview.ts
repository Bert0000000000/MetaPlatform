import { apiClient, get } from '@/api/client';

export interface ReviewOrder {
  tenant_id: string;
  order_id: string;
  amount_cents: number;
  payment_status: 'unpaid' | 'paid';
  review_status: string;
  version: number;
  updated_at: string;
}

export interface ActionProposal {
  tenant_id: string;
  proposal_id: string;
  review_case_id: string;
  order_id: string;
  action_type: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  expected_order_version: number;
  parameters: Record<string, unknown>;
  suggestion?: Record<string, unknown>;
  source_refs?: string[];
  expires_at: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface ReviewCaseCreated {
  review_case_id: string;
  proposal_id: string;
  status: 'pending';
  expected_order_version: number;
}

export interface ActionResult {
  proposal_id: string;
  order_id: string;
  status: 'confirmed' | 'rejected';
  order_version?: number;
  follow_up_task_id?: string;
  reason?: string;
}

export async function listHighValueUnpaid(minAmountCents = 100_000): Promise<ReviewOrder[]> {
  const payload = await get<{ items?: ReviewOrder[] } | ReviewOrder[]>('/orders/high-value-unpaid', {
    min_amount_cents: minAmountCents,
  });
  return Array.isArray(payload) ? payload : (payload.items ?? []);
}

export async function createReviewCase(input: {
  orderId: string;
  suggestion: Record<string, unknown>;
  sourceRefs: string[];
}): Promise<ReviewCaseCreated> {
  return apiClient.post<ReviewCaseCreated>('/review-cases', {
    order_id: input.orderId,
    suggestion: input.suggestion,
    source_refs: input.sourceRefs,
  }).then((response) => response.data as ReviewCaseCreated);
}

export async function getActionProposal(proposalId: string): Promise<ActionProposal> {
  return apiClient.get<ActionProposal>(`/action-proposals/${encodeURIComponent(proposalId)}`)
    .then((response) => response.data as ActionProposal);
}

export async function confirmActionProposal(proposalId: string, idempotencyKey: string, actorId: string): Promise<ActionResult> {
  return apiClient.post<ActionResult>(
    `/action-proposals/${encodeURIComponent(proposalId)}/confirm`,
    { actor_id: actorId },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  ).then((response) => response.data as ActionResult);
}

export async function rejectActionProposal(
  proposalId: string,
  idempotencyKey: string,
  actorId: string,
  reason: string,
): Promise<ActionResult> {
  return apiClient.post<ActionResult>(
    `/action-proposals/${encodeURIComponent(proposalId)}/reject`,
    { actor_id: actorId, reason },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  ).then((response) => response.data as ActionResult);
}
