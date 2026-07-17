import { useMemo, useState } from 'react';
import { Card, Empty, Form, Input, Space, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { PromptTemplate } from '@/types';

interface PreviewPanelProps {
  template: PromptTemplate;
}

export default function PreviewPanel({ template }: PreviewPanelProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    template.variables.forEach((v) => {
      init[v.name] = v.defaultValue || '';
    });
    return init;
  });

  const rendered = useMemo(() => {
    return template.template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return values[key] || `{{${key}}}`;
    });
  }, [template.template, values]);

  const emptyVars = template.variables.length === 0;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {emptyVars ? (
        <Card title="预览" size="small">
          <Empty description="该模板无变量" />
          <pre
            style={{
              background: '#fafafa',
              padding: 12,
              borderRadius: 4,
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {template.template}
          </pre>
        </Card>
      ) : (
        <Card title="填写变量" size="small">
          <Form layout="vertical">
            {template.variables.map((v) => (
              <Form.Item
                key={v.name}
                label={
                  <Space>
                    <span>{v.name}</span>
                    {v.required && <span style={{ color: '#f5222d' }}>*</span>}
                  </Space>
                }
                tooltip={v.description}
              >
                <Input.TextArea
                  rows={2}
                  value={values[v.name] || ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                />
              </Form.Item>
            ))}
          </Form>
        </Card>
      )}

      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            渲染结果
          </Space>
        }
        size="small"
      >
        <Typography.Paragraph copyable={{ text: rendered }}>
          <pre
            style={{
              background: '#fafafa',
              padding: 12,
              borderRadius: 4,
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {rendered}
          </pre>
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
