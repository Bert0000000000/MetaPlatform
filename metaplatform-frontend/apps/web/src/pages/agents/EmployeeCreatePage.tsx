import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Space,
  Steps,
  Tag,
  Toast,
  Typography,
  Upload,
} from '@douyinfe/semi-ui';
import { ArrowLeftOutlined, UploadOutlined, SaveOutlined } from '@ant-design/icons';
import { createEmployee } from '@/api/dw/employees';
import type { EmployeeCapability, EmployeeCreateRequest, RoleCategory } from '@/api/dw/types';
import {
  ROLE_CATEGORY_OPTIONS,
  ROLE_CATEGORY_MAP,
  DIALOG_STYLE_PRESETS,
  MOCK_MODELS,
} from '@/api/dw/types';
import { useEmployeeOptions, actionName } from './components/useEmployeeOptions';

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
  const [form, , formValues] = Form.useForm<FormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

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
    form.setValues(template as FormValues);
    if (template.systemPrompt) {
      form.setValue('systemPrompt', template.systemPrompt);
    }
    Toast.success('已应用角色模板，可继续修改');
  };

  const next = async () => {
    try {
      if (currentStep === 0) {
        await form.validate([
          'name',
          'code',
          'roleCategory',
          'roleIdentity',
          'description',
        ] as unknown as Array<keyof FormValues>);
      } else if (currentStep === 1) {
        await form.validate(['model', 'tools', 'systemPrompt']);
        const values = form.getValues();
        if (values.tools.length === 0 && values.ragKnowledgeBaseIds.length === 0) {
          Toast.warning('请至少配置一项能力（工具或知识库）');
          return;
        }
      } else if (currentStep === 2) {
        const values = form.getValues();
        if (values.ragKnowledgeBaseIds.length === 0) {
          Toast.warning('未绑定知识库可能影响回答准确性，建议返回配置');
        }
      }
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    } catch {
      Toast.error('请完善必填项');
    }
  };

  const prev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    try {
      await form.validate();
      const values = form.getValues();
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
      Toast.success(`数字员工「${created.name}」创建成功，编码 ${created.code}`);
      navigate(`/agents/${created.code}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBasicStep = () => (
    <div>
      <Typography.Title heading={5}>选择角色模板</Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        {Object.entries(roleTemplates).map(([key, template]) => (
          <Card
            key={key}
            shadows="hover"
            style={{ width: 160, cursor: 'pointer' }}
          >
            <div onClick={() => applyTemplate(key)}>
              <Typography.Text strong>
                {template.roleIdentity}
              </Typography.Text>
              <div>
                <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                  {ROLE_CATEGORY_MAP[template.roleCategory as RoleCategory]?.label}
                </Typography.Text>
              </div>
            </div>
          </Card>
        ))}
      </Space>

      <Form.Input
        field="name"
        label="员工名称"
        rules={[
          { required: true, message: '请输入员工名称' },
          { min: 2, message: '员工名称至少 2 个字符' },
          { max: 30, message: '员工名称最多 30 个字符' },
        ]}
        placeholder="例如：财务小助手"
      />
      <Form.Select
        field="roleCategory"
        label="角色分类"
        rules={[{ required: true, message: '请选择角色分类' }]}
        placeholder="请选择角色分类"
        optionList={ROLE_CATEGORY_OPTIONS}
      />
      <Form.Input
        field="roleIdentity"
        label="角色身份"
        rules={[
          { required: true, message: '请输入角色身份' },
          { max: 50, message: '角色身份最多 50 个字符' },
        ]}
        placeholder="例如：报销审批助手"
      />
      <Form.Slot label="头像">
        <Upload
          action=""
          showUploadList={false}
          beforeUpload={({ file }) => {
            if (file.fileInstance) {
              const url = URL.createObjectURL(file.fileInstance);
              setAvatarUrl(url);
            }
            return false;
          }}
        >
          {avatarUrl ? (
            <Avatar size="extra-large" src={avatarUrl} style={{ width: 64, height: 64 }} />
          ) : (
            <div style={{ border: '1px dashed var(--semi-color-border)', borderRadius: 8, padding: '24px 32px', textAlign: 'center' }}>
              <UploadOutlined />
              <div style={{ marginTop: 8 }}>上传头像</div>
            </div>
          )}
        </Upload>
      </Form.Slot>
      <Form.TextArea
        field="description"
        label="职责描述"
        rows={3}
        placeholder="描述该数字员工的职责范围和工作目标"
        rules={[
          { required: true, message: '请输入职责描述' },
          { min: 10, message: '职责描述至少 10 个字符' },
          { max: 500, message: '职责描述最多 500 个字符' },
        ]}
      />
      <Form.TextArea
        field="systemPrompt"
        label="System Prompt"
        rows={4}
        placeholder="数字员工的系统提示词"
        rules={[{ max: 2000, message: 'System Prompt 最多 2000 个字符' }]}
      />
    </div>
  );

  const renderCapabilityStep = () => {
    const model = formValues.model as string | undefined;
    const temperature = formValues.temperature as number | undefined;

    const applyDialogStyle = (index: number) => {
      const preset = DIALOG_STYLE_PRESETS[index];
      form.setValues({
        temperature: preset.temperature,
        topP: preset.topP,
        maxTokens: preset.maxTokens,
      });
    };

    return (
      <div>
        <Typography.Title heading={5}>Tool 工具选择</Typography.Title>
        <Form.CheckboxGroup
          field="tools"
          direction="vertical"
          options={realTools.map((tool) => ({
            label: (<><Tag>{tool.kind || 'tool'}</Tag> {tool.name}</>),
            value: tool.code,
          }))}
        />

        <Divider />

        <Typography.Title heading={5}>动作选择（可触发 ActionType）</Typography.Title>
        <Form.CheckboxGroup
          field="actionRids"
          direction="vertical"
          options={realActions.map((act) => ({
            label: (<><Tag>{act.category}</Tag> {act.name}</>),
            value: act.rid,
          }))}
        />

        <Divider />

        <Typography.Title heading={5}>模型选择</Typography.Title>
        <Form.Select
          field="model"
          rules={[{ required: true, message: '请选择模型' }]}
          placeholder="请选择 LLM 模型"
          optionList={MOCK_MODELS.map((m) => ({ label: `${m.name} - ${m.description}`, value: m.id }))}
        />
        <Space style={{ marginBottom: 16 }}>
          {DIALOG_STYLE_PRESETS.map((preset, index) => (
            <Button key={preset.label} onClick={() => applyDialogStyle(index)}>
              {preset.label}
            </Button>
          ))}
        </Space>
        <Form.Slot label="Temperature">
          <Space>
            <Form.Slider field="temperature" style={{ width: 200 }} min={0} max={1} step={0.1} />
            <span>{temperature}</span>
          </Space>
        </Form.Slot>
        <Form.InputNumber field="maxTokens" label="Max Tokens" min={100} max={8192} rules={[{ required: true }]} />
        <Form.InputNumber field="topP" label="Top P" min={0.1} max={1} step={0.05} />
        <Form.TextArea
          field="systemPrompt"
          label="System Prompt"
          rows={4}
          placeholder="系统提示词"
          rules={[{ required: true, message: '请输入 System Prompt' }]}
        />

        {model && (
          <Typography.Text type="tertiary">
            当前模型：{MOCK_MODELS.find((m) => m.id === model)?.name}
          </Typography.Text>
        )}
      </div>
    );
  };

  const renderKnowledgeStep = () => (
    <div>
      <Typography.Title heading={5}>RAG 知识库绑定</Typography.Title>
      <Form.CheckboxGroup
        field="ragKnowledgeBaseIds"
        direction="vertical"
        options={realKb.map((kb) => ({
          label: `${kb.name}（${kb.documentCount ?? 0} 篇文档）`,
          value: kb.id,
        }))}
      />

      <Form.Select
        field="retrievalMethod"
        label="检索策略"
        optionList={[
          { value: 'hybrid', label: '混合检索（向量+关键词）' },
          { value: 'vector', label: '纯向量检索' },
          { value: 'keyword', label: '纯关键词检索' },
        ]}
      />
      <Form.InputNumber field="topK" label="Top-K" min={1} max={20} />
      <Form.Switch field="rerank" label="重排序" />

      <Divider />

      <Typography.Title heading={5}>知识提炼</Typography.Title>
      <Typography.Paragraph type="tertiary">
        还没有足够的知识？上传企业制度/流程文档，AI 自动提炼知识结构。
      </Typography.Paragraph>
      <Upload action="" beforeUpload={() => false} showUploadList={false}>
        <Button icon={<UploadOutlined />}>上传文档提炼（占位）</Button>
      </Upload>
    </div>
  );

  const renderReviewStep = () => {
    const values = form.getValues();
    return (
      <div>
        <Typography.Title heading={5}>配置汇总</Typography.Title>
        <Descriptions column={2}>
          <Descriptions.Item itemKey="员工名称">{values.name}</Descriptions.Item>
          <Descriptions.Item itemKey="员工编码">提交后系统自动生成</Descriptions.Item>
          <Descriptions.Item itemKey="角色分类">
            {ROLE_CATEGORY_MAP[values.roleCategory]?.label}
          </Descriptions.Item>
          <Descriptions.Item itemKey="角色身份">{values.roleIdentity}</Descriptions.Item>
          <Descriptions.Item itemKey="头像">
            {avatarUrl ? <Avatar src={avatarUrl} /> : '-'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="职责描述" span={2}>
            {values.description}
          </Descriptions.Item>
        </Descriptions>

        <Typography.Title heading={5} style={{ marginTop: 16 }}>
          能力配置
        </Typography.Title>
        <Descriptions column={2}>
          <Descriptions.Item itemKey="已选工具">
            {values.tools.length > 0
              ? values.tools
                  .map((id: string) => realTools.find((t) => t.code === id)?.name || id)
                  .join('、')
              : '未选择'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="模型">{values.model}</Descriptions.Item>
          <Descriptions.Item itemKey="Temperature">{values.temperature}</Descriptions.Item>
          <Descriptions.Item itemKey="Max Tokens">{values.maxTokens}</Descriptions.Item>
          <Descriptions.Item itemKey="System Prompt" span={2}>
            {values.systemPrompt}
          </Descriptions.Item>
        </Descriptions>

        <Typography.Title heading={5} style={{ marginTop: 16 }}>
          知识范围
        </Typography.Title>
        <Descriptions column={2}>
          <Descriptions.Item itemKey="已绑定知识库">
            {values.ragKnowledgeBaseIds.length > 0
              ? values.ragKnowledgeBaseIds
                  .map((id: string) => realKb.find((k) => k.id === id)?.name || id)
                  .join('、')
              : '未绑定'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="检索策略">{values.retrievalMethod}</Descriptions.Item>
          <Descriptions.Item itemKey="Top-K">{values.topK}</Descriptions.Item>
          <Descriptions.Item itemKey="重排序">{values.rerank ? '开启' : '关闭'}</Descriptions.Item>
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
        headerExtraContent={
          <Button theme="borderless" icon={<SaveOutlined />} onClick={() => Toast.info('已保存为草稿（占位）')}>
            保存为草稿
          </Button>
        }
      >
        <Steps
          current={currentStep}
          style={{ marginBottom: 24 }}
        >
          {steps.map((title) => (
            <Steps.Step key={title} title={title} />
          ))}
        </Steps>

        <Form
          form={form}
          initValues={initialValues as FormValues}
          style={{ maxWidth: 800 }}
        >
          {renderStepContent()}
        </Form>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {currentStep > 0 && <Button onClick={prev}>上一步</Button>}
          {currentStep < steps.length - 1 && (
            <Button theme="solid" type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button theme="solid" type="primary" loading={submitting} onClick={handleSave}>
              完成创建
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
