import { useMemo, useState } from 'react';
import { Card, Space, TextArea, Typography } from '@douyinfe/semi-ui';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { PromptTemplate } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

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
    <Space vertical spacing="medium" className="mp-w-full">
      {emptyVars ? (
        <Card title="预览">
          <EmptyState title="该模板无变量" />
          <pre
            className="mp-border mp-p-3 mp-text-sm mp-bg-1 mp-rounded-sm mp-mono mp-mcp-pre-wrap"
          >
            {template.template}
          </pre>
        </Card>
      ) : (
        <Card title="填写变量">
          <div className="mp-flex mp-gap-4 mp-flex-col" >
            {template.variables.map((v) => (
              <div key={v.name}>
                <div className="mp-mb-1">
                  <span>{v.name}</span>
                  {v.required && <span className="mp-text-danger">*</span>}
                  {v.description && (
                    <span className="mp-text-sm mp-text-2 mp-ml-2" >
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
            className="mp-border mp-p-3 mp-m-0 mp-text-sm mp-bg-1 mp-rounded-sm mp-mono mp-mcp-pre-wrap"
          >
            {rendered}
          </pre>
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
