import { LayoutDashboard, FileText, GitBranch, BarChart3 } from 'lucide-react';
import type { RenderNode } from '@/api/apphub/types';

/** RenderNode.node_type → 侧边栏图标（lucide） */
export const NODE_ICONS: Record<string, typeof FileText> = {
  page: LayoutDashboard,
  form: FileText,
  flow: GitBranch,
  board: BarChart3,
};

export interface FlatNode {
  key: string;
  node: RenderNode;
}

/**
 * DFS 前序遍历，仅收集叶子节点（children 为空）。key 为 index 路径（"2"、"2-0"）。
 * key 算法与 AppRuntimeLayout 的 Nav itemKey 一致，用于「侧边栏选中 ↔ 内容区渲染」联动。
 */
export function flattenLeaves(tree: RenderNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: RenderNode[], prefix: string) => {
    nodes.forEach((n, i) => {
      const key = prefix ? `${prefix}-${i}` : `${i}`;
      if (n.children && n.children.length > 0) walk(n.children, key);
      else out.push({ key, node: n });
    });
  };
  walk(tree, '');
  return out;
}
