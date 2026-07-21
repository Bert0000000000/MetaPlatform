import { Select, Table, Switch, Typography, Space, Empty } from 'antd';
import type { ModuleItem, FormFieldBinding } from '@/types';

interface FormBindingProps {
  formModules: ModuleItem[];
  bindings: FormFieldBinding[];
  onChange: (bindings: FormFieldBinding[]) => void;
}

const MOCK_FIELDS: Array<{ fieldKey: string; fieldLabel: string }> = [
  { fieldKey: 'applicant', fieldLabel: '申请人' },
  { fieldKey: 'department', fieldLabel: '部门' },
  { fieldKey: 'amount', fieldLabel: '金额' },
  { fieldKey: 'type', fieldLabel: '类型' },
  { fieldKey: 'description', fieldLabel: '描述' },
  { fieldKey: 'date', fieldLabel: '日期' },
  { fieldKey: 'attachment', fieldLabel: '附件' },
];

export default function FormBinding({ formModules, bindings, onChange }: FormBindingProps) {
  const handleToggleVisible = (fieldKey: string, visible: boolean) => {
    const existing = bindings.find((b) => b.fieldKey === fieldKey);
    if (existing) {
      onChange(bindings.map((b) => (b.fieldKey === fieldKey ? { ...b, visible } : b)));
    } else {
      const field = MOCK_FIELDS.find((f) => f.fieldKey === fieldKey);
      if (field) {
        onChange([...bindings, { ...field, visible, required: false, readonly: false }]);
      }
    }
  };

  const handleToggleRequired = (fieldKey: string, required: boolean) => {
    const existing = bindings.find((b) => b.fieldKey === fieldKey);
    if (existing) {
      onChange(bindings.map((b) => (b.fieldKey === fieldKey ? { ...b, required } : b)));
    } else {
      const field = MOCK_FIELDS.find((f) => f.fieldKey === fieldKey);
      if (field) {
        onChange([...bindings, { ...field, visible: true, required, readonly: false }]);
      }
    }
  };

  const handleToggleReadonly = (fieldKey: string, readonly: boolean) => {
    const existing = bindings.find((b) => b.fieldKey === fieldKey);
    if (existing) {
      onChange(bindings.map((b) => (b.fieldKey === fieldKey ? { ...b, readonly } : b)));
    } else {
      const field = MOCK_FIELDS.find((f) => f.fieldKey === fieldKey);
      if (field) {
        onChange([...bindings, { ...field, visible: true, required: false, readonly }]);
      }
    }
  };

  const getBinding = (fieldKey: string): FormFieldBinding | undefined => {
    return bindings.find((b) => b.fieldKey === fieldKey);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Title level={5}>表单字段绑定</Typography.Title>

      {formModules.length > 0 && (
        <Space style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary">关联表单：</Typography.Text>
          <Select
            placeholder="选择表单模块"
            style={{ width: 200 }}
            options={formModules.map((m) => ({ label: m.name, value: m.moduleId }))}
          />
        </Space>
      )}

      {MOCK_FIELDS.length === 0 ? (
        <Empty description="请先关联表单模块" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          size="small"
          dataSource={MOCK_FIELDS.map((f) => ({ ...f, key: f.fieldKey }))}
          pagination={false}
          columns={[
            { title: '字段', dataIndex: 'fieldLabel', key: 'fieldLabel' },
            {
              title: '可见',
              key: 'visible',
              width: 60,
              render: (_: unknown, record: { fieldKey: string }) => (
                <Switch
                  size="small"
                  checked={getBinding(record.fieldKey)?.visible ?? false}
                  onChange={(v) => handleToggleVisible(record.fieldKey, v)}
                />
              ),
            },
            {
              title: '必填',
              key: 'required',
              width: 60,
              render: (_: unknown, record: { fieldKey: string }) => (
                <Switch
                  size="small"
                  checked={getBinding(record.fieldKey)?.required ?? false}
                  onChange={(v) => handleToggleRequired(record.fieldKey, v)}
                />
              ),
            },
            {
              title: '只读',
              key: 'readonly',
              width: 60,
              render: (_: unknown, record: { fieldKey: string }) => (
                <Switch
                  size="small"
                  checked={getBinding(record.fieldKey)?.readonly ?? false}
                  onChange={(v) => handleToggleReadonly(record.fieldKey, v)}
                />
              ),
            },
          ]}
         scroll={{ x: 'max-content' }}/>
      )}
    </div>
  );
}
