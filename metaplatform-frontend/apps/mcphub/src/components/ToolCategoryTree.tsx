import { Tree } from 'antd';
import type { McpTool } from '@/types';

interface ToolCategoryTreeProps {
  tools: McpTool[];
  selectedToolId?: string;
  onSelect: (toolId: string) => void;
}

export default function ToolCategoryTree({ tools, selectedToolId, onSelect }: ToolCategoryTreeProps) {
  const grouped = tools.reduce<Record<string, McpTool[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category]!.push(t);
    return acc;
  }, {});

  const treeData = Object.keys(grouped).map((cat) => ({
    title: `${cat} (${grouped[cat]!.length})`,
    key: `cat-${cat}`,
    selectable: false,
    children: grouped[cat]!.map((t) => ({
      title: t.name,
      key: t.id,
      isLeaf: true,
    })),
  }));

  return (
    <Tree
      treeData={treeData}
      defaultExpandAll
      selectedKeys={selectedToolId ? [selectedToolId] : []}
      onSelect={(keys) => {
        const k = keys[0];
        if (k && !String(k).startsWith('cat-')) onSelect(String(k));
      }}
    />
  );
}
