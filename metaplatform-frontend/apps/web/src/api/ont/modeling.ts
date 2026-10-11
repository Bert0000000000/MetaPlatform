import { apiClient } from '@/api/client';

export interface ModelingQuestion { id: string; question: string; expected: string }
export interface ModelingProperty { id: string; name: string; dataType: 'text' | 'number' | 'date' }
export interface ModelingEvidence { kind: 'source' | 'business' | 'inference'; detail: string; sheet: string; columns: string[] }
export interface ModelingUniqueKey { properties: string[]; reason: string; confirmed: boolean }
export interface ModelingClass { included?: boolean; grain?: string; identityStatus?: 'legacy' | 'proposed' | 'confirmed' | 'unresolved' | 'source-record'; identityCandidate?: string[]; identityReason?: string; uniqueKeys?: ModelingUniqueKey[]; evidence?: ModelingEvidence[]; id: string; name: string; description: string; properties: ModelingProperty[]; identity: string[]; labelProperty: string; accepted: boolean; parentClassId?: string | null; inheritanceReason?: string }
export interface ModelingMapping { id: string; classId: string; sheet: string; bindings: Record<string, string>; reason: string; accepted: boolean }
export interface ModelingRelationship { included?: boolean; cardinality?: '1:1' | '1:N' | 'N:1' | 'N:N'; cardinalityStatus?: 'legacy' | 'proposed' | 'confirmed' | 'unresolved'; cardinalityReason?: string; targetSelection?: 'legacy' | 'entity' | 'group'; evidence?: ModelingEvidence[]; id: string; name: string; source: string; target: string; joins: Array<{ sourceProperty: string; targetProperty: string }>; reason: string; accepted: boolean }
export interface ModelingDefinition { target: string; definition: string; aliases: string[]; scope: string; grain: string; unit: string; constraints: string; basis: string; confirmed: boolean }
export interface ModelingDraft {
  schemaVersion: 2; name: string; classes: ModelingClass[]; mappings: ModelingMapping[]; relationships: ModelingRelationship[];
  instances: unknown[]; instanceEdits: unknown[]; links: unknown[]; notes: string[];
  semantics: { context: string; questions: ModelingQuestion[]; definitions: ModelingDefinition[] };
}
export interface ModelingProfile { rowCount: number; sheets: Array<{ name: string; rows: number; columns: Array<{ name: string; dataType: string; nonNull: number; uniqueCount: number; unique: boolean; samples: string[] }> }>; joinCandidates?: unknown[] }
export interface ModelingResolution { mode: 'new' | 'reuse' | 'extend'; targetRid?: string; propertyMap: Record<string, string> }
export interface ModelingValidation {
  scope?: 'ontology' | 'data'; errors: number; warnings: number; canPublish?: boolean; canSync?: boolean;
  configHash: string; issues: Array<{ severity: string; item: string; message: string }>;
  issueGroups?: Array<{ severity: string; item: string; message: string; count: number }>;
  issueGroupsTruncated?: boolean;
  counts: { nodes: number; edges: number; classes: number; properties?: number; relationships?: number };
  classCounts?: Record<string, number>; dataValidation?: ModelingValidation;
}
export interface ModelingAcceptance {
  status: 'not_published' | 'drifted' | 'passed'; sourceRevision: number; checkedAt: string;
  counts: { types: number; relationships: number; drifted: number }; limitations: string[];
  types: Array<{ classId: string; name: string; rid: string; status: 'missing' | 'matched' | 'changed' }>;
  relationships: Array<{ relationId: string; rid: string; status: 'missing' | 'matched' | 'changed'; expectedCardinality: string; actualCardinality: string }>;
}
export interface ModelingSource {
  dataRepair?: null | { status: string; error?: string; notice?: string; proposal?: {
    id: string; repairs: Array<{ key: string; name: string; identity: unknown[]; values: Record<string, unknown>; reason: string;
      properties: Record<string,string>; before: Record<string, Array<{ value: unknown; rows: Array<{sheet: string;row: number}> }>> }>;
    before: ModelingValidation & { quarantine: ModelingQuarantine }; after: ModelingValidation & { quarantine: ModelingQuarantine };
  } };
  dataTreatment?: null | { edits: Array<{key: string;values: Record<string,unknown>}>; audit: Array<{actor: string;at: string;reason: string}> };
  generation?: null | {
    fingerprint: string; policyVersion: string; origin: 'generated' | 'reused'; rounds: number;
    structureErrors: number; dataErrors: number; stale?: boolean;
    findings: Array<{ kind: string; item: string; name: string; message: string }>;
    changes: Array<{ kind: string; item: string; reason: string; before: unknown; after: unknown }>;
    notices: string[]; capabilities: { manualCapabilities?: string[] };
  };
  syncCheck?: { sourceRevision: number; checkedAt: string; report: ModelingValidation; preview: { nodes: number; edges: number } | null; baselineError: string | null; canSync: boolean;
    partial?: { canSync: boolean; checkHash: string; preview: { nodes: number; edges: number }; report: ModelingValidation; quarantine: ModelingQuarantine } } | null;
  id: string; name: string; revision: number; profile: ModelingProfile; draft: ModelingDraft | null; context: string; questions: ModelingQuestion[];
  resolutions: Record<string, ModelingResolution>;
  job: null | { id: string; kind: 'generate' | 'review'; status: 'running' | 'succeeded' | 'failed' | 'interrupted'; error?: string; startedAt?: string; finishedAt?: string; progress?: { stage: 'preparing' | 'concepts' | 'mapping' | 'checking'; batch?: number; totalBatches?: number; retrying?: boolean; round?: number; reused?: boolean } };
  validation: ModelingValidation | null;
  review: Record<string, unknown> | null;
  preview: null | { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>>; totalNodes: number; totalEdges: number; limit: number };
  plan: null | { configHash: string; types: Array<{ classId: string; name: string; rid: string; mode: string; propertyMap: Record<string, string>; parentClassId?: string; inheritanceReason?: string; payload?: { parent_class?: string | null }; changes?: { addedProperties: string[]; retainedProperties: string[]; identityChanged: boolean; parentChanged: boolean } }>; relationships: Array<{ relationId?: string; rid?: string; payload?: { cardinality?: string }; cardinalityStatus?: string; targetSelection?: string }>; warnings: unknown[] };
  publication: null | { status: string; configHash: string; completed: unknown[]; results: Array<Record<string, unknown>>; error?: string; acceptance?: ModelingAcceptance };
  sync: null | { status: string; stage?: string; totalTypes?: number; totalLinks?: number; startedAt?: string; finishedAt?: string; types: Array<Record<string, unknown>>; links: unknown; error?: string; allowPartial?: boolean; quarantine?: ModelingQuarantine; eligible?: {nodes: number;edges: number} };
}

export interface ModelingQuarantine {
  rows: number; entities: number; relationships: number; groupsTruncated?: boolean;
  groups: Array<{kind: string;item: string;name: string;reason: string;count: number;examples: Array<{sheet: string;row: number}>}>;
}

const base = '/ont/v2/modeling/sources';
const sourcePath = (id: string) => `${base}/${encodeURIComponent(id)}`;
export const listModelingSources = async (): Promise<ModelingSource[]> => (await apiClient.get<{ sources: ModelingSource[] }>(base)).data.sources;
export const getModelingSource = async (id: string): Promise<ModelingSource> => (await apiClient.get<ModelingSource>(sourcePath(id))).data;
export const getModelingAcceptance = async (id: string): Promise<ModelingAcceptance> => (await apiClient.get<ModelingAcceptance>(`${sourcePath(id)}/acceptance`)).data;
export async function uploadModelingSource(file: File): Promise<ModelingSource> {
  const form = new FormData(); form.append('file', file);
  return (await apiClient.post<ModelingSource>(base, form, { headers: { 'Content-Type': undefined } })).data;
}
export const saveModelingSource = async (source: ModelingSource): Promise<ModelingSource> => (await apiClient.put<ModelingSource>(sourcePath(source.id), {
  revision: source.revision, draft: source.draft, context: source.context, questions: source.questions, resolutions: source.resolutions,
})).data;
export const runModelingOperation = async (source: ModelingSource, operation: 'generate' | 'review' | 'validate' | 'publish' | 'sync' | 'sync-check' | 'data-repair' | 'data-repair-confirm', extra: Record<string, unknown> = {}): Promise<ModelingSource> =>
  (await apiClient.post<ModelingSource>(`${sourcePath(source.id)}/${operation}`, {
    revision: source.revision, ...(operation === 'generate' ? { context: source.context, questions: source.questions } : {}), ...extra,
  }, { timeout: 120000 })).data;

export async function exportModelingQuarantine(source: ModelingSource) {
  const response = await apiClient.get<Blob>(`${sourcePath(source.id)}/quarantine`, { params: { checkHash: source.syncCheck?.partial?.checkHash }, responseType: 'blob' });
  const url = URL.createObjectURL(response.data); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = '暂缓数据明细.csv'; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
