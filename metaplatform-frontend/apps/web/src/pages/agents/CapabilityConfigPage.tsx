import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  RobotOutlined,
  ToolOutlined,
  DatabaseOutlined,
  CodeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getEmployee, updateEmployee } from '@/api/dw/employees';
import { listAiModels, type AiModelItem } from '@/api/admin/models';
import { useEmployeeOptions } from './components/useEmployeeOptions';
import type { Employee } from '@/api/dw/types';
import {
  ROLE_CATEGORY_OPTIONS,
  DIALOG_STYLE_PRESETS,
} from '@/api/dw/types';

const { Title, Text } = Typography;

function groupByProvider(items: AiModelItem[]): { provider: string; models: AiModelItem[] }[] {
  const byProvider = new Map<string, AiModelItem[]>();
  for (const m of items) {
    const p = m.provider || 'unknown';
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p)!.push(m);
  }
  return [...byProvider.entries()].map(([provider, models]) => ({ provider, models }));
}

export default function CapabilityConfigPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const id = employeeId;
  const navigate = useNavigate();
  const [form, , formValues] = Form.useForm<Record<string, any>>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiModels, setAiModels] = useState<AiModelItem[]>([]);
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  useEffect(() => {
    // 从后台 provider 注册表拉真实模型清单（AI Providers 页「获取模型」产物）
    listAiModels()
      .then((items) => setAiModels(items.filter((m) => m.enabled)))
      .catch(() => setAiModels([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEmployee(id)
      .then((emp) => {
        setEmployee(emp);
        form.setValues({
          name: emp.name,
          roleCategory: emp.roleCategory,
          roleIdentity: emp.roleIdentity,
          description: emp.description,
          model: emp.capability.model,
          temperature: emp.capability.temperature,
          maxTokens: emp.capability.maxTokens,
          topP: emp.capability.topP,
          systemPrompt: emp.capability.systemPrompt,
          tools: emp.capability.tools,
          actionRids: emp.capability.actionRids,
          ragKnowledgeBaseIds: emp.capability.ragKnowledgeBaseIds,
          retrievalMethod: emp.capability.retrievalMethod,
          topK: emp.capability.topK,
          rerank: emp.capability.rerank,
        });
      })
      .finally(() => setLoading(false));
  }, [id, form]);

  const toggleInArray = (field: 'tools' | 'actionRids' | 'ragKnowledgeBaseIds', value: string) => {
    const current = new Set<string>(formValues[field] ?? []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    form.setValue(field, [...current]);
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
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(`/agents/${employee?.code ?? id}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
      Toast.error(error instanceof Error ? error.message : '保存失败');
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

  if (loading || !employee) {
    return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  }

  return (
    <div>
      {/* 顶部导航 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => { if (window.history.length > 1) navigate(-1); else navigate(`/agents/${id}`); }}>
          返回详情
        </Button>
        <Space>
          <Title heading={4} style={{ margin: 0 }}>编辑数字员工</Title>
          <Button theme="solid" type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      <Form form={form}>
        {/* 基本信息 */}
        <Card
          title={<Space><RobotOutlined /> 基本信息</Space>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Form.Input field="name" label="员工名称" rules={[{ required: true, message: '请输入员工名称' }]} placeholder="请输入员工名称" />
            </Col>
            <Col span={8}>
              <Form.Select field="roleCategory" label="角色分类" rules={[{ required: true }]} placeholder="选择角色分类" optionList={ROLE_CATEGORY_OPTIONS} />
            </Col>
            <Col span={8}>
              <Form.Slot label="员工编码">
                <Input value={employee.code} disabled />
              </Form.Slot>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Input field="roleIdentity" label="角色身份" placeholder="角色身份" />
            </Col>
            <Col span={12}>
              <Form.Input field="description" label="职责描述" placeholder="职责描述" />
            </Col>
          </Row>
        </Card>

        {/* 模型配置 */}
        <Card
          title={<Space><RobotOutlined /> 模型配置</Space>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Select
                field="model"
                label="LLM 模型"
                rules={[{ required: true, message: '请选择模型' }]}
                placeholder="选择模型"
                loading={loading && aiModels.length === 0}
                filter
              >
                {aiModels.length === 0 && (
                  <Select.Option value="" disabled>
                    暂无可选模型（请先到后台 AI Providers 获取模型）
                  </Select.Option>
                )}
                {groupByProvider(aiModels).map((group) => (
                  <Select.OptGroup key={group.provider} label={`${group.provider} 模型`}>
                    {group.models.map((m) => (
                      <Select.Option
                        key={`${m.provider}-${m.modelId}`}
                        value={m.modelId}
                        label={m.displayName || m.modelId}
                      >
                        {m.displayName || m.modelId}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                ))}
              </Form.Select>
            </Col>
            <Col span={12}>
              <Form.Slot label="对话风格预设">
                <Space wrap>
                  {DIALOG_STYLE_PRESETS.map((preset, index) => (
                    <Button key={preset.label} size="small" onClick={() => applyDialogStyle(index)}>
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </Form.Slot>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Slot label="Temperature">
                <Space>
                  <Slider
                    value={formValues.temperature ?? 0.7}
                    onChange={(v) => form.setValue('temperature', v)}
                    style={{ width: 120 }}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                  <InputNumber
                    value={formValues.temperature ?? 0.7}
                    onChange={(v) => form.setValue('temperature', v ?? 0.7)}
                    min={0}
                    max={1}
                    step={0.1}
                    style={{ width: 70 }}
                    size="small"
                  />
                </Space>
              </Form.Slot>
            </Col>
            <Col span={8}>
              <Form.InputNumber field="topP" label="Top P" min={0.1} max={1} step={0.05} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <Form.InputNumber field="maxTokens" label="Max Tokens" min={100} max={8192} style={{ width: '100%' }} rules={[{ required: true }]} />
            </Col>
          </Row>
        </Card>

        {/* System Prompt */}
        <Card
          title={<Space><CodeOutlined /> Prompt 模板</Space>}
          style={{ marginBottom: 16 }}
        >
          <Form.TextArea
            field="systemPrompt"
            rows={6}
            placeholder="系统提示词，定义数字员工的角色、职责和输出规范"
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            rules={[{ required: true, message: '请输入 System Prompt' }]}
          />
        </Card>

        {/* 工具配置 */}
        <Card
          title={
            <Space>
              <ToolOutlined /> 工具配置
              <Text type="tertiary" style={{ fontSize: 12 }}>
                {realTools.length} 个可用
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 12]}>
            {realTools.map((tool) => (
              <Col key={tool.code} span={12}>
                <Checkbox
                  checked={(formValues.tools ?? []).includes(tool.code)}
                  onChange={() => toggleInArray('tools', tool.code)}
                  style={{ alignItems: 'flex-start' }}
                >
                  <Space vertical spacing={0}>
                    <Space spacing={4}>
                      <Text strong style={{ fontSize: 13 }}>{tool.name}</Text>
                      <Text type="tertiary" style={{ fontSize: 11 }}>{tool.kind}</Text>
                    </Space>
                  </Space>
                </Checkbox>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 动作配置：数字员工可触发的 ActionType */}
        <Card
          title={
            <Space>
              <ThunderboltOutlined /> 动作配置
              <Text type="tertiary" style={{ fontSize: 12 }}>
                {realActions.length} 个可触发 ActionType
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Slot label="可触发的动作">
            <Row gutter={[16, 12]}>
              {realActions.map((act) => (
                <Col key={act.rid} span={12}>
                  <Checkbox
                    checked={(formValues.actionRids ?? []).includes(act.rid)}
                    onChange={() => toggleInArray('actionRids', act.rid)}
                    style={{ alignItems: 'flex-start' }}
                  >
                    <Space vertical spacing={0}>
                      <Space spacing={4}>
                        <Text strong style={{ fontSize: 13 }}>{act.name}</Text>
                        <Text type="tertiary" style={{ fontSize: 11 }}>{act.category}</Text>
                      </Space>
                      <Text type="tertiary" style={{ fontSize: 11 }}>{act.desc}</Text>
                    </Space>
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Form.Slot>
        </Card>

        {/* RAG 知识库配置 */}
        <Card
          title={
            <Space>
              <DatabaseOutlined /> RAG 知识库配置
              <Text type="tertiary" style={{ fontSize: 12 }}>
                {realKb.length} 个可用
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Slot label="知识库范围">
            <Row gutter={[16, 8]}>
              {realKb.map((kb) => (
                <Col key={kb.id} span={12}>
                  <Checkbox
                    checked={(formValues.ragKnowledgeBaseIds ?? []).includes(kb.id)}
                    onChange={() => toggleInArray('ragKnowledgeBaseIds', kb.id)}
                  >
                    <Space spacing={4}>
                      <Text style={{ fontSize: 13 }}>{kb.name}</Text>
                      <Text type="tertiary" style={{ fontSize: 11 }}>({kb.documentCount ?? 0} 篇)</Text>
                    </Space>
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Form.Slot>
          <Row gutter={24}>
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
              <Form.InputNumber field="topK" label="Top-K" min={1} max={20} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <Form.Switch field="rerank" label="重排序" />
            </Col>
          </Row>
        </Card>
      </Form>
    </div>
  );
}
