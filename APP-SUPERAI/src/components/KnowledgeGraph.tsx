import { useRef, useEffect, useState, useCallback } from 'react';
import { Tooltip, Select, Space, Typography } from 'antd';
import type { GraphData, GraphNode } from '@/types';

interface KnowledgeGraphProps {
  data: GraphData;
  height?: number;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COLORS: Record<string, string> = {
  concept: '#1677ff',
  entity: '#52c41a',
  relation: '#faad14',
};

const NODE_RADIUS: Record<string, number> = {
  concept: 28,
  entity: 20,
  relation: 16,
};

export default function KnowledgeGraph({ data, height = 400 }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<PositionedNode[]>([]);
  const [layout, setLayout] = useState<'force' | 'circular' | 'grid'>('force');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const width = 800;

  useEffect(() => {
    if (data.nodes.length === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const positioned: PositionedNode[] = data.nodes.map((node, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      };
    });
    setNodes(positioned);
    setExpandedNodes(new Set(data.nodes.map((n) => n.id)));
  }, [data, height]);

  const applyLayout = useCallback(
    (layoutType: 'force' | 'circular' | 'grid') => {
      if (nodes.length === 0) return;
      const centerX = width / 2;
      const centerY = height / 2;

      if (layoutType === 'circular') {
        const radius = Math.min(width, height) * 0.35;
        setNodes((prev) =>
          prev.map((node, i) => {
            const angle = (i / prev.length) * Math.PI * 2;
            return { ...node, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, vx: 0, vy: 0 };
          }),
        );
      } else if (layoutType === 'grid') {
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const spacing = Math.min(width / (cols + 1), height / (Math.ceil(nodes.length / cols) + 1));
        setNodes((prev) =>
          prev.map((node, i) => ({
            ...node,
            x: spacing * ((i % cols) + 1),
            y: spacing * (Math.floor(i / cols) + 1),
            vx: 0,
            vy: 0,
          })),
        );
      }
    },
    [nodes, height],
  );

  useEffect(() => {
    if (layout === 'force') return;
    applyLayout(layout);
  }, [layout, applyLayout]);

  useEffect(() => {
    if (layout !== 'force' || nodes.length === 0) return;

    let animationId: number;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const tick = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        const centerX = width / 2;
        const centerY = height / 2;

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 3000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            next[i].vx -= fx;
            next[i].vy -= fy;
            next[j].vx += fx;
            next[j].vy += fy;
          }
        }

        for (const edge of data.edges) {
          const s = next.find((n) => n.id === edge.source);
          const t = next.find((n) => n.id === edge.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 120) * 0.05;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }

        for (const n of next) {
          n.vx += (centerX - n.x) * 0.005;
          n.vy += (centerY - n.y) * 0.005;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(40, Math.min(width - 40, n.x));
          n.y = Math.max(30, Math.min(height - 30, n.y));
        }

        return next;
      });

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [layout, data.edges, height]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const visibleNodes = nodes.filter((n) => expandedNodes.has(n.id));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = data.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">布局：</Typography.Text>
        <Select
          size="small"
          value={layout}
          onChange={setLayout}
          style={{ width: 100 }}
          options={[
            { label: '力导向', value: 'force' },
            { label: '环形', value: 'circular' },
            { label: '网格', value: 'grid' },
          ]}
        />
        <Typography.Text type="secondary">
          {visibleNodes.length} 节点 / {visibleEdges.length} 边
        </Typography.Text>
      </Space>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#bbb" />
          </marker>
        </defs>

        {visibleEdges.map((edge) => {
          const s = nodeMap.get(edge.source);
          const t = nodeMap.get(edge.target);
          if (!s || !t) return null;
          return (
            <g key={edge.id}>
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="#ccc"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
              <text
                x={(s.x + t.x) / 2}
                y={(s.y + t.y) / 2 - 4}
                textAnchor="middle"
                fontSize={10}
                fill="#999"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {visibleNodes.map((node) => {
          const r = NODE_RADIUS[node.type] || 20;
          const color = NODE_COLORS[node.type] || '#999';
          const isSelected = selectedNode === node.id;
          const hasHiddenNeighbors = data.edges.some(
            (e) =>
              (e.source === node.id || e.target === node.id) &&
              !visibleNodeIds.has(e.source === node.id ? e.target : e.source),
          );
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedNode(node.id);
                toggleNode(node.id);
              }}
            >
              <Tooltip title={`${node.label} (${node.type})`} placement="top">
                <circle
                  r={r}
                  fill={isSelected ? color : `${color}33`}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                />
                {hasHiddenNeighbors && (
                  <circle r={r + 4} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3,3" />
                )}
              </Tooltip>
              <text
                textAnchor="middle"
                dy={r + 14}
                fontSize={11}
                fill="#333"
                fontWeight={node.type === 'concept' ? 600 : 400}
              >
                {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
              </text>
              {node.type === 'concept' && (
                <text textAnchor="middle" dy={4} fontSize={10} fill={color} fontWeight={600}>
                  C
                </text>
              )}
              {node.type === 'entity' && (
                <text textAnchor="middle" dy={4} fontSize={9} fill={color}>
                  E
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
