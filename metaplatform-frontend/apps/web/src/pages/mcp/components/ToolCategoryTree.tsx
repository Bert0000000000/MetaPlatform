import { Tree } from '@douyinfe/semi-ui';
import type { McpTool } from '@/api/mcphub/types';

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
    label: `${cat} (${grouped[cat]!.length})`,
    key: `cat-${cat}`,
    children: grouped[cat]!.map((t) => ({
      label: t.name,
      key: t.id,
      isLeaf: true,
    })),
  }));

  return (
    <Tree
      treeData={treeData}
      defaultExpandAll
      onSelect={(key) => {
        const k = String(key);
        if (k && !k.startsWith('cat-')) onSelect(k);
      }}
    />
  );
}
