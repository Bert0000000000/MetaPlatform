import { Card, Form, Rate, Input, Button, Typography, message } from 'antd';
import { useState } from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';

interface QualityScoreFormProps {
  employeeId?: string;
}

export default function QualityScoreForm(_props: QualityScoreFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await form.validateFields();
      message.success('评分已保存');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="对话质量评分">
      <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
        <Form.Item name="dialogRound" label="对话 ID" rules={[{ required: true }]}>
          <Input placeholder="对话 ID" />
        </Form.Item>
        <Form.Item name="score" label="准确性" rules={[{ required: true }]}>
          <Rate />
        </Form.Item>
        <Form.Item name="helpfulness" label="有用性">
          <Rate />
        </Form.Item>
        <Form.Item name="compliance" label="安全性">
          <Rate />
        </Form.Item>
        <Form.Item name="comment" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            保存评分
          </Button>
        </Form.Item>
        <Typography.Paragraph type="secondary">
          评分会用于该数字员工的整体质量评估，并反馈给模型迭代训练。
        </Typography.Paragraph>
      </Form>
    </Card>
  );
}
