import { useEffect } from 'react';
import { Form, Input, Select, Switch, Modal } from 'antd';
import type { Attribute, AttributeCreateRequest } from '@/types';
import { DATA_TYPES } from '@/types';

interface AttributeFormProps {
  open: boolean;
  title: string;
  initial?: Attribute | null;
  onOk: (values: AttributeCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export default function AttributeForm({
  open,
  title,
  initial,
  onOk,
  onCancel,
  confirmLoading,
}: AttributeFormProps) {
  const [form] = Form.useForm<AttributeCreateRequest>();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initial) {
        form.setFieldsValue({
          code: initial.code,
          name: initial.name,
          description: initial.description,
          dataType: initial.dataType,
          required: initial.required,
          unique: initial.unique,
          defaultValue: initial.defaultValue,
          unit: initial.unit,
        });
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
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          name="code"
          label="属性编码"
          rules={[
            { required: true, message: '请输入属性编码' },
            { max: 100, message: '最多 100 个字符' },
            { pattern: CODE_PATTERN, message: '必须以大写字母开头，仅包含大写字母、数字、下划线' },
          ]}
        >
          <Input placeholder="例如：CUSTOMER_NAME" disabled={!!initial} />
        </Form.Item>
        <Form.Item
          name="name"
          label="属性名称"
          rules={[
            { required: true, message: '请输入属性名称' },
            { max: 50, message: '最多 50 个字符' },
          ]}
        >
          <Input placeholder="例如：客户名称" />
        </Form.Item>
        <Form.Item
          name="dataType"
          label="数据类型"
          rules={[{ required: true, message: '请选择数据类型' }]}
        >
          <Select options={DATA_TYPES} placeholder="请选择数据类型" />
        </Form.Item>
        <Form.Item
          name="description"
          label="描述"
          rules={[{ max: 500, message: '最多 500 个字符' }]}
        >
          <Input.TextArea rows={2} placeholder="请输入描述" />
        </Form.Item>
        <Form.Item name="required" label="是否必填" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="unique" label="是否唯一" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="defaultValue" label="默认值">
          <Input placeholder="请输入默认值" />
        </Form.Item>
        <Form.Item
          name="unit"
          label="单位"
          rules={[{ max: 32, message: '最多 32 个字符' }]}
        >
          <Input placeholder="例如：元" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
