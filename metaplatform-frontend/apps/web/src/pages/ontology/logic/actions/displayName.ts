import type { KernelActionType } from '@/api/ont/kernel';

// rid 末段 slug → 中文名兜底（后端 title 缺失时）。
// IA2-5 自 ActionTypeListPage 抽出（该容器退役，工具函数归 logic/actions/）。
const SLUG_LABELS: Record<string, string> = {
  'approve-leave': '审批请假',
  'close-ticket': '关闭工单',
  'approve-contract': '审批合同',
  'superai-orchestrate': 'SuperAI 编排调度',
};

export function actionDisplayName(at: Pick<KernelActionType, 'rid' | 'title'>): string {
  if (at.title) return at.title;
  const m = at.rid.match(/act\.([^.]+)\.v\d+$/);
  if (m && SLUG_LABELS[m[1]]) return SLUG_LABELS[m[1]];
  if (m) return m[1];
  return at.rid;
}
