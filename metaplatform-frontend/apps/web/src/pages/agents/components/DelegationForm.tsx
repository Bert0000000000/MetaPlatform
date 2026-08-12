import { useState } from 'react';
import { Form, Modal, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { createDelegation } from '@/api/dw/a2a';
import type { Delegation, ExternalAgent } from '@/api/dw/a2a';

interface DelegationFormProps {
  open: boolean;
  agent: ExternalAgent;
  onCancel: () => void;
  onSuccess?: (delegation: Delegation) => void;
}

export default function DelegationForm({ open, agent, onCancel, onSuccess }: DelegationFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const v = await form.validate();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { task: v.task };
      try {
        if (v.payload) payload['data'] = JSON.parse(v.payload);
      } catch {
        Toast.warning('payload 不是合法 JSON');
        return;
      }
      const res = await createDelegation({
        sourceAgentId: 'app-dw',
        targetAgentId: agent.agentId,
        taskType: 'a2a-delegation',
        payload,
      });
      Toast.success('外部委托已提交');
      form.reset();
      onSuccess?.(res);
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`委托任务 - ${agent.name}`}
      visible={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      keepDOM={false}
      width={640}
    >
      <Form form={form}>
        <Form.Slot label="外部 Agent 能力">
          <Space wrap>
            {agent.capabilities.map((c) => (
              <Tag key={c} color="blue">{c}</Tag>
            ))}
          </Space>
        </Form.Slot>
        <Form.TextArea
          field="task"
          label="任务目标"
          rules={[{ required: true }]}
          rows={3}
          placeholder="详细描述要外部 Agent 完成的任务..."
        />
        <Form.TextArea
          field="payload"
          label="附加数据 (JSON)"
          extraText="提供给外部 Agent 的初始数据"
          rows={4}
          placeholder='{"key": "value"}'
          style={{ fontFamily: 'Menlo, Consolas, monospace' }}
        />
      </Form>
    </Modal>
  );
}
