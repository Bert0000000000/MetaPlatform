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
