import { Form, Input, InputNumber, Switch, Select, Empty, Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { McpTool } from '@/types';

interface ParameterFormProps {
  tool: McpTool;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export default function ParameterForm({ tool, value, onChange }: ParameterFormProps) {
  if (tool.inputSchema.length === 0) {
    return <Empty description="该工具无需参数" />;
  }

  const handleFieldChange = (name: string, v: unknown) => {
    onChange({ ...value, [name]: v });
  };

  return (
    <Card size="small" title={`参数（${tool.inputSchema.length}）`}>
      <Form layout="vertical">
        {tool.inputSchema.map((p) => {
          const current = value[p.name];
          const label = (
            <>
              {p.name} {p.required && <span style={{ color: '#f5222d' }}>*</span>}
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {p.type}
              </Typography.Text>
            </>
          );

          let control: ReactNode;
          if (p.enumValues && p.enumValues.length > 0) {
            control = (
              <Select
                value={current as string | undefined}
                onChange={(v) => handleFieldChange(p.name, v)}
                options={p.enumValues.map((v) => ({ label: v, value: v }))}
              />
            );
          } else if (p.type === 'number') {
            control = (
              <InputNumber
                value={current as number | undefined}
                onChange={(v) => handleFieldChange(p.name, v)}
                style={{ width: '100%' }}
              />
            );
          } else if (p.type === 'boolean') {
            control = (
              <Switch
                checked={!!current}
                onChange={(v) => handleFieldChange(p.name, v)}
              />
            );
          } else {
            control = (
              <Input.TextArea
                rows={2}
                value={(current as string) || ''}
                onChange={(e) => handleFieldChange(p.name, e.target.value)}
              />
            );
          }

          return (
            <Form.Item key={p.name} label={label} tooltip={p.description}>
              {control}
            </Form.Item>
          );
        })}
      </Form>
    </Card>
  );
}
