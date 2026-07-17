import { Form, Input, Select, InputNumber, Switch, Button, Space, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ApprovalNodeConfig, AssigneeType, ApprovalMode } from '@/types';

interface ApprovalConfigProps {
  config: ApprovalNodeConfig;
  onChange: (config: ApprovalNodeConfig) => void;
}

const ASSIGNEE_TYPE_OPTIONS: { label: string; value: AssigneeType }[] = [
  { label: '指定人员', value: 'person' },
  { label: '指定角色', value: 'role' },
  { label: '指定部门', value: 'department' },
];

const APPROVAL_MODE_OPTIONS: { label: string; value: ApprovalMode }[] = [
  { label: '依次审批', value: 'sequential' },
  { label: '并行审批', value: 'parallel' },
  { label: '会签', value: 'countersign' },
];

const MOCK_ASSIGNEES: Record<AssigneeType, Array<{ label: string; value: string }>> = {
  person: [
    { label: '张三（销售经理）', value: 'u-zhangsan' },
    { label: '李四（财务主管）', value: 'u-lisi' },
    { label: '王五（副总）', value: 'u-wangwu' },
    { label: '赵六（总经理）', value: 'u-zhaoliu' },
  ],
  role: [
    { label: '销售经理', value: 'r-sales-manager' },
    { label: '财务主管', value: 'r-finance-manager' },
    { label: 'HR 经理', value: 'r-hr-manager' },
    { label: '部门负责人', value: 'r-dept-head' },
  ],
  department: [
    { label: '销售部', value: 'd-sales' },
    { label: '财务部', value: 'd-finance' },
    { label: '人力资源部', value: 'd-hr' },
    { label: '法务部', value: 'd-legal' },
  ],
};

export default function ApprovalConfig({ config, onChange }: ApprovalConfigProps) {
  const handleUpdate = (updates: Partial<ApprovalNodeConfig>) => {
    onChange({ ...config, ...updates });
  };

  const handleAddAssignee = () => {
    handleUpdate({ assigneeIds: [...config.assigneeIds, ''] });
  };

  const handleUpdateAssignee = (index: number, value: string) => {
    const newIds = [...config.assigneeIds];
    newIds[index] = value;
    handleUpdate({ assigneeIds: newIds });
  };

  const handleRemoveAssignee = (index: number) => {
    handleUpdate({ assigneeIds: config.assigneeIds.filter((_, i) => i !== index) });
  };

  const handleAddCC = () => {
    handleUpdate({ ccList: [...(config.ccList || []), ''] });
  };

  const handleUpdateCC = (index: number, value: string) => {
    const newList = [...(config.ccList || [])];
    newList[index] = value;
    handleUpdate({ ccList: newList });
  };

  const handleRemoveCC = (index: number) => {
    handleUpdate({ ccList: (config.ccList || []).filter((_, i) => i !== index) });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Divider style={{ margin: '8px 0' }}>审批配置</Divider>

      <Form layout="vertical" size="small">
        <Form.Item label="审批人类型">
          <Select
            value={config.assigneeType}
            onChange={(v) => handleUpdate({ assigneeType: v, assigneeIds: [] })}
            options={ASSIGNEE_TYPE_OPTIONS}
          />
        </Form.Item>

        <Form.Item label="审批人列表">
          <Space direction="vertical" style={{ width: '100%' }}>
            {config.assigneeIds.map((id, index) => (
              <Space key={index} style={{ width: '100%' }}>
                <Select
                  style={{ flex: 1, width: 200 }}
                  value={id || undefined}
                  onChange={(v) => handleUpdateAssignee(index, v)}
                  options={MOCK_ASSIGNEES[config.assigneeType]}
                  placeholder={`选择${config.assigneeType === 'person' ? '人员' : config.assigneeType === 'role' ? '角色' : '部门'}`}
                />
                <Button danger icon={<DeleteOutlined />} onClick={() => handleRemoveAssignee(index)} />
              </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddAssignee} block>
              添加审批人
            </Button>
          </Space>
        </Form.Item>

        <Form.Item label="审批模式">
          <Select
            value={config.approvalMode}
            onChange={(v) => handleUpdate({ approvalMode: v })}
            options={APPROVAL_MODE_OPTIONS}
          />
        </Form.Item>

        <Form.Item label="审批层级数">
          <InputNumber
            min={1}
            max={10}
            value={config.approvalLevels}
            onChange={(v) => handleUpdate({ approvalLevels: v ?? 1 })}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="超时时间（小时）">
          <InputNumber
            min={1}
            max={168}
            value={config.timeoutHours}
            onChange={(v) => handleUpdate({ timeoutHours: v ?? undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="允许拒绝" valuePropName="checked">
          <Switch
            checked={config.allowReject}
            onChange={(v) => handleUpdate({ allowReject: v })}
          />
        </Form.Item>

        <Form.Item label="允许转办" valuePropName="checked">
          <Switch
            checked={config.allowTransfer}
            onChange={(v) => handleUpdate({ allowTransfer: v })}
          />
        </Form.Item>

        <Form.Item label="抄送人列表">
          <Space direction="vertical" style={{ width: '100%' }}>
            {(config.ccList || []).map((id, index) => (
              <Space key={index} style={{ width: '100%' }}>
                <Input
                  style={{ width: 200 }}
                  value={id}
                  onChange={(e) => handleUpdateCC(index, e.target.value)}
                  placeholder="输入抄送人ID"
                />
                <Button danger icon={<DeleteOutlined />} onClick={() => handleRemoveCC(index)} />
              </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddCC} block>
              添加抄送人
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
