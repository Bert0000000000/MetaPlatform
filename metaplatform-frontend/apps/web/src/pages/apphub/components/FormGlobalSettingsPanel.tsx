import type { CSSProperties } from 'react';
import { Card, Form, Input, Select, Switch, TextArea } from '@douyinfe/semi-ui';
import type { FormConfig, FormGlobalSettings } from '@/api/apphub/types';

interface FormGlobalSettingsPanelProps {
  config: FormConfig;
  onChange: (c: FormConfig) => void;
}

const FIELD_LABEL_STYLE: CSSProperties = { display: 'block', marginBottom: 8 };

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
    <Card title="表单全局设置">
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>表单标题</Form.Label>
        <Input
          value={settings.title}
          onChange={(value) => update({ title: value })}
          placeholder="请输入表单标题"
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>表单描述</Form.Label>
        <TextArea
          rows={3}
          value={settings.description}
          onChange={(value) => update({ description: value })}
          placeholder="请输入表单描述"
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>标签页模式</Form.Label>
        <Select
          value={settings.tabMode || 'none'}
          onChange={(v) => update({ tabMode: v as FormGlobalSettings['tabMode'] })}
          optionList={[
            { label: '无', value: 'none' },
            { label: '标签页', value: 'tab' },
            { label: '步骤条', value: 'step' },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>提交文案</Form.Label>
        <Input
          value={settings.submitText || '提交'}
          onChange={(value) => update({ submitText: value })}
          placeholder="例如：提交、保存、确认"
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>布局密度</Form.Label>
        <Select
          value={settings.layoutDensity || 'default'}
          onChange={(v) => update({ layoutDensity: v as FormGlobalSettings['layoutDensity'] })}
          optionList={[
            { label: '默认', value: 'default' },
            { label: '紧凑', value: 'compact' },
            { label: '宽松', value: 'loose' },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>提交后动作</Form.Label>
        <Select
          value={config.submitAction || 'toast'}
          onChange={(v) => onChange({ ...config, submitAction: v as typeof config.submitAction })}
          optionList={[
            { label: '显示成功提示', value: 'toast' },
            { label: '跳转到指定页面', value: 'redirect' },
            { label: '发起流程', value: 'flow' },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>允许撤回</Form.Label>
        <Switch
          checked={config.allowWithdraw ?? false}
          onChange={(c) => onChange({ ...config, allowWithdraw: c })}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Form.Label style={FIELD_LABEL_STYLE}>允许编辑已提交</Form.Label>
        <Switch
          checked={config.allowEdit ?? false}
          onChange={(c) => onChange({ ...config, allowEdit: c })}
        />
      </div>
    </Card>
  );
}
