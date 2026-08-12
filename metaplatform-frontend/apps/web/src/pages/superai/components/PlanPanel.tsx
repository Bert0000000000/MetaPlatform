import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Steps,
  Tag,
  Button,
  Space,
  Typography,
  Banner,
  Tooltip,
  Popconfirm,
  Spin,
  Empty,
  Timeline,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import {
  ScheduleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  CheckOutlined,
  SwapOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  createPlan,
  approveStep,
  skipStep,
  executePlan,
  getPlan,
} from '@/api/superai/plans';
import type { Plan, PlanStep, PlanStepStatus, PlanStatus } from '@/api/superai/types';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';

interface PlanPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult?: (metadata: { plan?: Plan }) => void;
}

interface StepStatusMeta {
  label: string;
  color: TagColor;
  icon: React.ReactNode;
}

const STEP_STATUS_META: Record<PlanStepStatus, StepStatusMeta> = {
  pending: {
    label: '待执行',
    color: 'grey',
    icon: <ClockCircleOutlined />,
  },
  running: {
    label: '执行中',
    color: 'blue',
    icon: <LoadingOutlined />,
  },
  completed: {
    label: '已完成',
    color: 'green',
    icon: <CheckCircleOutlined />,
  },
  failed: {
    label: '失败',
    color: 'red',
    icon: <CloseCircleOutlined />,
  },
  skipped: {
    label: '已跳过',
    color: 'orange',
    icon: <MinusCircleOutlined />,
  },
  approved: {
    label: '已批准',
    color: 'blue',
    icon: <CheckOutlined />,
  },
};

const PLAN_STATUS_META: Record<PlanStatus, { label: string; color: TagColor }> = {
  draft: { label: '草稿', color: 'grey' },
  ready: { label: '待执行', color: 'blue' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
};

function timelineColorFor(status: PlanStepStatus): string {
  if (status === 'completed') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'skipped') return 'yellow';
  if (status === 'running') return 'blue';
  if (status === 'approved') return 'blue';
  return 'gray';
}

function stepsToTimelineItems(steps: PlanStep[]) {
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const meta = STEP_STATUS_META[step.status];
      return {
        key: step.stepId,
        color: timelineColorFor(step.status),
        dot: meta.icon,
        children: (
          <div>
            <Space spacing={6} align="center">
              <Typography.Text strong>{step.title}</Typography.Text>
              <Tag color={meta.color} style={{ fontSize: 11 }}>
                {meta.label}
              </Tag>
              {step.requiresApproval && (
                <Tag style={{ fontSize: 11 }}>需批准</Tag>
              )}
            </Space>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {step.description}
              </Typography.Text>
            </div>
            {step.action && (
              <div style={{ marginTop: 2 }}>
                <Tag style={{ fontSize: 10 }}>{step.action}</Tag>
              </div>
            )}
            {step.output && (
              <div
                style={{
                  marginTop: 4,
                  padding: 6,
                  background: 'var(--muted)',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <Typography.Text type="secondary">输出：</Typography.Text>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              </div>
            )}
            {step.errorMessage && (
              <div style={{ marginTop: 4 }}>
                <Typography.Text type="danger" style={{ fontSize: 12 }}>
                  {step.errorMessage}
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      };
    });
}

function stepsToSemiSteps(plan: Plan) {
  const currentIdx = plan.steps.findIndex(
    (s) => s.status === 'running' || s.status === 'pending' || s.status === 'approved',
  );
  const current = currentIdx === -1 ? plan.steps.length : currentIdx;

  const statusFor = (step: PlanStep): 'wait' | 'process' | 'finish' | 'error' =>
    step.status === 'completed'
      ? 'finish'
      : step.status === 'running'
        ? 'process'
        : step.status === 'failed'
          ? 'error'
          : 'wait';

  return (
    <Steps
      size="small"
      current={current}
      direction="vertical"
    >
      {plan.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => {
          const meta = STEP_STATUS_META[step.status];
          return (
            <Steps.Step
              key={step.stepId}
              title={(
                <Space spacing={4} align="center">
                  <Typography.Text strong>{step.title}</Typography.Text>
                  <Tag color={meta.color} style={{ fontSize: 11 }}>
                    {meta.label}
                  </Tag>
                </Space>
              )}
              description={(
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {step.description}
                  </Typography.Text>
                  {step.action && (
                    <div style={{ marginTop: 2 }}>
                      <Tag style={{ fontSize: 10 }}>{step.action}</Tag>
                    </div>
                  )}
                </div>
              )}
              status={statusFor(step)}
              icon={meta.icon}
            />
          );
        })}
    </Steps>
  );
}

export default function PlanPanel({
  query,
  onQueryChange,
  onResult,
}: PlanPanelProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const refreshPlan = useCallback(
    async (planId: string) => {
      try {
        const latest = await getPlan(planId);
        setPlan(latest);
        onResult?.({ plan: latest });
        if (latest.status === 'completed' || latest.status === 'failed') {
          setPolling(false);
        }
      } catch {
        setPolling(false);
      }
    },
    [onResult],
  );

  // 自动轮询：当计划状态为 running 时，每 2 秒拉取一次最新状态
  useEffect(() => {
    if (!polling || !plan) return;
    const timer = setInterval(() => {
      if (plan) void refreshPlan(plan.planId);
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, plan, refreshPlan]);

  const handleGenerate = useCallback(async () => {
    if (!query.trim()) {
      Toast.warning('请先输入任务描述');
      return;
    }
    setLoading(true);
    try {
      const created = await createPlan({ userInput: query.trim() });
      setPlan(created);
      onResult?.({ plan: created });
    } finally {
      setLoading(false);
    }
  }, [query, onResult]);

  const handleApprove = useCallback(
    async (stepId: string) => {
      if (!plan) return;
      setActionLoading(`approve:${stepId}`);
      try {
        const updated = await approveStep(plan.planId, stepId);
        setPlan(updated);
        onResult?.({ plan: updated });
      } finally {
        setActionLoading(null);
      }
    },
    [plan, onResult],
  );

  const handleSkip = useCallback(
    async (stepId: string) => {
      if (!plan) return;
      setActionLoading(`skip:${stepId}`);
      try {
        const updated = await skipStep(plan.planId, stepId);
        setPlan(updated);
        onResult?.({ plan: updated });
      } finally {
        setActionLoading(null);
      }
    },
    [plan, onResult],
  );

  const handleExecute = useCallback(async () => {
    if (!plan) return;
    setActionLoading('execute');
    setPolling(true);
    try {
      const updated = await executePlan(plan.planId);
      setPlan(updated);
      onResult?.({ plan: updated });
      if (updated.status === 'completed' || updated.status === 'failed') {
        setPolling(false);
      }
    } catch {
      setPolling(false);
    } finally {
      setActionLoading(null);
    }
  }, [plan, onResult]);

  const planStatusMeta = plan ? PLAN_STATUS_META[plan.status] : null;

  const hasApprovableStep = useMemo(() => {
    if (!plan) return false;
    return plan.steps.some((s) => s.status === 'pending' && s.requiresApproval);
  }, [plan]);

  const canExecute = useMemo(() => {
    if (!plan) return false;
    return plan.status === 'ready' || plan.status === 'running';
  }, [plan]);

  const renderStepActions = (step: PlanStep) => {
    if (!plan) return null;
    const isFinished = ['completed', 'skipped', 'failed'].includes(step.status);
    if (isFinished) return null;
    const approveLoading = actionLoading === `approve:${step.stepId}`;
    const skipLoading = actionLoading === `skip:${step.stepId}`;

    return (
      <Space spacing="tight">
        {step.status === 'pending' && step.requiresApproval && (
          <Tooltip content="批准执行此步骤">
            <Button
              size="small"
              theme="borderless"
              icon={<CheckOutlined />}
              loading={approveLoading}
              onClick={() => handleApprove(step.stepId)}
              data-testid={`approve-${step.stepId}`}
            >
              批准
            </Button>
          </Tooltip>
        )}
        {step.status === 'pending' && (
          <Popconfirm
            title="确定跳过此步骤？"
            onConfirm={() => handleSkip(step.stepId)}
            okText="跳过"
            cancelText="取消"
          >
            <Tooltip content="跳过此步骤">
              <Button
                size="small"
                theme="borderless"
                type="danger"
                icon={<SwapOutlined />}
                loading={skipLoading}
                data-testid={`skip-${step.stepId}`}
              >
                跳过
              </Button>
            </Tooltip>
          </Popconfirm>
        )}
        {step.status === 'running' && (
          <Tag color="blue">
            <LoadingOutlined style={{ marginRight: 4 }} />执行中
          </Tag>
        )}
      </Space>
    );
  };

  return (
    <Card
      style={{ marginBottom: 8 }}
      title={
        <Space>
          <ScheduleOutlined style={{ color: 'var(--primary)' }} />
          <Typography.Text strong>任务计划</Typography.Text>
          {plan && planStatusMeta && (
            <Tag color={planStatusMeta.color}>{planStatusMeta.label}</Tag>
          )}
          {plan && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              · {plan.title}
            </Typography.Text>
          )}
          {hasApprovableStep && (
            <Tag color="orange" style={{ fontSize: 11 }}>
              有待批准步骤
            </Tag>
          )}
        </Space>
      }
    >
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <TextArea
          value={query}
          onChange={(v) => onQueryChange(v)}
          placeholder="描述您的复杂任务，如：分析销售数据并生成周报"
          rows={2}
        />
        <Space>
          <Button
            theme="solid"
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={handleGenerate}
            disabled={!query.trim()}
          >
            生成计划
          </Button>
          {plan && (
            <Button
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={actionLoading === 'execute'}
              disabled={!canExecute}
            >
              {plan.status === 'running' ? '继续执行' : '执行计划'}
            </Button>
          )}
        </Space>

        <Spin spinning={loading}>
          {!plan ? (
            <Empty
              description={
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  输入复杂任务后点击「生成计划」，Agent 将自主分解步骤
                </span>
              }
            />
          ) : (
            <Space vertical spacing="tight" style={{ width: '100%' }}>
              <Banner
                type="info"
                title={plan.title}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {plan.description}（共 {plan.steps.length} 步）
                  </Typography.Text>
                }
                style={{ padding: '6px 12px' }}
              />

              <div style={{ padding: '8px 0' }}>{stepsToSemiSteps(plan)}</div>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  步骤详情：
                </Typography.Text>
                <Timeline style={{ marginTop: 8 }}>
                  {stepsToTimelineItems(plan.steps).map((item) => (
                    <Timeline.Item
                      key={item.key}
                      dot={item.dot}
                      color={item.color}
                    >
                      <div>
                        {item.children as React.ReactNode}
                        <div style={{ marginTop: 4 }}>
                          {renderStepActions(
                            plan.steps.find(
                              (s) => s.stepId === item.key,
                            ) as PlanStep,
                          )}
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>

              {plan.status === 'running' && (
                <Tag color="blue">
                  <LoadingOutlined style={{ marginRight: 4 }} />正在执行…
                </Tag>
              )}
            </Space>
          )}
        </Spin>
      </Space>
    </Card>
  );
}
