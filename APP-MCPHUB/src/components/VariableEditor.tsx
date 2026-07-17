import { Form, Input, Switch, Space, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { PromptVariable } from '@/types';

interface VariableEditorProps {
  value: PromptVariable[];
  onChange: (v: PromptVariable[]) => void;
}

export default function VariableEditor({ value, onChange }: VariableEditorProps) {
  const vars = value || [];

  const updateVar = (idx: number, updates: Partial<PromptVariable>) => {
    const next = [...vars];
    next[idx] = { ...next[idx], ...updates };
    onChange(next);
  };

  const removeVar = (idx: number) => {
    onChange(vars.filter((_, i) => i !== idx));
  };

  const addVar = () => {
    onChange([...vars, { name: '', required: false }]);
  };

  return (
    <div>
      <Form layout="vertical">
        {vars.map((v, idx) => (
          <Space key={idx} align="baseline" style={{ marginBottom: 8 }} wrap>
            <Form.Item>
              <Input
                placeholder="变量名 (如 name)"
                value={v.name}
                onChange={(e) => updateVar(idx, { name: e.target.value })}
                style={{ width: 140 }}
              />
            </Form.Item>
            <Form.Item>
              <Input
                placeholder="描述"
                value={v.description || ''}
                onChange={(e) => updateVar(idx, { description: e.target.value })}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item>
              <Input
                placeholder="默认值"
                value={v.defaultValue || ''}
                onChange={(e) => updateVar(idx, { defaultValue: e.target.value })}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Switch
                  checked={v.required || false}
                  checkedChildren="必填"
                  unCheckedChildren="可选"
                  onChange={(c) => updateVar(idx, { required: c })}
                />
                <Button danger icon={<DeleteOutlined />} onClick={() => removeVar(idx)} />
              </Space>
            </Form.Item>
          </Space>
        ))}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addVar}
          block
        >
          添加变量
        </Button>
      </Form>
    </div>
  );
}
