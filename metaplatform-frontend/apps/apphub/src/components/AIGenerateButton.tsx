import { useState } from 'react';
import { Button, Card, Input, Modal, Space, Tag, Typography, message } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { generateForm } from '@/api/generate';
import type { FormGenResult } from '@/types';

interface AIGenerateButtonProps {
  onApply: (result: FormGenResult) => void;
  promptPlaceholder?: string;
}

export default function AIGenerateButton({
  onApply,
  promptPlaceholder = '描述你要创建的表单，例如：员工请假申请',
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<FormGenResult | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入描述');
      return;
    }
    setGenerating(true);
    try {
      const r = await generateForm(prompt);
      setResult(r);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setOpen(false);
      setResult(null);
      setPrompt('');
    }
  };

  return (
    <>
      <Button icon={<RobotOutlined />} onClick={() => setOpen(true)}>
        AI 生成
      </Button>
      <Modal
        title="AI 生成表单"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleApply}
        okText="应用到设计器"
        okButtonProps={{ disabled: !result }}
        width={680}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            rows={3}
            placeholder={promptPlaceholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={generating}
            onClick={handleGenerate}
            block
          >
            生成
          </Button>
          {result && (
            <Card title={`预览：${result.name}`} size="small">
              <Typography.Paragraph type="secondary">
                {result.description}
              </Typography.Paragraph>
              <Space wrap>
                {result.fields.map((f: FormGenResult['fields'][number]) => (
                  <Tag key={f.fieldKey} color="blue">
                    {f.label} ({f.type})
                    {f.required && ' *'}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}
        </Space>
      </Modal>
    </>
  );
}
