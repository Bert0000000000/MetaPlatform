import { useEffect, useState } from 'react';
import { listTools, listKnowledgeBases, type AgentTool, type KnowledgeBase } from '@/api/dw/capabilities';
import { listActionTypes, type KernelActionType } from '@/api/ont/kernel';
import { MOCK_TOOLS, MOCK_KNOWLEDGE_BASES, MOCK_ACTIONS } from '@/api/dw/types';

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
 * 接口失败时回退到前端 mock，保证页面可用。
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
        setTools(
          toolRes.length > 0
            ? toolRes
            : MOCK_TOOLS.map((t) => ({ id: t.id, name: t.name, code: t.id })),
        );
        setActions(
          actionRes.length > 0
            ? actionRes.map((a) => ({
                rid: a.rid,
                name: actionName(a.rid),
                category: 'ActionType',
                desc: a.submission_criteria.join('；') || '可触发动作',
              }))
            : MOCK_ACTIONS.map((a) => ({ rid: a.id, name: a.name, category: a.category, desc: a.desc })),
        );
        setKb(
          kbRes.length > 0
            ? kbRes
            : MOCK_KNOWLEDGE_BASES.map((k) => ({ id: k.id, name: k.name, code: k.id })),
        );
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return { tools, actions, kb, loading };
}
