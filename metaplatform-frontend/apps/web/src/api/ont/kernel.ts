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
