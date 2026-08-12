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
import { createEmployee } from '@/api/dw/employees';
import type { EmployeeCapability, EmployeeCreateRequest, RoleCategory } from '@/api/dw/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  DIALOG_STYLE_PRESETS,
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
  MOCK_ACTIONS,
} from '@/api/dw/types';

const { TextArea } = Input;

interface FormValues {
  name: string;
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
  actionRids: string[];
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
  actionRids: [],
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
  ont: {
    roleCategory: 'ONTOLOGY',
    roleIdentity: '本体建模师',
    description: '解释 ClassRef / ObjectType / LinkType / ActionType，把自然语言需求映射为 ObjectSet 查询计划。',
    systemPrompt: '你是 Mate Platform 的「本体员工」，Ontology 语义建模与查询引擎。',
  },
  wf: {
    roleCategory: 'WORKFLOW',
    roleIdentity: '流程工程师',
    description: '解析 BPMN-lite 流程定义，按 Action / Gateway / WaitUser / End 节点调度 ActionType.apply。',
    systemPrompt: '你是 Mate Platform 的「工作流员工」，BPMN 流程编排引擎。',
  },
  app: {
    roleCategory: 'APP',
    roleIdentity: '应用构建师',
    description: '把 ObjectType 及其 ActionType 映射为前端可渲染的 UI manifest（list/detail/form/dashboard）。',
    systemPrompt: '你是 Mate Platform 的「应用员工」，低代码应用生成器。',
  },
  data: {
    roleCategory: 'DATA_PRODUCT',
    roleIdentity: '数据产品师',
    description: '维护 data.* 数据产品（湖仓表 / 物化视图 / 报告 / 流）与 ObjectType 的双向 link、血缘与质量告警。',
    systemPrompt: '你是 Mate Platform 的「数据产品员工」，数据资产与血缘管理员。',
  },
  obs: {
    roleCategory: 'OBS',
    roleIdentity: '可观测工程师',
    description: '订阅 OTel metric/log，定义告警规则，命中阈值触发 ActionType.apply 实现自动告警与自愈。',
    systemPrompt: '你是 Mate Platform 的「可观测员工」，监控、告警与自愈引擎。',
  },
  sec: {
    roleCategory: 'SECURITY',
    roleIdentity: '安全合规官',
    description: '在每次 ActionType.apply / 资源访问前做 allow / deny 决策，保证租户隔离与 Mandatory Marking 合规。',
    systemPrompt: '你是 Mate Platform 的「安全员工」，权限、合规与标记（Marking）检查官。',
  },
  kb: {
    roleCategory: 'KNOWLEDGE',
    roleIdentity: '知识管理员',
    description: '维护 KbDocument 库链接到 ObjectType，与 RAG-ONT-01 联合检索（class link 优先 + token overlap 补充）。',
    systemPrompt: '你是 Mate Platform 的「知识库员工」，企业知识检索与 RAG 联合引擎。',
  },
};

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // 优先使用浏览器历史回退；若直接打开创建页（无历史）则跳到列表页
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/agents');
    }
  };

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
          actionRids: values.actionRids,
          ragKnowledgeBaseIds: values.ragKnowledgeBaseIds,
          retrievalMethod: values.retrievalMethod,
          topK: values.topK,
          rerank: values.rerank,
        },
      };

      const created = await createEmployee(request);
      message.success(`数字员工「${created.name}」创建成功，编码 ${created.code}`);
      navigate(`/agents/${created.code}`);
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
            <Space orientation="vertical">
              {MOCK_TOOLS.map((tool) => (
                <Checkbox key={tool.id} value={tool.id}>
                  <Tag>{tool.category}</Tag> {tool.name}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Divider />

        <Typography.Title level={5}>动作选择（可触发 ActionType）</Typography.Title>
        <Form.Item name="actionRids">
          <Checkbox.Group style={{ width: '100%' }}>
            <Space orientation="vertical">
              {MOCK_ACTIONS.map((act) => (
                <Checkbox key={act.id} value={act.id}>
                  <Tag>{act.category}</Tag> {act.name}
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
          <Space orientation="vertical">
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
          <Descriptions.Item label="员工编码">提交后系统自动生成</Descriptions.Item>
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
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>
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
