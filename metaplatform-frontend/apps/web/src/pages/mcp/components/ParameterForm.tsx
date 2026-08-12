import { Card, Empty, InputNumber, Select, Switch, TextArea, Typography } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';
import type { McpTool } from '@/api/mcphub/types';

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
    <Card title={`参数（${tool.inputSchema.length}）`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tool.inputSchema.map((p) => {
          const current = value[p.name];
          const label = (
            <>
              {p.name} {p.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
              <Typography.Text type="tertiary" style={{ fontSize: 12, marginLeft: 8 }}>
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
                optionList={p.enumValues.map((v) => ({ label: v, value: v }))}
                style={{ width: '100%' }}
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
              <TextArea
                rows={2}
                value={(current as string) || ''}
                onChange={(val) => handleFieldChange(p.name, val)}
              />
            );
          }

          return (
            <div key={p.name}>
              <div style={{ marginBottom: 4 }}>
                {label}
                {p.description && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {p.description}
                  </span>
                )}
              </div>
              {control}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
