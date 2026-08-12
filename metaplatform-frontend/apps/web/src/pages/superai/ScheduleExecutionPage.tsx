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
  Toast,
} from '@douyinfe/semi-ui';
import { PlayCircleOutlined } from '@ant-design/icons';
import { startExecution } from '@/api/superai/schedule';
import type { ScheduleExecution } from '@/api/superai/schedule';

export default function ScheduleExecutionPage() {
  const [form] = Form.useForm();
  const [exec, setExec] = useState<ScheduleExecution | null>(null);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    const planId = String(form.getValues().planId ?? '');
    if (!planId.trim()) {
      Toast.warning('请输入 Plan ID');
      return;
    }
    setRunning(true);
    try {
      const e = await startExecution(planId);
      setExec(e);
      Toast.success('已启动');
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
      <Typography.Title heading={4}>执行面板</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form}>
          <Form.Input
            field="planId"
            label="Plan ID"
            initValue=""
            placeholder="请输入 Plan ID"
          />
          <Button
            theme="solid"
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
          <Space vertical style={{ width: '100%' }}>
            <Tag color={exec.status === 'completed' ? 'green' : 'blue'}>{exec.status}</Tag>
            <Progress
              percent={Math.round(exec.progress)}
              stroke={exec.status === 'completed' ? 'var(--success)' : undefined}
            />
          </Space>
        </Card>
      ) : (
        <Empty description="启动后查看实时进度" />
      )}
    </div>
  );
}
