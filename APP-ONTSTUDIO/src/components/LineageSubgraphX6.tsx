import { useEffect, useMemo, useRef } from 'react';
import { Empty, Space, Tag, Typography } from 'antd';
import { Graph } from '@antv/x6';
import type { DataLineage, LineageNode, LineageNodeType } from '@/types';

interface LineageSubgraphX6Props {
  data: DataLineage;
  height?: number;
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

const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;
const LAYER_GAP_Y = 90;
const NODE_GAP_X = 180;
const PADDING_X = 60;
const PADDING_Y = 40;

/**
 * 使用 AntV X6 渲染血缘子图。
 * 按 type 分层布局，节点之间用带箭头的连线连接。
 */
export default function LineageSubgraphX6({ data, height = 500 }: LineageSubgraphX6Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const layers = useMemo(() => {
    const byType = new Map<LineageNodeType, LineageNode[]>();
    for (const node of data.nodes) {
      const arr = byType.get(node.type) ?? [];
      arr.push(node);
      byType.set(node.type, arr);
    }
    return LAYER_ORDER.filter((t) => byType.has(t)).map((t) => ({
      type: t,
      nodes: byType.get(t) ?? [],
    }));
  }, [data.nodes]);

  useEffect(() => {
    if (!containerRef.current || data.nodes.length === 0) return;

    const container = containerRef.current;
    const width = Math.max(
      container.clientWidth || 800,
      ...layers.map((l) => l.nodes.length * NODE_GAP_X + PADDING_X * 2),
    );
    const totalHeight = Math.max(height, layers.length * LAYER_GAP_Y + PADDING_Y * 2);

    const graph = new Graph({
      container,
      width,
      height: totalHeight,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      panning: true,
      mousewheel: { enabled: true },
      interacting: { nodeMovable: false, edgeMovable: false },
    });

    // 计算节点位置
    const positionMap = new Map<string, { x: number; y: number }>();
    layers.forEach((layer, layerIdx) => {
      const nodesInLayer = layer.nodes;
      const totalWidth = nodesInLayer.length * NODE_GAP_X;
      const startX = (width - totalWidth) / 2 + NODE_GAP_X / 2 - NODE_WIDTH / 2;
      nodesInLayer.forEach((node, i) => {
        positionMap.set(node.id, {
          x: startX + i * NODE_GAP_X,
          y: PADDING_Y + layerIdx * LAYER_GAP_Y,
        });
      });
    });

    // 添加节点
    for (const node of data.nodes) {
      const pos = positionMap.get(node.id);
      if (!pos) continue;
      const color = NODE_COLORS[node.type] || '#999';
      graph.addNode({
        id: node.id,
        x: pos.x,
        y: pos.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        label: node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label,
        attrs: {
          body: {
            fill: `${color}1a`,
            stroke: color,
            strokeWidth: 1.5,
            rx: 6,
            ry: 6,
          },
          label: {
            fontSize: 11,
            fill: '#333',
            refX: NODE_WIDTH / 2,
            refY: NODE_HEIGHT / 2,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
          },
        },
        data: { type: node.type, label: node.label },
      });
    }

    // 添加边
    for (const edge of data.edges) {
      if (!positionMap.has(edge.source) || !positionMap.has(edge.target)) continue;
      graph.addEdge({
        source: { cell: edge.source },
        target: { cell: edge.target },
        attrs: {
          line: {
            stroke: '#bbb',
            strokeWidth: 1.2,
            targetMarker: {
              name: 'block',
              width: 8,
              height: 6,
            },
          },
        },
        ...(edge.label
          ? {
              labels: [
                {
                  attrs: {
                    label: {
                      text: edge.label.length > 16 ? edge.label.slice(0, 15) + '…' : edge.label,
                      fontSize: 9,
                      fill: '#666',
                    },
                    rect: {
                      fill: '#fff',
                      stroke: '#eee',
                    },
                  },
                },
              ],
            }
          : {}),
      });
    }

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, [data, layers, height]);

  if (data.nodes.length === 0) {
    return <Empty description="暂无血缘数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 8 }} wrap>
        {layers.map((l) => (
          <Tag key={l.type} color={NODE_COLORS[l.type]} style={{ fontSize: 11 }}>
            {TYPE_LABELS[l.type]} ({l.nodes.length})
          </Tag>
        ))}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {data.nodes.length} 节点 / {data.edges.length} 边
        </Typography.Text>
      </Space>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          overflow: 'auto',
        }}
      />
    </div>
  );
}
