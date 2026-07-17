import { Card, Form, Input, Switch, Select } from 'antd';
import type { FormConfig } from '@/types';

interface FormSettingsProps {
  config: FormConfig;
  onChange: (c: FormConfig) => void;
}

export default function FormSettings({ config, onChange }: FormSettingsProps) {
  return (
    <Card title="表单全局设置" size="small">
      <Form layout="vertical">
        <Form.Item label="表单名称">
          <Input
            value={config.name}
            onChange={(e) => onChange({ ...config, name: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="表单描述">
          <Input.TextArea
            rows={2}
            value={config.description || ''}
            onChange={(e) => onChange({ ...config, description: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="提交按钮文案">
          <Input
            value={config.submitText || ''}
            onChange={(e) => onChange({ ...config, submitText: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="提交后动作">
          <Select
            value={config.submitAction || 'toast'}
            onChange={(v) => onChange({ ...config, submitAction: v })}
            options={[
              { label: '显示提示', value: 'toast' },
              { label: '跳转链接', value: 'redirect' },
              { label: '触发流程', value: 'flow' },
            ]}
          />
        </Form.Item>
        <Form.Item label="允许撤回">
          <Switch
            checked={config.allowWithdraw ?? false}
            onChange={(c) => onChange({ ...config, allowWithdraw: c })}
          />
        </Form.Item>
        <Form.Item label="允许编辑已提交">
          <Switch
            checked={config.allowEdit ?? false}
            onChange={(c) => onChange({ ...config, allowEdit: c })}
          />
        </Form.Item>
      </Form>
    </Card>
  );
}
