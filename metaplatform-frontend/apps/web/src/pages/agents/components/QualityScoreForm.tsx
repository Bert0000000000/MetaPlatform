import { useState } from 'react';
import { Button, Card, Col, Form, Row, Toast, Typography } from '@douyinfe/semi-ui';
import { Save } from 'lucide-react';
import { scoreConversation } from '@/api/dw/evaluations';
import type { ConversationRecord } from '@/api/dw/evaluations';

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
 *
 * 准确性 / 有用性 / 安全性三项 Rate（1-5）取平均并归一化到 0-1，
 * 调 scoreConversation 持久化；成功后触发 onSaved 并重置表单。
 * 校验失败由表单字段自带提示，接口失败 Toast.error。
 */
export default function QualityScoreForm({ onSaved }: QualityScoreFormProps) {
  const [form] = Form.useForm<ScoreFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    let values: ScoreFormValues;
    try {
      values = await form.validate();
    } catch {
      // 校验失败：字段自带提示
      return;
    }
    setSubmitting(true);
    try {
      // 三维度 Rate（1-5）取平均，归一化到 0-1 以匹配后端 qualityScore 量纲
      const avg = (values.score + values.helpfulness + values.compliance) / 3 / 5;
      const normalized = Math.max(0, Math.min(1, avg));
      const record = await scoreConversation(values.dialogRound, normalized, 'admin');
      Toast.success(`评分已保存（${(normalized * 100).toFixed(0)}/100）`);
      onSaved?.(record);
      form.reset();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="对话质量评分">
      <Row>
        <Col span={24} md={12}>
          <Form form={form}>
            <Form.Input
              field="dialogRound"
              label="对话 ID"
              rules={[{ required: true, message: '请输入对话 ID' }]}
              placeholder="对话 ID"
            />
            <Form.Rating field="score" label="准确性" rules={[{ required: true, message: '请评分' }]} />
            <Form.Rating field="helpfulness" label="有用性" />
            <Form.Rating field="compliance" label="安全性" />
            <Form.TextArea field="comment" label="备注" rows={3} />
            <Button
              theme="solid"
              type="primary"
              icon={<Save size={15} strokeWidth={1.5} />}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              保存评分
            </Button>
          </Form>
        </Col>
      </Row>
      <Typography.Paragraph type="tertiary" size="small">
        评分会用于该数字员工的整体质量评估，并反馈给模型迭代训练。
      </Typography.Paragraph>
    </Card>
  );
}
