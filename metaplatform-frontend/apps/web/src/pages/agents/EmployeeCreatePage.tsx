import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Form,
  Select,
  Space,
  Steps,
  Tag,
  Toast,
  Typography,
  Upload,
} from '@douyinfe/semi-ui';
import { ArrowLeft, Upload as UploadIcon } from 'lucide-react';
import { createEmployee } from '@/api/dw/employees';
import { listAiModels, type AiModelItem } from '@/api/admin/models';
import type { EmployeeCapability, EmployeeCreateRequest, RoleCategory } from '@/api/dw/types';
import { DIALOG_STYLE_PRESETS, ROLE_CATEGORY_MAP, ROLE_CATEGORY_OPTIONS } from '@/api/dw/types';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { useEmployeeOptions } from './components/useEmployeeOptions';
import './agents.css';

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

/** 角色模板：一键预填角色分类 / 身份 / 职责 / System Prompt（可继续编辑）。 */
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

function groupByProvider(items: AiModelItem[]): { provider: string; models: AiModelItem[] }[] {
  const byProvider = new Map<string, AiModelItem[]>();
  for (const m of items) {
    const p = m.provider || 'unknown';
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p)!.push(m);
  }
  return [...byProvider.entries()].map(([provider, models]) => ({ provider, models }));
}

const STEPS = ['基本信息', '能力配置', '知识范围', '确认创建'];

/**
 * 数字员工 · 创建（DESIGN-SPEC §5：页头 + Card 区块 + Semi Steps/Form）。
 *
 * 表单字段与校验沿用原实现；模型清单改从后台 provider 注册表拉取（无 mock）。
 * 成功后跳转 /agents/{code}。
 */
export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [aiModels, setAiModels] = useState<AiModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  useEffect(() => {
    let alive = true;
    setModelsLoading(true);
    setModelsError('');
    listAiModels()
      .then((items) => {
        if (alive) setAiModels(items.filter((m) => m.enabled));
      })
      .catch((e) => {
        if (alive) {
          setAiModels([]);
          setModelsError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (alive) setModelsLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const groupedModels = useMemo(() => groupByProvider(aiModels), [aiModels]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/agents');
  };

  const applyTemplate = (key: string) => {
    const template = roleTemplates[key];
    if (!template) return;
    form.setValues(template as FormValues);
    Toast.success('已应用角色模板，可继续修改');
  };

  const next = async () => {
    try {
      if (currentStep === 0) {
        await form.validate(['name', 'roleCategory', 'roleIdentity', 'description']);
      } else if (currentStep === 1) {
        await form.validate(['model', 'tools', 'systemPrompt']);
        const values = form.getValues();
        if ((values.tools ?? []).length === 0 && (values.ragKnowledgeBaseIds ?? []).length === 0) {
          Toast.warning('请至少配置一项能力（工具或知识库）');
          return;
        }
      } else if (currentStep === 2) {
        const values = form.getValues();
        if ((values.ragKnowledgeBaseIds ?? []).length === 0) {
          Toast.warning('未绑定知识库可能影响回答准确性，建议返回配置');
        }
      }
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } catch {
      Toast.error('请完善必填项');
    }
  };

  const prev = () => setCurrentStep((p) => Math.max(p - 1, 0));

  const handleSave = async () => {
    try {
      const values = await form.validate();
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
          tools: values.tools ?? [],
          actionRids: values.actionRids ?? [],
          ragKnowledgeBaseIds: values.ragKnowledgeBaseIds ?? [],
          retrievalMethod: values.retrievalMethod,
          topK: values.topK,
          rerank: values.rerank,
        },
      };

      const created = await createEmployee(request);
      Toast.success(`数字员工「${created.name}」创建成功，编码 ${created.code}`);
      navigate(`/agents/${created.code}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes('validated')) return;
      Toast.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderModels = () => {
    if (modelsError) {
      return (
        <EmptyState
          illustration="failure"
          title="模型清单加载失败"
          desc={modelsError}
        />
      );
    }
    return (
      <Form.Select
        field="model"
        label="LLM 模型"
        rules={[{ required: true, message: '请选择模型' }]}
        placeholder="请选择 LLM 模型"
        loading={modelsLoading && aiModels.length === 0}
        filter
      >
        {aiModels.length === 0 && (
          <Select.Option value="" disabled>
            暂无可选模型（请先到后台 AI Providers 获取模型）
          </Select.Option>
        )}
        {groupedModels.map((group) => (
          <Select.OptGroup key={group.provider} label={`${group.provider} 模型`}>
            {group.models.map((m) => (
              <Select.Option key={`${m.provider}-${m.modelId}`} value={m.modelId}>
                {m.displayName || m.modelId}
              </Select.Option>
            ))}
          </Select.OptGroup>
        ))}
      </Form.Select>
    );
  };

  const renderBasicStep = () => (
    <>
      <Typography.Title heading={6}>角色模板</Typography.Title>
      <Space wrap spacing={8}>
        {Object.entries(roleTemplates).map(([key, template]) => (
          <Button key={key} theme="light" onClick={() => applyTemplate(key)}>
            {template.roleIdentity}
            {template.roleCategory ? (
              <Typography.Text type="tertiary">
                {ROLE_CATEGORY_MAP[template.roleCategory as RoleCategory]?.label}
              </Typography.Text>
            ) : null}
          </Button>
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
        <Space spacing={8} align="center">
          {avatarUrl ? <Avatar size="extra-large" src={avatarUrl} /> : null}
          <Upload
            action=""
            showUploadList={false}
            beforeUpload={({ file }) => {
              if (file.fileInstance) setAvatarUrl(URL.createObjectURL(file.fileInstance));
              return false;
            }}
          >
            <Button theme="light" icon={<UploadIcon size={15} strokeWidth={1.5} />}>
              上传头像
            </Button>
          </Upload>
        </Space>
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
    </>
  );

  const renderCapabilityStep = () => {
    const applyDialogStyle = (index: number) => {
      const preset = DIALOG_STYLE_PRESETS[index];
      form.setValues({
        temperature: preset.temperature,
        topP: preset.topP,
        maxTokens: preset.maxTokens,
      });
    };

    return (
      <>
        <Typography.Title heading={6}>Tool 工具选择</Typography.Title>
        {realTools.length === 0 ? (
          <EmptyState illustration="no-content" title="暂无可用工具" desc="工具在 MCP 中心注册后会出现在这里。" />
        ) : (
          <Form.CheckboxGroup
            field="tools"
            direction="vertical"
            options={realTools.map((tool) => ({
              label: (
                <>
                  <Tag type="light">{tool.kind || 'tool'}</Tag> {tool.name}
                </>
              ),
              value: tool.code,
            }))}
          />
        )}

        <Typography.Title heading={6}>动作选择（可触发 ActionType）</Typography.Title>
        {realActions.length === 0 ? (
          <EmptyState illustration="no-content" title="暂无可触发动作" desc="本体里定义 ActionType 后可在此绑定。" />
        ) : (
          <Form.CheckboxGroup
            field="actionRids"
            direction="vertical"
            options={realActions.map((act) => ({
              label: (
                <>
                  <Tag type="light">{act.category}</Tag> {act.name}
                </>
              ),
              value: act.rid,
            }))}
          />
        )}

        <Typography.Title heading={6}>模型选择</Typography.Title>
        {renderModels()}
        <Space spacing={8} wrap>
          {DIALOG_STYLE_PRESETS.map((preset, index) => (
            <Button key={preset.label} onClick={() => applyDialogStyle(index)}>
              {preset.label}
            </Button>
          ))}
        </Space>
        <Form.Slider field="temperature" label="Temperature" min={0} max={1} step={0.1} />
        <Form.InputNumber field="maxTokens" label="Max Tokens" min={100} max={8192} rules={[{ required: true }]} />
        <Form.InputNumber field="topP" label="Top P" min={0.1} max={1} step={0.05} />
        <Form.TextArea
          field="systemPrompt"
          label="System Prompt"
          rows={4}
          placeholder="系统提示词"
          rules={[{ required: true, message: '请输入 System Prompt' }]}
        />
      </>
    );
  };

  const renderKnowledgeStep = () => (
    <>
      <Typography.Title heading={6}>RAG 知识库绑定</Typography.Title>
      {realKb.length === 0 ? (
        <EmptyState illustration="no-content" title="暂无可用知识库" desc="在知识库域创建后可在此绑定。" />
      ) : (
        <Form.CheckboxGroup
          field="ragKnowledgeBaseIds"
          direction="vertical"
          options={realKb.map((kb) => ({
            label: `${kb.name}（${kb.documentCount ?? 0} 篇文档）`,
            value: kb.id,
          }))}
        />
      )}

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
    </>
  );

  const renderReviewStep = () => {
    const values = form.getValues();
    return (
      <>
        <Typography.Title heading={6}>配置汇总</Typography.Title>
        <Descriptions
          row
          data={[
            { key: '员工名称', value: values.name },
            { key: '员工编码', value: '提交后系统自动生成' },
            { key: '角色分类', value: ROLE_CATEGORY_MAP[values.roleCategory]?.label ?? '—' },
            { key: '角色身份', value: values.roleIdentity || '—' },
            { key: '头像', value: avatarUrl ? <Avatar size="small" src={avatarUrl} /> : '—' },
            { key: '职责描述', value: values.description || '—' },
            {
              key: '已选工具',
              value:
                (values.tools ?? []).length > 0
                  ? (values.tools ?? [])
                      .map((tid: string) => realTools.find((t) => t.code === tid)?.name ?? tid)
                      .join('、')
                  : '未选择',
            },
            { key: '模型', value: values.model || '—' },
            { key: 'Temperature', value: String(values.temperature ?? '—') },
            { key: 'Max Tokens', value: String(values.maxTokens ?? '—') },
            { key: 'System Prompt', value: values.systemPrompt || '—' },
            {
              key: '已绑定知识库',
              value:
                (values.ragKnowledgeBaseIds ?? []).length > 0
                  ? (values.ragKnowledgeBaseIds ?? [])
                      .map((kid: string) => realKb.find((k) => k.id === kid)?.name ?? kid)
                      .join('、')
                  : '未绑定',
            },
            { key: '检索策略', value: values.retrievalMethod ?? '—' },
            { key: 'Top-K', value: String(values.topK ?? '—') },
            { key: '重排序', value: values.rerank ? '开启' : '关闭' },
          ]}
        />
      </>
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
    <>
      <PageHeader
        title="创建数字员工"
        desc="四步完成：基本信息 → 能力配置 → 知识范围 → 确认创建"
        actions={
          <Button icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={goBack}>
            返回
          </Button>
        }
      />

      <Card
        footer={
          <Space spacing={8}>
            {currentStep > 0 ? <Button onClick={prev}>上一步</Button> : null}
            {currentStep < STEPS.length - 1 ? (
              <Button theme="solid" type="primary" onClick={() => void next()}>
                下一步
              </Button>
            ) : (
              <Button theme="solid" type="primary" loading={submitting} onClick={() => void handleSave()}>
                完成创建
              </Button>
            )}
          </Space>
        }
      >
        <Steps current={currentStep} type="basic">
          {STEPS.map((title) => (
            <Steps.Step key={title} title={title} />
          ))}
        </Steps>

        <Form
          form={form}
          initValues={initialValues as FormValues}
        >
          {renderStepContent()}
        </Form>
      </Card>
    </>
  );
}
