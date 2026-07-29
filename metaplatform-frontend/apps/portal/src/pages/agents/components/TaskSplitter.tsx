import { Card, Form, Input, Select, Button, Space } from 'antd';
import { useState } from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';

interface TaskSplitterProps {
  onSubTasksGenerated: (subTasks: Array<{ title: string; assignee: string }>) => void;
}

export default function TaskSplitter({ onSubTasksGenerated }: TaskSplitterProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const subs = v.strategy === 'parallel'
        ? [
            { title: '数据采集 - 模块 A', assignee: '员工 A' },
            { title: '数据分析 - 模块 B', assignee: '员工 B' },
            { title: '报告汇总 - 模块 C', assignee: '员工 C' },
          ]
        : [
            { title: '前置准备', assignee: '员工 A' },
            { title: '主流程 - Part 1', assignee: '员工 B' },
            { title: '主流程 - Part 2', assignee: '员工 C' },
            { title: '收尾', assignee: '员工 A' },
          ];
      onSubTasksGenerated(subs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="任务拆分">
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
          <Input placeholder="例如：季度复盘报告" />
        </Form.Item>
        <Form.Item name="description" label="任务描述">
          <Input.TextArea rows={3} placeholder="任务的背景、目标、产出" />
        </Form.Item>
        <Form.Item name="strategy" label="拆分策略" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '并行执行', value: 'parallel' },
              { label: '顺序执行', value: 'sequential' },
              { label: '混合模式', value: 'hybrid' },
            ]}
          />
        </Form.Item>
        <Form.Item name="count" label="子任务数量">
          <Input placeholder="AI 会根据策略自动拆分" disabled />
        </Form.Item>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleGenerate}
          >
            AI 拆分
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
