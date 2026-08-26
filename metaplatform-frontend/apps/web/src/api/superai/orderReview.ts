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

export interface EvidenceFact {
  id: string;
  field: string;
  label: string;
  value: unknown;
  display_value: string;
  source: string;
}

export interface EvidenceGraphNode {
  id: string;
  type: 'transaction_anchor' | 'object_type' | 'action_type';
  label: string;
  rid?: string | null;
}

export interface EvidenceGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface EvidenceDerivation {
  id: string;
  passed: boolean;
  refs: string[];
}

export interface EvidenceOntologyContract {
  object_type: {
    rid: string;
    title: string;
  };
  action_type: {
    rid: string;
    title: string;
    on: string[];
  };
}

export interface EvidenceBundle {
  schema_version: 'order-review-evidence.v1';
  status: 'complete' | 'unavailable';
  proposal_id: string;
  order_id: string;
  tenant_id: string;
  order_version: number;
  captured_at: string;
  ontology: {
    graph: {
      nodes: EvidenceGraphNode[];
      edges: EvidenceGraphEdge[];
    };
    legend: string;
    contract: EvidenceOntologyContract;
  };
  data: {
    facts: EvidenceFact[];
    snapshot: {
      tenant_id: string;
      order_id: string;
      updated_at: string;
    };
  };
  derivation: EvidenceDerivation[];
  recommendation: {
    action: string;
    title: string;
    reason: string;
    confidence?: number | null;
    requires_confirmation: boolean;
    derivation_refs: string[];
    source_refs: string[];
  };
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
  suggestion: Record<string, unknown>;
  source_refs: string[];
  evidence?: EvidenceBundle | null;
  expires_at: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface ReviewCaseCreated {
  review_case_id: string;
  proposal_id: string;
  status: 'pending';
  expected_order_version: number;
  evidence: EvidenceBundle;
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

export async function getActionProposalWithCreatedEvidence(
  proposalId: string,
  evidence: EvidenceBundle | null | undefined,
): Promise<ActionProposal> {
  const proposal = await getActionProposal(proposalId);
  return evidence ? { ...proposal, evidence } : proposal;
}

export async function getActionProposalWithExistingEvidence(
  proposalId: string,
  evidence: EvidenceBundle | null | undefined,
): Promise<ActionProposal> {
  const proposal = await getActionProposal(proposalId);
  return proposal.evidence ? proposal : { ...proposal, evidence };
}

export async function confirmActionProposal(proposalId: string, idempotencyKey: string, actorId: string): Promise<ActionResult> {
  return apiClient.post<ActionResult>(
    `/action-proposals/${encodeURIComponent(proposalId)}:confirm`,
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
    `/action-proposals/${encodeURIComponent(proposalId)}:reject`,
    { actor_id: actorId, reason },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  ).then((response) => response.data as ActionResult);
}
