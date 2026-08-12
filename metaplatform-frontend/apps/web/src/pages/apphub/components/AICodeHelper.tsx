import { useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Tag, Typography, Toast } from '@douyinfe/semi-ui';
import { CodeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { generateCode } from '@/api/apphub/generate';
import type { CodeGenResult } from '@/api/apphub/types';

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
      Toast.warning('请输入需求');
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
    <Card title={<><CodeOutlined /> AI 代码助手</>} bodyStyle={{ padding: 12 }}>
      <Space vertical style={{ width: '100%' }}>
        <Space>
          <Select
            value={language}
            onChange={(v) => setLanguage(typeof v === 'string' ? v : 'typescript')}
            style={{ width: 160 }}
            optionList={[
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
            onChange={(v) => setPrompt(v)}
            style={{ width: 320 }}
            onEnterPress={handleGenerate}
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
        </Space>

        {result ? (
          <>
            <Typography.Text type="tertiary">{result.description}</Typography.Text>
            {result.dependencies && (
              <Space wrap>
                {result.dependencies.map((d: string) => (
                  <Tag key={d} color="blue">{d}</Tag>
                ))}
              </Space>
            )}
            <Typography.Paragraph copyable={{ content: result.code }}>
              <pre
                style={{
                  background: 'var(--muted)',
                  padding: 12,
                  borderRadius: 'var(--radius)',
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
