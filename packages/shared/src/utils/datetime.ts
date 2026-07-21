/**
 * Date / time formatting helpers shared across all APPs.
 *
 * 不依赖 React context，接受可选 settings 参数（与 APP-DASHBOARD 的 UserSettings 子集对齐），
 * 这样无论是否挂载在 SettingsProvider 内都可使用。
 */

export interface DateTimeSettings {
  language?: string;
  timezone?: string;
  dateFormat?: string;
}

/** Format a date according to the user's language and timezone preferences. */
export function formatDateTime(
  date: string | Date | null | undefined,
  settings?: DateTimeSettings,
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';

  const locale = settings?.language || navigator.language || 'zh-CN';
  const timeZone = settings?.timezone || undefined;

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString(locale);
  }
}

export function formatDate(
  date: string | Date | null | undefined,
  settings?: DateTimeSettings,
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';

  const locale = settings?.language || navigator.language || 'zh-CN';
  const timeZone = settings?.timezone || undefined;

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleDateString(locale);
  }
}

export function formatTime(
  date: string | Date | null | undefined,
  settings?: DateTimeSettings,
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';

  const locale = settings?.language || navigator.language || 'zh-CN';
  const timeZone = settings?.timezone || undefined;

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString(locale);
  }
}

/** Relative time like "3 minutes ago" / "3 分钟前". */
export function formatRelative(
  date: string | Date | null | undefined,
  settings?: DateTimeSettings,
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';

  const locale = settings?.language || navigator.language || 'zh-CN';
  const diffMs = d.getTime() - Date.now();
  const absDiff = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  // Each entry: [thresholdMs, unitMs, unit]. Pick the first whose threshold exceeds absDiff.
  const ranges: Array<[number, number, Intl.RelativeTimeFormatUnit]> = [
    [60_000, 1_000, 'second'],
    [3_600_000, 60_000, 'minute'],
    [86_400_000, 3_600_000, 'hour'],
    [604_800_000, 86_400_000, 'day'],
    [2_629_800_000, 604_800_000, 'week'],
    [31_557_600_000, 2_629_800_000, 'month'],
    [Infinity, 31_557_600_000, 'year'],
  ];

  for (const [threshold, unitMs, unit] of ranges) {
    if (absDiff < threshold) {
      return rtf.format(Math.round(diffMs / unitMs), unit);
    }
  }
  return formatDateTime(d, settings);
}
