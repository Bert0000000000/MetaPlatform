import { Card, Form, Input, Select, Switch } from 'antd';
import type { FormConfig, FormGlobalSettings } from '@/types';

interface FormGlobalSettingsPanelProps {
  config: FormConfig;
  onChange: (c: FormConfig) => void;
}

export default function FormGlobalSettingsPanel({ config, onChange }: FormGlobalSettingsPanelProps) {
  const settings: FormGlobalSettings = config.globalSettings || {
    title: config.name || '',
    description: config.description || '',
    tabMode: 'none',
    submitText: config.submitText || '提交',
    layoutDensity: 'default',
  };

  const update = (partial: Partial<FormGlobalSettings>) => {
    const next: FormGlobalSettings = { ...settings, ...partial };
    onChange({
      ...config,
      name: next.title,
      description: next.description,
      submitText: next.submitText,
      globalSettings: next,
    });
  };

  return (
    <Card title="表单全局设置" size="small">
      <Form layout="vertical">
        <Form.Item label="表单标题">
          <Input
            value={settings.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="请输入表单标题"
          />
        </Form.Item>
        <Form.Item label="表单描述">
          <Input.TextArea
            rows={3}
            value={settings.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="请输入表单描述"
          />
        </Form.Item>
        <Form.Item label="标签页模式">
          <Select
            value={settings.tabMode || 'none'}
            onChange={(v) => update({ tabMode: v })}
            options={[
              { label: '无', value: 'none' },
              { label: '标签页', value: 'tab' },
              { label: '步骤条', value: 'step' },
            ]}
          />
        </Form.Item>
        <Form.Item label="提交文案">
          <Input
            value={settings.submitText || '提交'}
            onChange={(e) => update({ submitText: e.target.value })}
            placeholder="例如：提交、保存、确认"
          />
        </Form.Item>
        <Form.Item label="布局密度">
          <Select
            value={settings.layoutDensity || 'default'}
            onChange={(v) => update({ layoutDensity: v })}
            options={[
              { label: '默认', value: 'default' },
              { label: '紧凑', value: 'compact' },
              { label: '宽松', value: 'loose' },
            ]}
          />
        </Form.Item>
        <Form.Item label="提交后动作">
          <Select
            value={config.submitAction || 'toast'}
            onChange={(v) => onChange({ ...config, submitAction: v })}
            options={[
              { label: '显示成功提示', value: 'toast' },
              { label: '跳转到指定页面', value: 'redirect' },
              { label: '发起流程', value: 'flow' },
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
