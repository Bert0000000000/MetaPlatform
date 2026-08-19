// mate-tech-ont v2 kernel API 封装（本体引擎页真实数据源）。
// apiClient 的 baseURL 是 /api/v1，v2 kernel 前缀 /ont/v2，故路径为 /ont/v2/...。

import { apiClient } from '@/api/client';

export interface KernelProperty {
  rid: string;
  type_id: string;
  nullable: boolean;
  primary_key: boolean;
  title: string;
  format: string;
}

export interface KernelObjectType {
  rid: string;
  primary_key: string[];
  properties: KernelProperty[];
  interfaces: string[];
  display_name: string;
}

export interface KernelActionType {
  rid: string;
  parameters: KernelProperty[];
  submission_criteria: string[];
  side_effects: string[];
  function_ref: string;
  on: string[];
  title?: string;
  description?: string;
}

export interface KernelLinkType {
  rid: string;
  src: string;
  dst: string;
  cardinality: string;
  directionality: string;
  link_properties: KernelProperty[];
}

export interface KernelIndividual {
  rid: string;
  class_rid: string;
  primary_key: string;
  props: Record<string, unknown>;
  tenant_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface KernelFunction {
  rid: string;
  language: string;
  version: number;
  source_ref: string;
  signatures: Array<[string, string]>;
}

const v2 = (path: string) => `/ont/v2${path}`;

async function list<T>(path: string): Promise<T[]> {
  const resp = await apiClient.get(v2(path));
  return resp.data as T[];
}

async function getOne<T>(path: string): Promise<T> {
  const resp = await apiClient.get(v2(path));
  return resp.data as T;
}

export async function listObjectTypes(): Promise<KernelObjectType[]> {
  return list<KernelObjectType>('/object-types');
}

export async function getObjectType(rid: string): Promise<KernelObjectType> {
  return getOne<KernelObjectType>(`/object-types/${encodeURIComponent(rid)}`);
}

export async function listActionTypes(): Promise<KernelActionType[]> {
  return list<KernelActionType>('/action-types');
}

export async function listLinkTypes(): Promise<KernelLinkType[]> {
  return list<KernelLinkType>('/link-types');
}

export async function listIndividuals(params?: {
  classRid?: string;
  limit?: number;
  offset?: number;
}): Promise<KernelIndividual[]> {
  const resp = await apiClient.get(v2('/individuals'), {
    params: params ? { class_rid: params.classRid, limit: params.limit, offset: params.offset } : undefined,
  });
  return resp.data as KernelIndividual[];
}

export async function listFunctions(): Promise<KernelFunction[]> {
  return list<KernelFunction>('/functions');
}

// 写操作：与后端 PropertyDTO / ObjectTypeDTO 对齐（v2_kernel/api.py）。

export interface KernelObjectTypeCreate {
  rid: string;
  display_name: string;
  primary_key: string[];
  properties: KernelProperty[];
  interfaces: string[];
}

/** 增量追加单个 Property 到已存在的 ObjectType（POST /object-types/{rid}/properties）。 */
export async function appendObjectTypeProperty(rid: string, payload: KernelProperty): Promise<KernelObjectType> {
  const resp = await apiClient.post(v2(`/object-types/${encodeURIComponent(rid)}/properties`), payload);
  return resp.data as KernelObjectType;
}

/** Upsert 一个 ObjectType（POST /object-types）。 */
export async function createObjectType(payload: KernelObjectTypeCreate): Promise<KernelObjectType> {
  const resp = await apiClient.post(v2('/object-types'), payload);
  return resp.data as KernelObjectType;
}

// ── MP-DEDUP-01: 相似候选扫描 + 合并 ──

/** precheck 入参：候选 (display_name, slug, domain)。 */
export interface ObjectTypePrecheckRequest {
  name: string;
  slug: string;
  domain?: string;
  top_k?: number;
}

/** precheck 返回的单个候选。 */
export interface ObjectTypeCandidate {
  rid: string;
  display_name: string;
  slug: string;
  similarity: number;
  suggested_action: 'merge' | 'rename' | 'cancel' | string;
}

/** precheck 响应。 */
export interface ObjectTypePrecheckResponse {
  candidates: ObjectTypeCandidate[];
}

/**
 * 创建前相似扫描（POST /object-types/precheck）。
 * 后端走 embedder（或 slug 归一化兜底），不写库，仅返回候选列表。
 */
export async function precheckObjectTypes(payload: ObjectTypePrecheckRequest): Promise<ObjectTypePrecheckResponse> {
  const resp = await apiClient.post(v2('/object-types/precheck'), payload);
  const data = resp.data as { data?: ObjectTypePrecheckResponse } | ObjectTypePrecheckResponse;
  if (data && typeof data === 'object' && 'data' in data && (data as { data?: ObjectTypePrecheckResponse }).data) {
    return (data as { data: ObjectTypePrecheckResponse }).data;
  }
  return data as ObjectTypePrecheckResponse;
}

/** merge 入参：source / target rid + 可选 Property 映射。 */
export interface MergeObjectTypeRequest {
  source_rid: string;
  target_rid: string;
  /** source Property rid → target Property rid；缺省时后端按 slug 兜底。 */
  mapping?: Record<string, string>;
}

/** merge 响应。 */
export interface MergeObjectTypeResponse {
  source_rid: string;
  target_rid: string;
  mapping: Record<string, string>;
  affected_individuals: number;
  affected_links: number;
  source_archived: boolean;
}

/**
 * 合并两个 ObjectType（POST /object-types/merge）。
 * 后端会把 Individual.class_rid / rid / props 全部从 source 重映射到 target，
 * 然后把 source 软删（archived=true）。
 */
export async function mergeObjectTypes(payload: MergeObjectTypeRequest): Promise<MergeObjectTypeResponse> {
  const resp = await apiClient.post(v2('/object-types/merge'), payload);
  const data = resp.data as { data?: MergeObjectTypeResponse } | MergeObjectTypeResponse;
  if (data && typeof data === 'object' && 'data' in data && (data as { data?: MergeObjectTypeResponse }).data) {
    return (data as { data: MergeObjectTypeResponse }).data;
  }
  return data as MergeObjectTypeResponse;
}

// ── MP-SAL-05: 流程编排定义持久化（FlowGram WorkflowJSON + 字段配置） ──

export interface KernelActionFlow {
  action_rid: string;
  flow_json: Record<string, unknown>;
  config: Record<string, unknown>;
  updated_at?: string;
}

/** 读取 ActionType 的流程编排定义（未保存 → 抛 404）。 */
export async function getActionFlow(rid: string): Promise<KernelActionFlow> {
  const resp = await apiClient.get(v2(`/action-types/${encodeURIComponent(rid)}/flow`));
  return resp.data as KernelActionFlow;
}

/** 持久化 ActionType 的流程编排定义（upsert）。 */
export async function putActionFlow(
  rid: string, flow_json: Record<string, unknown>, config: Record<string, unknown>,
): Promise<KernelActionFlow> {
  const resp = await apiClient.put(
    v2(`/action-types/${encodeURIComponent(rid)}/flow`), { flow_json, config },
  );
  return resp.data as KernelActionFlow;
}

// 域名段 → 一级本体分组。rid 形如 ont.<tenant>.obj.<domain>.<slug>.v1。
export function domainOfObjectType(rid: string): string {
  const parts = rid.split('.');
  // ont.<tenant>.obj.<domain>.<slug>.v1 → domain 在 obj 之后
  const objIdx = parts.indexOf('obj');
  if (objIdx >= 0 && parts.length > objIdx + 2) return parts[objIdx + 1];
  const last = parts[parts.length - 1] ?? '';
  return last.replace(/\.v\d+$/, '');
}

// 拆 slug + version。返回 {slug: 'obj.<domain>.<slug>', version: 'v1'}。
// rid 形态 ADR-0021：ont.<tenant>.<kind>.<slug>.<version>，kind=obj/at/lt/...
// 兜底：整串当 slug，版本空串。
export function slugAndVersionOfObjectType(rid: string): { slug: string; version: string } {
  const parts = rid.split('.');
  // 去掉 ont 与 tenant
  const tail = parts.slice(2);
  if (tail.length < 2) return { slug: rid, version: '' };
  const last = tail[tail.length - 1] ?? '';
  const m = last.match(/^v\d+$/);
  if (!m) return { slug: tail.join('.'), version: '' };
  return { slug: tail.slice(0, -1).join('.'), version: last };
}

// ── MP-ONT-PROPOSAL-01: AI Assistant 提案 staging preview / confirm / execute / reject ──

/** ProposalKind：4 种后端支持的提案类型。 */
export type ProposalKind =
  | 'model_type'
  | 'create_instance'
  | 'merge_suggestion'
  | 'action';

/** 单个 Property 映射（merge_suggestion 用，source rid → target rid）。 */
export interface PropertyMapping {
  source_rid: string;
  target_rid: string;
}

/** 影响摘要：受影响的 Individual / LinkInstance / 跨 schema 引用。 */
export interface ImpactSummary {
  affected_individuals: number;
  affected_link_instances: number;
  cross_schema_refs: string[];
}

/** model_type 提案预览的字段。 */
export interface ModelTypePreview {
  rid: string;
  display_name: string;
  primary_key: string[];
  properties: KernelProperty[];
  interfaces: string[];
  domain?: string;
  slug?: string;
}

/** create_instance 提案预览的字段。 */
export interface CreateInstancePreview {
  class_rid: string;
  primary_key: string;
  props: Record<string, unknown>;
  validation_errors?: string[];
}

/** merge_suggestion 提案预览的字段。 */
export interface MergeSuggestionPreview {
  source_rid: string;
  target_rid: string;
  source_display_name?: string;
  target_display_name?: string;
  mapping: PropertyMapping[];
  similarity?: number;
}

/** action 提案预览的字段。 */
export interface ActionPreview {
  action_rid: string;
  target_objects: Array<{ rid: string; primary_key: string }>;
  parameters: Record<string, unknown>;
}

/** Proposal 预览（GET /ont/v2/proposals/{id}/preview）。 */
export interface ProposalPreview {
  id: string;
  kind: ProposalKind;
  status?: 'pending' | 'confirmed' | 'rejected' | 'executed' | string;
  title?: string;
  summary?: string;
  created_by?: string;
  created_at?: string;
  // 4 种 kind 对应的渲染字段（按 kind 只出现其中一个）
  model_type?: ModelTypePreview;
  create_instance?: CreateInstancePreview;
  merge_suggestion?: MergeSuggestionPreview;
  action?: ActionPreview;
  // 通用影响说明（所有 kind 都可能附带）
  impact?: ImpactSummary;
}

/** 通用操作响应（confirm / reject / execute）。 */
export interface ProposalOperationResponse {
  id: string;
  status: string;
  /** 副作用统计：影响多少 Individual / LinkInstance / 新建 rid 等。 */
  affected_individuals?: number;
  affected_links?: number;
  created_rid?: string;
  message?: string;
}

/**
 * 读取 Proposal 的 staging 预览（GET /ont/v2/proposals/{id}/preview）。
 * 用于在 ProposalConfirmDrawer 中渲染前先看一眼变更的详细 schema 投影 + 影响说明。
 */
export async function getProposalPreview(id: string): Promise<ProposalPreview> {
  const resp = await apiClient.get(v2(`/proposals/${encodeURIComponent(id)}/preview`));
  const payload = resp.data as { data?: ProposalPreview } | ProposalPreview;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalPreview }).data) {
    return (payload as { data: ProposalPreview }).data;
  }
  return payload as ProposalPreview;
}

/** 确认 Proposal（POST /ont/v2/proposals/{id}/confirm）。 */
export async function confirmProposal(id: string): Promise<ProposalOperationResponse> {
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/confirm`));
  const payload = resp.data as { data?: ProposalOperationResponse } | ProposalOperationResponse;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalOperationResponse }).data) {
    return (payload as { data: ProposalOperationResponse }).data;
  }
  return payload as ProposalOperationResponse;
}

/** 执行已确认的 Proposal（POST /ont/v2/proposals/{id}/execute）。 */
export async function executeProposal(id: string): Promise<ProposalOperationResponse> {
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/execute`));
  const payload = resp.data as { data?: ProposalOperationResponse } | ProposalOperationResponse;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalOperationResponse }).data) {
    return (payload as { data: ProposalOperationResponse }).data;
  }
  return payload as ProposalOperationResponse;
}

/** 拒绝 Proposal（POST /ont/v2/proposals/{id}/reject）。 */
export async function rejectProposal(id: string): Promise<ProposalOperationResponse> {
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/reject`));
  const payload = resp.data as { data?: ProposalOperationResponse } | ProposalOperationResponse;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalOperationResponse }).data) {
    return (payload as { data: ProposalOperationResponse }).data;
  }
  return payload as ProposalOperationResponse;
}

// property rid 形如 ont.<tenant>.prp.<slug>.v<N>。
// 返回 {slug: 'prp.<slug>', version: 'v1'}。
export function slugAndVersionOfProperty(rid: string): { slug: string; version: string } {
  const parts = rid.split('.');
  // 去掉 ont 与 tenant
  const tail = parts.slice(2);
  if (tail.length < 2) return { slug: rid, version: '' };
  const last = tail[tail.length - 1] ?? '';
  const m = last.match(/^v\d+$/);
  if (!m) return { slug: tail.join('.'), version: '' };
  return { slug: tail.slice(0, -1).join('.'), version: last };
}
