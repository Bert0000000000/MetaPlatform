import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type {
  OpsCapacityResponse,
  OpsHealthReport,
  OpsAlertRule,
  OpsSelfMetrics,
  ApiEnvelope,
} from "@/types";

export async function getOpsHealth(): Promise<OpsHealthReport> {
  const { data } = await apiClient.get(ADMIN_BASE + "/operations/health");
  const env = data as ApiEnvelope<{ report: OpsHealthReport; checkedAt: number }>;
  return unwrap<{ report: OpsHealthReport; checkedAt: number }>(env).report;
}

export async function getOpsCapacity(): Promise<OpsCapacityResponse> {
  const { data } = await apiClient.get(ADMIN_BASE + "/operations/capacity");
  return unwrap<OpsCapacityResponse>(data as ApiEnvelope<OpsCapacityResponse>);
}

export async function getOpsSelfMetrics(): Promise<OpsSelfMetrics> {
  const { data } = await apiClient.get(ADMIN_BASE + "/operations/metrics/self");
  const env = data as ApiEnvelope<{ metrics: OpsSelfMetrics; checkedAt: number }>;
  return unwrap<{ metrics: OpsSelfMetrics; checkedAt: number }>(env).metrics;
}

export async function listAlertRules(): Promise<OpsAlertRule[]> {
  const { data } = await apiClient.get(ADMIN_BASE + "/operations/alerts/rules");
  const env = data as ApiEnvelope<{ rules: OpsAlertRule[]; total: number }>;
  return unwrap<{ rules: OpsAlertRule[]; total: number }>(env).rules;
}

export async function queryPrometheus(query: string): Promise<{
  query: string;
  status: string;
  result_type?: string;
  value?: unknown;
  error?: string;
}> {
  const { data } = await apiClient.get(ADMIN_BASE + "/operations/prometheus/query", { params: { query } });
  return unwrap<{ query: string; status: string; result_type?: string; value?: unknown; error?: string }>(
    data as ApiEnvelope<{ query: string; status: string; result_type?: string; value?: unknown; error?: string }>,
  );
}
