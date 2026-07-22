import { Card, Form, Tabs } from 'antd';
import { Editor } from '@monaco-editor/react';
import type { FormConfig, FormScripts } from '@/types';

interface FormScriptsPanelProps {
  config: FormConfig;
  onChange: (c: FormConfig) => void;
}

const SCRIPT_TEMPLATES: Record<keyof FormScripts, string> = {
  beforeSubmit: `// beforeSubmit: 提交前校验/加工数据
// 可用 API: form.setFieldVisible(fieldKey, visible)
//          form.setFieldRequired(fieldKey, required)
//          form.setFieldReadonly(fieldKey, readonly)
//          form.setFieldValue(fieldKey, value)
//          form.setFieldOptions(fieldKey, options)
//          form.addError(fieldKey, message)
//          console.log(...)
if (values.amount > 1000) {
  form.addError('amount', '金额不能超过 1000');
}
`,
  afterSubmit: `// afterSubmit: 提交成功后处理
console.log('submit done', values);
`,
  onChange: `// onChange: 字段值变化时联动
if (values.type === 'urgent') {
  form.setFieldRequired('deadline', true);
} else {
  form.setFieldRequired('deadline', false);
}
`,
};

export default function FormScriptsPanel({ config, onChange }: FormScriptsPanelProps) {
  const scripts: FormScripts = config.scripts || {};

  const updateScripts = (next: FormScripts) => {
    onChange({ ...config, scripts: next });
  };

  const updateScript = (key: keyof FormScripts, value: string | undefined) => {
    updateScripts({ ...scripts, [key]: value || '' });
  };

  const items = [
    {
      key: 'beforeSubmit',
      label: '提交前 (beforeSubmit)',
      children: (
        <Form.Item style={{ marginBottom: 0 }}>
          <Editor
            height={320}
            defaultLanguage="javascript"
            value={scripts.beforeSubmit || ''}
            onChange={(v) => updateScript('beforeSubmit', v)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
            }}
          />
        </Form.Item>
      ),
    },
    {
      key: 'afterSubmit',
      label: '提交后 (afterSubmit)',
      children: (
        <Form.Item style={{ marginBottom: 0 }}>
          <Editor
            height={320}
            defaultLanguage="javascript"
            value={scripts.afterSubmit || ''}
            onChange={(v) => updateScript('afterSubmit', v)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
            }}
          />
        </Form.Item>
      ),
    },
    {
      key: 'onChange',
      label: '值变化 (onChange)',
      children: (
        <Form.Item style={{ marginBottom: 0 }}>
          <Editor
            height={320}
            defaultLanguage="javascript"
            value={scripts.onChange || ''}
            onChange={(v) => updateScript('onChange', v)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
            }}
          />
        </Form.Item>
      ),
    },
  ];

  return (
    <Card title="表单脚本" size="small">
      <Form layout="vertical">
        <Form.Item>
          <Tabs
            items={items}
            onTabClick={(key) => {
              if (!scripts[key as keyof FormScripts]) {
                updateScript(key as keyof FormScripts, SCRIPT_TEMPLATES[key as keyof FormScripts]);
              }
            }}
          />
        </Form.Item>
      </Form>
    </Card>
  );
}
