import { useEffect } from 'react';
import { Form, InputNumber, Modal } from '@douyinfe/semi-ui';
import type { PermissionRule, PermissionRuleCreateRequest } from '@/api/mcphub/types';

interface RuleEditorProps {
  open: boolean;
  initial?: PermissionRule | null;
  resources: Array<{ type: PermissionRule['resourceType']; id: string; name: string }>;
  onOk: (values: PermissionRuleCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const SUBJECT_TYPE_OPTIONS = [
  { label: '用户', value: 'user' },
  { label: '角色', value: 'role' },
  { label: '应用', value: 'app' },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: '工具', value: 'tool' },
  { label: 'Server', value: 'server' },
  { label: '资源', value: 'resource' },
  { label: 'Prompt', value: 'prompt' },
];

const ACTION_OPTIONS = [
  { label: '调用 (invoke)', value: 'invoke' },
  { label: '读取 (read)', value: 'read' },
  { label: '管理 (admin)', value: 'admin' },
];

const EFFECT_OPTIONS = [
  { label: '允许', value: 'allow' },
  { label: '拒绝', value: 'deny' },
];

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
        form.setValues(initial);
      } else {
        form.reset();
        form.setValues({
          effect: 'allow',
          enabled: true,
          priority: 100,
          actions: ['invoke'],
        });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validate();
    onOk(values);
  };

  return (
    <Modal
      visible={open}
      title={initial ? '编辑权限规则' : '创建权限规则'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
    >
      <Form form={form}>
        <Form.Input field="name" label="规则名称" rules={[{ required: true }]} />
        <Form.Input field="subject" label="主体" rules={[{ required: true }]} placeholder="用户 / 角色 / 应用 ID" />
        <Form.Select
          field="subjectType"
          label="主体类型"
          rules={[{ required: true }]}
          optionList={SUBJECT_TYPE_OPTIONS}
        />
        <Form.Select
          field="resourceType"
          label="资源类型"
          rules={[{ required: true }]}
          optionList={RESOURCE_TYPE_OPTIONS}
        />
        <Form.Select
          field="resourceId"
          label="资源 ID"
          rules={[{ required: true }]}
          placeholder="选择资源"
          optionList={resources.map((r) => ({
            label: `${r.type}:${r.name}`,
            value: r.id,
          }))}
        />
        <Form.Select
          field="actions"
          label="允许操作"
          rules={[{ required: true }]}
          multiple
          optionList={ACTION_OPTIONS}
        />
        <Form.Select
          field="effect"
          label="效果"
          rules={[{ required: true }]}
          optionList={EFFECT_OPTIONS}
        />
        <Form.InputNumber
          field="priority"
          label="优先级（数字越小优先级越高）"
          style={{ width: '100%' }}
        />
        <Form.Switch field="enabled" label="启用" />
      </Form>
    </Modal>
  );
}
