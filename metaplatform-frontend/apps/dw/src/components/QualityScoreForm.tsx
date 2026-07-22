import { Card, Form, Rate, Input, Button, Typography, message } from 'antd';
import { useState } from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';
import { scoreConversation } from '@/api/evaluations';
import type { ConversationRecord } from '@/api/evaluations';

interface QualityScoreFormProps {
  employeeId?: string;
  /** 评分成功后回调 */
  onSaved?: (record: ConversationRecord) => void;
}

interface ScoreFormValues {
  dialogRound: string;
  score: number;
  helpfulness: number;
  compliance: number;
  comment?: string;
}

/**
 * 手动对话质量评分表单。
 * 将准确性 / 有用性 / 合规性三项 Rate（1-5）取平均并归一化到 0-1，
 * 调用 scoreConversation 持久化，成功后触发 onSaved 回调。
 */
export default function QualityScoreForm({ onSaved }: QualityScoreFormProps) {
  const [form] = Form.useForm<ScoreFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      // 三维度 Rate（1-5）取平均，归一化到 0-1 以匹配后端 qualityScore 量纲
      const avg =
        (values.score + values.helpfulness + values.compliance) / 3 / 5;
      const normalized = Math.max(0, Math.min(1, avg));
      const record = await scoreConversation(
        values.dialogRound,
        normalized,
        'admin',
      );
      message.success(`评分已保存（${(normalized * 100).toFixed(0)}/100）`);
      onSaved?.(record);
      form.resetFields();
    } catch {
      // 校验失败：Form.Item 自带字段提示；API 失败：axios 拦截器已统一 message.error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="对话质量评分">
      <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
        <Form.Item name="dialogRound" label="对话 ID" rules={[{ required: true, message: '请输入对话 ID' }]}>
          <Input placeholder="对话 ID" />
        </Form.Item>
        <Form.Item name="score" label="准确性" rules={[{ required: true, message: '请评分' }]}>
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
