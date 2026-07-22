import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Steps,
  Space,
  Typography,
  message,
  Upload,
  Checkbox,
  Slider,
  InputNumber,
  Switch,
  Divider,
  Descriptions,
  Avatar,
  Tag,
} from 'antd';
import { ArrowLeftOutlined, UploadOutlined, SaveOutlined } from '@ant-design/icons';
import { createEmployee } from '@/api/employees';
import type { EmployeeCapability, EmployeeCreateRequest, RoleCategory } from '@/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  DIALOG_STYLE_PRESETS,
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
} from '@/types';

const { TextArea } = Input;

interface FormValues {
  name: string;
  code: string;
  roleCategory: RoleCategory;
  roleIdentity: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  tools: string[];
  ragKnowledgeBaseIds: string[];
  retrievalMethod: 'hybrid' | 'vector' | 'keyword';
  topK: number;
  rerank: boolean;
}

const defaultCapability: EmployeeCapability = {
  model: 'doubao-pro',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
  systemPrompt: '',
  tools: [],
  ragKnowledgeBaseIds: [],
  retrievalMethod: 'hybrid',
  topK: 5,
  rerank: true,
};

const initialValues: Partial<FormValues> = {
  roleCategory: 'CUSTOM',
  ...defaultCapability,
};

const roleTemplates: Record<string, Partial<FormValues>> = {
  finance: {
    roleCategory: 'FINANCE',
    roleIdentity: '报销审批助手',
    description: '协助员工完成报销政策咨询、报销单初审及审批进度查询。',
    systemPrompt: '你是财务助手，熟悉公司报销制度，能够准确回答报销政策问题。',
  },
  hr: {
    roleCategory: 'HR',
    roleIdentity: '薪酬查询专员',
    description: '为员工提供薪酬、社保、公积金及假期政策咨询服务。',
    systemPrompt: '你是 HR 助手，熟悉公司人力资源政策，保护员工隐私数据。',
  },
  data: {
    roleCategory: 'DATA_ANALYST',
    roleIdentity: '数据分析师',
    description: '根据业务需求查询数据、生成分析报告并提供决策建议。',
    systemPrompt: '你是数据分析助手，擅长从多数据源提取信息并生成清晰结论。',
  },
  legal: {
    roleCategory: 'LEGAL',
    roleIdentity: '法务顾问',
    description: '解答合同、合规及法律风险相关问题，提供制度依据。',
    systemPrompt: '你是法务助手，能够提供合规建议并提示潜在法律风险。',
  },
  cs: {
    roleCategory: 'CUSTOMER_SERVICE',
    roleIdentity: '客服专员',
    description: '面向客户解答产品使用问题，处理常见咨询与投诉。',
    systemPrompt: '你是客服助手，态度友好，能够准确解答产品与服务问题。',
  },
};

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const steps = ['基本信息', '能力配置', '知识范围', '确认创建'];

  const applyTemplate = (key: string) => {
    const template = roleTemplates[key];
    if (!template) return;
    form.setFieldsValue(template as FormValues);
    if (template.systemPrompt) {
      form.setFieldValue('systemPrompt', template.systemPrompt);
    }
    message.success('已应用角色模板，可继续修改');
  };

  const next = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields([
          'name',
          'code',
          'roleCategory',
          'roleIdentity',
          'description',
        ]);
      } else if (currentStep === 1) {
        await form.validateFields(['model', 'tools', 'systemPrompt']);
        const values = form.getFieldsValue();
        if (values.tools.length === 0 && values.ragKnowledgeBaseIds.length === 0) {
          message.warning('请至少配置一项能力（工具或知识库）');
          return;
        }
      } else if (currentStep === 2) {
        const values = form.getFieldsValue();
        if (values.ragKnowledgeBaseIds.length === 0) {
          message.warning('未绑定知识库可能影响回答准确性，建议返回配置');
        }
      }
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    } catch {
      message.error('请完善必填项');
    }
  };

  const prev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      setSubmitting(true);

      const request: EmployeeCreateRequest = {
        name: values.name,
        code: values.code,
        roleCategory: values.roleCategory,
        roleIdentity: values.roleIdentity,
        description: values.description,
        avatar: avatarUrl || undefined,
        capability: {
          model: values.model,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
          topP: values.topP,
          systemPrompt: values.systemPrompt,
          tools: values.tools,
          ragKnowledgeBaseIds: values.ragKnowledgeBaseIds,
          retrievalMethod: values.retrievalMethod,
          topK: values.topK,
          rerank: values.rerank,
        },
      };

      const created = await createEmployee(request);
      message.success(`数字员工「${created.name}」创建成功`);
      navigate(`/dw/employees/${created.employeeId}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBasicStep = () => (
    <div>
      <Typography.Title level={5}>选择角色模板</Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        {Object.entries(roleTemplates).map(([key, template]) => (
          <Card
            key={key}
            size="small"
            hoverable
            style={{ width: 160, cursor: 'pointer' }}
            onClick={() => applyTemplate(key)}
          >
            <Typography.Text strong>
              {template.roleIdentity}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {ROLE_CATEGORY_MAP[template.roleCategory as RoleCategory]?.label}
              </Typography.Text>
            </div>
          </Card>
        ))}
      </Space>

      <Form.Item
        name="name"
        label="员工名称"
        rules={[
          { required: true, message: '请输入员工名称' },
          { min: 2, message: '员工名称至少 2 个字符' },
          { max: 30, message: '员工名称最多 30 个字符' },
        ]}
      >
        <Input placeholder="例如：财务小助手" />
      </Form.Item>
      <Form.Item
        name="code"
        label="员工编码"
        rules={[
          { required: true, message: '请输入员工编码' },
          { pattern: /^[a-zA-Z0-9_]+$/, message: '员工编码只能包含字母、数字和下划线' },
          { min: 2, message: '员工编码至少 2 个字符' },
          { max: 30, message: '员工编码最多 30 个字符' },
        ]}
      >
        <Input placeholder="例如：DW_001" />
      </Form.Item>
      <Form.Item
        name="roleCategory"
        label="角色分类"
        rules={[{ required: true, message: '请选择角色分类' }]}
      >
        <Select placeholder="请选择角色分类">
          {ROLE_CATEGORY_OPTIONS.map((role) => (
            <Select.Option key={role.value} value={role.value}>
              {role.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="roleIdentity"
        label="角色身份"
        rules={[
          { required: true, message: '请输入角色身份' },
          { max: 50, message: '角色身份最多 50 个字符' },
        ]}
      >
        <Input placeholder="例如：报销审批助手" />
      </Form.Item>
      <Form.Item label="头像">
        <Upload
          listType="picture-card"
          showUploadList={false}
          beforeUpload={(file) => {
            const url = URL.createObjectURL(file);
            setAvatarUrl(url);
            return false;
          }}
        >
          {avatarUrl ? (
            <Avatar size={64} src={avatarUrl} />
          ) : (
            <div>
              <UploadOutlined />
              <div style={{ marginTop: 8 }}>上传头像</div>
            </div>
          )}
        </Upload>
      </Form.Item>
      <Form.Item
        name="description"
        label="职责描述"
        rules={[
          { required: true, message: '请输入职责描述' },
          { min: 10, message: '职责描述至少 10 个字符' },
          { max: 500, message: '职责描述最多 500 个字符' },
        ]}
      >
        <TextArea rows={3} placeholder="描述该数字员工的职责范围和工作目标" />
      </Form.Item>
      <Form.Item
        name="systemPrompt"
        label="System Prompt"
        rules={[{ max: 2000, message: 'System Prompt 最多 2000 个字符' }]}
      >
        <TextArea rows={4} placeholder="数字员工的系统提示词" />
      </Form.Item>
    </div>
  );

  const renderCapabilityStep = () => {
    const model = Form.useWatch('model', form);
    const temperature = Form.useWatch('temperature', form);

    const applyDialogStyle = (index: number) => {
      const preset = DIALOG_STYLE_PRESETS[index];
      form.setFieldsValue({
        temperature: preset.temperature,
        topP: preset.topP,
        maxTokens: preset.maxTokens,
      });
    };

    return (
      <div>
        <Typography.Title level={5}>Tool 工具选择</Typography.Title>
        <Form.Item name="tools">
          <Checkbox.Group style={{ width: '100%' }}>
            <Space direction="vertical">
              {MOCK_TOOLS.map((tool) => (
                <Checkbox key={tool.id} value={tool.id}>
                  <Tag>{tool.category}</Tag> {tool.name}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Divider />

        <Typography.Title level={5}>模型选择</Typography.Title>
        <Form.Item name="model" rules={[{ required: true, message: '请选择模型' }]}>
          <Select placeholder="请选择 LLM 模型">
            {MOCK_MODELS.map((m) => (
              <Select.Option key={m.id} value={m.id}>
                {m.name} - {m.description}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Space style={{ marginBottom: 16 }}>
          {DIALOG_STYLE_PRESETS.map((preset, index) => (
            <Button key={preset.label} onClick={() => applyDialogStyle(index)}>
              {preset.label}
            </Button>
          ))}
        </Space>
        <Form.Item label="Temperature">
          <Space>
            <Form.Item name="temperature" noStyle>
              <Slider style={{ width: 200 }} min={0} max={1} step={0.1} />
            </Form.Item>
            <span>{temperature}</span>
          </Space>
        </Form.Item>
        <Form.Item label="Max Tokens" name="maxTokens" rules={[{ required: true }]}>
          <InputNumber min={100} max={8192} />
        </Form.Item>
        <Form.Item label="Top P" name="topP">
          <InputNumber min={0.1} max={1} step={0.05} />
        </Form.Item>
        <Form.Item
          label="System Prompt"
          name="systemPrompt"
          rules={[{ required: true, message: '请输入 System Prompt' }]}
        >
          <TextArea rows={4} placeholder="系统提示词" />
        </Form.Item>

        {model && (
          <Typography.Text type="secondary">
            当前模型：{MOCK_MODELS.find((m) => m.id === model)?.name}
          </Typography.Text>
        )}
      </div>
    );
  };

  const renderKnowledgeStep = () => (
    <div>
      <Typography.Title level={5}>RAG 知识库绑定</Typography.Title>
      <Form.Item name="ragKnowledgeBaseIds">
        <Checkbox.Group style={{ width: '100%' }}>
          <Space direction="vertical">
            {MOCK_KNOWLEDGE_BASES.map((kb) => (
              <Checkbox key={kb.id} value={kb.id}>
                {kb.name}（{kb.documentCount} 篇文档）
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Form.Item>

      <Form.Item name="retrievalMethod" label="检索策略">
        <Select>
          <Select.Option value="hybrid">混合检索（向量+关键词）</Select.Option>
          <Select.Option value="vector">纯向量检索</Select.Option>
          <Select.Option value="keyword">纯关键词检索</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="topK" label="Top-K">
        <InputNumber min={1} max={20} />
      </Form.Item>
      <Form.Item name="rerank" label="重排序" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Divider />

      <Typography.Title level={5}>知识提炼</Typography.Title>
      <Typography.Paragraph type="secondary">
        还没有足够的知识？上传企业制度/流程文档，AI 自动提炼知识结构。
      </Typography.Paragraph>
      <Upload beforeUpload={() => false}>
        <Button icon={<UploadOutlined />}>上传文档提炼（占位）</Button>
      </Upload>
    </div>
  );

  const renderReviewStep = () => {
    const values = form.getFieldsValue();
    return (
      <div>
        <Typography.Title level={5}>配置汇总</Typography.Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="员工名称">{values.name}</Descriptions.Item>
          <Descriptions.Item label="员工编码">{values.code}</Descriptions.Item>
          <Descriptions.Item label="角色分类">
            {ROLE_CATEGORY_MAP[values.roleCategory]?.label}
          </Descriptions.Item>
          <Descriptions.Item label="角色身份">{values.roleIdentity}</Descriptions.Item>
          <Descriptions.Item label="头像">
            {avatarUrl ? <Avatar src={avatarUrl} /> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="职责描述" span={2}>
            {values.description}
          </Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5} style={{ marginTop: 16 }}>
          能力配置
        </Typography.Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="已选工具">
            {values.tools.length > 0
              ? values.tools
                  .map((id: string) => MOCK_TOOLS.find((t) => t.id === id)?.name)
                  .join('、')
              : '未选择'}
          </Descriptions.Item>
          <Descriptions.Item label="模型">{values.model}</Descriptions.Item>
          <Descriptions.Item label="Temperature">{values.temperature}</Descriptions.Item>
          <Descriptions.Item label="Max Tokens">{values.maxTokens}</Descriptions.Item>
          <Descriptions.Item label="System Prompt" span={2}>
            {values.systemPrompt}
          </Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5} style={{ marginTop: 16 }}>
          知识范围
        </Typography.Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="已绑定知识库">
            {values.ragKnowledgeBaseIds.length > 0
              ? values.ragKnowledgeBaseIds
                  .map((id: string) => MOCK_KNOWLEDGE_BASES.find((k) => k.id === id)?.name)
                  .join('、')
              : '未绑定'}
          </Descriptions.Item>
          <Descriptions.Item label="检索策略">{values.retrievalMethod}</Descriptions.Item>
          <Descriptions.Item label="Top-K">{values.topK}</Descriptions.Item>
          <Descriptions.Item label="重排序">{values.rerank ? '开启' : '关闭'}</Descriptions.Item>
        </Descriptions>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicStep();
      case 1:
        return renderCapabilityStep();
      case 2:
        return renderKnowledgeStep();
      case 3:
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card
        title="创建数字员工"
        extra={
          <Button type="text" icon={<SaveOutlined />} onClick={() => message.info('已保存为草稿（占位）')}>
            保存为草稿
          </Button>
        }
      >
        <Steps
          current={currentStep}
          style={{ marginBottom: 24 }}
          items={steps.map((title) => ({ title }))}
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues as FormValues}
          style={{ maxWidth: 800 }}
        >
          {renderStepContent()}
        </Form>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {currentStep > 0 && <Button onClick={prev}>上一步</Button>}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button type="primary" loading={submitting} onClick={handleSave}>
              完成创建
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
