import { Button, Divider, Form, Input, InputNumber, Select, Space, Switch } from '@douyinfe/semi-ui';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ApprovalNodeConfig, AssigneeType, ApprovalMode } from '@/api/apphub/types';
import '../apps.css';

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
    <div className="mp-mt-3">
      <Divider className="mp-mt-2 mp-mb-2">审批配置</Divider>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">审批人类型</Form.Label>
        <Select
          size="small"
          value={config.assigneeType}
          onChange={(v) => handleUpdate({ assigneeType: v as AssigneeType, assigneeIds: [] })}
          optionList={ASSIGNEE_TYPE_OPTIONS}
          className="mp-w-full"
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">审批人列表</Form.Label>
        <Space vertical spacing="tight" className="mp-w-full">
          {config.assigneeIds.map((id, index) => (
            <Space key={index} spacing="tight" className="mp-w-full">
              <Select
                size="small"
                className="mp-flex-1 mp-w-200"
                value={id || undefined}
                onChange={(v) => handleUpdateAssignee(index, v as string)}
                optionList={MOCK_ASSIGNEES[config.assigneeType]}
                placeholder={`选择${config.assigneeType === 'person' ? '人员' : config.assigneeType === 'role' ? '角色' : '部门'}`}
              />
              <Button size="small" type="danger" icon={<DeleteOutlined />} onClick={() => handleRemoveAssignee(index)} />
            </Space>
          ))}
          <Button size="small" type="primary" theme="outline" icon={<PlusOutlined />} onClick={handleAddAssignee} block>
            添加审批人
          </Button>
        </Space>
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">审批模式</Form.Label>
        <Select
          size="small"
          value={config.approvalMode}
          onChange={(v) => handleUpdate({ approvalMode: v as ApprovalMode })}
          optionList={APPROVAL_MODE_OPTIONS}
          className="mp-w-full"
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">审批层级数</Form.Label>
        <InputNumber
          size="small"
          min={1}
          max={10}
          value={config.approvalLevels}
          onChange={(v) => handleUpdate({ approvalLevels: (v ?? 1) as number })}
          className="mp-w-full"
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">超时时间（小时）</Form.Label>
        <InputNumber
          size="small"
          min={1}
          max={168}
          value={config.timeoutHours}
          onChange={(v) => handleUpdate({ timeoutHours: (v ?? undefined) as number | undefined })}
          className="mp-w-full"
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">允许拒绝</Form.Label>
        <Switch
          size="small"
          checked={config.allowReject}
          onChange={(v) => handleUpdate({ allowReject: v })}
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">允许转办</Form.Label>
        <Switch
          size="small"
          checked={config.allowTransfer}
          onChange={(v) => handleUpdate({ allowTransfer: v })}
        />
      </div>

      <div className="mp-mb-4">
        <Form.Label className="mp-block mp-mb-2">抄送人列表</Form.Label>
        <Space vertical spacing="tight" className="mp-w-full">
          {(config.ccList || []).map((id, index) => (
            <Space key={index} spacing="tight" className="mp-w-full">
              <Input
                size="small"
                className="mp-w-200"
                value={id}
                onChange={(value) => handleUpdateCC(index, value)}
                placeholder="输入抄送人ID"
              />
              <Button size="small" type="danger" icon={<DeleteOutlined />} onClick={() => handleRemoveCC(index)} />
            </Space>
          ))}
          <Button size="small" type="primary" theme="outline" icon={<PlusOutlined />} onClick={handleAddCC} block>
            添加抄送人
          </Button>
        </Space>
      </div>
    </div>
  );
}
