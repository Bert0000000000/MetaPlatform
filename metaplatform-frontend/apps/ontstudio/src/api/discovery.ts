import { get, post } from './client';

export interface DataSourceListItem {
  id: string;
  name: string;
  type: string;
  tableCount: number;
}

export interface CandidateAttribute {
  tempId: string;
  code: string;
  name: string;
  dataType: string;
  required: boolean;
  unique: boolean;
  description?: string;
  sourceColumn: string;
  selected: boolean;
}

export interface CandidateConcept {
  tempId: string;
  sourceTable: string;
  code: string;
  name: string;
  description?: string;
  selected: boolean;
  attributes: CandidateAttribute[];
}

export interface CandidateRelation {
  tempId: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  code: string;
  name: string;
  description?: string;
  cardinality: string;
  selected: boolean;
}

export interface DiscoveryResult {
  sourceId: string;
  concepts: CandidateConcept[];
  relations: CandidateRelation[];
}

export interface ImportResult {
  createdConcepts: number;
  createdAttributes: number;
  createdRelations: number;
  conceptIds: string[];
  relationIds: string[];
  failed: Array<{ type: string; code: string; reason: string }>;
}

const BASE = '/v1/ont/discovery';

export async function listDiscoveryDataSources(): Promise<{ items: DataSourceListItem[]; total: number }> {
  return get<{ items: DataSourceListItem[]; total: number }>(`${BASE}/data-sources`);
}

export async function analyzeDataSource(sourceId: string, tables?: string[]): Promise<DiscoveryResult> {
  return post<DiscoveryResult>(`${BASE}/analyze`, { sourceId, tables });
}

export async function suggestCandidates(
  sourceId: string,
  concepts: CandidateConcept[],
  relations: CandidateRelation[],
): Promise<DiscoveryResult> {
  return post<DiscoveryResult>(`${BASE}/${sourceId}/suggest`, { concepts, relations });
}

export async function importCandidates(
  sourceId: string,
  concepts: CandidateConcept[],
  relations: CandidateRelation[],
): Promise<ImportResult> {
  return post<ImportResult>(`${BASE}/import`, { sourceId, concepts, relations });
}
