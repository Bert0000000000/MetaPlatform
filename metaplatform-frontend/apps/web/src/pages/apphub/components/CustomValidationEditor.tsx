import type { CSSProperties } from 'react';
import { Button, Card, Empty, Form, Input, InputNumber, Select, Space, Switch, Tag } from '@douyinfe/semi-ui';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export interface CustomValidationRule {
  id: string;
  name: string;
  fieldKey: string;
  validator: 'min' | 'max' | 'pattern' | 'custom';
  args: Record<string, unknown>;
  message: string;
  enabled: boolean;
}

interface CustomValidationEditorProps {
  rules: CustomValidationRule[];
  onChange: (rules: CustomValidationRule[]) => void;
}

const FIELD_LABEL_STYLE: CSSProperties = { display: 'block', marginBottom: 8 };

export default function CustomValidationEditor({ rules, onChange }: CustomValidationEditorProps) {
  const addRule = () => {
    onChange([
      ...rules,
      {
        id: `rule_${Date.now().toString(36)}`,
        name: '新规则',
        fieldKey: '',
        validator: 'pattern',
        args: {},
        message: '校验失败',
        enabled: true,
      },
    ]);
  };

  const updateRule = (idx: number, updates: Partial<CustomValidationRule>) => {
    const next = [...rules];
    next[idx] = { ...next[idx]!, ...updates };
    onChange(next);
  };

  const removeRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
  };

  if (rules.length === 0) {
    return (
      <Card title="自定义校验规则">
        <Empty description="暂无自定义规则" />
        <Button type="primary" theme="outline" icon={<PlusOutlined />} onClick={addRule} block style={{ marginTop: 12 }}>
          添加规则
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="自定义校验规则"
      headerExtraContent={
        <Button theme="borderless" type="primary" icon={<PlusOutlined />} onClick={addRule}>
          添加
        </Button>
      }
    >
      {rules.map((r, idx) => (
        <Card
          key={r.id}
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <Tag color="purple">{r.validator}</Tag>
              <Switch
                size="small"
                checked={r.enabled}
                onChange={(c) => updateRule(idx, { enabled: c })}
              />
            </Space>
          }
          headerExtraContent={
            <Button
              theme="borderless"
              type="danger"
              icon={<DeleteOutlined />}
              onClick={() => removeRule(idx)}
            />
          }
        >
          <Space wrap>
            <div>
              <Form.Label style={FIELD_LABEL_STYLE}>名称</Form.Label>
              <Input
                size="small"
                value={r.name}
                onChange={(value) => updateRule(idx, { name: value })}
                style={{ width: 160 }}
              />
            </div>
            <div>
              <Form.Label style={FIELD_LABEL_STYLE}>字段</Form.Label>
              <Input
                size="small"
                value={r.fieldKey}
                onChange={(value) => updateRule(idx, { fieldKey: value })}
                style={{ width: 140 }}
              />
            </div>
            <div>
              <Form.Label style={FIELD_LABEL_STYLE}>校验器</Form.Label>
              <Select
                size="small"
                value={r.validator}
                onChange={(v) => updateRule(idx, { validator: v as CustomValidationRule['validator'] })}
                style={{ width: 140 }}
                optionList={[
                  { label: '最小值', value: 'min' },
                  { label: '最大值', value: 'max' },
                  { label: '正则', value: 'pattern' },
                  { label: '自定义', value: 'custom' },
                ]}
              />
            </div>
            {r.validator === 'min' && (
              <div>
                <Form.Label style={FIELD_LABEL_STYLE}>最小值</Form.Label>
                <InputNumber
                  size="small"
                  value={r.args.min as number | undefined}
                  onChange={(v) => updateRule(idx, { args: { ...r.args, min: v } })}
                />
              </div>
            )}
            {r.validator === 'max' && (
              <div>
                <Form.Label style={FIELD_LABEL_STYLE}>最大值</Form.Label>
                <InputNumber
                  size="small"
                  value={r.args.max as number | undefined}
                  onChange={(v) => updateRule(idx, { args: { ...r.args, max: v } })}
                />
              </div>
            )}
            {r.validator === 'pattern' && (
              <div>
                <Form.Label style={FIELD_LABEL_STYLE}>正则表达式</Form.Label>
                <Input
                  size="small"
                  value={(r.args.pattern as string) || ''}
                  onChange={(value) => updateRule(idx, { args: { ...r.args, pattern: value } })}
                  style={{ width: 200 }}
                />
              </div>
            )}
            {r.validator === 'custom' && (
              <div>
                <Form.Label style={FIELD_LABEL_STYLE}>表达式</Form.Label>
                <Input
                  size="small"
                  value={(r.args.expr as string) || ''}
                  onChange={(value) => updateRule(idx, { args: { ...r.args, expr: value } })}
                  placeholder="value > 100 && status === 'ok'"
                  style={{ width: 240 }}
                />
              </div>
            )}
          </Space>
          <div style={{ marginTop: 12 }}>
            <Form.Label style={FIELD_LABEL_STYLE}>失败提示</Form.Label>
            <Input
              size="small"
              value={r.message}
              onChange={(value) => updateRule(idx, { message: value })}
            />
          </div>
        </Card>
      ))}
    </Card>
  );
}
