import { post } from './client';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  DashboardGenResult,
} from '@/types';

export async function generateForm(prompt: string): Promise<FormGenResult> {
  return post<FormGenResult>('/v1/superai/generate/form', { prompt });
}

export async function generateProcess(prompt: string): Promise<ProcessGenResult> {
  return post<ProcessGenResult>('/v1/superai/generate/process', { prompt });
}

export async function generateCode(
  prompt: string,
  language: string,
): Promise<CodeGenResult> {
  return post<CodeGenResult>('/v1/superai/generate/code', { prompt, language });
}

export async function generateDashboard(prompt: string): Promise<DashboardGenResult> {
  return post<DashboardGenResult>('/v1/superai/generate/dashboard', { prompt });
}
