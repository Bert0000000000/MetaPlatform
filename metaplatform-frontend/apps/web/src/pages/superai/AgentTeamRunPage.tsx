import { useCallback, useState } from 'react';
import { Banner, Button, Card, Input, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { CheckCircle2, Play, ShieldCheck } from 'lucide-react';
import { approveRun, getRun, startRun, type RunState } from '@/api/agentTeam';
import { EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · Agent 产品层（超级大脑 + 数字员工）。
 *
 * 一条主链：一句话 → 任务图 → 并行派给多个数字员工 → 真实执行 →
 * 停在人工确认闸门 → 确认后汇总。
 *
 * 只做读：所有状态都来自后端 run 状态，前端不拼装、不伪造产出。
 * 员工产出与其"是否真的跑过"（source / llm_calls / 工具调用）一并展示，
 * 避免把"派活返回假回执"当成成功。
 */

const STATUS_TAG: Record<RunState['status'], { color: 'grey' | 'blue' | 'amber' | 'green' | 'red'; label: string }> = {
  planning: { color: 'grey', label: '拆解中' },
  running: { color: 'blue', label: '执行中' },
  awaiting_approval: { color: 'amber', label: '等待人工确认' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
};

export default function AgentTeamRunPage() {
  const [goal, setGoal] = useState('把本月的异常订单找出来，逐个分析原因，给我一份汇总');
  const [run, setRun] = useState<RunState | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (fn: () => Promise<RunState>, failMsg: string) => {
    setBusy(true);
    try {
      setRun(await fn());
    } catch (e) {
      Toast.error(`${failMsg}：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const status = run ? STATUS_TAG[run.status] : null;

  return (
    <>
      <PageHeader
        title="Agent 产品层"
        desc="超级大脑拆任务图 → 并行派给数字员工 → 真实执行 → 人工确认 → 汇总"
      />

      <Card title="① 一句话">
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={goal} onChange={setGoal} placeholder="要做什么？" />
          <Button
            theme="solid"
            icon={<Play size={14} />}
            loading={busy}
            disabled={!goal.trim()}
            onClick={() => call(() => startRun(goal.trim()), '提交失败')}
          >
            拆解并派活
          </Button>
        </div>
      </Card>

      {run?.error ? (
        <Banner type="danger" description={run.error} closeIcon={null} style={{ marginTop: 16 }} />
      ) : null}

      {run ? (
        <Card
          title="② 任务图"
          style={{ marginTop: 16 }}
          headerExtraContent={
            status ? (
              <Tag color={status.color} type="light">
                {status.label}
              </Tag>
            ) : null
          }
        >
          <Typography.Text type="tertiary">run_id：{run.run_id}（租户 {run.tenant_id}）</Typography.Text>
          <Table
            style={{ marginTop: 12 }}
            pagination={false}
            size="small"
            rowKey="task_id"
            dataSource={run.subtasks}
            columns={[
              { title: '子任务', dataIndex: 'task_id', width: 90 },
              {
                title: '承接员工',
                dataIndex: 'profile_id',
                width: 160,
                render: (v: string) => <Tag color="blue">{v}</Tag>,
              },
              { title: '指令', dataIndex: 'instruction' },
            ]}
          />
        </Card>
      ) : null}

      {run && run.status === 'awaiting_approval' ? (
        <Card title="③ 人工确认" style={{ marginTop: 16 }}>
          <Banner
            type="warning"
            icon={<ShieldCheck size={16} />}
            description={run.hitl_reason || '员工已产出，等待人工确认后汇总'}
            closeIcon={null}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button
              theme="solid"
              icon={<CheckCircle2 size={14} />}
              loading={busy}
              onClick={() =>
                call(() => approveRun(run.run_id, true), '确认失败').then(() =>
                  getRun(run.run_id).then(setRun).catch(() => undefined),
                )
              }
            >
              确认并继续
            </Button>
            <Button
              type="danger"
              loading={busy}
              onClick={() => call(() => approveRun(run.run_id, false), '驳回失败')}
            >
              驳回
            </Button>
          </div>
        </Card>
      ) : null}

      {run && Object.keys(run.results).length > 0 ? (
        <Card title="④ 各员工状态与产出" style={{ marginTop: 16 }}>
          {Object.values(run.results).map((r) => (
            <Card
              key={r.task_id}
              style={{ marginBottom: 12 }}
              title={
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <Tag color="blue">{r.profile_id}</Tag>
                  <Tag color={r.status === 'ok' ? 'green' : 'red'} type="light">
                    {r.status}
                  </Tag>
                  <Typography.Text type="tertiary">
                    模型调用 {r.llm_calls} 次 · 来源 {r.source}
                  </Typography.Text>
                </span>
              }
            >
              {r.tool_calls.length > 0 ? (
                <div style={{ marginBottom: 8 }}>
                  {r.tool_calls.map((c, i) => (
                    <Tag
                      key={i}
                      size="small"
                      color={c.allowed === false ? 'red' : 'grey'}
                      type="light"
                      style={{ marginRight: 6 }}
                    >
                      {String(c.name)}
                      {c.allowed === false ? `（拒绝：${String(c.rejected)}）` : ''}
                    </Tag>
                  ))}
                </div>
              ) : null}
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {r.output || r.error || '（无产出）'}
              </Typography.Paragraph>
            </Card>
          ))}
        </Card>
      ) : null}

      {run?.summary ? (
        <Card title="⑤ 汇总" style={{ marginTop: 16 }}>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {run.summary}
          </Typography.Paragraph>
        </Card>
      ) : null}

      {!run ? (
        <EmptyState
          title="还没有运行"
          description="在上面输入一句话，点「拆解并派活」即可看到任务图与各员工产出。"
        />
      ) : null}
    </>
  );
}
