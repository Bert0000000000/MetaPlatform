import { useEffect } from 'react';
import { Form, Modal } from '@douyinfe/semi-ui';
import type { AppItem, AppCreateRequest, AppUpdateRequest } from '@/api/apphub/types';
import { APP_ICONS } from './componentRegistry';

interface AppFormProps {
  open: boolean;
  title: string;
  initial?: AppItem | null;
  groups: string[];
  onOk: (values: AppCreateRequest | AppUpdateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export default function AppForm({ open, title, initial, groups, onOk, onCancel, confirmLoading }: AppFormProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setValues({
          name: initial.name,
          code: initial.code,
          description: initial.description,
          icon: initial.icon,
          group: initial.group,
        });
      } else {
        form.reset();
        form.setValues({ icon: APP_ICONS[0] });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validate();
    onOk(values);
  };

  const iconOptions = APP_ICONS.map((icon) => ({ label: icon, value: icon }));
  const groupOptions = groups.map((g) => ({ label: g, value: g }));

  return (
    <Modal
      title={title}
      visible={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
    >
      <Form form={form}>
        <Form.Input
          field="name"
          label="应用名称"
          rules={[
            { required: true, message: '请输入应用名称' },
            { min: 1, max: 50, message: '长度 1-50 个字符' },
            { pattern: /\S+/, message: '不能纯空格' },
          ]}
          placeholder="例如：采购管理"
        />
        <Form.Input
          field="code"
          label="应用编码"
          rules={[
            { required: true, message: '请输入应用编码' },
            { min: 3, max: 30, message: '长度 3-30 个字符' },
            { pattern: CODE_PATTERN, message: '以字母开头，可包含字母、数字、下划线' },
          ]}
          placeholder="例如：PURCHASE"
          disabled={!!initial}
        />
        <Form.TextArea
          field="description"
          label="应用描述"
          rules={[{ max: 200, message: '最多 200 个字符' }]}
          rows={3}
          placeholder="描述应用用途"
        />
        <Form.Select field="icon" label="应用图标" optionList={iconOptions} placeholder="选择图标" />
        <Form.Select
          field="group"
          label="应用分组"
          optionList={groupOptions}
          placeholder="选择或输入分组"
          showClear
          filter
        />
      </Form>
    </Modal>
  );
}
