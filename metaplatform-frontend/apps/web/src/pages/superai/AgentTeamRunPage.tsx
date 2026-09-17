import { useCallback, useState } from 'react';
import { Card, Input, Toast } from '@douyinfe/semi-ui';
import { Play, RefreshCw } from 'lucide-react';
import { approveRun, cancelRun, newIdempotencyKey, startRun, type RunState } from '@/api/agentTeam';
import { EmptyState, PageHeader } from '@/components/skeleton';
import AgentTeamSchedule from './components/AgentTeamSchedule';
import { useAgentTeamRun } from './useAgentTeamRun';
import './superai.css';

/**
 * SuperAI · Agent 产品层**工作台**（超级大脑 + 数字员工）。
 *
 * 一条主链：一句话 → 任务图 → 并行派给多个数字员工 → 真实执行 → 停在人工
 * 确认闸门 → 确认后汇总。
 *
 * 页面本身只管**起一轮、订阅、控制**；调度可视化（任务图 / 员工状态 / 波次 /
 * 证据 / 交付物 / 终态）全在 `AgentTeamSchedule` 里——会话页用的是**同一个**
 * 组件，所以同一轮运行在两个页面上只有一种样子。
 *
 * **实时（1.7 任务 2）**：提交走受理制（立刻拿 run_id），之后**订阅事件流**
 * （`fetch` + `ReadableStream`，不用 `EventSource`——它带不了 `Authorization`）。
 * 流负责说"有推进了"，`GET /runs/{id}` 负责给"现在长什么样"。**没有轮询定时器**。
 */
export default function AgentTeamRunPage() {
  const [goal, setGoal] = useState('把本月的异常订单找出来，逐个分析原因，给我一份汇总');
  const [runId, setRunId] = useState('');
  const [busy, setBusy] = useState(false);

  const { run, setRun, live, refresh } = useAgentTeamRun(runId);

  const call = useCallback(
    async (fn: () => Promise<RunState>, failMsg: string) => {
      setBusy(true);
      try {
        const next = await fn();
        setRun(next);
        await refresh();
      } catch (e) {
        Toast.error(`${failMsg}：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [refresh, setRun],
  );

  /** 提交：受理制下这只是**一次受理**，不是"等结果"（1.7 任务 1）。 */
  const submit = useCallback(async () => {
    setBusy(true);
    try {
      // 带幂等键：网络层重试/超时重发不会多起一轮（后端按同键回同一轮）
      const accepted = await startRun(goal.trim(), 3, newIdempotencyKey());
      setRun(null);
      setRunId(accepted.run_id);
    } catch (e) {
      Toast.error(`提交失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [goal, setRun]);

  return (
    <>
      <PageHeader
        title="Agent 产品层 · 工作台"
        desc="超级大脑拆任务图 → 并行派给数字员工 → 真实执行 → 人工确认 → 汇总交付"
      />

      <Card title="① 一句话">
        <div className="mp-team-input">
          <Input value={goal} onChange={setGoal} placeholder="要做什么？" />
          <button
            type="button"
            className="mp-proposal-btn mp-proposal-btn--primary"
            disabled={busy || !goal.trim()}
            onClick={() => void submit()}
            data-testid="agent-team-start"
          >
            <Play size={14} />
            拆解并派活
          </button>
          {runId ? (
            <button
              type="button"
              className="mp-proposal-btn"
              onClick={() => void refresh()}
              data-testid="agent-team-refresh"
            >
              <RefreshCw size={14} />
              刷新
            </button>
          ) : null}
        </div>
      </Card>

      {run ? (
        <Card className="mp-team-gap" title="② 运行 · 调度 · 证据 · 交付">
          <AgentTeamSchedule
            run={run}
            runId={runId}
            live={live}
            busy={busy}
            onApprove={(approved) =>
              void call(() => approveRun(run.run_id, approved), approved ? '确认失败' : '驳回失败')
            }
            onCancel={() => void call(() => cancelRun(run.run_id), '取消失败')}
          />
        </Card>
      ) : null}

      {!run && !runId ? (
        <EmptyState
          title="还没有运行"
          desc="在上面输入一句话，点「拆解并派活」即可看到任务图、各员工证据与交付物。"
        />
      ) : null}

      {!run && runId ? (
        <EmptyState title="已受理" desc={`run_id：${runId} —— 正在取回这一轮的状态…`} />
      ) : null}
    </>
  );
}
