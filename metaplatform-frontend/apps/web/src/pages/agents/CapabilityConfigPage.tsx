import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Checkbox,
  Slider,
  InputNumber,
  Switch,
  Typography,
  Space,
  App,
  Spin,
  Row,
  Col,
} from 'antd';
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
import type { Employee } from '@/api/dw/types';
import {
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
  MOCK_ACTIONS,
  DIALOG_STYLE_PRESETS,
} from '@/api/dw/types';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function CapabilityConfigPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const id = employeeId;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEmployee(id)
      .then((emp) => {
        setEmployee(emp);
        form.setFieldsValue({
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

  const handleSave = async () => {
    if (!id || !employee) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await updateEmployee(id, {
        name: employee.name,
        roleCategory: employee.roleCategory,
        roleIdentity: employee.roleIdentity,
        description: employee.description,
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
      message.success('能力配置已更新');
      navigate(`/agents/${employee?.code ?? id}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const applyDialogStyle = (index: number) => {
    const preset = DIALOG_STYLE_PRESETS[index];
    form.setFieldsValue({
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/agents/${id}`)}>
          返回详情
        </Button>
        <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
          保存配置
        </Button>
      </div>

      <Form form={form} layout="vertical">
        {/* 模型配置 */}
        <Card
          size="small"
          title={<Space><RobotOutlined /> 模型配置</Space>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="model" label="LLM 模型" rules={[{ required: true, message: '请选择模型' }]}>
                <Select placeholder="选择模型">
                  {MOCK_MODELS.map((m) => (
                    <Select.Option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="对话风格预设">
                <Space wrap>
                  {DIALOG_STYLE_PRESETS.map((preset, index) => (
                    <Button key={preset.label} size="small" onClick={() => applyDialogStyle(index)}>
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label="Temperature">
                <Space>
                  <Form.Item name="temperature" noStyle>
                    <Slider style={{ width: 120 }} min={0} max={1} step={0.1} />
                  </Form.Item>
                  <Form.Item name="temperature" noStyle>
                    <InputNumber min={0} max={1} step={0.1} style={{ width: 70 }} size="small" />
                  </Form.Item>
                </Space>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Top P" name="topP">
                <InputNumber min={0.1} max={1} step={0.05} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Max Tokens" name="maxTokens" rules={[{ required: true }]}>
                <InputNumber min={100} max={8192} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* System Prompt */}
        <Card
          size="small"
          title={<Space><CodeOutlined /> Prompt 模板</Space>}
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            name="systemPrompt"
            rules={[{ required: true, message: '请输入 System Prompt' }]}
          >
            <TextArea
              rows={6}
              placeholder="系统提示词，定义数字员工的角色、职责和输出规范"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Card>

        {/* 工具配置 */}
        <Card
          size="small"
          title={
            <Space>
              <ToolOutlined /> 工具配置
              <Text type="secondary" style={{ fontSize: 12 }}>
                {MOCK_TOOLS.length} 个可用
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="tools">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 12]}>
                {MOCK_TOOLS.map((tool) => (
                  <Col key={tool.id} span={12}>
                    <Checkbox value={tool.id} style={{ alignItems: 'flex-start' }}>
                      <Space orientation="vertical" size={0}>
                        <Space size={4}>
                          <Text strong style={{ fontSize: 13 }}>{tool.name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{tool.category}</Text>
                        </Space>
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Card>

        {/* 动作配置：数字员工可触发的 ActionType */}
        <Card
          size="small"
          title={
            <Space>
              <ThunderboltOutlined /> 动作配置
              <Text type="secondary" style={{ fontSize: 12 }}>
                {MOCK_ACTIONS.length} 个可触发 ActionType
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="actionRids" label="可触发的动作">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 12]}>
                {MOCK_ACTIONS.map((act) => (
                  <Col key={act.id} span={12}>
                    <Checkbox value={act.id} style={{ alignItems: 'flex-start' }}>
                      <Space orientation="vertical" size={0}>
                        <Space size={4}>
                          <Text strong style={{ fontSize: 13 }}>{act.name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{act.category}</Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11 }}>{act.desc}</Text>
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Card>

        {/* RAG 知识库配置 */}
        <Card
          size="small"
          title={
            <Space>
              <DatabaseOutlined /> RAG 知识库配置
              <Text type="secondary" style={{ fontSize: 12 }}>
                {MOCK_KNOWLEDGE_BASES.length} 个可用
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="ragKnowledgeBaseIds" label="知识库范围">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 8]}>
                {MOCK_KNOWLEDGE_BASES.map((kb) => (
                  <Col key={kb.id} span={12}>
                    <Checkbox value={kb.id}>
                      <Space size={4}>
                        <Text style={{ fontSize: 13 }}>{kb.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>({kb.documentCount} 篇)</Text>
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="retrievalMethod" label="检索策略">
                <Select>
                  <Select.Option value="hybrid">混合检索（向量+关键词）</Select.Option>
                  <Select.Option value="vector">纯向量检索</Select.Option>
                  <Select.Option value="keyword">纯关键词检索</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="topK" label="Top-K">
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rerank" label="重排序" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>
    </div>
  );
}
