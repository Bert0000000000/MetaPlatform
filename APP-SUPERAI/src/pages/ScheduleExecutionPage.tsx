import { useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Progress,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { startExecution } from '@/api/schedule';
import type { ScheduleExecution } from '@/api/schedule';

export default function ScheduleExecutionPage() {
  const [planId, setPlanId] = useState('');
  const [exec, setExec] = useState<ScheduleExecution | null>(null);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    if (!planId.trim()) {
      message.warning('请输入 Plan ID');
      return;
    }
    setRunning(true);
    try {
      const e = await startExecution(planId);
      setExec(e);
      message.success('已启动');
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setExec((cur) => cur ? { ...cur, progress: 100, status: 'completed' } : cur);
        } else {
          setExec((cur) => cur ? { ...cur, progress } : cur);
        }
      }, 1000);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>执行面板</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="Plan ID">
            <Input value={planId} onChange={(e) => setPlanId(e.target.value)} />
          </Form.Item>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={running}
            onClick={handleStart}
          >
            开始执行
          </Button>
        </Form>
      </Card>

      {exec ? (
        <Card title={`Execution #${exec.executionId}`}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Tag color={exec.status === 'completed' ? 'green' : 'blue'}>{exec.status}</Tag>
            <Progress percent={Math.round(exec.progress)} status={exec.status === 'completed' ? 'success' : 'active'} />
          </Space>
        </Card>
      ) : (
        <Empty description="启动后查看实时进度" />
      )}
    </div>
  );
}
