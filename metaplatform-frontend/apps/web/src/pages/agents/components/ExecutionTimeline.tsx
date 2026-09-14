import { Card, Tag, Timeline } from '@douyinfe/semi-ui';
import type { EmployeeTask } from '@/api/dw/types';
import { EmptyState } from '@/components/skeleton';
import '../agents.css';

interface ExecutionTimelineProps {
  task: EmployeeTask;
}

type TagColorName = 'grey' | 'blue' | 'green' | 'red';

const STATUS_META: Record<string, { label: string; color: TagColorName }> = {
  pending: { label: '待处理', color: 'grey' },
  in_progress: { label: '运行中', color: 'blue' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  success: { label: '已完成', color: 'green' },
  done: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  error: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
};

function statusMeta(value: string): { label: string; color: TagColorName } {
  return STATUS_META[value] ?? { label: value, color: 'grey' };
}

/** Semi Timeline.Item 的 color 直接作为圆点背景色，取状态语义 token。 */
const DOT_COLOR: Record<TagColorName, string> = {
  green: 'var(--semi-color-success)',
  red: 'var(--semi-color-danger)',
  blue: 'var(--semi-color-primary)',
  grey: 'var(--semi-color-text-3)',
};

interface LifecycleEvent {
  key: string;
  name: string;
  at: string;
}

/**
 * 执行轨迹：由任务自身的生命周期时间戳派生（创建 → 开始 → 完成），是真实数据。
 * 平台没有逐步的 plan/tool/reflect 轨迹接口，故不编造步骤轨迹。
 */
export default function ExecutionTimeline({ task }: ExecutionTimelineProps) {
  const events: LifecycleEvent[] = [];
  if (task.createdAt) events.push({ key: 'created', name: '任务创建', at: task.createdAt });
  if (task.startedAt) events.push({ key: 'started', name: '开始执行', at: task.startedAt });
  if (task.completedAt) events.push({ key: 'completed', name: '执行结束', at: task.completedAt });

  const meta = statusMeta(task.status);

  if (events.length === 0) {
    return (
      <Card title={`执行轨迹 · ${task.title || task.id}`}>
        <EmptyState
          illustration="no-content"
          title="暂无轨迹时间戳"
          desc="该任务还没有创建/开始/完成时间记录。"
        />
      </Card>
    );
  }

  return (
    <Card title={`执行轨迹 · ${task.title || task.id}`}>
      <Timeline>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const color = isLast ? DOT_COLOR[meta.color] : DOT_COLOR.blue;
          return (
            <Timeline.Item key={event.key} color={color}>
              <div className="mp-agent-line">
                <span>
                  <span className="mp-agent-name">{event.name}</span>{' '}
                  <Tag color={isLast ? meta.color : 'blue'} type="light">
                    {isLast ? meta.label : '已记录'}
                  </Tag>
                </span>
                <span className="mp-agent-line-label">{new Date(event.at).toLocaleString()}</span>
              </div>
              {isLast && task.result ? (
                <div className="mp-agent-line">
                  <span className="mp-agent-line-label">结果</span>
                  <span>{task.result}</span>
                </div>
              ) : null}
            </Timeline.Item>
          );
        })}
      </Timeline>
    </Card>
  );
}
