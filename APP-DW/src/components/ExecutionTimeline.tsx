import { Card, Tag, Timeline, Typography } from 'antd';
import type { EmployeeTask } from '@/types';

interface ExecutionTimelineProps {
  task: EmployeeTask;
}

interface Step {
  id: string;
  name: string;
  status: 'completed' | 'current' | 'pending' | 'failed';
  timestamp: string;
  type: 'plan' | 'tool' | 'retrieve' | 'reflect' | 'finalize';
}

const MOCK_STEPS: Step[] = [
  { id: '1', name: '任务规划', status: 'completed', timestamp: new Date(Date.now() - 60000).toISOString(), type: 'plan' },
  { id: '2', name: '知识库检索', status: 'completed', timestamp: new Date(Date.now() - 50000).toISOString(), type: 'retrieve' },
  { id: '3', name: '工具调用: query_database', status: 'completed', timestamp: new Date(Date.now() - 40000).toISOString(), type: 'tool' },
  { id: '4', name: '反思重试 (修正 SQL)', status: 'current', timestamp: new Date(Date.now() - 30000).toISOString(), type: 'reflect' },
  { id: '5', name: '汇总输出', status: 'pending', timestamp: '', type: 'finalize' },
];

const STEP_TYPE_COLOR: Record<Step['type'], string> = {
  plan: 'blue',
  tool: 'purple',
  retrieve: 'cyan',
  reflect: 'orange',
  finalize: 'green',
};

export default function ExecutionTimeline({ task }: ExecutionTimelineProps) {
  return (
    <Card title={`执行轨迹 - ${task.title}`}>
      <Timeline
        items={MOCK_STEPS.map((s) => ({
          color:
            s.status === 'completed'
              ? 'green'
              : s.status === 'current'
                ? 'blue'
                : s.status === 'failed'
                  ? 'red'
                  : 'gray',
          children: (
            <div>
              <Typography.Text strong>{s.name}</Typography.Text>
              <div>
                <Tag color={STEP_TYPE_COLOR[s.type]}>{s.type}</Tag>
                <Tag color={
                  s.status === 'completed'
                    ? 'green'
                    : s.status === 'current'
                      ? 'blue'
                      : s.status === 'failed'
                        ? 'red'
                        : 'default'
                }>{s.status}</Tag>
                {s.timestamp && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {' '} {new Date(s.timestamp).toLocaleTimeString()}
                  </Typography.Text>
                )}
              </div>
            </div>
          ),
        }))}
      />
    </Card>
  );
}
