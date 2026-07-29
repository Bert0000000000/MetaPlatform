/**
 * IAM 审计日志 API
 * 后端：com.metaplatform.iam.audit.controller.AuditLogController
 * 路径：/api/v1/iam/audit-logs
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'FAILED' | 'PARTIAL';

export interface AuditLogResponse {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
  status: AuditStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Mate Platform IAM admin /api/v1/admin/logs/modules returns:
//   { modules: [{value:string, count:number}], actions: [{value:string, count:number}] }
// The portal OperationsPage uses byAction/byUser counts; we expose the raw
// `actions`/`modules` here and the page derives counts from those.
export interface AuditLogCount {
  value: string;
  count: number;
}

export interface AuditLogStatistics {
  modules?: AuditLogCount[];
  actions?: AuditLogCount[];
  totalCount?: number;
  successCount?: number;
  failureCount?: number;
  byAction?: Record<string, number>;
  byUser?: Record<string, number>;
  byResourceType?: Record<string, number>;
}

export interface ListAuditLogParams {
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  status?: AuditStatus;
  startTime?: string;
  endTime?: string;
  page?: number;
  size?: number;
}

export async function listAuditLogs(params: ListAuditLogParams = {}): Promise<PageResponse<AuditLogResponse>> {
  const url = apiPath('iam', '/audit-logs');
  const resp = await apiClient.get<PageResponse<AuditLogResponse>>(url, { params });
  return resp.data;
}

export async function getAuditLogStatistics(params: { tenantId?: string; startTime?: string; endTime?: string } = {}): Promise<AuditLogStatistics> {
  const url = apiPath('iam', '/audit-logs/statistics');
  const resp = await apiClient.get<AuditLogStatistics>(url, { params });
  return resp.data;
}

export async function exportAuditLogs(params: ListAuditLogParams = {}, format: 'json' | 'csv' = 'json'): Promise<Blob> {
  const url = apiPath('iam', '/audit-logs/export');
  const resp = await apiClient.get<Blob>(url, { params: { ...params, format }, responseType: 'blob' });
  return resp.data;
}
