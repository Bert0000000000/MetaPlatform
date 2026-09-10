// mate-tech-ont v2 kernel API 封装（本体引擎页真实数据源）。
// apiClient 的 baseURL 是 /api/v1，v2 kernel 前缀 /ont/v2，故路径为 /ont/v2/...。

import { apiClient } from '@/api/client';

/** EXP-02：派生属性规格（fn ∈ count/sum/avg + over_link + 对端属性完整 rid）。 */
export interface KernelDerivedSpec {
  fn: 'count' | 'sum' | 'avg' | string;
  over_link: string;
  /** sum/avg 必填（对端类型属性完整 rid）；count 可为 null。 */
  field: string | null;
}

export interface KernelProperty {
  rid: string;
  type_id: string;
  nullable: boolean;
  primary_key: boolean;
  title: string;
  format: string;
  // ── EXP-02 扩展（可选，增量；后端 PropertyDTO 已支持） ──
  description?: string;
  /** format=struct 时的嵌套字段定义。 */
  struct_fields?: KernelProperty[];
  array?: boolean;
  /** 多值归约：first / latest；仅 array 时有意义。 */
  reducer?: string | null;
  derived?: KernelDerivedSpec | null;
  /** 共享属性（同一 rid 被多个 ObjectType 引用）。 */
  shared?: boolean;
}

export interface KernelObjectType {
  rid: string;
  primary_key: string[];
  properties: KernelProperty[];
  interfaces: string[];
  display_name: string;
  marking?: string[];
  parent_class?: string;
  description?: string;
  status?: string;
  type_group?: string;
  render_hints?: Array<[string, string]>;
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
  src_display_name?: string;
  dst_display_name?: string;
  description?: string;
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

/** EXP-02：值类型注册表条目（GET /value-types）。type_id → format 一致性由注册表保证。 */
export interface KernelValueType {
  type_id: string;
  format: string;
  description: string;
  /** 结构化附加参数（vector dims / decimal precision 等），元数据级。 */
  params?: Record<string, unknown>;
}

/** 值类型注册表（Property.type_id 引用目标；format 决定 struct_fields 等联动）。 */
export async function listValueTypes(): Promise<KernelValueType[]> {
  return list<KernelValueType>('/value-types');
}

// 写操作：与后端 PropertyDTO / ObjectTypeDTO 对齐（v2_kernel/api.py）。

export interface KernelObjectTypeCreate {
  rid: string;
  display_name: string;
  primary_key: string[];
  properties: KernelProperty[];
  interfaces: string[];
  // ── EXP-02/EXP-04 扩展（可选，增量；POST /object-types 整体 upsert） ──
  marking?: string[];
  /** 父类型 rid（浅层级声明，限 1 层）；空串 = 无。 */
  parent_class?: string;
  description?: string;
  /** active / draft / deprecated。 */
  status?: string;
  type_group?: string;
  render_hints?: Array<[string, string]>;
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
  action_rid?: string;
  target_iid?: string;
  audit_id?: string;
  outbox_event_ids?: string[];
  side_effects_emitted?: string[];
  message?: string;
}

/** Proposal 的服务端事实状态（用于确认/执行后的权威刷新）。 */
export interface ProposalRecord {
  proposal_id: string;
  status: string;
  kind: ProposalKind;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
}

export async function getProposal(id: string): Promise<ProposalRecord> {
  const resp = await apiClient.get(v2(`/proposals/${encodeURIComponent(id)}`));
  const payload = resp.data as { data?: ProposalRecord } | ProposalRecord;
  return payload && typeof payload === 'object' && 'data' in payload && payload.data
    ? payload.data
    : payload as ProposalRecord;
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
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/confirm`), {}, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  const payload = resp.data as { data?: ProposalOperationResponse } | ProposalOperationResponse;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalOperationResponse }).data) {
    return (payload as { data: ProposalOperationResponse }).data;
  }
  return payload as ProposalOperationResponse;
}

/** 执行已确认的 Proposal（POST /ont/v2/proposals/{id}/execute）。 */
export async function executeProposal(id: string): Promise<ProposalOperationResponse> {
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/execute`), {}, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  const payload = resp.data as { data?: ProposalOperationResponse } | ProposalOperationResponse;
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: ProposalOperationResponse }).data) {
    return (payload as { data: ProposalOperationResponse }).data;
  }
  return payload as ProposalOperationResponse;
}

/** 拒绝 Proposal（POST /ont/v2/proposals/{id}/reject）。 */
export async function rejectProposal(id: string): Promise<ProposalOperationResponse> {
  const resp = await apiClient.post(v2(`/proposals/${encodeURIComponent(id)}/reject`), {}, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
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

// ── EXP-01/03（ONT-UI-01 对象浏览器）：层级树 / searchAround / 语义检索 ──

/** 类型层级树节点（GET /object-types/hierarchy）。 */
export interface TypeHierarchyNode {
  rid: string;
  display_name: string;
  parent_class: string;
  children: TypeHierarchyNode[];
}

/** 层级树（EXP-01）。 */
export async function getTypeHierarchy(): Promise<TypeHierarchyNode[]> {
  return list<TypeHierarchyNode>('/object-types/hierarchy');
}

/** searchAround 分组条目（GET /individuals/{rid}/around）。 */
export interface SearchAroundGroup {
  link_type_rid: string;
  /** 方向性显示名（出边 = src_display_name，入边 = dst_display_name）。 */
  link_display: string;
  direction: 'out' | 'in' | string;
  peers: Array<Record<string, unknown> & { __rid__?: string }>;
}

/** 一跳关系遍历（EXP-03）。 */
export async function searchAround(rid: string, limit = 100): Promise<SearchAroundGroup[]> {
  const resp = await apiClient.get(
    v2(`/individuals/${encodeURIComponent(rid)}/around`), { params: { limit } },
  );
  return resp.data as SearchAroundGroup[];
}

/** 单个实例详情（GET /individuals/{rid}）。 */
export async function getIndividual(rid: string): Promise<KernelIndividual> {
  return getOne<KernelIndividual>(`/individuals/${encodeURIComponent(rid)}`);
}

/** 语义检索结果卡片（POST /object-search，MP-SAL-02 OAG）。 */
export interface SemanticSearchCard {
  individual_rid: string;
  class_rid: string;
  score: number;
  matched: Array<{ property_rid: string; value_text: string; score: number }>;
  card_text?: string;
}

/** 对象语义检索（OAG → 对象卡片，带 rid 可追溯）。 */
export async function searchObjectsSemantic(payload: {
  text: string;
  class_rid?: string;
  top_k?: number;
}): Promise<SemanticSearchCard[]> {
  const resp = await apiClient.post(v2('/object-search'), payload);
  const data = resp.data as { data?: SemanticSearchCard[]; results?: SemanticSearchCard[] } | SemanticSearchCard[];
  if (Array.isArray(data)) return data;
  const wrapped = data as { data?: SemanticSearchCard[]; results?: SemanticSearchCard[] };
  return wrapped.data ?? wrapped.results ?? [];
}

/** props 键（完整 Property rid）→ slug 短键（与后端 individual_to_row 同规则）。 */
export function propSlug(rid: string): string {
  const parts = rid.split('.');
  return parts[3] ?? rid;
}

// ── UI-02/03/04/05：Action 表单 / 治理面 / Interface / 时序 ──

/** 提交 edit-set 提案（AI 路径，强制 HITL）。 */
export async function proposeEditSet(
  actionRid: string, body: {
    parameters: Record<string, unknown>; target_iid?: string;
    edits?: Array<Record<string, unknown>>; impact_summary?: string;
  },
): Promise<{ proposal_id: string; status: string; requires_hitl: boolean }> {
  const resp = await apiClient.post(
    v2(`/action-types/${encodeURIComponent(actionRid)}/propose-edit-set`), body);
  const data = resp.data as { data?: unknown } | Record<string, unknown>;
  return (data && typeof data === 'object' && 'data' in data
    ? (data as { data: { proposal_id: string; status: string; requires_hitl: boolean } }).data
    : data) as { proposal_id: string; status: string; requires_hitl: boolean };
}

/** 人工路径「预览即确认」edit-set（即时 proposal + 单事务 + 审计）。 */
export async function applyEditSet(
  actionRid: string, body: {
    parameters: Record<string, unknown>; target_iid?: string;
    edits?: Array<Record<string, unknown>>; impact_summary?: string;
  },
): Promise<Record<string, unknown>> {
  const resp = await apiClient.post(
    v2(`/action-types/${encodeURIComponent(actionRid)}/apply-edit-set`), body);
  return resp.data as Record<string, unknown>;
}

/** GOV-16：类型使用量。 */
export interface UsageRow {
  class_rid: string;
  reads: number | null;
  writes: number | null;
  active_days: number | null;
}

export async function getUsageSummary(days = 30): Promise<UsageRow[]> {
  const resp = await apiClient.get(v2('/usage/types'), { params: { days } });
  return resp.data as UsageRow[];
}

/** UI-04：执行历史（audit 行）。 */
export interface ActionAuditRow {
  audit_id: string;
  tenant_id: string;
  proposal_id: string;
  action_rid: string;
  target_iid: string;
  actor_id: string;
  result: Record<string, unknown>;
  created_at: string;
}

export async function listActionAudit(limit = 100, actionRid?: string): Promise<ActionAuditRow[]> {
  const resp = await apiClient.get(v2('/action-audit'), {
    params: { limit, action_rid: actionRid },
  });
  return resp.data as ActionAuditRow[];
}

/** GOV-18：反模式 lint。 */
export interface LintFinding {
  pattern: string;
  subject: string;
  detail: string;
  hint: string;
}

export async function lintAntiPatterns(): Promise<LintFinding[]> {
  const resp = await apiClient.get(v2('/lint/anti-patterns'));
  return resp.data as LintFinding[];
}

/** GOV-17：生命周期处置。 */
export async function applyLifecycle(
  classRid: string, action: 'snooze' | 'deprecate' | 'delete',
): Promise<Record<string, unknown>> {
  const resp = await apiClient.post(
    v2(`/object-types/${encodeURIComponent(classRid)}/lifecycle`),
    { action });
  return resp.data as Record<string, unknown>;
}

/** UI-03：Interface 清单。 */
export interface KernelInterface {
  rid: string;
  properties: KernelProperty[];
  required_links: string[];
  polymorphic_action_constraints: string[];
}

export async function listInterfaces(): Promise<KernelInterface[]> {
  return list<KernelInterface>('/interfaces');
}

export async function listInterfaceImplementations(rid: string): Promise<string[]> {
  return list<string>(`/interfaces/${encodeURIComponent(rid)}/implementations`);
}

/** GOV-19：时序窗口查询。 */
export interface TimeseriesPoint {
  ts: string;
  value: number;
  attrs?: Record<string, unknown>;
}

export async function queryTimeseries(
  seriesRid: string, start?: string, end?: string,
): Promise<TimeseriesPoint[]> {
  const resp = await apiClient.get(
    v2(`/timeseries/${encodeURIComponent(seriesRid)}`),
    { params: { start, end } },
  );
  return resp.data as TimeseriesPoint[];
}

// ── G41：类型版本操作（branch / diff / rollback）+ Export/Import ──
// 后端契约（v2_kernel/api.py）：
//   POST /object-types/{rid}/branch    body: {new_rid, note?}（new_rid 必须是本租户 obj rid）
//   GET  /object-types/{rid}/diff?against=<同族另一版本>  → {old_rid,new_rid,added,removed,changed,has_changes}
//   POST /object-types/{rid}/rollback  body: {from_rid}
//   GET  /object-types/{rid}/export    → {format, rid, content}（jsonld）/ turtle 文本
//   POST /object-types/import          body 即 export 的 JSON（同 rid upsert）

/** G41：以当前定义分支出新版本类型（返回分支后的类型）。 */
export async function branchObjectType(
  rid: string, newRid: string, note = '',
): Promise<KernelObjectType> {
  const resp = await apiClient.post(
    v2(`/object-types/${encodeURIComponent(rid)}/branch`),
    { new_rid: newRid, note });
  return resp.data as KernelObjectType;
}

/** G41：rid 与 againstRid（同族另一版本）的属性级 diff。 */
export async function diffObjectTypes(
  rid: string, againstRid: string,
): Promise<Record<string, unknown>> {
  const resp = await apiClient.get(
    v2(`/object-types/${encodeURIComponent(rid)}/diff`),
    { params: { against: againstRid } },
  );
  return resp.data as Record<string, unknown>;
}

/** G41：把 rid 的定义回滚为 fromRid 版本的定义（返回回滚后的类型）。 */
export async function rollbackObjectType(
  rid: string, fromRid: string,
): Promise<KernelObjectType> {
  const resp = await apiClient.post(
    v2(`/object-types/${encodeURIComponent(rid)}/rollback`),
    { from_rid: fromRid });
  return resp.data as KernelObjectType;
}

/** G41：导出类型定义（默认 jsonld；返回体整体即 import 的入参）。 */
export async function exportObjectType(
  rid: string, format: 'jsonld' | 'turtle' = 'jsonld',
): Promise<Record<string, unknown>> {
  const resp = await apiClient.get(
    v2(`/object-types/${encodeURIComponent(rid)}/export`),
    { params: { format } },
  );
  return resp.data as Record<string, unknown>;
}

/** G41：导入 export 的 JSON 回灌类型（同 rid upsert 语义，返回导入后的类型）。 */
export async function importObjectTypes(
  payload: Record<string, unknown>,
): Promise<KernelObjectType> {
  const resp = await apiClient.post(v2('/object-types/import'), payload);
  return resp.data as KernelObjectType;
}
