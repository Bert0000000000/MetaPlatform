import { useMemo, useState } from 'react';
import { Card, Progress, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { IconChevronDown, IconChevronRight, IconRoute } from '@douyinfe/semi-icons';
import type { RoutingDecision, RoutingTakenPath } from '@/api/superai/types';

const { Text, Paragraph } = Typography;

export interface RoutingDecisionPanelProps {
  /** One or multiple routing_decision events for the same turn (pre-screen + selected). */
  decision: RoutingDecision | RoutingDecision[];
  /** Force collapsed/expanded (defaults to user toggleable). */
  defaultExpanded?: boolean;
}

/**
 * RoutingDecisionPanel — visualizes the SuperAI semantic_router + dispatcher trace
 * for one assistant turn (MP-SR-01 task 2).
 *
 * <p>Layout (collapsed by default):
 * <ul>
 *   <li>Header: chevron + IconRoute + "路由决策" + candidate count + selected
 *       role_slug + taken_path 颜色标签（llm_fc=蓝 / semantic_router=绿 /
 *       dispatcher=黄 / keyword_fallback=灰）</li>
 *   <li>展开后：top-k 候选列表 + Similarity Progress 进度条 + 最终选中高亮
 *       （边框 + SELECTED 标签 + 浅色背景）</li>
 *   <li>taken_path + reason 描述放在底部</li>
 * </ul>
 * </p>
 */
export function RoutingDecisionPanel({ decision, defaultExpanded = false }: RoutingDecisionPanelProps) {
  const decisions = useMemo(
    () => (Array.isArray(decision) ? decision : [decision]).filter(Boolean),
    [decision],
  );

  const [expanded, setExpanded] = useState(defaultExpanded);

  // Pick the most informative view: prefer the one that has a non-null selected.
  const primary = useMemo(
    () => decisions.find((d) => d.selected != null) ?? decisions[0] ?? null,
    [decisions],
  );

  if (!primary) return null;

  const selectedRoleSlug = primary.selected?.role_slug;
  const takenPath = primary.taken_path;
  const totalCandidates = primary.candidates.length;

  return (
    <Card
      data-testid="routing-decision-panel"
      style={{
        marginTop: 8,
        border: '1px solid var(--semi-color-border, var(--border))',
        background: 'var(--semi-color-fill-0, var(--muted))',
      }}
      bodyStyle={{ padding: expanded ? 12 : 8 }}
      headerStyle={{ padding: expanded ? '8px 12px' : '4px 12px' }}
      header={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-testid="routing-decision-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: 0,
            margin: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          {expanded ? <IconChevronDown size="small" /> : <IconChevronRight size="small" />}
          <IconRoute size="small" style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ fontSize: 13 }}>路由决策</Text>
          <Tag color="grey" size="small">{totalCandidates} candidates</Tag>
          {selectedRoleSlug && (
            <Tag color="blue" size="small">→ {selectedRoleSlug}</Tag>
          )}
          {takenPath && (
            <Tag color={takenPathColor(takenPath)} size="small">{takenPathLabel(takenPath)}</Tag>
          )}
          {decisions.length > 1 && (
            <Tag color="cyan" size="small">{decisions.length} events</Tag>
          )}
        </button>
      }
    >
      {expanded && (
        <div data-testid="routing-decision-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Candidates list */}
          <Space vertical spacing={6} style={{ width: '100%' }}>
            {primary.candidates.length === 0 && (
              <Text type="tertiary" style={{ fontSize: 12 }}>无候选角色</Text>
            )}
            {primary.candidates.map((c, idx) => {
              const isSelected = !!selectedRoleSlug && c.role_slug === selectedRoleSlug;
              const pct = clampPercent(c.similarity);
              return (
                <div
                  key={`${c.role_slug}-${idx}`}
                  data-testid={`routing-candidate-${c.role_slug}`}
                  style={{
                    padding: '6px 10px',
                    border: isSelected
                      ? '2px solid var(--semi-color-primary)'
                      : '1px solid var(--semi-color-border, var(--border))',
                    borderRadius: 6,
                    background: isSelected
                      ? 'var(--semi-color-primary-light-default, rgba(56, 125, 255, 0.08))'
                      : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{c.display_name}</Text>
                    <Tag color="grey" size="small">{c.role_slug}</Tag>
                    {isSelected && <Tag color="blue" size="small">SELECTED</Tag>}
                    <Text type="tertiary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      {(pct).toFixed(1)}%
                    </Text>
                  </div>
                  <Progress percent={pct} size="small" showInfo={false} />
                  {(c.capability_tags && c.capability_tags.length > 0) && (
                    <Space wrap spacing={4}>
                      {c.capability_tags.map((t) => (
                        <Tag key={t} color="light-blue" size="small">{t}</Tag>
                      ))}
                    </Space>
                  )}
                  {c.reason && (
                    <Text type="tertiary" style={{ fontSize: 11 }}>{c.reason}</Text>
                  )}
                </div>
              );
            })}
          </Space>

          {/* Taken path + reason */}
          {(takenPath || primary.reason) && (
            <div
              style={{
                paddingTop: 8,
                borderTop: '1px dashed var(--semi-color-border, var(--border))',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {takenPath && (
                <Space spacing={6}>
                  <Text type="tertiary" style={{ fontSize: 12 }}>命中路径:</Text>
                  <Tag color={takenPathColor(takenPath)} size="small">{takenPathLabel(takenPath)}</Tag>
                </Space>
              )}
              {primary.reason && (
                <Paragraph
                  type="tertiary"
                  style={{ fontSize: 12, marginBottom: 0 }}
                  ellipsis={{ rows: 2, expandable: true, collapsible: true }}
                >
                  {primary.reason}
                </Paragraph>
              )}
            </div>
          )}

          {decisions.length > 1 && (
            <Text type="tertiary" style={{ fontSize: 11 }}>
              共收到 {decisions.length} 个 routing_decision 事件（pre-screen + 决策回填）
            </Text>
          )}
        </div>
      )}
    </Card>
  );
}

function clampPercent(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  // similarity 通常 0..1，少数情况下后端传 0..100
  if (v <= 1) return Math.min(100, v * 100);
  return Math.min(100, v);
}

function takenPathColor(p: RoutingTakenPath): TagColor {
  switch (p) {
    case 'llm_fc': return 'blue';
    case 'semantic_router': return 'green';
    case 'dispatcher': return 'orange';
    case 'keyword_fallback': return 'grey';
  }
}

function takenPathLabel(p: RoutingTakenPath): string {
  switch (p) {
    case 'llm_fc': return 'LLM FC';
    case 'semantic_router': return 'Semantic Router';
    case 'dispatcher': return 'Dispatcher';
    case 'keyword_fallback': return 'Keyword Fallback';
  }
}

export default RoutingDecisionPanel;