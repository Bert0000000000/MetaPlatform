import { Input, Switch, Space, Button } from '@douyinfe/semi-ui';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { PromptVariable } from '@/api/mcphub/types';

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
      {vars.map((v, idx) => (
        <Space key={idx} style={{ marginBottom: 8 }} wrap>
          <Input
            placeholder="变量名 (如 name)"
            value={v.name}
            onChange={(val) => updateVar(idx, { name: val })}
            style={{ width: 140 }}
          />
          <Input
            placeholder="描述"
            value={v.description || ''}
            onChange={(val) => updateVar(idx, { description: val })}
            style={{ width: 200 }}
          />
          <Input
            placeholder="默认值"
            value={v.defaultValue || ''}
            onChange={(val) => updateVar(idx, { defaultValue: val })}
            style={{ width: 160 }}
          />
          <Space>
            <Switch
              checked={v.required || false}
              checkedText="必填"
              uncheckedText="可选"
              onChange={(c) => updateVar(idx, { required: c })}
            />
            <Button type="danger" icon={<DeleteOutlined />} onClick={() => removeVar(idx)} />
          </Space>
        </Space>
      ))}
      <Button
        theme="borderless"
        icon={<PlusOutlined />}
        onClick={addVar}
        block
      >
        添加变量
      </Button>
    </div>
  );
}
