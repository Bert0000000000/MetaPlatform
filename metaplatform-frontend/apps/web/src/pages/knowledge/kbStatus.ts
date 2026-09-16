/**
 * kbStatus —— 文档状态「中文标签 + 标签色」的单一事实源。
 *
 * 背景：KnowledgeDocsPage（文档管理）与 KnowledgeKbDetailPage（知识库详情）
 * 此前各维护一份映射表，后端同一个 status 会在两页渲染出不同文案——一页出中文，
 * 另一页直接漏出裸后端字符串（如 `PROCESSING` / `archived`）。
 *
 * 这里收敛成一份，并统一做大小写归一：RAG 侧给小写（`indexed`），KB 文档侧给大写
 * （`FAILED`），语义上是同一状态，不应有两种观感。
 */
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';

export interface KbStatusMeta {
  label: string;
  color: TagColor;
}

/** key 一律小写；查表时把入参 toLowerCase 后匹配，大小写变体归一到同一条。 */
const KB_STATUS: Record<string, KbStatusMeta> = {
  pending: { label: '待处理', color: 'grey' },
  uploaded: { label: '已上传', color: 'blue' },
  processing: { label: '处理中', color: 'blue' },
  indexing: { label: '索引中', color: 'blue' },
  processed: { label: '已处理', color: 'green' },
  indexed: { label: '已索引', color: 'green' },
  failed: { label: '失败', color: 'red' },
  archived: { label: '已归档', color: 'grey' },
};

/** 未知状态不编造文案，回退成后端原值 + 中性色。 */
export function kbStatusMeta(status?: string): KbStatusMeta {
  if (!status) return { label: '—', color: 'grey' };
  return KB_STATUS[status.toLowerCase()] ?? { label: status, color: 'grey' };
}
