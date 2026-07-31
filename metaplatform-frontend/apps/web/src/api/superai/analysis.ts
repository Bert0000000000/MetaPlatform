import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  SqlGenerationResult,
  SqlExecutionResult,
  SqlAuditResult,
  ChartDataSet,
  ChartType,
} from '@/api/superai/types';
export async function generateSql(
  query: string,
  ontologyConcepts?: string[],
): Promise<SqlGenerationResult> {
  return post<SqlGenerationResult>('/analysis/generate-sql', {
    query,
    ontologyConcepts,
  });
}
export async function executeSql(sql: string): Promise<SqlExecutionResult> {
  return post<SqlExecutionResult>('/analysis/execute-sql', { sql });
}
export async function explainSql(sql: string): Promise<string> {
  return post<string>('/analysis/explain-sql', { sql });
}
export async function auditSql(sql: string): Promise<SqlAuditResult> {
  return post<SqlAuditResult>('/analysis/audit-sql', { sql });
}
export async function autoDetectChartType(
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<ChartType> {
  if (rows.length === 0) return 'table';
  if (columns.length >= 2) {
    const firstCol = columns[0];
    const secondCol = columns[1];
    const firstValues = rows.map((r) => r[firstCol]);
    const secondValues = rows.map((r) => r[secondCol]);
    const firstIsCategory = firstValues.every((v) => typeof v === 'string');
    const secondIsNumeric = secondValues.every((v) => typeof v === 'number');
    if (firstIsCategory && secondIsNumeric) {
      if (firstValues.length <= 8) return 'pie';
      return 'bar';
    }
    const hasDate = firstValues.some((v) => typeof v === 'string' && /\d{4}-\d{2}/.test(v as string));
    if (hasDate && secondIsNumeric) return 'line';
    if (columns.length >= 3) {
      const thirdIsNumeric = rows.every((r) => typeof r[columns[2]] === 'number');
      if (thirdIsNumeric) return 'scatter';
    }
    return 'bar';
  }
  return 'table';
}
export async function buildChartDataSet(
  result: SqlExecutionResult,
  chartType?: ChartType,
): Promise<ChartDataSet> {
  const type = chartType || (await autoDetectChartType(result.columns, result.rows));
  return {
    type,
    title: '查询结果可视化',
    columns: result.columns,
    data: result.rows,
  };
}
