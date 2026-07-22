export interface DateTimeSettings {
  language?: string;
  dateFormat?: string;
  timeFormat?: string;
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseDate(value: string | Date | number): Date {
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatPattern(date: Date, pattern: string): string {
  const map: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (key) => map[key] ?? key);
}

export function formatDateTime(value: string | Date | number, settings?: DateTimeSettings): string {
  const date = parseDate(value);
  if (settings?.dateFormat && settings?.timeFormat) {
    return `${formatPattern(date, settings.dateFormat)} ${formatPattern(date, settings.timeFormat)}`;
  }
  return formatPattern(date, DEFAULT_DATETIME_FORMAT);
}

export function formatDate(value: string | Date | number, settings?: DateTimeSettings): string {
  return formatPattern(parseDate(value), settings?.dateFormat ?? DEFAULT_DATE_FORMAT);
}

export function formatTime(value: string | Date | number, settings?: DateTimeSettings): string {
  return formatPattern(parseDate(value), settings?.timeFormat ?? DEFAULT_TIME_FORMAT);
}

function formatRelativeEn(diff: number, date: Date, settings?: DateTimeSettings): string {
  const seconds = Math.floor(Math.abs(diff) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    if (seconds < 60) return 'in a few seconds';
    if (minutes < 60) return `in ${minutes} minutes`;
    if (hours < 24) return `in ${hours} hours`;
    return `in ${days} days`;
  }
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 30) return `${days} days ago`;
  return formatDate(date, settings);
}

export function formatRelative(value: string | Date | number, settings?: DateTimeSettings): string {
  const date = parseDate(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const isZh = settings?.language !== 'en-US';

  const seconds = Math.floor(Math.abs(diff) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (isZh) {
    if (diff < 0) {
      if (seconds < 60) return '几秒后';
      if (minutes < 60) return `${minutes} 分钟后`;
      if (hours < 24) return `${hours} 小时后`;
      return `${days} 天后`;
    }
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    return formatDate(date, settings);
  }

  return formatRelativeEn(diff, date, settings);
}
