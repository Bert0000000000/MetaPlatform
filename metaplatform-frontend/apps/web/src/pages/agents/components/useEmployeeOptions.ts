import { useEffect, useState } from 'react';
import { listTools, listKnowledgeBases, type AgentTool, type KnowledgeBase } from '@/api/dw/capabilities';
import { listActionTypes, type KernelActionType } from '@/api/ont/kernel';

export interface EmployeeActionOption {
  rid: string;
  name: string;
  category: string;
  desc: string;
}

export interface EmployeeOptions {
  tools: AgentTool[];
  actions: EmployeeActionOption[];
  kb: KnowledgeBase[];
  loading: boolean;
}

/** 动作显示名：rid 形如 ont.<tenant>.act.<slug>.v1 → 取 slug。 */
export function actionName(rid: string): string {
  const parts = rid.split('.');
  return parts.length >= 4 ? parts[3] : rid;
}

/**
 * 并行拉取数字员工配置所需的真实选项（工具 / 可触发动作 / 知识库）。
 * 接口失败或为空时**不回退 mock**：宁可选项为空（由调用方给出空态提示），
 * 也不让用户在配置表单里选到并不存在的工具/知识库。
 */
export function useEmployeeOptions(): EmployeeOptions {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [actions, setActions] = useState<EmployeeActionOption[]>([]);
  const [kb, setKb] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listTools().catch(() => []),
      listActionTypes().catch(() => []),
      listKnowledgeBases().catch(() => []),
    ])
      .then(([toolRes, actionRes, kbRes]) => {
        if (!alive) return;
        setTools(toolRes);
        setActions(
          actionRes.map((a) => ({
            rid: a.rid,
            name: actionName(a.rid),
            category: 'ActionType',
            desc: a.submission_criteria.join('；') || '可触发动作',
          })),
        );
        setKb(kbRes);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return { tools, actions, kb, loading };
}
