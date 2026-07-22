import { useEffect } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import type { AppItem, AppCreateRequest, AppUpdateRequest } from '@/types';
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
        form.setFieldsValue({
          name: initial.name,
          code: initial.code,
          description: initial.description,
          icon: initial.icon,
          group: initial.group,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ icon: APP_ICONS[0] });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="应用名称"
          rules={[
            { required: true, message: '请输入应用名称' },
            { min: 1, max: 50, message: '长度 1-50 个字符' },
            { pattern: /\S+/, message: '不能纯空格' },
          ]}
        >
          <Input placeholder="例如：采购管理" />
        </Form.Item>
        <Form.Item
          name="code"
          label="应用编码"
          rules={[
            { required: true, message: '请输入应用编码' },
            { min: 3, max: 30, message: '长度 3-30 个字符' },
            { pattern: CODE_PATTERN, message: '以字母开头，可包含字母、数字、下划线' },
          ]}
        >
          <Input placeholder="例如：PURCHASE" disabled={!!initial} />
        </Form.Item>
        <Form.Item name="description" label="应用描述" rules={[{ max: 200, message: '最多 200 个字符' }]}>
          <Input.TextArea rows={3} placeholder="描述应用用途" />
        </Form.Item>
        <Form.Item name="icon" label="应用图标">
          <Select placeholder="选择图标">
            {APP_ICONS.map((icon) => (
              <Select.Option key={icon} value={icon}>
                {icon}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="group" label="应用分组">
          <Select placeholder="选择或输入分组" allowClear showSearch>
            {groups.map((g) => (
              <Select.Option key={g} value={g}>
                {g}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
