import { get, post, put, del } from './client';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  CodeReviewResult,
  DashboardGenResult,
  GeneratedConfig,
  ExecutionResult,
  CodeTemplate,
  CodeTemplateCreateRequest,
  CodeTemplateUpdateRequest,
  CodeSnippet,
  CodeSnippetCreateRequest,
  CodeSnippetUpdateRequest,
  CodeSnippetVersion,
  CodeSnippetDiffResult,
  CodeShare,
  CodeShareRequest,
} from '@/types';

// ----------------------------------------------------------- form / process
// (unchanged endpoints — kept for backward compatibility with P2-SAI-13~17)

export async function generateForm(description: string): Promise<FormGenResult> {
  return post<FormGenResult>('/v1/generate/form', { description });
}

export async function generateProcess(description: string): Promise<ProcessGenResult> {
  return post<ProcessGenResult>('/v1/generate/process', { description });
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

// ----------------------------------------------------- V12-02 code workspace
// All code-related endpoints are mounted under /v1/llmgw/code/* on TECH-LLMGW.

const CODE_BASE = '/v1/llmgw/code';

// REQ-038 — natural-language -> code
export async function generateCode(
  description: string,
  language: string,
  context?: string,
  modelId?: string,
): Promise<CodeGenResult> {
  return post<CodeGenResult>(`${CODE_BASE}/generate`, {
    description,
    language,
    context,
    modelId,
  });
}

// REQ-041 / REQ-042 — sandbox execution
export async function executeCode(
  code: string,
  language: string,
  timeoutMs = 5000,
): Promise<ExecutionResult> {
  return post<ExecutionResult>(`${CODE_BASE}/execute`, {
    code,
    language,
    timeoutMs,
  });
}

// REQ-043 — template library CRUD
export async function listCodeTemplates(params?: {
  language?: string;
  category?: string;
  keyword?: string;
}): Promise<CodeTemplate[]> {
  const data = await get<{ items: CodeTemplate[]; total: number }>(
    `${CODE_BASE}/templates`,
    params as Record<string, unknown> | undefined,
  );
  return data.items;
}

export async function getCodeTemplate(templateId: string): Promise<CodeTemplate> {
  return getCodeTemplateById(templateId);
}

export async function getCodeTemplateById(templateId: string): Promise<CodeTemplate> {
  return get<CodeTemplate>(`${CODE_BASE}/templates/${templateId}`);
}

export async function createCodeTemplate(
  payload: CodeTemplateCreateRequest,
): Promise<CodeTemplate> {
  return post<CodeTemplate>(`${CODE_BASE}/templates`, payload);
}

export async function updateCodeTemplate(
  templateId: string,
  payload: CodeTemplateUpdateRequest,
): Promise<CodeTemplate> {
  return put<CodeTemplate>(`${CODE_BASE}/templates/${templateId}`, payload);
}

export async function deleteCodeTemplate(templateId: string): Promise<void> {
  await del<{ templateId: string; deleted: boolean }>(
    `${CODE_BASE}/templates/${templateId}`,
  );
}

// REQ-040 / REQ-044 — snippet CRUD + version history + diff
export async function listCodeSnippets(params?: {
  language?: string;
  keyword?: string;
}): Promise<CodeSnippet[]> {
  const data = await get<{ items: CodeSnippet[]; total: number }>(
    `${CODE_BASE}/snippets`,
    params as Record<string, unknown> | undefined,
  );
  return data.items;
}

export async function getCodeSnippet(snippetId: string): Promise<CodeSnippet> {
  return get<CodeSnippet>(`${CODE_BASE}/snippets/${snippetId}`);
}

export async function createCodeSnippet(
  payload: CodeSnippetCreateRequest,
): Promise<CodeSnippet> {
  return post<CodeSnippet>(`${CODE_BASE}/snippets`, payload);
}

export async function updateCodeSnippet(
  snippetId: string,
  payload: CodeSnippetUpdateRequest,
): Promise<CodeSnippet> {
  return put<CodeSnippet>(`${CODE_BASE}/snippets/${snippetId}`, payload);
}

export async function deleteCodeSnippet(snippetId: string): Promise<void> {
  await del<{ snippetId: string; deleted: boolean; deletedVersions: number }>(
    `${CODE_BASE}/snippets/${snippetId}`,
  );
}

export async function listCodeSnippetVersions(
  snippetId: string,
): Promise<CodeSnippetVersion[]> {
  const data = await get<{ items: CodeSnippetVersion[]; total: number }>(
    `${CODE_BASE}/snippets/${snippetId}/versions`,
  );
  return data.items;
}

export async function getCodeSnippetVersion(
  snippetId: string,
  version: number,
): Promise<CodeSnippetVersion> {
  return get<CodeSnippetVersion>(
    `${CODE_BASE}/snippets/${snippetId}/versions/${version}`,
  );
}

export async function diffCodeSnippetVersions(
  snippetId: string,
  versionA: number,
  versionB: number,
): Promise<CodeSnippetDiffResult> {
  return post<CodeSnippetDiffResult>(
    `${CODE_BASE}/snippets/${snippetId}/diff`,
    { versionA, versionB },
  );
}

// REQ-045 — share link / export
export async function createCodeShare(
  payload: CodeShareRequest,
): Promise<CodeShare> {
  return post<CodeShare>(`${CODE_BASE}/share`, payload);
}

export async function listCodeShares(): Promise<CodeShare[]> {
  const data = await get<{ items: CodeShare[]; total: number }>(
    `${CODE_BASE}/share`,
  );
  return data.items;
}

export async function getCodeShare(shareId: string): Promise<CodeShare> {
  return get<CodeShare>(`${CODE_BASE}/share/${shareId}`);
}

export async function deleteCodeShare(shareId: string): Promise<void> {
  await del<{ shareId: string; deleted: boolean }>(
    `${CODE_BASE}/share/${shareId}`,
  );
}
