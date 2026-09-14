import { Card, Descriptions, Progress } from '@douyinfe/semi-ui';
import type { EmployeeTask } from '@/api/dw/types';

interface ExecutionProgressProps {
  task: EmployeeTask;
}

function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

/**
 * 实时进度：只呈现任务记录里真实存在的字段（progress / 起止时间 / 结果）。
 * 平台没有任务日志流接口，因此不渲染任何模拟日志行。
 */
export default function ExecutionProgress({ task }: ExecutionProgressProps) {
  const percent = typeof task.progress === 'number' ? Math.round(task.progress) : 0;

  return (
    <Card title="实时进度">
      {/* Semi Progress 无 status prop：完成态用语义色，进行中走主题色 */}
      <Progress
        percent={percent}
        stroke={percent >= 100 ? 'var(--semi-color-success)' : undefined}
      />
      <Descriptions
        row
        data={[
          { key: '当前进度', value: `${percent}%` },
          { key: '开始时间', value: formatTime(task.startedAt) },
          { key: '完成时间', value: formatTime(task.completedAt) },
          { key: '执行结果', value: task.result || '—' },
        ]}
      />
    </Card>
  );
}
