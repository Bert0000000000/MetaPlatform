import { Button, Card, Empty, Form, Input, InputNumber, Select, Space, Switch, Tag } from 'antd';
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
      <Card title="自定义校验规则" size="small">
        <Empty description="暂无自定义规则" />
        <Button type="dashed" icon={<PlusOutlined />} onClick={addRule} block style={{ marginTop: 12 }}>
          添加规则
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="自定义校验规则"
      size="small"
      extra={
        <Button type="link" icon={<PlusOutlined />} onClick={addRule}>
          添加
        </Button>
      }
    >
      {rules.map((r, idx) => (
        <Card
          key={r.id}
          type="inner"
          size="small"
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
          extra={
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeRule(idx)}
            />
          }
        >
          <Form layout="vertical" size="small">
            <Space wrap>
              <Form.Item label="名称">
                <Input
                  value={r.name}
                  onChange={(e) => updateRule(idx, { name: e.target.value })}
                  style={{ width: 160 }}
                />
              </Form.Item>
              <Form.Item label="字段">
                <Input
                  value={r.fieldKey}
                  onChange={(e) => updateRule(idx, { fieldKey: e.target.value })}
                  style={{ width: 140 }}
                />
              </Form.Item>
              <Form.Item label="校验器">
                <Select
                  value={r.validator}
                  onChange={(v) => updateRule(idx, { validator: v as CustomValidationRule['validator'] })}
                  style={{ width: 140 }}
                  options={[
                    { label: '最小值', value: 'min' },
                    { label: '最大值', value: 'max' },
                    { label: '正则', value: 'pattern' },
                    { label: '自定义', value: 'custom' },
                  ]}
                />
              </Form.Item>
              {r.validator === 'min' && (
                <Form.Item label="最小值">
                  <InputNumber
                    value={r.args.min as number | undefined}
                    onChange={(v) => updateRule(idx, { args: { ...r.args, min: v } })}
                  />
                </Form.Item>
              )}
              {r.validator === 'max' && (
                <Form.Item label="最大值">
                  <InputNumber
                    value={r.args.max as number | undefined}
                    onChange={(v) => updateRule(idx, { args: { ...r.args, max: v } })}
                  />
                </Form.Item>
              )}
              {r.validator === 'pattern' && (
                <Form.Item label="正则表达式">
                  <Input
                    value={(r.args.pattern as string) || ''}
                    onChange={(e) => updateRule(idx, { args: { ...r.args, pattern: e.target.value } })}
                    style={{ width: 200 }}
                  />
                </Form.Item>
              )}
              {r.validator === 'custom' && (
                <Form.Item label="表达式">
                  <Input
                    value={(r.args.expr as string) || ''}
                    onChange={(e) => updateRule(idx, { args: { ...r.args, expr: e.target.value } })}
                    placeholder="value > 100 && status === 'ok'"
                    style={{ width: 240 }}
                  />
                </Form.Item>
              )}
            </Space>
            <Form.Item label="失败提示">
              <Input
                value={r.message}
                onChange={(e) => updateRule(idx, { message: e.target.value })}
              />
            </Form.Item>
          </Form>
        </Card>
      ))}
    </Card>
  );
}
