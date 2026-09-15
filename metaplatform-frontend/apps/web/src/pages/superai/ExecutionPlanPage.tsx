import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Button, Card, Input, Steps, Tag, Toast } from '@douyinfe/semi-ui';
import { RefreshCw, Sparkles } from 'lucide-react';
import { listPlans } from '@/api/superai/plans';
import { detectIntent, generatePlan } from '@/api/superai/schedule';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import './superai.css';

/**
 * SuperAI · 执行计划（DESIGN-SPEC §5 版式 D 的可用子集）。
 *
 * 后端现状（2026-09-14 实测，dev 的 copilot 服务为 stub）：
 *   GET  /copilot/plans                 → 200，行形状 {id, name, goal, steps: string[], status}
 *   GET  /copilot/plans/{id}            → 404（没有按 id 取详情）
 *   POST /copilot/plans                 → 405（不能从这里建计划）
 *   POST /copilot/plans/{id}/execute    → 404
 *   POST /copilot/plans/{id}/steps/{s}/approve → 404
 *   POST /copilot/scheduling/intent/detect + /scheduling/plan/generate → 200（stub 回显）
 *
 * 因此本页只呈现**确实拿得到**的东西：计划列表、计划状态、计划步骤名、以及
 * detect→generate 这条真实可走的生成链路。逐步骤状态/耗时/进度、执行与 HITL 确认
 * 因为对应接口不存在，这里不画——宁可少画，也不拿 stub 回显编出进度条和时间线。
 * 当后端补齐契约（plans.ts 里声明的 Plan/PlanStep）时，去掉 isStub 分支即可恢复完整 D 版式。
 */

/** 后端可能给「契约形状」也可能给「stub 形状」，统一读成展示模型。 */
interface PlanView {
  key: string;
  title: string;
  goal: string;
  status: string;
  stepNames: string[];
  /** true = 后端没给契约字段（逐步骤对象 / planId），说明当前是 stub 实现 */
  isStub: boolean;
}

interface RawPlan {
  planId?: string;
  id?: string;
  title?: string;
  name?: string;
  userInput?: string;
  goal?: string;
  status?: string;
  steps?: Array<string | { stepId?: string; title?: string; name?: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  ready: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已终止',
};

function normalize(raw: RawPlan, index: number): PlanView {
  const steps = raw.steps ?? [];
  const stepNames = steps.map((s) => (typeof s === 'string' ? s : (s.title ?? s.name ?? '未命名步骤')));
  return {
    key: raw.planId ?? raw.id ?? `plan-${index}`,
    title: raw.title ?? raw.name ?? '(未命名计划)',
    goal: raw.userInput ?? raw.goal ?? '',
    status: raw.status ?? 'draft',
    stepNames,
    isStub: !raw.planId || steps.some((s) => typeof s === 'string'),
  };
}

export default function ExecutionPlanPage() {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [selected, setSelected] = useState<PlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [intent, setIntent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPlans({ page: 1, pageSize: 50 });
      const raw = (res.items ?? []) as unknown as RawPlan[];
      setPlans(raw.map(normalize));
    } catch (e) {
      setPlans([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    const text = intent.trim();
    if (!text) {
      Toast.warning('先描述一下要做什么');
      return;
    }
    setBusy(true);
    try {
      // detect → generate 是本域当前唯一可走的真实链路
      const intentRes = (await detectIntent(text)) as unknown as {
        intentId?: string;
        intent?: string;
      };
      const intentId = intentRes.intentId ?? intentRes.intent ?? text;
      const plan = (await generatePlan(intentId)) as unknown as RawPlan;
      const view = normalize(plan, 0);
      setSelected({ ...view, goal: text });
      Toast.success('已生成计划');
      setIntent('');
      void load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '计划',
        dataIndex: 'title',
        width: 320,
        ellipsis: true,
        render: (_: unknown, row: PlanView) => (
          <span className="mp-home-agent-main">
            <span className="mp-home-agent-name">{row.title}</span>
            <span className="mp-home-agent-type">{row.goal || '—'}</span>
          </span>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string) => <Tag size="small" type="light">{STATUS_LABEL[v] ?? v}</Tag>,
      },
      {
        title: '步骤',
        dataIndex: 'stepNames',
        width: 90,
        render: (v: string[]) => v.length,
      },
      { title: '计划 ID', dataIndex: 'key', width: 220, ellipsis: true },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title={selected ? selected.title : '执行计划'}
        desc={
          selected
            ? `${selected.key}${selected.goal ? ` · 目标「${selected.goal}」` : ''}`
            : `${plans.length} 个计划 · 描述意图即可生成计划`
        }
        actions={
          <>
            {selected ? <Button onClick={() => setSelected(null)}>返回列表</Button> : null}
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
          </>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="执行计划加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : selected ? (
        <>
          {selected.isStub ? (
            <Banner
              type="info"
              closeIcon={null}
              description="当前 copilot 服务是 stub 实现：只提供计划列表与生成回显，逐步骤状态 / 耗时 / 执行与逐步确认接口尚未实现。本页因此只列出真实可得的计划步骤名，不显示进度与时间线。"
            />
          ) : null}

          <div className="mp-exec-kpis">
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">状态</span>
                <span className="mp-exec-kpi-state">
                  <span
                    className={`mp-exec-dot ${
                      selected.status === 'running'
                        ? 'is-running'
                        : selected.status === 'completed'
                          ? 'is-done'
                          : selected.status === 'failed'
                            ? 'is-failed'
                            : ''
                    }`}
                  />
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">计划步骤</span>
                <span className="mp-exec-kpi-value">{selected.stepNames.length}</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">计划 ID</span>
                <span className="mp-exec-kpi-value">{selected.key}</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">目标</span>
                <span className="mp-exec-kpi-value">{selected.goal || '—'}</span>
              </div>
            </Card>
          </div>

          <div className="mp-exec-grid">
            <div className="mp-exec-col">
              <Card title="计划步骤">
                {selected.stepNames.length === 0 ? (
                  <EmptyState
                    illustration="no-content"
                    title="该计划没有步骤"
                    desc="后端返回的计划里没有步骤信息。"
                  />
                ) : (
                  <Steps direction="vertical" current={-1}>
                    {selected.stepNames.map((name, i) => (
                      <Steps.Step
                        key={`${name}-${i}`}
                        title={<><span className="mp-exec-step-title">{name}</span></>}
                        description={
                          <span className="mp-exec-step-body">
                            第 {i + 1} 步 · 状态与耗时由后端逐步执行接口提供（当前不可得）
                          </span>
                        }
                      />
                    ))}
                  </Steps>
                )}
              </Card>
            </div>

            <div className="mp-exec-col">
              <Card title="编排信息">
                <div className="mp-exec-line">
                  <span className="mp-exec-line-label">计划 ID</span>
                  <span>{selected.key}</span>
                </div>
                <div className="mp-exec-line">
                  <span className="mp-exec-line-label">状态</span>
                  <span>{STATUS_LABEL[selected.status] ?? selected.status}</span>
                </div>
                <div className="mp-exec-line">
                  <span className="mp-exec-line-label">步骤数</span>
                  <span>{selected.stepNames.length}</span>
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          <Card title="描述意图，生成计划">
            <div className="mp-exec-intent">
              <div className="mp-exec-intent-input">
                <Input
                  value={intent}
                  onChange={setIntent}
                  placeholder="例如：分析华东区高价值客户流失风险并输出挽回方案"
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
                生成计划
              </Button>
            </div>
          </Card>

          <Card title="最近计划">
            <DataTablePro<PlanView>
              columns={columns}
              dataSource={plans}
              rowKey="key"
              loading={loading}
              onRow={(record) => ({ onClick: () => setSelected(record) })}
              empty={
                <EmptyState
                  illustration="no-content"
                  title="还没有执行计划"
                  desc="在上方描述一个意图，生成第一份计划。"
                />
              }
            />
          </Card>
        </>
      )}
    </>
  );
}
