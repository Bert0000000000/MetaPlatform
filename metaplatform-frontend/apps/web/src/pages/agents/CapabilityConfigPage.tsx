import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { ArrowLeft, Save } from 'lucide-react';
import { getEmployee, updateEmployee } from '@/api/dw/employees';
import { listAiModels, type AiModelItem } from '@/api/admin/models';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { useEmployeeOptions } from './components/useEmployeeOptions';
import type { Employee } from '@/api/dw/types';
import { DIALOG_STYLE_PRESETS, ROLE_CATEGORY_OPTIONS } from '@/api/dw/types';
import './agents.css';

const { Text } = Typography;

function groupByProvider(items: AiModelItem[]): { provider: string; models: AiModelItem[] }[] {
  const byProvider = new Map<string, AiModelItem[]>();
  for (const m of items) {
    const p = m.provider || 'unknown';
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p)!.push(m);
  }
  return [...byProvider.entries()].map(([provider, models]) => ({ provider, models }));
}

/**
 * 数字员工 · 能力配置（DESIGN-SPEC §5：页头 + Card 区块 + Semi Form）。
 *
 * 表单语义沿用原实现（名称 / 角色 / 模型 / 采样参数 / Prompt / 工具 / 动作 / RAG）。
 * 模型清单从后台 provider 注册表拉取（无 mock）；保存走 updateEmployee。
 */
export default function CapabilityConfigPage() {
  const { employeeId: id } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<Record<string, any>>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiModels, setAiModels] = useState<AiModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  const groupedModels = useMemo(() => groupByProvider(aiModels), [aiModels]);

  // 从后台 provider 注册表拉真实模型清单（AI Providers 页「获取模型」产物）
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

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('缺少员工参数');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const emp = await getEmployee(id);
      setEmployee(emp);
    } catch (e) {
      setEmployee(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 表单在 employee 就绪后才挂载，因此在挂载完成后的 effect 里回填，
  // 避免外部 formApi 在 Form 绑定前 setValues 被丢弃导致字段空白。
  useEffect(() => {
    if (!employee) return;
    form.setValues({
      name: employee.name,
      roleCategory: employee.roleCategory,
      roleIdentity: employee.roleIdentity,
      description: employee.description,
      model: employee.capability.model,
      temperature: employee.capability.temperature,
      maxTokens: employee.capability.maxTokens,
      topP: employee.capability.topP,
      systemPrompt: employee.capability.systemPrompt,
      tools: employee.capability.tools,
      actionRids: employee.capability.actionRids,
      ragKnowledgeBaseIds: employee.capability.ragKnowledgeBaseIds,
      retrievalMethod: employee.capability.retrievalMethod,
      topK: employee.capability.topK,
      rerank: employee.capability.rerank,
    });
  }, [employee, form]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/agents/${id}`);
  };

  const handleSave = async () => {
    if (!id || !employee) return;
    try {
      const values = await form.validate();
      setSubmitting(true);
      await updateEmployee(id, {
        name: values.name,
        roleCategory: values.roleCategory,
        roleIdentity: values.roleIdentity,
        description: values.description,
        avatar: employee.avatar,
        capability: {
          model: values.model,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
          topP: values.topP,
          systemPrompt: values.systemPrompt,
          tools: values.tools || [],
          actionRids: values.actionRids || [],
          ragKnowledgeBaseIds: values.ragKnowledgeBaseIds || [],
          retrievalMethod: values.retrievalMethod,
          topK: values.topK,
          rerank: values.rerank,
        },
      });
      Toast.success('数字员工已更新');
      goBack();
    } catch (e) {
      if (e instanceof Error && e.message.includes('validated')) return;
      Toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const applyDialogStyle = (index: number) => {
    const preset = DIALOG_STYLE_PRESETS[index];
    form.setValues({
      temperature: preset.temperature,
      topP: preset.topP,
      maxTokens: preset.maxTokens,
    });
  };

  const renderModelSelect = () => {
    if (modelsError) {
      return (
        <EmptyState illustration="failure" title="模型清单加载失败" desc={modelsError} />
      );
    }
    return (
      <Form.Select
        field="model"
        label="LLM 模型"
        rules={[{ required: true, message: '请选择模型' }]}
        placeholder="选择模型"
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
              <Select.Option key={`${m.provider}-${m.modelId}`} value={m.modelId} label={m.displayName || m.modelId}>
                {m.displayName || m.modelId}
              </Select.Option>
            ))}
          </Select.OptGroup>
        ))}
      </Form.Select>
    );
  };

  if (loading && !employee) {
    return (
      <>
        <PageHeader title="能力配置" />
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="能力配置" />
        <EmptyState
          illustration="failure"
          title="员工加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </>
    );
  }

  if (!employee) {
    return (
      <>
        <PageHeader title="能力配置" />
        <EmptyState
          illustration="no-content"
          title="未找到该数字员工"
          desc="它可能已被删除，返回列表查看其他员工。"
          actions={
            <Button theme="solid" type="primary" onClick={() => navigate('/agents')}>
              返回列表
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="能力配置"
        desc={`${employee.name} · ${employee.code}`}
        actions={
          <>
            <Button icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={goBack}>
              返回
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Save size={15} strokeWidth={1.5} />}
              loading={submitting}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </>
        }
      />

      <Form form={form}>
        <Space vertical spacing={16}>
          <Card title="基本信息">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Input
                  field="name"
                  label="员工名称"
                  rules={[{ required: true, message: '请输入员工名称' }]}
                  placeholder="请输入员工名称"
                />
              </Col>
              <Col span={8}>
                <Form.Select
                  field="roleCategory"
                  label="角色分类"
                  rules={[{ required: true }]}
                  placeholder="选择角色分类"
                  optionList={ROLE_CATEGORY_OPTIONS}
                />
              </Col>
              <Col span={8}>
                <Form.Slot label="员工编码">
                  <Input value={employee.code} disabled />
                </Form.Slot>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input field="roleIdentity" label="角色身份" placeholder="角色身份" />
              </Col>
              <Col span={12}>
                <Form.Input field="description" label="职责描述" placeholder="职责描述" />
              </Col>
            </Row>
          </Card>

          <Card title="模型配置">
            <Row gutter={16}>
              <Col span={12}>{renderModelSelect()}</Col>
              <Col span={12}>
                <Form.Slot label="对话风格预设">
                  <Space spacing={8} wrap>
                    {DIALOG_STYLE_PRESETS.map((preset, index) => (
                      <Button key={preset.label} size="small" onClick={() => applyDialogStyle(index)}>
                        {preset.label}
                      </Button>
                    ))}
                  </Space>
                </Form.Slot>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Slider field="temperature" label="Temperature" min={0} max={1} step={0.1} />
              </Col>
              <Col span={8}>
                <Form.InputNumber field="topP" label="Top P" min={0.1} max={1} step={0.05} />
              </Col>
              <Col span={8}>
                <Form.InputNumber field="maxTokens" label="Max Tokens" min={100} max={8192} rules={[{ required: true }]} />
              </Col>
            </Row>
          </Card>

          <Card title="Prompt 模板">
            <Form.TextArea
              field="systemPrompt"
              rows={6}
              placeholder="系统提示词，定义数字员工的角色、职责和输出规范"
              rules={[{ required: true, message: '请输入 System Prompt' }]}
            />
          </Card>

          <Card
            title={
              <Space spacing={4}>
                <span>工具配置</span>
                <Text type="tertiary">{realTools.length} 个可用</Text>
              </Space>
            }
          >
            {realTools.length === 0 ? (
              <EmptyState illustration="no-content" title="暂无可用工具" desc="工具在 MCP 中心注册后会出现在这里。" />
            ) : (
              <Form.CheckboxGroup
                field="tools"
                direction="vertical"
                options={realTools.map((tool) => ({
                  label: (
                    <>
                      <Text strong>{tool.name}</Text> <Text type="tertiary">{tool.kind}</Text>
                    </>
                  ),
                  value: tool.code,
                }))}
              />
            )}
          </Card>

          <Card
            title={
              <Space spacing={4}>
                <span>动作配置</span>
                <Text type="tertiary">{realActions.length} 个可触发 ActionType</Text>
              </Space>
            }
          >
            {realActions.length === 0 ? (
              <EmptyState illustration="no-content" title="暂无可触发动作" desc="本体里定义 ActionType 后可在此绑定。" />
            ) : (
              <Form.CheckboxGroup
                field="actionRids"
                direction="vertical"
                options={realActions.map((act) => ({
                  label: (
                    <>
                      <Tag type="light">{act.category}</Tag> <Text strong>{act.name}</Text>{' '}
                      <Text type="tertiary">{act.desc}</Text>
                    </>
                  ),
                  value: act.rid,
                }))}
              />
            )}
          </Card>

          <Card
            title={
              <Space spacing={4}>
                <span>RAG 知识库配置</span>
                <Text type="tertiary">{realKb.length} 个可用</Text>
              </Space>
            }
          >
            {realKb.length === 0 ? (
              <EmptyState illustration="no-content" title="暂无可用知识库" desc="在知识库域创建后可在此绑定。" />
            ) : (
              <Form.CheckboxGroup
                field="ragKnowledgeBaseIds"
                direction="vertical"
                options={realKb.map((kb) => ({
                  label: `${kb.name}（${kb.documentCount ?? 0} 篇）`,
                  value: kb.id,
                }))}
              />
            )}
            <Row gutter={16}>
              <Col span={8}>
                <Form.Select
                  field="retrievalMethod"
                  label="检索策略"
                  optionList={[
                    { value: 'hybrid', label: '混合检索（向量+关键词）' },
                    { value: 'vector', label: '纯向量检索' },
                    { value: 'keyword', label: '纯关键词检索' },
                  ]}
                />
              </Col>
              <Col span={8}>
                <Form.InputNumber field="topK" label="Top-K" min={1} max={20} />
              </Col>
              <Col span={8}>
                <Form.Switch field="rerank" label="重排序" />
              </Col>
            </Row>
          </Card>
        </Space>
      </Form>
    </>
  );
}
