import { useEffect, useState } from 'react';
import { Card, Empty, Progress, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface ExecutionRecord {
  execId: string;
  target: string;
  status: 'running' | 'success' | 'failed' | 'queued';
  progress: number;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  errorMessage?: string;
}

const STORAGE_KEY = 'ontstudio_executions';

function load(): ExecutionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const sample: ExecutionRecord[] = Array.from({ length: 8 }).map((_, i) => ({
      execId: `exec_${i + 1}`,
      target: ['action_run', 'flow_trigger', 'sync_data'][i % 3]!,
      status: (['running', 'success', 'failed', 'queued'] as const)[i % 4]!,
      progress: [40, 100, 25, 100, 80, 100, 50, 0][i]!,
      startedAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
      finishedAt: i % 2 === 0 ? new Date(Date.now() - i * 3600 * 1000 + 60000).toISOString() : undefined,
      duration: i % 2 === 0 ? 60 + Math.floor(Math.random() * 60) : undefined,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
    return sample;
  }
  try {
    return JSON.parse(raw) as ExecutionRecord[];
  } catch {
    return [];
  }
}

const STATUS_COLOR: Record<ExecutionRecord['status'], string> = {
  running: 'blue',
  success: 'green',
  failed: 'red',
  queued: 'default',
};

export default function ExecutionMonitorPage() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);

  useEffect(() => {
    setExecutions(load());
    const interval = setInterval(() => setExecutions(load()), 5000);
    return () => clearInterval(interval);
  }, []);

  const columns: ColumnsType<ExecutionRecord> = [
    { title: 'ID', dataIndex: 'execId' },
    { title: '目标', dataIndex: 'target' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v as ExecutionRecord['status']]}>{v}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      render: (v: number, r) => (
        <Progress
          percent={v}
          size="small"
          status={
            r.status === 'failed'
              ? 'exception'
              : r.status === 'success'
                ? 'success'
                : r.status === 'running'
                  ? 'active'
                  : 'normal'
          }
        />
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      render: (v) => (v ? `${v}s` : '-'),
    },
    {
      title: '开始',
      dataIndex: 'startedAt',
      render: (v) => new Date(v).toLocaleString(),
    },
  ];

  const running = executions.filter((e) => e.status === 'running').length;

  return (
    <div>
      <Typography.Title level={4}>执行监控</Typography.Title>

      <Space size="large" style={{ marginBottom: 16 }}>
        <Card size="small">
          <Typography.Text>正在运行：</Typography.Text>
          <Tag color="blue">{running}</Tag>
        </Card>
        <Card size="small">
          <Typography.Text>今日执行：</Typography.Text>
          <Tag>{executions.length}</Tag>
        </Card>
        <Card size="small">
          <Typography.Text>成功率：</Typography.Text>
          <Tag color="green">
            {Math.round(
              (executions.filter((e) => e.status === 'success').length /
                Math.max(1, executions.length)) *
                100,
            )}
            %
          </Tag>
        </Card>
      </Space>

      <Card>
        {executions.length === 0 ? (
          <Empty description="暂无执行记录" />
        ) : (
          <Table rowKey="execId" dataSource={executions} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>
    </div>
  );
}
