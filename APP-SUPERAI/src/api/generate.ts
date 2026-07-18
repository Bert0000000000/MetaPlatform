import { post } from './client';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  CodeReviewResult,
  DashboardGenResult,
  GeneratedConfig,
} from '@/types';

export async function generateForm(description: string): Promise<FormGenResult> {
  return post<FormGenResult>('/v1/generate/form', { description });
}

export async function generateProcess(description: string): Promise<ProcessGenResult> {
  return post<ProcessGenResult>('/v1/generate/process', { description });
}

export async function generateCode(description: string, language: string): Promise<CodeGenResult> {
  return post<CodeGenResult>('/v1/generate/code', { description, language });
}

export async function explainCode(code: string): Promise<GeneratedConfig> {
  return post<GeneratedConfig>('/v1/generate/explain-code', { code });
}

export async function reviewCode(code: string): Promise<CodeReviewResult> {
  return post<CodeReviewResult>('/v1/generate/review-code', { code });
}

export async function generateDashboard(description: string): Promise<DashboardGenResult> {
  return post<DashboardGenResult>('/v1/generate/dashboard', { description });
}
