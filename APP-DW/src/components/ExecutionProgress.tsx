import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Card, Progress, Space, Tag, Typography } from 'antd';
import type { EmployeeTask } from '@/types';

interface ExecutionProgressProps {
  task: EmployeeTask;
}

export default function ExecutionProgress({ task }: ExecutionProgressProps) {
  const [progress, setProgress] = useState(task.progress || 0);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date(task.createdAt).toLocaleTimeString()}] 任务已创建`,
    `[${new Date().toLocaleTimeString()}] 任务开始执行`,
  ]);

  useEffect(() => {
    setProgress(task.progress || 0);
  }, [task.progress]);

  useEffect(() => {
    if (task.status !== 'running') return;
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.random() * 5));
      setLogs((l) => [
        `[${new Date().toLocaleTimeString()}] ${randomLog()}`,
        ...l,
      ].slice(0, 20));
    }, 2000);
    return () => clearInterval(interval);
  }, [task.status]);

  return (
    <div>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>当前进度：{Math.round(progress)}%</Typography.Text>
          <Progress percent={Math.round(progress)} status={progress >= 100 ? 'success' : 'active'} />
          <Typography.Text strong>实时日志：</Typography.Text>
          <Card type="inner" size="small">
            <pre style={codeStyle}>
              {logs.join('\n')}
            </pre>
          </Card>
        </Space>
      </Card>
    </div>
  );
}

function randomLog(): string {
  const samples = [
    '读取知识库 ...',
    '调用工具 query_database ...',
    '已生成 SQL 并执行 (rows: 12)',
    '正在总结输出 ...',
    '调用 Action ' + (['send_email', 'create_record'][Math.floor(Math.random() * 2)]),
    '已完成步骤，等待用户确认',
  ];
  return samples[Math.floor(Math.random() * samples.length)]!;
}

const codeStyle: CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 240,
  overflow: 'auto',
  margin: 0,
};
