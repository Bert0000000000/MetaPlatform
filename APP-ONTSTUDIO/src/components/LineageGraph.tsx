import { useMemo, useState } from 'react';
import { Empty, Space, Tag, Tooltip, Typography } from 'antd';
import type { DataLineage, LineageNode, LineageNodeType, LineageEdge } from '@/types';

interface LineageGraphProps {
  data: DataLineage;
  height?: number;
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
}

/** 按 type 分层，定义节点的 y 坐标层级。 */
const LAYER_ORDER: LineageNodeType[] = [
  'datasource',
  'table',
  'field',
  'mapping',
  'concept',
  'attribute',
  'entity',
  'relation',
  'action',
  'output',
];

const NODE_COLORS: Record<LineageNodeType, string> = {
  datasource: '#722ed1',
  table: '#1677ff',
  field: '#13c2c2',
  mapping: '#fa8c16',
  concept: '#1677ff',
  attribute: '#52c41a',
  entity: '#eb2f96',
  relation: '#faad14',
  action: '#fa541c',
  output: '#08979c',
};

const NODE_RADIUS: Record<LineageNodeType, number> = {
  datasource: 26,
  table: 22,
  field: 14,
  mapping: 22,
  concept: 26,
  attribute: 16,
  entity: 20,
  relation: 18,
  action: 24,
  output: 22,
};

const TYPE_LABELS: Record<LineageNodeType, string> = {
  datasource: '数据源',
  table: '表',
  field: '字段',
  mapping: '映射',
  concept: '概念',
  attribute: '属性',
  entity: '实体',
  relation: '关系',
  action: 'Action',
  output: '输出',
};

interface PositionedNode extends LineageNode {
  x: number;
  y: number;
}

const LAYER_HEIGHT = 90;
const NODE_GAP = 140;
const PADDING_X = 60;
const PADDING_Y = 50;

export default function LineageGraph({
  data,
  height = 560,
  selectedNodeId,
  onSelectNode,
  highlightedNodes,
}: LineageGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { positioned, layerCount, maxNodesInLayer } = useMemo(() => {
    // 按 type 分组
    const byType = new Map<LineageNodeType, LineageNode[]>();
    for (const node of data.nodes) {
      const arr = byType.get(node.type) ?? [];
      arr.push(node);
      byType.set(node.type, arr);
    }

    // 只保留实际存在的层
    const layers = LAYER_ORDER.filter((t) => byType.has(t));
    const layerCount = layers.length;

    // 计算每层的节点 x 坐标
    const maxNodesInLayer = Math.max(...layers.map((t) => byType.get(t)?.length ?? 0), 1);
    const width = Math.max(800, maxNodesInLayer * NODE_GAP + PADDING_X * 2);

    const positioned: PositionedNode[] = [];
    layers.forEach((type, layerIdx) => {
      const nodesInLayer = byType.get(type) ?? [];
      const totalWidth = nodesInLayer.length * NODE_GAP;
      const startX = (width - totalWidth) / 2 + NODE_GAP / 2;
      nodesInLayer.forEach((node, i) => {
        positioned.push({
          ...node,
          x: startX + i * NODE_GAP,
          y: PADDING_Y + layerIdx * LAYER_HEIGHT,
        });
      });
    });

    return { positioned, layerCount, maxNodesInLayer };
  }, [data.nodes]);

  const nodeMap = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  const totalHeight = Math.max(height, layerCount * LAYER_HEIGHT + PADDING_Y * 2);
  const totalWidth = Math.max(800, maxNodesInLayer * NODE_GAP + PADDING_X * 2);

  if (data.nodes.length === 0) {
    return <Empty description="暂无血缘数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const isHighlighted = (id: string) => !highlightedNodes || highlightedNodes.has(id);

  return (
    <div style={{ overflow: 'auto', maxHeight: height }}>
      <Space style={{ marginBottom: 8 }} wrap>
        {LAYER_ORDER.filter((t) => data.nodes.some((n) => n.type === t)).map((t) => (
          <Tag key={t} color={NODE_COLORS[t]} style={{ fontSize: 11 }}>
            {TYPE_LABELS[t]}
          </Tag>
        ))}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {data.nodes.length} 节点 / {data.edges.length} 边
        </Typography.Text>
      </Space>
      <svg
        width={totalWidth}
        height={totalHeight}
        style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}
      >
        <defs>
          <marker
            id="lineage-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#bbb" />
          </marker>
          <marker
            id="lineage-arrow-highlight"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#1677ff" />
          </marker>
        </defs>

        {/* 层级分隔线 */}
        {LAYER_ORDER.filter((t) => data.nodes.some((n) => n.type === t)).map((t, idx) => {
          const y = PADDING_Y + idx * LAYER_HEIGHT - 24;
          if (y < 0) return null;
          return (
            <g key={`layer-${t}`}>
              <line
                x1={0}
                y1={y}
                x2={totalWidth}
                y2={y}
                stroke="#eee"
                strokeDasharray="4,4"
              />
              <text x={8} y={y - 6} fontSize={10} fill="#999">
                {TYPE_LABELS[t]}
              </text>
            </g>
          );
        })}

        {/* 边 */}
        {data.edges.map((edge: LineageEdge) => {
          const s = nodeMap.get(edge.source);
          const t = nodeMap.get(edge.target);
          if (!s || !t) return null;
          const highlighted =
            isHighlighted(edge.source) && isHighlighted(edge.target);
          const isHovered =
            hoveredNode === edge.source || hoveredNode === edge.target;
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;
          return (
            <g key={edge.id}>
              <path
                d={`M ${s.x} ${s.y} C ${s.x} ${(s.y + t.y) / 2}, ${t.x} ${
                  (s.y + t.y) / 2
                }, ${t.x} ${t.y}`}
                fill="none"
                stroke={highlighted ? (isHovered ? '#1677ff' : '#bbb') : '#eee'}
                strokeWidth={isHovered ? 2 : 1.2}
                markerEnd={
                  highlighted
                    ? 'url(#lineage-arrow-highlight)'
                    : 'url(#lineage-arrow)'
                }
                opacity={highlighted ? 1 : 0.3}
              />
              {edge.label && highlighted && (
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#666"
                  style={{ pointerEvents: 'none' }}
                >
                  {edge.label.length > 16 ? edge.label.slice(0, 15) + '…' : edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* 节点 */}
        {positioned.map((node) => {
          const r = NODE_RADIUS[node.type] || 16;
          const color = NODE_COLORS[node.type] || '#999';
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNode === node.id;
          const highlighted = isHighlighted(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectNode?.(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              opacity={highlighted ? 1 : 0.35}
            >
              <Tooltip
                title={
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{node.label}</Typography.Text>
                    <Typography.Text style={{ fontSize: 11 }}>
                      类型：{TYPE_LABELS[node.type]}
                    </Typography.Text>
                    {node.metadata?.transform && (
                      <Typography.Text style={{ fontSize: 11 }}>
                        转换：{node.metadata.transform}
                      </Typography.Text>
                    )}
                    {node.metadata?.schedule && (
                      <Typography.Text style={{ fontSize: 11 }}>
                        调度：{node.metadata.schedule}
                      </Typography.Text>
                    )}
                  </Space>
                }
                placement="top"
              >
                <circle
                  r={r}
                  fill={isSelected ? color : `${color}22`}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.8}
                />
              </Tooltip>
              <text
                textAnchor="middle"
                dy={r + 14}
                fontSize={11}
                fill="#333"
                fontWeight={node.type === 'concept' || node.type === 'action' ? 600 : 400}
              >
                {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
              </text>
              <text textAnchor="middle" dy={4} fontSize={9} fill={color} fontWeight={600}>
                {TYPE_LABELS[node.type].slice(0, 1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
