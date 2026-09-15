import { useCallback, useState } from 'react';
import { Banner, Button, Card, Input, Steps, Tag, Toast } from '@douyinfe/semi-ui';
import { Sparkles } from 'lucide-react';
import { detectIntent, generatePlan } from '@/api/superai/schedule';
import { EmptyState, PageHeader } from '@/components/skeleton';

interface PlanStepView {
  key: string;
  name: string;
  employeeId?: string;
  tool?: string;
  estimatedDuration?: number;
}

interface PlanView {
  planId: string;
  steps: PlanStepView[];
  totalEstimatedDuration?: number;
  parallelGroups?: Array<{ groupId: string; stepIds: string[] }>;
  /** true = 后端给的是 stub 形状（steps 为字符串 / 无 planId） */
  isStub: boolean;
}

interface RawPlan {
  planId?: string;
  id?: string;
  steps?: Array<string | { id?: string; stepId?: string; name?: string; title?: string; employeeId?: string; tool?: string; estimatedDuration?: number }>;
  totalEstimatedDuration?: number;
  parallelGroups?: Array<{ groupId: string; stepIds: string[] }>;
}

function normalize(raw: RawPlan): PlanView {
  const steps = raw.steps ?? [];
  return {
    planId: raw.planId ?? raw.id ?? '—',
    totalEstimatedDuration: raw.totalEstimatedDuration,
    parallelGroups: raw.parallelGroups,
    isStub: !raw.planId || steps.some((s) => typeof s === 'string'),
    steps: steps.map((s, i) =>
      typeof s === 'string'
        ? { key: `step-${i}`, name: s }
        : {
            key: s.id ?? s.stepId ?? `step-${i}`,
            name: s.name ?? s.title ?? '未命名步骤',
            employeeId: s.employeeId,
            tool: s.tool,
            estimatedDuration: s.estimatedDuration,
          },
    ),
  };
}

/**
 * SuperAI · 调度计划卡片。
 *
 * 原页用写死的 demo ExecutionPlan 渲染卡片（伪造数据 + 静态示例页脚），已删除。
 * 真实可走的链路是 detect→generate（与执行计划页一致），这里复用：
 * 输入意图 → detectIntent → generatePlan → 按后端返回渲染计划卡；stub 形状如实标注。
 */
export default function SchedulePlanCardPage() {
  const [intent, setIntent] = useState('');
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(async () => {
    const text = intent.trim();
    if (!text) {
      Toast.warning('先描述一下要做什么');
      return;
    }
    setBusy(true);
    try {
      const intentRes = (await detectIntent(text)) as unknown as { intentId?: string; intent?: string };
      const intentId = intentRes.intentId ?? intentRes.intent ?? text;
      const raw = (await generatePlan(intentId)) as unknown as RawPlan;
      setPlan(normalize(raw));
      Toast.success('已生成计划卡');
    } catch (e) {
      setPlan(null);
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [intent]);

  return (
    <>
      <PageHeader title="调度计划卡片" desc="输入意图生成计划卡，按后端真实步骤渲染" />

      <Card title="生成计划卡">
        <div className="mp-exec-intent">
          <div className="mp-exec-intent-input">
            <Input
              value={intent}
              onChange={setIntent}
              placeholder="例如：汇总本月销售数据并发送邮件"
              onEnterPress={() => void generate()}
            />
          </div>
          <Button
            theme="solid"
            type="primary"
            icon={<Sparkles size={15} strokeWidth={1.5} />}
            loading={busy}
            onClick={() => void generate()}
          >
            生成计划卡
          </Button>
        </div>
      </Card>

      {plan ? (
        <>
          {plan.isStub ? (
            <Banner
              type="info"
              closeIcon={null}
              description="当前 copilot 服务是 stub 实现：返回的步骤是字符串数组，没有逐步骤的员工 / 工具 / 预计耗时字段。本卡只如实展示拿到的步骤名。"
            />
          ) : null}

          <Card
            title={`计划 #${plan.planId}`}
            headerExtraContent={
              <span className="mp-exec-chips">
                <Tag type="light" color="blue">
                  {(plan.parallelGroups?.length ?? 0) > 0 ? '混合' : '顺序'}
                </Tag>
                {typeof plan.totalEstimatedDuration === 'number' ? (
                  <Tag type="light">预计耗时 {plan.totalEstimatedDuration}s</Tag>
                ) : null}
                <Tag type="light">{plan.steps.length} 步</Tag>
              </span>
            }
          >
            {plan.steps.length === 0 ? (
              <EmptyState illustration="no-content" title="该计划没有步骤" desc="后端返回的计划里没有步骤信息。" />
            ) : (
              <Steps direction="vertical" size="small" type="basic" current={-1}>
                {plan.steps.map((s) => (
                  <Steps.Step
                    key={s.key}
                    title={<><span className="mp-exec-step-title">{s.name}</span></>}
                    description={
                      <span className="mp-exec-chips">
                        {s.employeeId ? (
                          <Tag type="light" color="purple">
                            {s.employeeId}
                          </Tag>
                        ) : null}
                        {s.tool ? (
                          <Tag type="light" color="cyan">
                            {s.tool}
                          </Tag>
                        ) : null}
                        {typeof s.estimatedDuration === 'number' ? (
                          <Tag type="light">{s.estimatedDuration}s</Tag>
                        ) : null}
                      </span>
                    }
                  />
                ))}
              </Steps>
            )}
          </Card>
        </>
      ) : (
        <EmptyState
          illustration="idle"
          title="还没有计划卡"
          desc="在上方描述一个意图，生成第一张计划卡。"
        />
      )}
    </>
  );
}
