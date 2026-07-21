import { useEffect, useState } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { getConceptHierarchy } from '@/api/search';
import type { ConceptHierarchyNode } from '@/types';

interface ConceptTreeProps {
  onSelect?: (conceptId: string) => void;
  selectedKey?: string;
}

function buildTree(nodes: ConceptHierarchyNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.conceptId,
    title: `${node.name} (${node.code})`,
    children: node.children && node.children.length > 0 ? buildTree(node.children) : undefined,
  }));
}

export default function ConceptTree({ onSelect, selectedKey }: ConceptTreeProps) {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getConceptHierarchy(undefined, 5)
      .then((res) => {
        setTreeData(buildTree(res.nodes || []));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Spin spinning={loading}>
      <Tree
        treeData={treeData}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onSelect={(keys) => {
          if (keys.length > 0 && onSelect) {
            onSelect(keys[0] as string);
          }
        }}
        defaultExpandAll
      />
    </Spin>
  );
}
