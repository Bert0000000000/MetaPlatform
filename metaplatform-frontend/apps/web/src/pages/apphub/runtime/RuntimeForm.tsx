import { useState } from 'react';
import { Button, Card, Empty, Form, Toast } from '@douyinfe/semi-ui';
import type { FormConfig, FormField } from '@/api/apphub/types';
import { runScript } from '../utils/safeScriptRunner';

/**
 * 表单运行时渲染器：从 FormDesignerPage 的 renderRuntimeField / handlePreviewSubmit 提取。
 * 接收 form 节点的 config（FormConfig），渲染成可填写的 Semi 表单，提交时执行 beforeSubmit/afterSubmit 脚本。
 * 联动规则（config.linkageRules）作为后续增强接入点（见 linkageEngine.evaluateLinkageRules）。
 */
interface RuntimeFormProps {
  config: FormConfig;
}

export default function RuntimeForm({ config }: RuntimeFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const renderField = (field: FormField) => {
    if (field.hidden) return null;
    const disabled = !!field.readonly;
    const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : [];

    switch (field.type) {
      case 'textarea':
        return <Form.TextArea field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} rows={3} disabled={disabled} />;
      case 'number':
        return <Form.InputNumber field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} disabled={disabled} style={{ width: '100%' }} />;
      case 'radio':
        return <Form.Select field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} disabled={disabled} optionList={(field.options || []).map((o) => ({ value: o.value, label: o.label }))} />;
      case 'checkbox':
        return <Form.Select field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} disabled={disabled} multiple optionList={(field.options || []).map((o) => ({ value: o.value, label: o.label }))} />;
      case 'select':
        return <Form.Select field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} disabled={disabled} optionList={(field.options || []).map((o) => ({ value: o.value, label: o.label }))} />;
      case 'date':
        return <Form.Input field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder || 'YYYY-MM-DD'} disabled={disabled} />;
      case 'switch':
        return <Form.Switch field={field.fieldKey} label={field.label} rules={rules} disabled={disabled} />;
      case 'upload':
        return <Form.Slot label={field.label}><Button disabled={disabled}>上传附件</Button></Form.Slot>;
      case 'divider':
        return <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 16 }}>{field.label}</div>;
      case 'group':
        return <Card title={field.label} style={{ background: 'var(--muted)', marginBottom: 16 }} />;
      default:
        return <Form.Input field={field.fieldKey} label={field.label} rules={rules} placeholder={field.placeholder} disabled={disabled} />;
    }
  };

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      const values = (await form.validate()) as Record<string, unknown>;
      const before = runScript(config.scripts?.beforeSubmit || '', values);
      if (before.errors.length > 0) {
        Toast.error(before.errors[0].message);
        return;
      }
      Toast.success('提交成功');
      runScript(config.scripts?.afterSubmit || '', values);
    } catch {
      Toast.error('请检查表单填写');
    } finally {
      setSubmitting(false);
    }
  };

  if (!config?.fields?.length) {
    return <Empty description="该表单暂无字段" style={{ padding: 48 }} />;
  }

  return (
    <Card title={config.name} style={{ maxWidth: 760 }}>
      {config.description && (
        <div style={{ color: 'var(--semi-color-text-2)', fontSize: 13, marginBottom: 16 }}>{config.description}</div>
      )}
      <Form form={form} labelPosition="top" style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {config.fields.map((f) => {
            const node = renderField(f);
            if (!node) return null;
            const full = f.width === '100%' || f.type === 'divider' || f.type === 'group' || f.type === 'textarea';
            return <div key={f.id} style={{ gridColumn: full ? 'span 2' : 'span 1' }}>{node}</div>;
          })}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button theme="solid" type="primary" loading={submitting} onClick={onSubmit}>
            {config.submitText || '提交'}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
