import { get, post, del } from '@/api/client';

// ── Sprint 1A：Temporal 双轨编排（ADR-0061）───────────────────────────────
const ORCH = '/orchestrator';

export interface TemporalStep {
  step_id: string;
  kind: 'call_agent' | 'apply_action' | 'propose' | 'run_function' | 'evaluate_object_set';
  target: string;
  payload: Record<string, unknown>;
  requires_hitl?: boolean;
}

export interface SubmitResult {
  plan_id: string;      // twf- 前缀（temporal）或 legacy id
  status: string;       // submitted | hitl_waiting:<step> | completed | failed
  engine: 'temporal' | 'legacy';
  step_count?: number;
}

export interface ReviewResult {
  plan_id: string;
  status: string;
  engine?: string;
}

export async function submitPlanTemporal(steps: TemporalStep[]): Promise<SubmitResult> {
  // axios params 序列化 ?engine=temporal
  const response = await post<SubmitResult>(`${ORCH}/plans?engine=temporal`, { steps });
  return response;
}

export async function submitPlanLegacy(steps: TemporalStep[]): Promise<SubmitResult> {
  return post<SubmitResult>(`${ORCH}/plans`, { steps });
}

export async function planStatus(planId: string): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(`${ORCH}/plans/${planId}`);
}

export async function reviewStep(planId: string, stepId: string, approved: boolean): Promise<ReviewResult> {
  return post<ReviewResult>(`${ORCH}/plans/${planId}/steps/${stepId}/review`, { approved });
}

// ── PRD-01：会话级能力热进化（MP-EMP-EVOLVE-01）──────────────────────────
export interface EvolutionStatus {
  session_id: string;
  tenant_id: string;
  mounted: Record<string, string>;
  snapshot_roles: string[];
  fibers: Record<string, string>;
}

export const openSession = (sid: string) => post(`${ORCH}/sessions/${sid}/open`);
export const mountCapability = (sid: string, name: string, ref: string) =>
  post(`${ORCH}/sessions/${sid}/capabilities`, { name, ref });
export const unmountCapability = (sid: string, name: string) =>
  del(`${ORCH}/sessions/${sid}/capabilities/${name}`);
export const evolutionStatus = (sid: string) => get<EvolutionStatus>(`${ORCH}/sessions/${sid}/evolution`);
export const closeSession = (sid: string) => post(`${ORCH}/sessions/${sid}/close`);
export const sweepSessions = () => post(`${ORCH}/sessions/sweep`);

export interface EvolveProposal {
  proposal_id: string;
  name: string;
  ref: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
}
export const proposeEvolution = (sid: string, name: string, ref: string, reason = '') =>
  post<EvolveProposal>(`${ORCH}/sessions/${sid}/evolve-proposals`, { name, ref, reason });
export const approveEvolution = (sid: string, pid: string) =>
  post<EvolveProposal>(`${ORCH}/sessions/${sid}/evolve-proposals/${pid}/approve`);
export const rejectEvolution = (sid: string, pid: string) =>
  post<EvolveProposal>(`${ORCH}/sessions/${sid}/evolve-proposals/${pid}/reject`);
