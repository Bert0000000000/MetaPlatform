import { useEffect } from 'react';
import { Form, Input, Modal, Radio, Select } from 'antd';
import type { ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, ModuleType } from '@/types';
import { MODULE_TYPE_LABELS, MODULE_ICONS } from './componentRegistry';

interface ModuleFormProps {
  open: boolean;
  title: string;
  initial?: ModuleItem | null;
  onOk: (values: ModuleCreateRequest | ModuleUpdateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const MODULE_TYPES: ModuleType[] = ['FORM', 'FLOW', 'BOARD', 'PAGE'];

export default function ModuleForm({ open, title, initial, onOk, onCancel, confirmLoading }: ModuleFormProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue({
          name: initial.name,
          code: initial.code,
          type: initial.type,
          description: initial.description,
          icon: initial.icon,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ type: 'FORM', icon: MODULE_ICONS.FORM });
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
          label="模块名称"
          rules={[
            { required: true, message: '请输入模块名称' },
            { min: 1, max: 30, message: '长度 1-30 个字符' },
            { pattern: /\S+/, message: '不能纯空格' },
          ]}
        >
          <Input placeholder="例如：采购申请" />
        </Form.Item>
        <Form.Item
          name="code"
          label="模块编码"
          rules={[
            { required: true, message: '请输入模块编码' },
            { min: 2, max: 30, message: '长度 2-30 个字符' },
            { pattern: CODE_PATTERN, message: '以字母开头，可包含字母、数字、下划线' },
          ]}
        >
          <Input placeholder="例如：purchase_apply" disabled={!!initial} />
        </Form.Item>
        <Form.Item name="type" label="模块类型" rules={[{ required: true, message: '请选择模块类型' }]}>
          <Radio.Group disabled={!!initial}>
            {MODULE_TYPES.map((t) => (
              <Radio.Button key={t} value={t}>
                {MODULE_TYPE_LABELS[t]}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item name="description" label="模块描述" rules={[{ max: 200, message: '最多 200 个字符' }]}>
          <Input.TextArea rows={2} placeholder="描述模块功能" />
        </Form.Item>
        <Form.Item name="icon" label="模块图标">
          <Select placeholder="选择图标">
            {Object.entries(MODULE_ICONS).map(([type, icon]) => (
              <Select.Option key={icon} value={icon}>
                {icon} ({MODULE_TYPE_LABELS[type]})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
