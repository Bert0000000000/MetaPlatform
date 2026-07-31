import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('superai', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}


import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  DashboardGenResult,
} from './types';

export async function generateForm(prompt: string): Promise<FormGenResult> {
  return post<FormGenResult>('/generate/form', { prompt });
}

export async function generateProcess(prompt: string): Promise<ProcessGenResult> {
  return post<ProcessGenResult>('/generate/process', { prompt });
}

export async function generateCode(
  prompt: string,
  language: string,
): Promise<CodeGenResult> {
  return post<CodeGenResult>('/generate/code', { prompt, language });
}

export async function generateDashboard(prompt: string): Promise<DashboardGenResult> {
  return post<DashboardGenResult>('/generate/dashboard', { prompt });
}
