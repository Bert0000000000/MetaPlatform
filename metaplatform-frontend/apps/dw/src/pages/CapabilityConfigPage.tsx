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
  Divider,
  Typography,
  Space,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { getEmployee, updateEmployee } from '@/api/employees';
import type { Employee } from '@/types';
import {
  MOCK_TOOLS,
  MOCK_MODELS,
  MOCK_KNOWLEDGE_BASES,
  DIALOG_STYLE_PRESETS,
} from '@/types';

const { TextArea } = Input;

export default function CapabilityConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
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
        code: employee.code,
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
          ragKnowledgeBaseIds: values.ragKnowledgeBaseIds || [],
          retrievalMethod: values.retrievalMethod,
          topK: values.topK,
          rerank: values.rerank,
        },
      });
      message.success('能力配置已更新');
      navigate(`/dw/employees/${id}`);
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
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/dw/employees/${id}`)} style={{ marginBottom: 16 }}>
        返回详情
      </Button>

      <Card
        title={`${employee.name} - 能力配置`}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            保存配置
          </Button>
        }
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 800 }}>
          <Typography.Title level={5}>Tool 工具绑定</Typography.Title>
          <Form.Item name="tools" label="已绑定工具">
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical">
                {MOCK_TOOLS.map((tool) => (
                  <Checkbox key={tool.id} value={tool.id}>
                    <Space size={4}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{tool.category}</Typography.Text>
                      <span>{tool.name}</span>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>RAG 知识库配置</Typography.Title>
          <Form.Item name="ragKnowledgeBaseIds" label="知识库范围">
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

          <Typography.Title level={5}>模型配置</Typography.Title>
          <Form.Item name="model" label="LLM 模型" rules={[{ required: true, message: '请选择模型' }]}>
            <Select>
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
              <Form.Item name="temperature" noStyle>
                <InputNumber min={0} max={1} step={0.1} style={{ width: 80 }} />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item label="Max Tokens" name="maxTokens" rules={[{ required: true }]}>
            <InputNumber min={100} max={8192} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item label="Top P" name="topP">
            <InputNumber min={0.1} max={1} step={0.05} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item
            label="System Prompt"
            name="systemPrompt"
            rules={[{ required: true, message: '请输入 System Prompt' }]}
          >
            <TextArea rows={4} placeholder="系统提示词" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
