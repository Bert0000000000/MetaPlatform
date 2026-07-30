import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type { AdminAuditLog, ApiEnvelope, AuditAction, PageResult } from "@/types";

export interface ListAuditLogsParams {
  actor?: string;
  module?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  start?: string;
  end?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(p?: ListAuditLogsParams): Promise<PageResult<AdminAuditLog>> {
  const params: Record<string, unknown> = {};
  if (p?.actor) params.actor = p.actor;
  if (p?.module) params.module = p.module;
  if (p?.action) params.action = p.action;
  if (p?.resourceType) params.resourceType = p.resourceType;
  if (p?.resourceId) params.resourceId = p.resourceId;
  if (p?.start) params.start = p.start;
  if (p?.end) params.end = p.end;
  if (p?.page) params.page = p.page;
  if (p?.pageSize) params.pageSize = p.pageSize;
  const { data } = await apiClient.get(ADMIN_BASE + "/logs/audit", { params });
  return unwrap<PageResult<AdminAuditLog>>(data as ApiEnvelope<PageResult<AdminAuditLog>>);
}

export async function getAuditLog(id: number): Promise<AdminAuditLog> {
  const { data } = await apiClient.get(ADMIN_BASE + "/logs/audit/" + id);
  return unwrap<AdminAuditLog>(data as ApiEnvelope<AdminAuditLog>);
}

export async function getAuditModules(): Promise<{ modules: { value: string; count: number }[]; actions: { value: string; count: number }[] }> {
  const { data } = await apiClient.get(ADMIN_BASE + "/logs/modules");
  return unwrap<{ modules: { value: string; count: number }[]; actions: { value: string; count: number }[] }>(
    data as ApiEnvelope<{ modules: { value: string; count: number }[]; actions: { value: string; count: number }[] }>,
  );
}

export function auditLogsExportUrl(p?: ListAuditLogsParams): string {
  const qs = new URLSearchParams();
  if (p?.actor) qs.set("actor", p.actor);
  if (p?.module) qs.set("module", p.module);
  if (p?.action) qs.set("action", p.action);
  if (p?.start) qs.set("start", p.start);
  if (p?.end) qs.set("end", p.end);
  qs.set("fmt", "csv");
  return ADMIN_BASE + "/logs/audit/export?" + qs.toString();
}
