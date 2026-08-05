import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }



export interface ObsSpan {
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTimeUs: number;
  durationUs: number;
  status: string;
  tags?: Record<string, unknown>;
  logs?: Array<{
    timestamp?: string;
    fields?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

export interface TraceDetail {
  traceId: string;
  startTime: string;
  durationUs: number;
  rootService: string;
  spanCount: number;
  errorCount: number;
  spans: ObsSpan[];
}

// TODO: /v1/obs was not in the original DW mapping table; remapped to /v1/dw/traces
const BASE = '/dw/traces';

export async function getTraceDetail(traceId: string): Promise<TraceDetail> {
  return get<TraceDetail>(`${BASE}/${traceId}`);
}

export async function getTraceSpans(traceId: string): Promise<ObsSpan[]> {
  return get<ObsSpan[]>(`${BASE}/${traceId}/spans`);
}
