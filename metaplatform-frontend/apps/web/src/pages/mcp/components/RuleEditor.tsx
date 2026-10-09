import { useEffect, useState } from 'react';
import { Button, Form, InputNumber, SideSheet } from '@douyinfe/semi-ui';
import type { PermissionRule, PermissionRuleCreateRequest } from '@/api/mcphub/types';

interface RuleEditorProps {
  open: boolean;
  initial?: PermissionRule | null;
  resources: Array<{ type: PermissionRule['resourceType']; id: string; name: string }>;
  onOk: (values: PermissionRuleCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
  disabled?: boolean;
}

const SUBJECT_TYPE_OPTIONS = [
  { label: '用户', value: 'USER' },
  { label: '角色', value: 'ROLE' },
  { label: '应用', value: 'APP' },
  { label: '数字员工', value: 'AGENT' },
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
  { label: '允许', value: 'ALLOW' },
  { label: '拒绝', value: 'DENY' },
];

const FORM_DRAWER_W = 420;

export default function RuleEditor({
  open,
  initial,
  resources,
  onOk,
  onCancel,
  confirmLoading,
  disabled,
}: RuleEditorProps) {
  const [form] = Form.useForm<PermissionRuleCreateRequest>();
  const [resourceType, setResourceType] = useState('tool');

  useEffect(() => {
    if (open) {
      if (initial) {
        setResourceType(initial.resourceType);
        form.setValues(initial);
      } else {
        setResourceType('tool');
        form.reset();
        form.setValues({
          effect: 'ALLOW',
          enabled: true,
          priority: 100,
          action: 'invoke',
          resourceIds: [],
          resourceType: 'tool',
        });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    if (disabled) return;
    const values = await form.validate();
    onOk(values);
  };

  return (
    <SideSheet
      visible={open}
      title={initial ? '编辑权限规则' : '创建权限规则'}
      onCancel={onCancel}
      width={`min(${FORM_DRAWER_W}px, 100vw)`}
      footer={
        <>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" type="primary" disabled={disabled} loading={confirmLoading} onClick={() => void handleOk()}>
            {initial ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <Form form={form}>
        <Form.Input field="name" label="规则名称" rules={[{ required: true }]} />
        <Form.Input field="subjectId" label="主体" rules={[{ required: true }]} placeholder="用户 / 角色 / 应用 / 员工 ID" />
        <Form.Select
          field="subjectType"
          label="主体类型"
          rules={[{ required: true }]}
          optionList={SUBJECT_TYPE_OPTIONS}
          style={{ width: '100%' }}
        />
        <Form.Select
          field="resourceType"
          label="资源类型"
          rules={[{ required: true }]}
          optionList={RESOURCE_TYPE_OPTIONS}
          style={{ width: '100%' }}
          onChange={(value) => {
            setResourceType(String(value));
            form.setValues({ resourceIds: [] });
          }}
        />
        <Form.Select
          field="resourceIds"
          label="资源 ID"
          rules={[{ required: true }]}
          placeholder="选择资源"
          multiple
          style={{ width: '100%' }}
          optionList={resources.filter(r => r.type === resourceType && typeof r.id === 'string' && r.id.trim()).map((r) => ({
            label: `${r.type}:${r.name}`,
            value: r.id,
          }))}
        />
        <Form.Select
          field="action"
          label="允许操作"
          rules={[{ required: true }]}
          optionList={ACTION_OPTIONS}
          style={{ width: '100%' }}
        />
        <Form.Select
          field="effect"
          label="效果"
          rules={[{ required: true }]}
          optionList={EFFECT_OPTIONS}
          style={{ width: '100%' }}
        />
        <Form.TextArea field="conditionExpression" label="条件表达式" />
        <Form.InputNumber
          field="priority"
          label="优先级（数字越小优先级越高）"
          className="mp-w-full"
        />
        <Form.Switch field="enabled" label="启用" />
      </Form>
    </SideSheet>
  );
}
