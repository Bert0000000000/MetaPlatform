import { get } from './client';

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

const BASE = '/v1/obs';

export async function getTraceDetail(traceId: string): Promise<TraceDetail> {
  return get<TraceDetail>(`${BASE}/traces/${traceId}`);
}

export async function getTraceSpans(traceId: string): Promise<ObsSpan[]> {
  return get<ObsSpan[]>(`${BASE}/traces/${traceId}/spans`);
}
