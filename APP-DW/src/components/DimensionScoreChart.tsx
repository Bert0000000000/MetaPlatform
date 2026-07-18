import { useMemo } from 'react';
import { Empty } from 'antd';
import { DIMENSION_META } from '@/types';
import type { DimensionScore, EvaluationDimension } from '@/types';

interface DimensionScoreChartProps {
  dimensions: DimensionScore[];
  /** 雷达图最大值，默认 100 */
  max?: number;
  /** 像素尺寸（宽=高），默认 320 */
  size?: number;
}

const CANONICAL_DIMENSIONS = Object.keys(DIMENSION_META) as EvaluationDimension[];

/**
 * 6 维度评分雷达图（纯 SVG 实现，不依赖额外图表库）。
 *
 * 规范要求：若 @antv/g6 或 @ant-design/charts 未安装则用 SVG 手绘。
 * 本项目仅安装了 recharts（用于折线图），未安装上述两个库，
 * 因此按规范使用 SVG 实现六边形雷达图。
 */
export default function DimensionScoreChart({
  dimensions,
  max = 100,
  size = 320,
}: DimensionScoreChartProps) {
  const scoreMap = useMemo(() => {
    const m = new Map<EvaluationDimension, number>();
    for (const d of dimensions) {
      m.set(d.dimension, d.score);
    }
    return m;
  }, [dimensions]);

  const points = CANONICAL_DIMENSIONS.map((dim, i) => ({
    dim,
    label: DIMENSION_META[dim].label,
    color: DIMENSION_META[dim].color,
    score: scoreMap.get(dim) ?? 0,
    index: i,
  }));

  if (dimensions.length === 0) {
    return <Empty description="暂无维度评分数据" />;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 48; // 留出 label 空间
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]; // 5 圈刻度

  // 第 i 个维度在 -90° + i*60° 方向（顶部开始顺时针）
  const angleOf = (i: number): number => -Math.PI / 2 + (i * Math.PI) / 3;

  const vertex = (i: number, r: number): { x: number; y: number } => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  });

  // 多边形顶点字符串
  const polygonPoints = (r: number): string =>
    points.map((p) => {
      const v = vertex(p.index, r);
      return `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
    }).join(' ');

  // 数据多边形顶点（按 score 缩放）
  const dataPolygon = points
    .map((p) => {
      const r = (Math.max(0, Math.min(p.score, max)) / max) * radius;
      const v = vertex(p.index, r);
      return `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div style={{ width: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="维度评分雷达图">
        {/* 同心刻度多边形 */}
        {rings.map((ring, idx) => (
          <polygon
            key={idx}
            points={polygonPoints(radius * ring)}
            fill="none"
            stroke="#e6e8eb"
            strokeWidth={1}
          />
        ))}

        {/* 刻度数值标签（在顶部轴上） */}
        {rings.map((ring, idx) => {
          const v = vertex(0, radius * ring);
          return (
            <text
              key={`tick-${idx}`}
              x={v.x + 4}
              y={v.y - 2}
              fontSize={9}
              fill="#bfbfbf"
            >
              {Math.round(ring * max)}
            </text>
          );
        })}

        {/* 轴线 */}
        {points.map((p) => {
          const v = vertex(p.index, radius);
          return (
            <line
              key={`axis-${p.dim}`}
              x1={cx}
              y1={cy}
              x2={v.x}
              y2={v.y}
              stroke="#d9d9d9"
              strokeWidth={1}
            />
          );
        })}

        {/* 数据多边形 */}
        <polygon
          points={dataPolygon}
          fill="rgba(22, 119, 255, 0.18)"
          stroke="#1677ff"
          strokeWidth={2}
        />

        {/* 数据点 */}
        {points.map((p) => {
          const r = (Math.max(0, Math.min(p.score, max)) / max) * radius;
          const v = vertex(p.index, r);
          return (
            <circle
              key={`pt-${p.dim}`}
              cx={v.x}
              cy={v.y}
              r={3.5}
              fill={p.color}
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}

        {/* 维度标签 + 分值 */}
        {points.map((p) => {
          const labelR = radius + 22;
          const v = vertex(p.index, labelR);
          // 根据象限微调 textAnchor
          const cosA = Math.cos(angleOf(p.index));
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          if (cosA > 0.3) anchor = 'start';
          else if (cosA < -0.3) anchor = 'end';
          return (
            <g key={`label-${p.dim}`}>
              <text
                x={v.x}
                y={v.y}
                fontSize={12}
                fontWeight={600}
                fill="#262626"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {p.label}
              </text>
              <text
                x={v.x}
                y={v.y + 14}
                fontSize={11}
                fill={p.color}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {p.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
