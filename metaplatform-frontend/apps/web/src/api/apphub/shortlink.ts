import { get, post } from './client';
import type { Shortlink } from './types';

export function resolveShortlink(code: string): Promise<{ app_id: string; role?: string }> {
  return get(`/shortlinks/${code}`);
}

export function createShortlink(appId: string, role?: string): Promise<Shortlink> {
  return post<Shortlink>('/shortlinks', { app_id: appId, role });
}

export function listShortlinks(): Promise<{ items: Shortlink[] }> {
  return get('/shortlinks');
}
