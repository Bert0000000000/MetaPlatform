import { get } from './client';
import type { SearchResult } from '@/types';

const MOCK_RESULTS: SearchResult[] = [
  { category: 'app', id: 'a1', title: '财务报销应用', description: '包含报销表单和审批流程', link: 'http://localhost:9201/apps' },
  { category: 'app', id: 'a2', title: '采购管理应用', description: '采购申请与供应商管理', link: 'http://localhost:9201/apps' },
  { category: 'knowledge', id: 'k1', title: '财务制度手册', description: '公司财务报销制度与流程规范', link: 'http://localhost:9203/concepts' },
  { category: 'knowledge', id: 'k2', title: 'HR政策汇编', description: '人事管理制度合集', link: 'http://localhost:9203/concepts' },
  { category: 'ontology', id: 'o1', title: '报销单', description: '概念：报销单实体定义', link: 'http://localhost:9201/concepts' },
  { category: 'ontology', id: 'o2', title: '供应商', description: '概念：供应商实体定义', link: 'http://localhost:9201/concepts' },
  { category: 'task', id: 't1', title: '月度报销汇总', description: '数字员工执行中的任务', link: 'http://localhost:9201/dw' },
  { category: 'task', id: 't2', title: '合同到期提醒', description: '已完成任务', link: 'http://localhost:9201/dw' },
];

export async function globalSearch(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return [];
  try {
    return await get<SearchResult[]>('/v1/search/global', { keyword });
  } catch {
    const lower = keyword.toLowerCase();
    return MOCK_RESULTS.filter(
      (r) => r.title.toLowerCase().includes(lower) || r.description.toLowerCase().includes(lower)
    );
  }
}
