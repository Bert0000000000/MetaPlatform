import { useState } from 'react';
import { Button, Card, Slider, Space, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import type { EmployeeTask } from '@/types';

interface ReplayPlayerProps {
  task: EmployeeTask;
}

interface Frame {
  time: number;
  title: string;
  content: string;
}

const MOCK_FRAMES: Frame[] = [
  { time: 0, title: '开始', content: '任务创建于 2026-07-17 10:00' },
  { time: 10, title: '任务规划', content: 'Agent 分析任务并生成执行计划 (5 步)' },
  { time: 25, title: '知识库检索', content: '从 kb-finance 检索到 12 篇相关文档' },
  { time: 50, title: 'SQL 生成与执行', content: '已执行 SELECT COUNT(*) FROM employees' },
  { time: 75, title: '反思', content: 'Agent 反思结果，确认数据准确' },
  { time: 100, title: '输出', content: '任务执行完成，已发送邮件' },
];

export default function ReplayPlayer({ task }: ReplayPlayerProps) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  const frame = MOCK_FRAMES[current] || MOCK_FRAMES[0]!;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const interval = setInterval(() => {
      setCurrent((c) => {
        if (c >= MOCK_FRAMES.length - 1) {
          clearInterval(interval);
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 1000);
  };

  return (
    <Card title={`任务重放 - ${task.title}`}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button
            icon={<StepBackwardOutlined />}
            disabled={current === 0}
            onClick={() => setCurrent(Math.max(0, current - 1))}
          />
          <Button
            type="primary"
            icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={togglePlay}
          >
            {playing ? '暂停' : '播放'}
          </Button>
          <Button
            icon={<StepForwardOutlined />}
            disabled={current >= MOCK_FRAMES.length - 1}
            onClick={() => setCurrent(Math.min(MOCK_FRAMES.length - 1, current + 1))}
          />
        </Space>
        <Slider
          value={current}
          min={0}
          max={MOCK_FRAMES.length - 1}
          onChange={(v) => setCurrent(v as number)}
          marks={{ 0: '0%', 100: '100%' }}
        />
        <Card type="inner" size="small">
          <Typography.Title level={5}>{frame!.title}</Typography.Title>
          <Typography.Paragraph>{frame!.content}</Typography.Paragraph>
        </Card>
      </Space>
    </Card>
  );
}
