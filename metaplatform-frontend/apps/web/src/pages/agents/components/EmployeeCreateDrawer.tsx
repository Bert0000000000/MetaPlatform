import { useEffect, useState } from 'react';
import { Divider, Form, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import {
  RobotOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { FormDrawer } from '@mate/shared';
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

const { Title } = Typography;

export default function EmployeeCreateDrawer({ open, onClose, onCreated }: EmployeeCreateDrawerProps) {
  const [form] = Form.useForm<DrawerFormValues>();
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
      const values = await form.validate();
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
      Toast.success(`数字员工「${created.name}」创建成功，编码 ${created.code}`);
      form.reset();
      onClose();
      onCreated(created.code);
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
      Toast.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      title="创建数字员工"
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={handleSave}
    >
      <Form form={form} initValues={{ temperature: 0.7, maxTokens: 4096, topP: 0.9, tools: [], actionRids: [], ragKnowledgeBaseIds: [], retrievalMethod: 'hybrid', topK: 5, rerank: true }}>
        {/* 基本信息 */}
        <Typography.Title heading={5}><RobotOutlined /> 基本信息</Typography.Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Input field="name" label="员工名称" rules={[{ required: true, message: '请输入员工名称' }, { min: 2, message: '至少 2 个字符' }]} placeholder="例如：财务小助手" />
          </Col>
          <Col span={12}>
            <Form.Select field="roleCategory" label="角色分类" rules={[{ required: true, message: '请选择角色分类' }]} placeholder="选择角色分类" optionList={ROLE_CATEGORY_OPTIONS} />
          </Col>
        </Row>
        <Form.Input field="roleIdentity" label="角色身份" rules={[{ required: true, message: '请输入角色身份' }]} placeholder="例如：报销审批助手" />
        <Form.TextArea field="description" label="职责描述" rows={2} placeholder="简述职责" />

        <Divider />

        {/* 能力配置 */}
        <Typography.Title heading={5}><ToolOutlined /> 模型与能力</Typography.Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Select
              field="model"
              label="LLM 模型"
              rules={[{ required: true, message: '请选择模型' }]}
              placeholder="选择模型"
              filter
              optionList={aiModels.map((m) => ({ label: m.displayName || m.modelId, value: m.modelId }))}
            />
          </Col>
          <Col span={12}>
            <Form.TextArea field="systemPrompt" label="系统提示词" rows={2} placeholder="可选；留空则用内核身份 prompt" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><Form.InputNumber field="temperature" label="Temperature" min={0} max={1} step={0.1} style={{ width: '100%' }} /></Col>
          <Col span={8}><Form.InputNumber field="maxTokens" label="Max Tokens" min={100} max={8192} style={{ width: '100%' }} /></Col>
          <Col span={8}><Form.InputNumber field="topP" label="Top P" min={0.1} max={1} step={0.05} style={{ width: '100%' }} /></Col>
        </Row>
        <Form.CheckboxGroup
          field="tools"
          label="工具"
          options={realTools.map((tool) => ({
            label: (<><Tag>{tool.kind || 'tool'}</Tag> {tool.name}</>),
            value: tool.code,
          }))}
        />
        <Form.CheckboxGroup
          field="actionRids"
          label={<Space><ThunderboltOutlined /> 可触发动作</Space>}
          options={realActions.map((act) => ({
            label: (<><Tag>{act.category}</Tag> {act.name}</>),
            value: act.rid,
          }))}
        />

        <Divider />

        {/* 知识范围 */}
        <Typography.Title heading={5}><DatabaseOutlined /> 知识范围</Typography.Title>
        <Form.CheckboxGroup
          field="ragKnowledgeBaseIds"
          label="RAG 知识库"
          options={realKb.map((kb) => ({
            label: `${kb.name}（${kb.documentCount ?? 0} 篇）`,
            value: kb.id,
          }))}
        />
        <Row gutter={16}>
          <Col span={8}>
            <Form.Select
              field="retrievalMethod"
              label="检索策略"
              optionList={[
                { value: 'hybrid', label: '混合检索' },
                { value: 'vector', label: '纯向量' },
                { value: 'keyword', label: '纯关键词' },
              ]}
            />
          </Col>
          <Col span={8}><Form.InputNumber field="topK" label="Top-K" min={1} max={20} style={{ width: '100%' }} /></Col>
          <Col span={8}><Form.Switch field="rerank" label="重排序" /></Col>
        </Row>
      </Form>
    </FormDrawer>
  );
}
