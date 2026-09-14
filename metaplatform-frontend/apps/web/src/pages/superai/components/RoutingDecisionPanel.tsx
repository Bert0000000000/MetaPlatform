import { useMemo, useState } from 'react';
import { Card, Progress, Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { IconChevronDown, IconChevronRight, IconRoute } from '@douyinfe/semi-icons';
import type { RoutingDecision, RoutingTakenPath } from '@/api/superai/types';

const { Text, Paragraph } = Typography;

export interface RoutingDecisionPanelProps {
  /** One or multiple routing_decision events for the same turn (pre-screen + selected). */
  decision: RoutingDecision | RoutingDecision[];
  /** A routing event failed validation; never render a prior decision beside it. */
  streamError?: string;
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
 *       display_name + taken_path 颜色标签（llm_fc=蓝 / semantic_router=绿 /
 *       dispatcher=黄 / keyword_fallback=灰）</li>
 *   <li>展开后：top-k 候选列表 + Similarity Progress 进度条 + 最终选中高亮
 *       （边框 + SELECTED 标签 + 浅色背景）</li>
 *   <li>taken_path + reason 描述放在底部</li>
 * </ul>
 * </p>
 */
export function RoutingDecisionPanel({ decision, streamError, defaultExpanded = false }: RoutingDecisionPanelProps) {
  const decisions = useMemo(
    () => (Array.isArray(decision) ? decision : [decision]).filter(Boolean),
    [decision],
  );

  const [expanded, setExpanded] = useState(defaultExpanded);

  // A final denial is fail-closed and therefore wins over any selected event.
  const primary = useMemo(
    () => {
      const finalDecisions = decisions.filter((decision) => decision.stage === 'final');
      for (let index = finalDecisions.length - 1; index >= 0; index -= 1) {
        if (finalDecisions[index].outcome === 'denied') return finalDecisions[index];
      }
      return finalDecisions[finalDecisions.length - 1] ?? decisions[0] ?? null;
    },
    [decisions],
  );

  if (streamError) {
    return (
      <Card data-testid="routing-decision-panel">
        <div className="mp-evidence-list">
          <Text strong>路由决策</Text>
          <Paragraph type="danger" className="mp-evidence-fragment">
            {streamError}
          </Paragraph>
          <Text type="tertiary" className="mp-evidence-sub">
            本次路由轨迹未展示，也不会允许手动选择角色。
          </Text>
        </div>
      </Card>
    );
  }

  if (!primary) return null;

  const selectedRoleSlug = primary.selected?.role_slug;
  const selectedCandidate = primary.candidates.find(
    (candidate) => candidate.role_slug === selectedRoleSlug || candidate.role_rid === selectedRoleSlug,
  );
  const takenPath = primary.taken_path;
  const totalCandidates = primary.candidates.length;
  const denied = primary.outcome === 'denied';

  return (
    <Card data-testid="routing-decision-panel">
      <div className="mp-exec-col">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          data-testid="routing-decision-toggle"
          className="mp-exec-step-head mp-claim-ref"
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setExpanded((v) => !v);
            }
          }}
        >
          {expanded ? <IconChevronDown size="small" /> : <IconChevronRight size="small" />}
          <IconRoute size="small" className="mp-evidence-icon is-ontology" />
          <Text strong>路由决策</Text>
          <Tag color="grey" size="small">{totalCandidates} candidates</Tag>
          {selectedRoleSlug && (
            <Tag color="blue" size="small">→ {selectedCandidate?.display_name ?? '已授权角色'}</Tag>
          )}
          {denied && <Tag color="red" size="small">已拒绝</Tag>}
          {takenPath && (
            <Tag color={takenPathColor(takenPath)} size="small">{takenPathLabel(takenPath)}</Tag>
          )}
          {decisions.length > 1 && (
            <Tag color="cyan" size="small">{decisions.length} events</Tag>
          )}
        </div>

        {expanded && (
          <div data-testid="routing-decision-body" className="mp-exec-col">
            {/* Candidates list */}
            <div className="mp-evidence-list">
              {primary.candidates.length === 0 && (
                <Text type="tertiary" className="mp-evidence-sub">无候选角色</Text>
              )}
              {primary.candidates.map((c, idx) => {
                const isSelected = !!selectedRoleSlug && c.role_slug === selectedRoleSlug;
                const pct = clampPercent(c.similarity);
                return (
                  <div
                    key={`${c.role_slug}-${idx}`}
                    data-testid={`routing-candidate-${idx}`}
                    className="mp-claim"
                  >
                    <div className="mp-claim-main">
                      <div className="mp-exec-line">
                        <span className="mp-exec-chips">
                          <Text strong>{c.display_name}</Text>
                          {isSelected && <Tag color="blue" size="small">SELECTED</Tag>}
                        </span>
                        <Text type="tertiary">{(pct).toFixed(1)}%</Text>
                      </div>
                      <Progress percent={pct} size="small" showInfo={false} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Taken path + reason */}
            {(takenPath || primary.reason) && (
              <div className="mp-evidence-list">
                {takenPath && (
                  <div className="mp-exec-chips">
                    <Text type="tertiary" className="mp-evidence-sub">来源:</Text>
                    <Tag color={takenPathColor(takenPath)} size="small">{takenPathLabel(takenPath)}</Tag>
                  </div>
                )}
                {primary.outcome === 'denied' && (
                  <Text type="danger" className="mp-evidence-sub">此轮请求未执行任何调度。</Text>
                )}
                {routingSummary(primary) && (
                  <Paragraph type="tertiary" className="mp-evidence-fragment">
                    {routingSummary(primary)}
                  </Paragraph>
                )}
                {primary.policy_version && (
                  <Text type="tertiary" className="mp-evidence-sub">
                    策略版本: {primary.policy_version}
                  </Text>
                )}
              </div>
            )}

            {decisions.length > 1 && (
              <Text type="tertiary" className="mp-evidence-sub">
                共收到 {decisions.length} 个 routing_decision 事件（pre-screen + 决策回填）
              </Text>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function routingSummary(decision: RoutingDecision): string {
  if (decision.outcome === 'selected') return '已依据已授权能力完成路由';
  if (decision.outcome === 'denied') {
    switch (decision.reason_code) {
      case 'no_authorized_roles':
        return '当前身份没有可用的数字员工权限。';
      case 'no_authorized_candidates':
        return '当前请求没有匹配到可授权的数字员工。';
      case 'llm_unavailable':
        return '路由服务暂不可用。';
      case 'llm_decision_missing':
        return '未获得可验证的路由结果。';
      case 'target_not_authorized':
        return '目标角色不在当前授权范围内。';
      case 'missing_dispatch_tool_call':
        return '未获得可验证的授权调度指令。';
      default:
        return '本次路由未通过授权校验。';
    }
  }
  return '系统正在根据已授权能力筛选候选角色。';
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
