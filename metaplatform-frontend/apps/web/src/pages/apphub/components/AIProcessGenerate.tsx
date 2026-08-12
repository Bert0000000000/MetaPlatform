import { useState } from 'react';
import { Button, Card, Empty, Space, Tag, TextArea, Typography, Toast } from '@douyinfe/semi-ui';
import { PartitionOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { generateProcess } from '@/api/apphub/generate';
import type { ProcessGenResult } from '@/api/apphub/types';

interface AIProcessGenerateProps {
  onApply: (result: ProcessGenResult) => void;
}

export default function AIProcessGenerate({ onApply }: AIProcessGenerateProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<ProcessGenResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Toast.warning('请输入流程描述');
      return;
    }
    setLoading(true);
    try {
      const r = await generateProcess(prompt);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setResult(null);
      setPrompt('');
      Toast.success('已应用');
    }
  };

  return (
    <Card title={<><PartitionOutlined /> AI 流程生成</>} bodyStyle={{ padding: 12 }}>
      <Space vertical style={{ width: '100%' }}>
        <TextArea
          rows={3}
          placeholder="描述业务流程，例如：员工请假：员工提交→直属上级审批→HR 备案→结束"
          value={prompt}
          onChange={(v) => setPrompt(v)}
        />
        <Button
          theme="solid"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleGenerate}
        >
          生成
        </Button>

        {result ? (
          <Card title={result.name} bordered={false} bodyStyle={{ padding: 12 }}>
            <Typography.Paragraph type="tertiary">
              {result.description}
            </Typography.Paragraph>
            <Space wrap>
              {result.nodes.map((n: ProcessGenResult['nodes'][number]) => (
                <Tag color={n.type === 'start' ? 'green' : n.type === 'end' ? 'red' : 'blue'} key={n.id}>
                  {n.name} ({n.type}){n.assignee && ` - ${n.assignee}`}
                </Tag>
              ))}
            </Space>
            <div style={{ marginTop: 12 }}>
              <Button theme="solid" type="primary" onClick={handleApply}>
                应用到流程设计器
              </Button>
            </div>
          </Card>
        ) : (
          <Empty description="点击生成查看结果" />
        )}
      </Space>
    </Card>
  );
}
