/**
 * 本体 rid 展示助手（`ont.<tenant>.<kind>.<domain>.<slug>.<version>`）。
 * 只用于呈现层；解析/校验仍以后端 DTO 为准。
 */
export function ridTail(rid: string): string {
  const parts = rid.split('.');
  const last = parts[parts.length - 1] ?? '';
  return /^v\d+$/.test(last) ? (parts[parts.length - 2] ?? rid) : last;
}
