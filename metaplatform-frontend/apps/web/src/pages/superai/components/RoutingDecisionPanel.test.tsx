import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoutingDecision } from '@/api/superai/types';
import { RoutingDecisionPanel } from './RoutingDecisionPanel';

// Semi UI loads lottie-web at module initialization, which requires a real
// canvas. These focused tests exercise this component's contract rather than
// Semi's rendering implementation.
vi.mock('@douyinfe/semi-ui', () => ({
  Card: ({ header, children }: { header?: React.ReactNode; children?: React.ReactNode }) => (
    <section>{header}{children}</section>
  ),
  Progress: () => <div data-testid="routing-similarity" />,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
}));

vi.mock('@douyinfe/semi-icons', () => ({
  IconChevronDown: () => <span />,
  IconChevronRight: () => <span />,
  IconRoute: () => <span />,
}));

afterEach(cleanup);

const preScreen: RoutingDecision = {
  candidates: [
    {
      role_slug: 'order-reviewer',
      role_rid: 'role:order-reviewer',
      display_name: '订单复核专员',
      capability_tags: ['orders'],
      similarity: 0.92,
    },
  ],
  selected: null,
  taken_path: 'semantic_router',
  reason: 'semantic_router pre-screen',
  stage: 'pre_screen',
  outcome: null,
  reason_code: 'semantic_pre_screen',
  policy_version: 'semantic-router-v1',
  seq: 1,
  ts: '2026-08-31T00:00:00Z',
};

const selected: RoutingDecision = {
  ...preScreen,
  selected: { role_slug: 'order-reviewer' },
  taken_path: 'llm_fc',
  stage: 'final',
  outcome: 'selected',
  reason_code: 'model_selected',
  seq: 2,
};

const denied: RoutingDecision = {
  ...preScreen,
  stage: 'final',
  outcome: 'denied',
  reason_code: 'no_authorized_candidates',
  seq: 2,
};

describe('RoutingDecisionPanel', () => {
  it('keeps pre-screen candidates before the final authorized selection without offering a manual choice', () => {
    render(<RoutingDecisionPanel decision={[preScreen, selected]} defaultExpanded />);

    expect(screen.getByText('订单复核专员')).toBeInTheDocument();
    expect(screen.getByTestId('routing-candidate-0')).toBeInTheDocument();
    expect(screen.queryByTestId('routing-candidate-order-reviewer')).not.toBeInTheDocument();
    expect(screen.getByText('已依据已授权能力完成路由')).toBeInTheDocument();
    expect(screen.getByText('来源:')).toBeInTheDocument();
    expect(screen.getAllByText('LLM FC')).toHaveLength(2);
    expect(screen.getByText('策略版本: semantic-router-v1')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a final denial as a non-retryable explanation', () => {
    render(<RoutingDecisionPanel decision={[preScreen, denied]} defaultExpanded />);

    expect(screen.getByText('此轮请求未执行任何调度。')).toBeInTheDocument();
    expect(screen.getByText('当前请求没有匹配到可授权的数字员工。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /重试|重新选择|选择角色/ })).not.toBeInTheDocument();
  });

  it('gives a later final denial precedence over an earlier final selection', () => {
    render(<RoutingDecisionPanel decision={[preScreen, selected, denied]} defaultExpanded />);

    expect(screen.getByText('此轮请求未执行任何调度。')).toBeInTheDocument();
    expect(screen.queryByText('已依据已授权能力完成路由')).not.toBeInTheDocument();
  });

  it('replaces stale routing output with a visible stream-contract error', () => {
    render(
      <RoutingDecisionPanel
        decision={[preScreen]}
        defaultExpanded
        streamError="路由决策事件格式错误，无法安全展示本次路由结果。"
      />,
    );

    expect(screen.getByText('路由决策事件格式错误，无法安全展示本次路由结果。')).toBeInTheDocument();
    expect(screen.queryByText('订单复核专员')).not.toBeInTheDocument();
  });
});
