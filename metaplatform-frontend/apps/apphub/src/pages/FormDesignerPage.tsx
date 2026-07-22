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
  message,
  Tabs,
  Modal,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  EyeOutlined,
  DeleteOutlined,
  CopyOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { getModule, updateModule } from '@/api/modules';
import {
  getFormDefinition,
  saveFormSettings,
  saveFormLinkageRules,
  saveFormScripts,
  validateForm,
} from '@/api/forms';
import AIGenerateButton from '@/components/AIGenerateButton';
import { COMPONENT_DEFINITIONS } from '@/components/componentRegistry';
import FormGlobalSettingsPanel from '@/components/FormGlobalSettingsPanel';
import FormLinkageRulesPanel from '@/components/FormLinkageRulesPanel';
import FormScriptsPanel from '@/components/FormScriptsPanel';
import { evaluateLinkageRules, applyLinkageToFields } from '@/utils/linkageEngine';
import { runScript } from '@/utils/safeScriptRunner';
import type {
  ModuleItem,
  FormField,
  FormConfig,
  FormGenResult,
  FormGlobalSettings,
  LinkageRule,
  FormScripts,
} from '@/types';

const { TextArea } = Input;
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

export default function FormDesignerPage() {
  const { appId, moduleId } = useParams<{ appId: string; moduleId: string }>();
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
            message.success(`从 AI 导入 ${newFields.length} 个字段`);
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
      message.warning('AI 生成的字段已存在，未重复导入');
      return;
    }
    setConfig((prev) => ({ ...prev, fields: [...prev.fields, ...newFields] }));
    message.success(`已导入 ${newFields.length} 个 AI 字段`);
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
      message.warning('请至少添加一个组件');
      return false;
    }
    const keys = config.fields.map((f) => f.fieldKey);
    if (new Set(keys).size !== keys.length) {
      message.warning('字段标识不能重复');
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
        message.error(first ? `[${first.code}] ${first.message}` : '表单校验未通过');
        return;
      }

      await Promise.all([
        updateModule(moduleId, { config }),
        saveFormSettings(moduleId, config.globalSettings || { title: config.name }),
        saveFormLinkageRules(moduleId, config.linkageRules || []),
        saveFormScripts(moduleId, config.scripts || {}),
      ]);
      message.success('表单保存成功');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!validateLocal()) return;
    setPreviewValues(previewForm.getFieldsValue(true));
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
          border: `2px dashed ${isSelected ? '#1677ff' : '#d9d9d9'}`,
          borderRadius: 8,
          marginBottom: 8,
          background: isSelected ? '#f0f5ff' : '#fff',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text strong>{field.label}</Typography.Text>
          {isSelected && (
            <Space size="small">
              <Button type="text" size="small" icon={<DragOutlined />} onClick={() => handleMoveField(field.id, 'up')} />
              <Button type="text" size="small" icon={<DragOutlined />} onClick={() => handleMoveField(field.id, 'down')} />
              <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyField(field)} />
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteField(field.id)} />
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
          <Select style={{ width: '100%' }} placeholder={field.placeholder}>
            {field.options?.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        );
      case 'date':
        return <Input placeholder={field.placeholder || 'YYYY-MM-DD'} />;
      case 'switch':
        return <Switch />;
      case 'upload':
        return <Button>上传附件</Button>;
      case 'divider':
        return <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 8 }}>{field.label}</div>;
      case 'group':
        return <Card size="small" title={field.label} style={{ background: '#fafafa' }} />;
      default:
        return <Input placeholder={field.placeholder} />;
    }
  };

  const renderPropertyPanel = () => {
    if (!selectedField) {
      return (
        <Form layout="vertical">
          <Empty description="点击画布中的字段进行编辑" />
        </Form>
      );
    }

    return (
      <Form layout="vertical">
        <Form.Item label="标签名称">
          <Input
            value={selectedField.label}
            onChange={(e) => handleUpdateField(selectedField.id, { label: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="字段标识">
          <Input
            value={selectedField.fieldKey}
            onChange={(e) => handleUpdateField(selectedField.id, { fieldKey: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="占位提示">
          <Input
            value={selectedField.placeholder}
            onChange={(e) => handleUpdateField(selectedField.id, { placeholder: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="宽度">
          <Select
            value={selectedField.width}
            onChange={(v) => handleUpdateField(selectedField.id, { width: v })}
          >
            <Select.Option value="100%">100%</Select.Option>
            <Select.Option value="50%">50%</Select.Option>
            <Select.Option value="33%">33%</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="必填">
          <Switch
            checked={selectedField.required}
            onChange={(v) => handleUpdateField(selectedField.id, { required: v })}
          />
        </Form.Item>
        <Form.Item label="只读">
          <Switch
            checked={selectedField.readonly}
            onChange={(v) => handleUpdateField(selectedField.id, { readonly: v })}
          />
        </Form.Item>
        <Form.Item label="隐藏">
          <Switch
            checked={selectedField.hidden}
            onChange={(v) => handleUpdateField(selectedField.id, { hidden: v })}
          />
        </Form.Item>
        {['text', 'textarea'].includes(selectedField.type) && (
          <>
            <Form.Item label="最小长度">
              <InputNumber
                value={selectedField.minLength}
                onChange={(v) => handleUpdateField(selectedField.id, { minLength: v ?? undefined })}
              />
            </Form.Item>
            <Form.Item label="最大长度">
              <InputNumber
                value={selectedField.maxLength}
                onChange={(v) => handleUpdateField(selectedField.id, { maxLength: v ?? undefined })}
              />
            </Form.Item>
          </>
        )}
        {['radio', 'checkbox', 'select'].includes(selectedField.type) && (
          <Form.Item label="选项配置">
            <TextArea
              rows={4}
              value={selectedField.options?.map((o) => `${o.label}:${o.value}`).join('\n')}
              placeholder="每行一个选项，格式：标签:值"
              onChange={(e) => {
                const options = e.target.value
                  .split('\n')
                  .filter((line) => line.includes(':'))
                  .map((line) => {
                    const [label, value] = line.split(':');
                    return { label: label.trim(), value: value.trim() };
                  });
                handleUpdateField(selectedField.id, { options });
              }}
            />
          </Form.Item>
        )}
      </Form>
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
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <TextArea placeholder={field.placeholder} rows={3} disabled={disabled} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} disabled={disabled} />
          </Form.Item>
        );
      case 'radio':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Select placeholder={field.placeholder} disabled={disabled}>
              {field.options?.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'checkbox':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Select mode="multiple" placeholder={field.placeholder} disabled={disabled}>
              {field.options?.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Select placeholder={field.placeholder} disabled={disabled}>
              {field.options?.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'date':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Input placeholder={field.placeholder || 'YYYY-MM-DD'} disabled={disabled} />
          </Form.Item>
        );
      case 'switch':
        return (
          <Form.Item name={field.fieldKey} label={field.label} valuePropName="checked" rules={rules}>
            <Switch disabled={disabled} />
          </Form.Item>
        );
      case 'upload':
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Button disabled={disabled}>上传附件</Button>
          </Form.Item>
        );
      case 'divider':
        return <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 8, marginBottom: 16 }}>{field.label}</div>;
      case 'group':
        return <Card size="small" title={field.label} style={{ background: '#fafafa', marginBottom: 16 }} />;
      default:
        return (
          <Form.Item name={field.fieldKey} label={field.label} rules={rules}>
            <Input placeholder={field.placeholder} disabled={disabled} />
          </Form.Item>
        );
    }
  };

  const handlePreviewSubmit = async () => {
    try {
      const values = await previewForm.validateFields();
      const beforeRes = runScript(config.scripts?.beforeSubmit || '', values);
      if (beforeRes.errors.length > 0) {
        message.error(beforeRes.errors[0].message);
        return;
      }
      message.success('预览提交成功');
      runScript(config.scripts?.afterSubmit || '', values);
    } catch {
      message.error('请检查表单填写');
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
          <Typography.Title level={5} style={{ margin: 0 }}>
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
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            基础组件
          </Typography.Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {COMPONENT_DEFINITIONS.filter((c) => c.category === 'basic').map((c) => (
              <Button key={c.type} onClick={() => handleAddField(c)} block>
                {c.label}
              </Button>
            ))}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
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

        <Card
          title="表单画布"
          style={{ flex: 1, overflow: 'auto' }}
          onClick={() => setSelectedId(null)}
        >
          {config.fields.length === 0 ? (
            <Empty description="点击左侧组件添加到画布" />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {config.fields.map(renderCanvasField)}
            </div>
          )}
        </Card>

        <Card
          title="属性配置"
          style={{ width: 360, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, overflow: 'auto' } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as ActiveTab)}
            items={[
              { key: 'fields', label: '字段' },
              { key: 'settings', label: '全局设置' },
              { key: 'linkage', label: '数据联动' },
              { key: 'scripts', label: '表单脚本' },
            ]}
          />
          <div style={{ marginTop: 12 }}>{renderRightPanel()}</div>
        </Card>
      </div>

      <Modal
        title={config.globalSettings?.title || config.name || '表单预览'}
        open={previewOpen}
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
          layout="vertical"
          onValuesChange={(_, allValues) => {
            setPreviewValues(allValues);
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
