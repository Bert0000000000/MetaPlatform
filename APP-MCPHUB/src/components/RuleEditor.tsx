import { Modal, Form, Input, Select, InputNumber, Switch } from 'antd';
import type { PermissionRule, PermissionRuleCreateRequest } from '@/types';

interface RuleEditorProps {
  open: boolean;
  initial?: PermissionRule | null;
  resources: Array<{ type: PermissionRule['resourceType']; id: string; name: string }>;
  onOk: (values: PermissionRuleCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function RuleEditor({
  open,
  initial,
  resources,
  onOk,
  onCancel,
  confirmLoading,
}: RuleEditorProps) {
  const [form] = Form.useForm<PermissionRuleCreateRequest>();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue(initial);
      } else {
        form.resetFields();
        form.setFieldsValue({
          effect: 'allow',
          enabled: true,
          priority: 100,
          actions: ['invoke'],
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
      open={open}
      title={initial ? '编辑权限规则' : '创建权限规则'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="subject" label="主体" rules={[{ required: true }]}>
          <Input placeholder="用户 / 角色 / 应用 ID" />
        </Form.Item>
        <Form.Item name="subjectType" label="主体类型" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '用户', value: 'user' },
              { label: '角色', value: 'role' },
              { label: '应用', value: 'app' },
            ]}
          />
        </Form.Item>
        <Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '工具', value: 'tool' },
              { label: 'Server', value: 'server' },
              { label: '资源', value: 'resource' },
              { label: 'Prompt', value: 'prompt' },
            ]}
          />
        </Form.Item>
        <Form.Item name="resourceId" label="资源 ID" rules={[{ required: true }]}>
          <Select
            placeholder="选择资源"
            showSearch
            options={resources.map((r) => ({
              label: `${r.type}:${r.name}`,
              value: r.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="actions" label="允许操作" rules={[{ required: true }]}>
          <Select
            mode="multiple"
            options={[
              { label: '调用 (invoke)', value: 'invoke' },
              { label: '读取 (read)', value: 'read' },
              { label: '管理 (admin)', value: 'admin' },
            ]}
          />
        </Form.Item>
        <Form.Item name="effect" label="效果" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '允许', value: 'allow' },
              { label: '拒绝', value: 'deny' },
            ]}
          />
        </Form.Item>
        <Form.Item name="priority" label="优先级（数字越小优先级越高）">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

import { useEffect } from 'react';
