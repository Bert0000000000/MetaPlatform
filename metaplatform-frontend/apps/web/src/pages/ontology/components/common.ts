// 共享类型
export type StatusType = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export const STATUS_COLOR: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: '成功',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  warning: { label: '警告',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  error:   { label: '失败',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  neutral: { label: '中性',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  info:    { label: '信息',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toString();
}

export function formatTimestamp(ts?: string): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}
