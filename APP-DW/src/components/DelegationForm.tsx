import { useState } from 'react';
import { Form, Input, Modal, Space, Tag, message } from 'antd';
import { delegateTask } from '@/api/a2a';
import type { ExternalAgent } from '@/api/a2a';

interface DelegationFormProps {
  open: boolean;
  agent: ExternalAgent;
  onCancel: () => void;
}

export default function DelegationForm({ open, agent, onCancel }: DelegationFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      try {
        if (v.payload) payload['data'] = JSON.parse(v.payload);
      } catch {
        message.warning('payload 不是合法 JSON');
        return;
      }
      const res = await delegateTask(agent.agentId, v.task, payload);
      if (res.status === 'completed') {
        message.success(`外部 Agent 已返回结果`);
        form.resetFields();
        onCancel();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`委托任务 - ${agent.name}`}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnClose
      width={640}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="外部 Agent 能力">
          <Space wrap>
            {agent.capabilities.map((c) => (
              <Tag key={c} color="blue">{c}</Tag>
            ))}
          </Space>
        </Form.Item>
        <Form.Item name="task" label="任务描述" rules={[{ required: true }]}>
          <Input.TextArea rows={3} placeholder="详细描述要外部 Agent 完成的任务..." />
        </Form.Item>
        <Form.Item
          name="payload"
          label="附加数据 (JSON)"
          extra="提供给外部 Agent 的初始数据"
        >
          <Input.TextArea
            rows={4}
            placeholder='{"key": "value"}'
            style={{ fontFamily: 'Menlo, Consolas, monospace' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
