import { useEffect, useState } from 'react';
import { Card, Empty, Progress, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';

interface SubStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  duration?: number;
}

const MOCK_STEPS: SubStep[] = [
  { id: 's1', name: '数据查询', status: 'completed', progress: 100, duration: 12 },
  { id: 's2', name: '数据分析', status: 'running', progress: 65, duration: 45 },
  { id: 's3', name: '汇总汇总', status: 'pending', progress: 0 },
];

export default function ParallelExecutionPage() {
  const [steps, setSteps] = useState(MOCK_STEPS);

  useEffect(() => {
    const id = setInterval(() => {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.status === 'running') {
            const p = Math.min(100, s.progress + Math.random() * 10);
            return { ...s, progress: p, status: p >= 100 ? 'completed' : 'running' };
          }
          return s;
        }),
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const COLOR: Record<SubStep['status'], TagColor> = {
    pending: 'grey',
    running: 'blue',
    completed: 'green',
    failed: 'red',
  };

  return (
    <div>
      <Typography.Title heading={4}>并行执行监控</Typography.Title>
      <Card>
        {steps.length === 0 ? (
          <Empty />
        ) : (
          <Space vertical spacing="medium" style={{ width: '100%' }}>
            {steps.map((s) => (
              <Card key={s.id} title={s.name}>
                <Space vertical style={{ width: '100%' }}>
                  <Space>
                    <Tag color={COLOR[s.status]}>{s.status}</Tag>
                    {s.duration && <Tag>耗时 {s.duration}s</Tag>}
                  </Space>
                  <Progress
                    percent={Math.round(s.progress)}
                    stroke={s.status === 'completed' ? 'var(--success)' : undefined}
                  />
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
}
