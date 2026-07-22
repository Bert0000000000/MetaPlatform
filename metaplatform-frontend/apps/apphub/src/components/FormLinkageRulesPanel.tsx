import { Button, Card, Empty, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { FormConfig, FormField, LinkageRule, LinkageRuleAction, LinkageRuleCondition } from '@/types';

interface FormLinkageRulesPanelProps {
  config: FormConfig;
  onChange: (c: FormConfig) => void;
}

const OPERATORS: { label: string; value: LinkageRuleCondition['operator'] }[] = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '包含', value: 'contains' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于等于', value: 'lte' },
  { label: '在列表中', value: 'in' },
];

const ACTIONS: { label: string; value: LinkageRuleAction['action'] }[] = [
  { label: '显示', value: 'show' },
  { label: '隐藏', value: 'hide' },
  { label: '设为必填', value: 'require' },
  { label: '设为可选', value: 'optional' },
  { label: '设为只读', value: 'readonly' },
  { label: '设为可编辑', value: 'editable' },
  { label: '设置选项', value: 'setOptions' },
  { label: '设置值', value: 'setValue' },
];

export default function FormLinkageRulesPanel({ config, onChange }: FormLinkageRulesPanelProps) {
  const rules: LinkageRule[] = config.linkageRules || [];
  const fields: FormField[] = config.fields || [];

  const updateRules = (next: LinkageRule[]) => {
    onChange({ ...config, linkageRules: next });
  };

  const addRule = () => {
    const firstField = fields[0];
    const newRule: LinkageRule = {
      id: `linkage_${Date.now().toString(36)}`,
      name: '新联动规则',
      when: {
        fieldKey: firstField?.fieldKey || '',
        operator: 'eq',
        value: '',
      },
      then: {
        fieldKey: firstField?.fieldKey || '',
        action: 'show',
      },
    };
    updateRules([...rules, newRule]);
  };

  const updateRule = (idx: number, partial: Partial<LinkageRule>) => {
    const next = [...rules];
    next[idx] = { ...next[idx]!, ...partial };
    updateRules(next);
  };

  const updateWhen = (idx: number, partial: Partial<LinkageRuleCondition>) => {
    const rule = rules[idx];
    if (!rule) return;
    updateRule(idx, { when: { ...rule.when, ...partial } });
  };

  const updateThen = (idx: number, partial: Partial<LinkageRuleAction>) => {
    const rule = rules[idx];
    if (!rule) return;
    updateRule(idx, { then: { ...rule.then, ...partial } });
  };

  const removeRule = (idx: number) => {
    updateRules(rules.filter((_, i) => i !== idx));
  };

  const fieldOptions = fields.map((f) => ({ label: f.label, value: f.fieldKey }));

  return (
    <Card
      title="数据联动规则"
      size="small"
      extra={
        <Button type="link" icon={<PlusOutlined />} onClick={addRule} disabled={fields.length === 0}>
          添加规则
        </Button>
      }
    >
      {fields.length === 0 && (
        <Empty description="请先添加表单字段" />
      )}
      {rules.length === 0 && fields.length > 0 && (
        <Empty description="暂无联动规则">
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRule}>
            添加规则
          </Button>
        </Empty>
      )}
      {rules.map((rule, idx) => (
        <Card
          key={rule.id}
          type="inner"
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <Input
              value={rule.name}
              onChange={(e) => updateRule(idx, { name: e.target.value })}
              bordered={false}
              placeholder="规则名称"
              style={{ width: 200 }}
            />
          }
          extra={
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeRule(idx)} />
          }
        >
          <Form layout="vertical" size="small">
            <Space wrap align="start">
              <Card size="small" title="当" style={{ width: 320 }}>
                <Form.Item label="字段">
                  <Select
                    value={rule.when.fieldKey}
                    onChange={(v) => updateWhen(idx, { fieldKey: v })}
                    options={fieldOptions}
                    placeholder="选择字段"
                  />
                </Form.Item>
                <Form.Item label="运算符">
                  <Select
                    value={rule.when.operator || 'eq'}
                    onChange={(v) => updateWhen(idx, { operator: v })}
                    options={OPERATORS}
                  />
                </Form.Item>
                <Form.Item label="目标值">
                  <Input
                    value={String(rule.when.value ?? '')}
                    onChange={(e) => updateWhen(idx, { value: e.target.value })}
                    placeholder="输入比较值"
                  />
                </Form.Item>
              </Card>
              <Card size="small" title="则" style={{ width: 320 }}>
                <Form.Item label="字段">
                  <Select
                    value={rule.then.fieldKey}
                    onChange={(v) => updateThen(idx, { fieldKey: v })}
                    options={fieldOptions}
                    placeholder="选择字段"
                  />
                </Form.Item>
                <Form.Item label="动作">
                  <Select
                    value={rule.then.action}
                    onChange={(v) => updateThen(idx, { action: v })}
                    options={ACTIONS}
                  />
                </Form.Item>
                {rule.then.action === 'setValue' && (
                  <Form.Item label="设置值">
                    <Input
                      value={String(rule.then.value ?? '')}
                      onChange={(e) => updateThen(idx, { value: e.target.value })}
                      placeholder="输入要设置的值"
                    />
                  </Form.Item>
                )}
                {rule.then.action === 'setOptions' && (
                  <Form.Item label="选项（每行 标签:值）">
                    <Input.TextArea
                      rows={3}
                      value={rule.then.options?.map((o) => `${o.label}:${o.value}`).join('\n')}
                      onChange={(e) => {
                        const options = e.target.value
                          .split('\n')
                          .filter((line) => line.includes(':'))
                          .map((line) => {
                            const [label, value] = line.split(':');
                            return { label: label.trim(), value: value.trim() };
                          });
                        updateThen(idx, { options });
                      }}
                      placeholder="选项1:1\n选项2:2"
                    />
                  </Form.Item>
                )}
              </Card>
            </Space>
          </Form>
        </Card>
      ))}
    </Card>
  );
}
