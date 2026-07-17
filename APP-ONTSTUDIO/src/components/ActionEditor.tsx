import { Button, Card, Empty, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { RuleAction } from '@/api/rules';

interface ActionEditorProps {
  value: RuleAction[];
  onChange: (v: RuleAction[]) => void;
}

export default function ActionEditor({ value, onChange }: ActionEditorProps) {
  const actions = value || [];

  const add = () => {
    onChange([
      ...actions,
      {
        id: `act_${Date.now().toString(36)}`,
        type: 'set-value',
        config: { field: '', value: '' },
      },
    ]);
  };

  const update = (idx: number, patch: Partial<RuleAction>) => {
    const next = [...actions];
    next[idx] = { ...next[idx]!, ...patch, config: { ...next[idx]!.config, ...patch.config } };
    onChange(next);
  };

  const remove = (idx: number) => onChange(actions.filter((_, i) => i !== idx));

  if (actions.length === 0) {
    return (
      <Card size="small" title="执行动作">
        <Empty description="无任何动作" />
        <Button type="dashed" icon={<PlusOutlined />} onClick={add} block style={{ marginTop: 12 }}>
          添加动作
        </Button>
      </Card>
    );
  }

  return (
    <Card size="small" title="执行动作">
      {actions.map((a, idx) => (
        <Card key={a.id} type="inner" size="small" style={{ marginBottom: 8 }} title={`动作 ${idx + 1}`} extra={<Button danger icon={<DeleteOutlined />} onClick={() => remove(idx)} />}>
          <Space wrap>
            <Form.Item label="类型">
              <Select
                value={a.type}
                onChange={(v) => update(idx, { type: v as RuleAction['type'] })}
                style={{ width: 160 }}
                options={[
                  { label: '设置属性', value: 'set-value' },
                  { label: '发送通知', value: 'send-notify' },
                  { label: '调用 Action', value: 'call-action' },
                  { label: '触发流程', value: 'trigger-flow' },
                ]}
              />
            </Form.Item>
            {a.type === 'set-value' && (
              <>
                <Form.Item label="字段">
                  <Input
                    value={a.config.field as string || ''}
                    onChange={(e) => update(idx, { config: { field: e.target.value } })}
                    style={{ width: 160 }}
                  />
                </Form.Item>
                <Form.Item label="值">
                  <Input
                    value={a.config.value as string || ''}
                    onChange={(e) => update(idx, { config: { value: e.target.value } })}
                    style={{ width: 200 }}
                  />
                </Form.Item>
              </>
            )}
            {a.type === 'send-notify' && (
              <Form.Item label="收件人">
                <Input
                  value={a.config.recipient as string || ''}
                  onChange={(e) => update(idx, { config: { recipient: e.target.value } })}
                />
              </Form.Item>
            )}
            {a.type === 'call-action' && (
              <Form.Item label="Action ID">
                <Input
                  value={a.config.actionId as string || ''}
                  onChange={(e) => update(idx, { config: { actionId: e.target.value } })}
                />
              </Form.Item>
            )}
            {a.type === 'trigger-flow' && (
              <Form.Item label="Flow ID">
                <Input
                  value={a.config.flowId as string || ''}
                  onChange={(e) => update(idx, { config: { flowId: e.target.value } })}
                />
              </Form.Item>
            )}
          </Space>
        </Card>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={add} block>
        添加动作
      </Button>
    </Card>
  );
}
