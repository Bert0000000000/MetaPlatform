import { errDetailText } from '@/api/ont/kernel';
export function resourceError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return `${status === 403 ? 'forbidden' : 'unavailable'}${status ? ` · ${status}` : ''} · ${errDetailText(error, '读取失败')}`;
}
