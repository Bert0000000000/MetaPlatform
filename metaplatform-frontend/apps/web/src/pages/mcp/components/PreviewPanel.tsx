import { useMemo, useState } from 'react';
import { Card, Empty, Space, TextArea, Typography } from '@douyinfe/semi-ui';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { PromptTemplate } from '@/api/mcphub/types';

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
    <Space vertical spacing="medium" style={{ width: '100%' }}>
      {emptyVars ? (
        <Card title="预览">
          <Empty description="该模板无变量" />
          <pre
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
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
        <Card title="填写变量">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {template.variables.map((v) => (
              <div key={v.name}>
                <div style={{ marginBottom: 4 }}>
                  <span>{v.name}</span>
                  {v.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
                  {v.description && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {v.description}
                    </span>
                  )}
                </div>
                <TextArea
                  rows={2}
                  value={values[v.name] || ''}
                  onChange={(val) => setValues((prev) => ({ ...prev, [v.name]: val }))}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            渲染结果
          </Space>
        }
      >
        <Typography.Paragraph copyable={{ content: rendered }}>
          <pre
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
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
