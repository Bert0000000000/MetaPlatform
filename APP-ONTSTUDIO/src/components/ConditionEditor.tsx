import { Button, Card, Empty, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { RuleCondition } from '@/api/rules';

interface ConditionEditorProps {
  value: RuleCondition[];
  onChange: (v: RuleCondition[]) => void;
}

export default function ConditionEditor({ value, onChange }: ConditionEditorProps) {
  const conds = value || [];

  const add = () => {
    onChange([
      ...conds,
      { id: `cond_${Date.now().toString(36)}`, field: '', operator: 'eq', value: '' },
    ]);
  };

  const update = (idx: number, patch: Partial<RuleCondition>) => {
    const next = [...conds];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  };

  const remove = (idx: number) => onChange(conds.filter((_, i) => i !== idx));

  if (conds.length === 0) {
    return (
      <Card size="small" title="触发条件">
        <Empty description="无任何条件（始终满足）" />
        <Button type="dashed" icon={<PlusOutlined />} onClick={add} block style={{ marginTop: 12 }}>
          添加条件
        </Button>
      </Card>
    );
  }

  return (
    <Card size="small" title="触发条件（全部满足时触发）">
      <Form layout="vertical" size="small">
        {conds.map((c, idx) => (
          <Space key={c.id} wrap style={{ marginBottom: 8, width: '100%' }}>
            <Form.Item>
              <Input
                placeholder="字段名"
                value={c.field}
                onChange={(e) => update(idx, { field: e.target.value })}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Form.Item>
              <Select
                value={c.operator}
                onChange={(v) => update(idx, { operator: v as RuleCondition['operator'] })}
                style={{ width: 120 }}
                options={[
                  { label: '等于 (eq)', value: 'eq' },
                  { label: '不等于 (ne)', value: 'ne' },
                  { label: '大于 (gt)', value: 'gt' },
                  { label: '小于 (lt)', value: 'lt' },
                  { label: '包含 (in)', value: 'in' },
                  { label: '字符串包含', value: 'contains' },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Input
                placeholder="比较值"
                value={c.value}
                onChange={(e) => update(idx, { value: e.target.value })}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Button danger icon={<DeleteOutlined />} onClick={() => remove(idx)} />
          </Space>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={add} block>
          添加条件
        </Button>
      </Form>
    </Card>
  );
}
