import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Switch,
  Button,
  Typography,
  Space,
  App,
  Row,
  Col,
  Divider,
  Tag,
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { createEmployee } from '@/api/dw/employees';
import { listAiModels, type AiModelItem } from '@/api/admin/models';
import type { EmployeeCreateRequest, RoleCategory } from '@/api/dw/types';
import { ROLE_CATEGORY_OPTIONS } from '@/api/dw/types';
import { useEmployeeOptions } from './useEmployeeOptions';

interface EmployeeCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
}

interface DrawerFormValues {
  name: string;
  roleCategory: RoleCategory;
  roleIdentity: string;
  description: string;
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

const { Text } = Typography;

export default function EmployeeCreateDrawer({ open, onClose, onCreated }: EmployeeCreateDrawerProps) {
  const [form] = Form.useForm<DrawerFormValues>();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [aiModels, setAiModels] = useState<AiModelItem[]>([]);
  const { tools: realTools, actions: realActions, kb: realKb } = useEmployeeOptions();

  useEffect(() => {
    listAiModels()
      .then((items) => setAiModels(items.filter((m) => m.enabled)))
      .catch(() => setAiModels([]));
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const request: EmployeeCreateRequest = {
        name: values.name,
        roleCategory: values.roleCategory,
        roleIdentity: values.roleIdentity,
        description: values.description,
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
      };
      const created = await createEmployee(request);
      message.success(`数字员工「${created.name}」创建成功，编码 ${created.code}`);
      form.resetFields();
      onClose();
      onCreated(created.code);
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title="创建数字员工"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={submitting} onClick={handleSave}>
            创建
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" size="small" initialValues={{ temperature: 0.7, maxTokens: 4096, topP: 0.9, tools: [], actionRids: [], ragKnowledgeBaseIds: [], retrievalMethod: 'hybrid', topK: 5, rerank: true }}>
        {/* 基本信息 */}
        <Typography.Title level={5}><RobotOutlined /> 基本信息</Typography.Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="员工名称" rules={[{ required: true, message: '请输入员工名称' }, { min: 2, message: '至少 2 个字符' }]}>
              <Input placeholder="例如：财务小助手" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="roleCategory" label="角色分类" rules={[{ required: true, message: '请选择角色分类' }]}>
              <Select placeholder="选择角色分类">
                {ROLE_CATEGORY_OPTIONS.map((role) => (
                  <Select.Option key={role.value} value={role.value}>{role.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="roleIdentity" label="角色身份" rules={[{ required: true, message: '请输入角色身份' }]}>
          <Input placeholder="例如：报销审批助手" />
        </Form.Item>
        <Form.Item name="description" label="职责描述">
          <Input.TextArea rows={2} placeholder="简述职责" />
        </Form.Item>

        <Divider />

        {/* 能力配置 */}
        <Typography.Title level={5}><ToolOutlined /> 模型与能力</Typography.Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="model" label="LLM 模型" rules={[{ required: true, message: '请选择模型' }]}>
              <Select placeholder="选择模型" showSearch optionFilterProp="label">
                {aiModels.map((m) => (
                  <Select.Option key={`${m.provider}-${m.modelId}`} value={m.modelId} label={m.displayName || m.modelId}>
                    {m.displayName || m.modelId}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="systemPrompt" label="系统提示词">
              <Input.TextArea rows={2} placeholder="可选；留空则用内核身份 prompt" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="temperature" label="Temperature"><InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="maxTokens" label="Max Tokens"><InputNumber min={100} max={8192} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="topP" label="Top P"><InputNumber min={0.1} max={1} step={0.05} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item name="tools" label="工具">
          <Checkbox.Group style={{ width: '100%' }}>
            <Space wrap>
              {realTools.map((tool) => (
                <Checkbox key={tool.code} value={tool.code}>
                  <Tag>{tool.kind || 'tool'}</Tag> {tool.name}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>
        <Form.Item name="actionRids" label={<Space><ThunderboltOutlined /> 可触发动作</Space>}>
          <Checkbox.Group style={{ width: '100%' }}>
            <Space wrap>
              {realActions.map((act) => (
                <Checkbox key={act.rid} value={act.rid}>
                  <Tag>{act.category}</Tag> {act.name}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Divider />

        {/* 知识范围 */}
        <Typography.Title level={5}><DatabaseOutlined /> 知识范围</Typography.Title>
        <Form.Item name="ragKnowledgeBaseIds" label="RAG 知识库">
          <Checkbox.Group style={{ width: '100%' }}>
            <Space wrap>
              {realKb.map((kb) => (
                <Checkbox key={kb.id} value={kb.id}>
                  {kb.name}（{kb.documentCount ?? 0} 篇）
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="retrievalMethod" label="检索策略">
              <Select>
                <Select.Option value="hybrid">混合检索</Select.Option>
                <Select.Option value="vector">纯向量</Select.Option>
                <Select.Option value="keyword">纯关键词</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="topK" label="Top-K"><InputNumber min={1} max={20} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="rerank" label="重排序" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
      </Form>
    </Drawer>
  );
}
