import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Space,
  Tag,
  Typography,
  Toast,
  Tabs,
  Modal,
  TextArea,
} from '@douyinfe/semi-ui';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  EyeOutlined,
  DeleteOutlined,
  CopyOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { getModule, updateModule } from '@/api/apphub/modules';
import {
  getFormDefinition,
  saveFormSettings,
  saveFormLinkageRules,
  saveFormScripts,
  validateForm,
} from '@/api/apphub/forms';
import AIGenerateButton from './components/AIGenerateButton';
import { COMPONENT_DEFINITIONS } from './components/componentRegistry';
import FormGlobalSettingsPanel from './components/FormGlobalSettingsPanel';
import FormLinkageRulesPanel from './components/FormLinkageRulesPanel';
import FormScriptsPanel from './components/FormScriptsPanel';
import { evaluateLinkageRules, applyLinkageToFields } from './utils/linkageEngine';
import { runScript } from './utils/safeScriptRunner';
import type {
  ModuleItem,
  FormField,
  FormConfig,
  FormGenResult,
  FormGlobalSettings,
  LinkageRule,
  FormScripts,
} from '@/api/apphub/types';


const DESIGNER_IMPORT_KEY = 'metaplatform:designer:import';

type ActiveTab = 'fields' | 'settings' | 'linkage' | 'scripts';

function generateFieldKey(type: string): string {
  return `${type}_${Date.now().toString(36)}`;
}

function toFormField(f: Partial<FormField>, idx: number): FormField {
  return {
    id: crypto.randomUUID(),
    type: f.type || 'text',
    label: f.label || `字段${idx + 1}`,
    fieldKey: f.fieldKey || generateFieldKey(f.type || 'text'),
    placeholder: f.placeholder,
    defaultValue: f.defaultValue,
    width: f.width || ('100%' as const),
    required: f.required,
    minLength: f.minLength,
    maxLength: f.maxLength,
    pattern: f.pattern,
    patternMessage: f.patternMessage,
    readonly: f.readonly,
    hidden: f.hidden,
    helpText: f.helpText,
    options: f.options,
    precision: f.precision,
    min: f.min,
    max: f.max,
    unit: f.unit,
    accept: f.accept,
    maxFileSize: f.maxFileSize,
    maxFileCount: f.maxFileCount,
  };
}

function consumeDesignerImport(): { type: string; content: string } | null {
  try {
    const raw = localStorage.getItem(DESIGNER_IMPORT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { type?: string; content?: string };
    localStorage.removeItem(DESIGNER_IMPORT_KEY);
    if (data.type && data.content) return { type: data.type, content: data.content };
    return null;
  } catch {
    return null;
  }
}

function normalizeConfig(m: ModuleItem): FormConfig {
  const base: FormConfig = m.config || {
    name: m.name,
    fields: [],
    submitText: '提交',
    submitAction: 'toast',
    allowWithdraw: true,
    allowEdit: false,
  };
  return {
    ...base,
    globalSettings: base.globalSettings || {
      title: base.name || m.name,
      description: base.description || '',
      tabMode: 'none',
      submitText: base.submitText || '提交',
      layoutDensity: 'default',
    },
    linkageRules: base.linkageRules || [],
    scripts: base.scripts || {},
  };
}

export default function FormDesignerPage({ appId: appIdProp, moduleId: moduleIdProp }: { appId?: string; moduleId?: string } = {}) {
  const { appId: routeAppId, moduleId: routeModuleId } = useParams<{ appId: string; moduleId: string }>();
  const appId = appIdProp || routeAppId;
  const moduleId = moduleIdProp || routeModuleId;
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleItem | null>(null);
  const [config, setConfig] = useState<FormConfig>({ name: '', fields: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('fields');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [previewForm] = Form.useForm();

  useEffect(() => {
    if (!moduleId) return;
    Promise.all([getModule(moduleId), getFormDefinition(moduleId)]).then(([m, definition]) => {
      setModule(m);
      let initialConfig = normalizeConfig(m);

      const settings = definition.globalSettings as FormGlobalSettings | undefined;
      const rules = definition.linkageRules as LinkageRule[] | undefined;
      const scripts = definition.scripts as FormScripts | undefined;

      if (settings || rules || scripts) {
        initialConfig = {
          ...initialConfig,
          globalSettings: settings || initialConfig.globalSettings,
          linkageRules: rules || initialConfig.linkageRules,
          scripts: scripts || initialConfig.scripts,
        };
      }

      const imported = consumeDesignerImport();
      if (imported && imported.type === 'form') {
        try {
          const gen = JSON.parse(imported.content) as FormGenResult;
          const existingKeys = new Set(initialConfig.fields.map((f) => f.fieldKey));
          const newFields = gen.fields
            .filter((f) => f.fieldKey && !existingKeys.has(f.fieldKey))
            .map((f, idx) => toFormField(f, idx));
          if (newFields.length > 0) {
            setConfig({ ...initialConfig, fields: [...initialConfig.fields, ...newFields] });
            Toast.success(`从 AI 导入 ${newFields.length} 个字段`);
            return;
          }
        } catch {
          // ignore parse error
        }
      }
      setConfig(initialConfig);
    });
  }, [moduleId]);

  const handleAIGenerate = (result: FormGenResult) => {
    const existingKeys = new Set(config.fields.map((f) => f.fieldKey));
    const newFields = result.fields
      .filter((f) => f.fieldKey && !existingKeys.has(f.fieldKey))
      .map((f, idx) => toFormField(f, idx));
    if (newFields.length === 0) {
      Toast.warning('AI 生成的字段已存在，未重复导入');
      return;
    }
    setConfig((prev) => ({ ...prev, fields: [...prev.fields, ...newFields] }));
    Toast.success(`已导入 ${newFields.length} 个 AI 字段`);
  };

  const selectedField = config.fields.find((f) => f.id === selectedId) || null;

  const handleAddField = (def: typeof COMPONENT_DEFINITIONS[number]) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: def.type,
      ...def.defaultProps,
      fieldKey: generateFieldKey(def.type),
    } as FormField;
    setConfig((prev) => ({ ...prev, fields: [...prev.fields, newField] }));
    setSelectedId(newField.id);
  };

  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  };

  const handleDeleteField = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleCopyField = (field: FormField) => {
    const copy: FormField = {
      ...field,
      id: crypto.randomUUID(),
      fieldKey: generateFieldKey(field.type),
      label: `${field.label}_副本`,
    };
    setConfig((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === field.id);
      const fields = [...prev.fields];
      fields.splice(idx + 1, 0, copy);
      return { ...prev, fields };
    });
    setSelectedId(copy.id);
  };

  const handleMoveField = (id: string, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(prev.fields.length - 1, idx + 1);
      const fields = [...prev.fields];
      const [removed] = fields.splice(idx, 1);
      fields.splice(newIdx, 0, removed);
      return { ...prev, fields };
    });
  };

  const validateLocal = (): boolean => {
    if (config.fields.length === 0) {
      Toast.warning('请至少添加一个组件');
      return false;
    }
    const keys = config.fields.map((f) => f.fieldKey);
    if (new Set(keys).size !== keys.length) {
      Toast.warning('字段标识不能重复');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!moduleId) return;
    if (!validateLocal()) return;

    setSubmitting(true);
    try {
      const validateRes = await validateForm(moduleId, {
        fields: config.fields,
        globalSettings: config.globalSettings,
        linkageRules: config.linkageRules,
        scripts: config.scripts,
        values: previewValues,
      });
      if (!validateRes.valid) {
        const first = validateRes.errors[0];
        Toast.error(first ? `[${first.code}] ${first.message}` : '表单校验未通过');
        return;
      }

      await Promise.all([
        updateModule(moduleId, { config }),
        saveFormSettings(moduleId, config.globalSettings || { title: config.name }),
        saveFormLinkageRules(moduleId, config.linkageRules || []),
        saveFormScripts(moduleId, config.scripts || {}),
      ]);
      Toast.success('表单保存成功');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!validateLocal()) return;
    setPreviewValues(previewForm.getValues());
    setPreviewOpen(true);
  };

  const linkageResult = useMemo(
    () => evaluateLinkageRules(config.linkageRules || [], previewValues),
    [config.linkageRules, previewValues]
  );
  const scriptResult = useMemo(
    () => runScript(config.scripts?.onChange || '', previewValues),
    [config.scripts, previewValues]
  );
  const displayFields = useMemo(() => {
    let fields = applyLinkageToFields(config.fields, linkageResult);
    fields = fields.map((field) => {
      const key = field.fieldKey;
      const updates: Partial<FormField> = {};
      if (scriptResult.fieldVisible[key] !== undefined) {
        updates.hidden = !scriptResult.fieldVisible[key];
      }
      if (scriptResult.fieldRequired[key] !== undefined) {
        updates.required = scriptResult.fieldRequired[key];
      }
      if (scriptResult.fieldReadonly[key] !== undefined) {
        updates.readonly = scriptResult.fieldReadonly[key];
      }
      if (scriptResult.fieldOptions[key] !== undefined) {
        updates.options = scriptResult.fieldOptions[key];
      }
      return { ...field, ...updates };
    });
    return fields;
  }, [config.fields, linkageResult, scriptResult]);

  const renderCanvasField = (field: FormField) => {
    const isSelected = selectedId === field.id;
    const width = field.width || '100%';
    return (
      <div
        key={field.id}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(field.id);
        }}
        style={{
          width,
          padding: 12,
          border: `2px dashed ${isSelected ? 'var(--semi-color-primary)' : 'var(--border)'}`,
          borderRadius: 8,
          marginBottom: 8,
          background: isSelected ? 'var(--semi-color-primary-light-default)' : 'var(--card)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text strong>{field.label}</Typography.Text>
          {isSelected && (
            <Space spacing="tight">
              <Button theme="borderless" size="small" icon={<DragOutlined />} onClick={() => handleMoveField(field.id, 'up')} />
              <Button theme="borderless" size="small" icon={<DragOutlined />} onClick={() => handleMoveField(field.id, 'down')} />
              <Button theme="borderless" size="small" icon={<CopyOutlined />} onClick={() => handleCopyField(field)} />
              <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteField(field.id)} />
            </Space>
          )}
        </div>
        <div style={{ marginTop: 8, pointerEvents: 'none' }}>
          {renderFieldPreview(field)}
        </div>
        {field.required && <Tag color="red" style={{ marginTop: 4 }}>必填</Tag>}
      </div>
    );
  };

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'textarea':
        return <TextArea placeholder={field.placeholder} rows={3} />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />;
      case 'radio':
        return (
          <Space>
            {field.options?.map((opt) => (
              <Tag key={opt.value}>{opt.label}</Tag>
            ))}
          </Space>
        );
      case 'checkbox':
        return (
          <Space>
            {field.options?.map((opt) => (
              <Tag key={opt.value}>{opt.label}</Tag>
            ))}
          </Space>
        );
      case 'select':
        return (
          <Select
            style={{ width: '100%' }}
            placeholder={field.placeholder}
            optionList={(field.options || []).map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        );
      case 'date':
        return <Input placeholder={field.placeholder || 'YYYY-MM-DD'} />;
      case 'switch':
        return <Switch />;
      case 'upload':
        return <Button>上传附件</Button>;
      case 'divider':
        return <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>{field.label}</div>;
      case 'group':
        return <Card title={field.label} style={{ background: 'var(--muted)' }} />;
      default:
        return <Input placeholder={field.placeholder} />;
    }
  };

  const renderPropertyPanel = () => {
    if (!selectedField) {
      return (
        <div>
          <Empty description="点击画布中的字段进行编辑" />
        </div>
      );
    }

    return (
      <div>
        <Form.Slot label="标签名称">
          <Input
            value={selectedField.label}
            onChange={(v) => handleUpdateField(selectedField.id, { label: v })}
          />
        </Form.Slot>
        <Form.Slot label="字段标识">
          <Input
            value={selectedField.fieldKey}
            onChange={(v) => handleUpdateField(selectedField.id, { fieldKey: v })}
          />
        </Form.Slot>
        <Form.Slot label="占位提示">
          <Input
            value={selectedField.placeholder}
            onChange={(v) => handleUpdateField(selectedField.id, { placeholder: v })}
          />
        </Form.Slot>
        <Form.Slot label="宽度">
          <Select
            value={selectedField.width}
            onChange={(v) => handleUpdateField(selectedField.id, { width: v as FormField['width'] })}
            optionList={[
              { value: '100%', label: '100%' },
              { value: '50%', label: '50%' },
              { value: '33%', label: '33%' },
            ]}
          />
        </Form.Slot>
        <Form.Slot label="必填">
          <Switch
            checked={selectedField.required}
            onChange={(v) => handleUpdateField(selectedField.id, { required: v })}
          />
        </Form.Slot>
        <Form.Slot label="只读">
          <Switch
            checked={selectedField.readonly}
            onChange={(v) => handleUpdateField(selectedField.id, { readonly: v })}
          />
        </Form.Slot>
        <Form.Slot label="隐藏">
          <Switch
            checked={selectedField.hidden}
            onChange={(v) => handleUpdateField(selectedField.id, { hidden: v })}
          />
        </Form.Slot>
        {['text', 'textarea'].includes(selectedField.type) && (
          <>
            <Form.Slot label="最小长度">
              <InputNumber
                value={selectedField.minLength}
                onChange={(v) => handleUpdateField(selectedField.id, { minLength: typeof v === "number" ? v : undefined })}
              />
            </Form.Slot>
            <Form.Slot label="最大长度">
              <InputNumber
                value={selectedField.maxLength}
                onChange={(v) => handleUpdateField(selectedField.id, { maxLength: typeof v === "number" ? v : undefined })}
              />
            </Form.Slot>
          </>
        )}
        {['radio', 'checkbox', 'select'].includes(selectedField.type) && (
          <Form.Slot label="选项配置">
            <TextArea
              rows={4}
              value={selectedField.options?.map((o) => `${o.label}:${o.value}`).join('\n')}
              placeholder="每行一个选项，格式：标签:值"
              onChange={(value) => {
                const options = value
                  .split('\n')
                  .filter((line) => line.includes(':'))
                  .map((line) => {
                    const [label, value] = line.split(':');
                    return { label: label.trim(), value: value.trim() };
                  });
                handleUpdateField(selectedField.id, { options });
              }}
            />
          </Form.Slot>
        )}
      </div>
    );
  };

  const renderRightPanel = () => {
    switch (activeTab) {
      case 'settings':
        return <FormGlobalSettingsPanel config={config} onChange={setConfig} />;
      case 'linkage':
        return <FormLinkageRulesPanel config={config} onChange={setConfig} />;
      case 'scripts':
        return <FormScriptsPanel config={config} onChange={setConfig} />;
      default:
        return renderPropertyPanel();
    }
  };

  const renderRuntimeField = (field: FormField) => {
    if (field.hidden) return null;
    const disabled = !!field.readonly;
    const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : [];

    switch (field.type) {
      case 'textarea':
        return (
          <Form.TextArea
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            rows={3}
            disabled={disabled}
          />
        );
      case 'number':
        return (
          <Form.InputNumber
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            disabled={disabled}
            style={{ width: '100%' }}
          />
        );
      case 'radio':
        return (
          <Form.Select
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            disabled={disabled}
            optionList={(field.options || []).map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        );
      case 'checkbox':
        return (
          <Form.Select
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            disabled={disabled}
            multiple
            optionList={(field.options || []).map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        );
      case 'select':
        return (
          <Form.Select
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            disabled={disabled}
            optionList={(field.options || []).map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        );
      case 'date':
        return (
          <Form.Input
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder || 'YYYY-MM-DD'}
            disabled={disabled}
          />
        );
      case 'switch':
        return (
          <Form.Switch
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            disabled={disabled}
          />
        );
      case 'upload':
        return (
          <Form.Slot label={field.label}>
            <Button disabled={disabled}>上传附件</Button>
          </Form.Slot>
        );
      case 'divider':
        return <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 16 }}>{field.label}</div>;
      case 'group':
        return <Card title={field.label} style={{ background: 'var(--muted)', marginBottom: 16 }} />;
      default:
        return (
          <Form.Input
            field={field.fieldKey}
            label={field.label}
            rules={rules}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );
    }
  };

  const handlePreviewSubmit = async () => {
    try {
      const values = (await previewForm.validate()) as Record<string, unknown>;
      const beforeRes = runScript(config.scripts?.beforeSubmit || '', values);
      if (beforeRes.errors.length > 0) {
        Toast.error(beforeRes.errors[0].message);
        return;
      }
      Toast.success('预览提交成功');
      runScript(config.scripts?.afterSubmit || '', values);
    } catch {
      Toast.error('请检查表单填写');
    }
  };

  if (!module) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/${appId}`)}>
            返回
          </Button>
          <Typography.Title heading={5} style={{ margin: 0 }}>
            {module.name} - 表单设计器
          </Typography.Title>
        </Space>
        <Space>
          <AIGenerateButton
            onApply={handleAIGenerate}
            promptPlaceholder="描述你要创建的表单，例如：员工请假申请"
          />
          <Button icon={<EyeOutlined />} onClick={handlePreview}>
            预览
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        <Card title="组件面板" style={{ width: 240, overflow: 'auto' }}>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            基础组件
          </Typography.Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {COMPONENT_DEFINITIONS.filter((c) => c.category === 'basic').map((c) => (
              <Button key={c.type} onClick={() => handleAddField(c)} block>
                {c.label}
              </Button>
            ))}
          </div>
          <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
            布局组件
          </Typography.Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {COMPONENT_DEFINITIONS.filter((c) => c.category === 'layout').map((c) => (
              <Button key={c.type} onClick={() => handleAddField(c)} block>
                {c.label}
              </Button>
            ))}
          </div>
        </Card>

        <div
          style={{ flex: 1, overflow: 'auto' }}
          onClick={() => setSelectedId(null)}
        >
          <Card title="表单画布" style={{ height: '100%' }}>
            {config.fields.length === 0 ? (
              <Empty description="点击左侧组件添加到画布" />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {config.fields.map(renderCanvasField)}
              </div>
            )}
          </Card>
        </div>

        <Card
          title="属性配置"
          style={{ width: 360, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, overflow: 'auto' }}
        >
          <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as ActiveTab)}>
            <Tabs.TabPane tab="字段" itemKey="fields" />
            <Tabs.TabPane tab="全局设置" itemKey="settings" />
            <Tabs.TabPane tab="数据联动" itemKey="linkage" />
            <Tabs.TabPane tab="表单脚本" itemKey="scripts" />
          </Tabs>
          <div style={{ marginTop: 12 }}>{renderRightPanel()}</div>
        </Card>
      </div>

      <Modal
        title={config.globalSettings?.title || config.name || '表单预览'}
        visible={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={720}
        footer={
          <Space>
            <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
            <Button type="primary" onClick={handlePreviewSubmit}>
              {config.globalSettings?.submitText || config.submitText || '提交'}
            </Button>
          </Space>
        }
      >
        <Form
          form={previewForm}
          onValueChange={(values) => {
            setPreviewValues(values);
          }}
        >
          {displayFields.map((field) => (
            <div key={field.id} style={{ width: field.width || '100%' }}>
              {renderRuntimeField(field)}
            </div>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
