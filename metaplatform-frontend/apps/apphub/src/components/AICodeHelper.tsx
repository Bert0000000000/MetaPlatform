import { useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Tag, Typography, message } from 'antd';
import { CodeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { generateCode } from '@/api/generate';
import type { CodeGenResult } from '@/types';

interface AICodeHelperProps {
  defaultLanguage?: string;
}

export default function AICodeHelper({ defaultLanguage = 'typescript' }: AICodeHelperProps) {
  const [language, setLanguage] = useState(defaultLanguage);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<CodeGenResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入需求');
      return;
    }
    setLoading(true);
    try {
      const r = await generateCode(prompt, language);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card size="small" title={<><CodeOutlined /> AI 代码助手</>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Select
            value={language}
            onChange={setLanguage}
            style={{ width: 160 }}
            options={[
              { label: 'TypeScript', value: 'typescript' },
              { label: 'Python', value: 'python' },
              { label: 'Java', value: 'java' },
              { label: 'Go', value: 'go' },
              { label: 'curl', value: 'curl' },
            ]}
          />
          <Input
            placeholder="描述需求"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ width: 320 }}
            onPressEnter={handleGenerate}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleGenerate}
          >
            生成
          </Button>
        </Space>

        {result ? (
          <>
            <Typography.Text type="secondary">{result.description}</Typography.Text>
            {result.dependencies && (
              <Space wrap>
                {result.dependencies.map((d: string) => (
                  <Tag key={d} color="blue">{d}</Tag>
                ))}
              </Space>
            )}
            <Typography.Paragraph copyable={{ text: result.code }}>
              <pre
                style={{
                  background: '#fafafa',
                  padding: 12,
                  borderRadius: 4,
                  fontFamily: 'Menlo, Consolas, monospace',
                  fontSize: 12,
                  maxHeight: 320,
                  overflow: 'auto',
                  margin: 0,
                }}
              >
                <code>{result.code}</code>
              </pre>
            </Typography.Paragraph>
          </>
        ) : (
          <Empty description="点击生成查看结果" />
        )}
      </Space>
    </Card>
  );
}
