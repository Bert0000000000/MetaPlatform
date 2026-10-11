import { useState } from 'react';
import { Select, Table, Switch, Typography, Space, Empty } from '@douyinfe/semi-ui';
import type { ModuleItem, FormFieldBinding } from '@/api/apphub/types';

interface FormBindingProps {
  formModules: ModuleItem[];
  bindings: FormFieldBinding[];
  onChange: (bindings: FormFieldBinding[]) => void;
}


export default function FormBinding({ formModules, bindings, onChange }: FormBindingProps) {
  const [moduleId, setModuleId] = useState('');
  const fields = (formModules.find(m => m.moduleId === moduleId)?.config?.fields ?? []).map(f => ({ fieldKey: f.fieldKey, fieldLabel: f.label }));
  const handleToggleVisible = (fieldKey: string, visible: boolean) => {
    const existing = bindings.find((b) => b.fieldKey === fieldKey);
    if (existing) {
      onChange(bindings.map((b) => (b.fieldKey === fieldKey ? { ...b, visible } : b)));
    } else {
      const field = fields.find((f) => f.fieldKey === fieldKey);
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
      const field = fields.find((f) => f.fieldKey === fieldKey);
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
      const field = fields.find((f) => f.fieldKey === fieldKey);
      if (field) {
        onChange([...bindings, { ...field, visible: true, required: false, readonly }]);
      }
    }
  };

  const getBinding = (fieldKey: string): FormFieldBinding | undefined => {
    return bindings.find((b) => b.fieldKey === fieldKey);
  };

  return (
    <div className="mp-mt-3">
      <Typography.Title heading={5}>表单字段绑定</Typography.Title>

      {formModules.length > 0 && (
        <Space spacing="tight" className="mp-mb-3">
          <Typography.Text type="tertiary">关联表单：</Typography.Text>
          <Select
            value={moduleId}
            onChange={value => { setModuleId(String(value)); onChange([]); }}
            placeholder="选择表单模块"
            className="mp-w-200"
            optionList={formModules.map((m) => ({ label: m.name, value: m.moduleId }))}
          />
        </Space>
      )}

      {fields.length === 0 ? (
        <Empty description="请先关联具有已保存字段的表单模块" />
      ) : (
        <Table
          size="small"
          rowKey="fieldKey"
          dataSource={fields.map((f) => ({ ...f, key: f.fieldKey }))}
          pagination={false}
          scroll={{ x: 'max-content' }}
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
        />
      )}
    </div>
  );
}
