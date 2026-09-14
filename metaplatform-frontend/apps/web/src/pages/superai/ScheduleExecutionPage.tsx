import { useCallback, useMemo, useState } from 'react';
import { Button, Card, Input, Progress, Tag, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlayCircle } from 'lucide-react';
import { startExecution, type ScheduleExecution, type SubTaskResult } from '@/api/superai/schedule';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

const STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  partial: '部分完成',
  failed: '失败',
  skipped: '已跳过',
};

/**
 * SuperAI · 执行面板。
 *
 * 数据面沿用 src/api/superai/schedule：startExecution（POST /scheduling/execution/start）。
 * 原页用 setInterval 随机递增进度是伪造的，已删除；这里只显示后端返回的真实
 * status/progress/results，没有轮询接口就不假装实时推进。
 */
export default function ScheduleExecutionPage() {
  const [planId, setPlanId] = useState('');
  const [exec, setExec] = useState<ScheduleExecution | null>(null);
  const [running, setRunning] = useState(false);

  const handleStart = useCallback(async () => {
    const id = planId.trim();
    if (!id) {
      Toast.warning('请输入 Plan ID');
      return;
    }
    setRunning(true);
    try {
      const e = await startExecution(id);
      setExec(e);
      Toast.success('已启动');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [planId]);

  const columns: ColumnProps<SubTaskResult>[] = useMemo(
    () => [
      { title: '步骤', dataIndex: 'stepId', width: 160, ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string) => <Tag type="light">{STATUS_LABEL[v] ?? v}</Tag>,
      },
      {
        title: '耗时',
        dataIndex: 'duration',
        width: 100,
        render: (v?: number) => (typeof v === 'number' ? `${v}ms` : '—'),
      },
      { title: '输出', dataIndex: 'output', ellipsis: true, render: (v?: string) => v || '—' },
      {
        title: '错误',
        dataIndex: 'errorMessage',
        ellipsis: true,
        render: (v?: string) => v || '—',
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="执行面板" desc="按 Plan ID 启动一次调度执行，查看后端返回的真实状态与子任务结果" />

      <Card title="启动执行">
        <div className="mp-exec-intent">
          <div className="mp-exec-intent-input">
            <Input
              value={planId}
              onChange={setPlanId}
              placeholder="请输入 Plan ID"
              onEnterPress={() => void handleStart()}
            />
          </div>
          <Button
            theme="solid"
            type="primary"
            icon={<PlayCircle size={15} strokeWidth={1.5} />}
            loading={running}
            onClick={() => void handleStart()}
          >
            开始执行
          </Button>
        </div>
      </Card>

      {exec ? (
        <>
          <div className="mp-exec-kpis">
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">执行 ID</span>
                <span className="mp-exec-kpi-value">{exec.executionId}</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">状态</span>
                <span className="mp-exec-kpi-state">
                  <span
                    className={`mp-exec-dot ${
                      exec.status === 'running'
                        ? 'is-running'
                        : exec.status === 'completed'
                          ? 'is-done'
                          : exec.status === 'failed'
                            ? 'is-failed'
                            : ''
                    }`}
                  />
                  {STATUS_LABEL[exec.status] ?? exec.status}
                </span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">进度</span>
                <span className="mp-exec-kpi-value">{Math.round(exec.progress ?? 0)}%</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">子任务</span>
                <span className="mp-exec-kpi-value">{exec.results?.length ?? 0}</span>
              </div>
            </Card>
          </div>

          {typeof exec.progress === 'number' ? (
            <Card title="进度">
              <Progress
                percent={Math.round(exec.progress)}
                stroke={exec.status === 'completed' ? 'var(--semi-color-success)' : undefined}
              />
            </Card>
          ) : null}

          <Card title="子任务结果">
            <DataTablePro<SubTaskResult>
              columns={columns}
              dataSource={exec.results ?? []}
              rowKey="resultId"
              empty={
                <EmptyState
                  illustration="no-content"
                  title="暂无子任务结果"
                  desc="后端未返回 results，或该执行还没有产生子任务。"
                />
              }
            />
          </Card>

          {exec.finalReport ? (
            <Card title="最终报告">
              {exec.finalReport.split('\n').map((line, i) => (
                <div key={i}>
                  <span className="mp-exec-step-body">{line.length > 0 ? line : ' '}</span>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          illustration="idle"
          title="启动后查看实时进度"
          desc="输入 Plan ID 并开始执行，进度与子任务结果会按后端真实返回呈现。"
        />
      )}
    </>
  );
}
