import { Checkbox, Input, Select, Space, Typography } from '@douyinfe/semi-ui';
import type { ActionTypeDescriptor, PlanNode } from '@/api/wfe/workflowDefinitions';

interface PlanInspectorProps {
  node: PlanNode | null;
  actionTypes: ActionTypeDescriptor[];
  onChange: (node: PlanNode) => void;
}

export function PlanInspector({ node, actionTypes, onChange }: PlanInspectorProps) {
  if (!node) return <Typography.Text type="tertiary">在画布中选择一个节点以编辑。</Typography.Text>;
  if (node.type !== 'action') {
    return <Typography.Text type="tertiary">{node.type === 'start' ? '开始节点' : '结束节点'}不需要配置。</Typography.Text>;
  }
  const currentAction = actionTypes.find((item) => item.action_type === node.action_type);
  const firstRequiredInput = currentAction?.required_inputs[0] || 'order_id';
  const input = node.input || {};
  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Typography.Text type="secondary">节点 ID：{node.id}</Typography.Text>
      <Typography.Text strong>ActionType</Typography.Text>
      <Select
        value={node.action_type}
        style={{ width: '100%' }}
        optionList={actionTypes.map((item) => ({ label: item.action_type, value: item.action_type }))}
        onChange={(value) => {
          const action = actionTypes.find((item) => item.action_type === value);
          onChange({
            ...node,
            action_type: String(value),
            input: {},
            requires_confirmation: action?.requires_confirmation ?? false,
          });
        }}
      />
      <Typography.Text strong>{firstRequiredInput}</Typography.Text>
      <Input
        value={String(input[firstRequiredInput] || '')}
        placeholder={`输入 ${firstRequiredInput}`}
        onChange={(value) => onChange({ ...node, input: { ...input, [firstRequiredInput]: value } })}
      />
      <Checkbox
        checked={Boolean(node.requires_confirmation)}
        disabled={Boolean(currentAction?.requires_confirmation)}
        onChange={(event) => onChange({ ...node, requires_confirmation: event.target.checked })}
      >
        执行前需要人工确认{currentAction?.requires_confirmation ? '（此 ActionType 必填）' : ''}
      </Checkbox>
    </Space>
  );
}
