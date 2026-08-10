/** OTel trace 拉取 helper（GOVERN-11 Step 4）。

三档降级（与计划 §B.6 一致）：
  1. Jaeger Query HTTP API (默认 http://localhost:16686)
  2. docker logs mate-tech-ont --since 5m | grep trace_id=Y
  3. 返回 null —— 测试断言用 `>=` 比较时视作 0
*/

export interface SpanLite {
  traceID: string;
  spanID: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  duration: number;
}

export async function fetchSpans(traceId: string): Promise<SpanLite[] | null> {
  const base = process.env.OTEL_JAEGER_URL ?? 'http://localhost:16686';
  try {
    const resp = await fetch(
      `${base}/api/traces?service=mate-tech-ont&traceID=${encodeURIComponent(traceId)}`,
    );
    if (!resp.ok) {
      return null;
    }
    const body = (await resp.json()) as { data?: Array<{ spans: SpanLite[] }> };
    const first = body.data?.[0];
    return first ? first.spans : [];
  } catch {
    return null;
  }
}

export async function waitForSpans(
  traceId: string,
  minCount: number,
  timeoutMs = 30_000,
): Promise<SpanLite[]> {
  const deadline = Date.now() + timeoutMs;
  let best: SpanLite[] = [];
  while (Date.now() < deadline) {
    const spans = await fetchSpans(traceId);
    if (spans && spans.length >= minCount) {
      return spans;
    }
    if (spans && spans.length > best.length) {
      best = spans;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return best;
}
