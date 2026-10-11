import { get, post } from './client';
import type { AppRuntime, RuntimeAction, ActionResult } from './types';

export function getAppRuntime(appId: string): Promise<AppRuntime> {
  return get<AppRuntime>(`/apps/${appId}/runtime`);
}

export function executeRuntimeAction(appId: string, action: RuntimeAction): Promise<ActionResult> {
  return post<ActionResult>(`/apps/${appId}/runtime/execute`, action);
}

export function publishApp(appId: string): Promise<{ app_id: string; status: string; version: string }> {
  return post(`/apps/${appId}/publish`);
}


import type { OrderBinding, PageDesignerConfig } from './pages';
import type { KernelIndividual, KernelLinkInstance } from '@/api/ont/kernel';
export interface OrderRuntimeData {
  orders: KernelIndividual[];
  customers: KernelIndividual[];
  links: KernelLinkInstance[];
  binding: OrderBinding;
  version: string;
}
export function getOrderRuntimeData(appId: string, pageId: string): Promise<OrderRuntimeData> {
  return get('/apps/' + encodeURIComponent(appId) + '/runtime/data?page_id=' + encodeURIComponent(pageId));
}
export function proposeOrderReview(appId: string, pageId: string, targetIid: string, parameters: Record<string, unknown>): Promise<ActionResult> {
  return post('/apps/' + encodeURIComponent(appId) + '/runtime/execute', {
    action_id: 'review', action_type: 'ontology_propose', page_id: pageId,
    payload: { target_iid: targetIid, parameters },
  });
}


export function previewOrderPage(pageId: string, config: PageDesignerConfig): Promise<OrderRuntimeData> {
  return post('/pages/' + encodeURIComponent(pageId) + '/preview', config);
}

export interface PublicationCheck {
  app_id: string; draft_version: string; revision: number; checked_at: string; can_publish: boolean;
  checks: Array<{ key: string; status: 'pass' | 'fail' | 'unknown'; message: string; next_step: string }>;
}
export function checkPublication(appId: string): Promise<PublicationCheck> {
  return get('/apps/' + encodeURIComponent(appId) + '/publication-check');
}

export function getOrderRuntimeHistory(appId: string, pageId: string): Promise<import('@/api/ont/kernel').ActionAuditRow[]> {
  return get('/apps/' + encodeURIComponent(appId) + '/runtime/history?page_id=' + encodeURIComponent(pageId));
}
