import { useEffect } from 'react';
import { Form, Input, Modal, TreeSelect } from 'antd';
import type { Concept, ConceptCreateRequest, ConceptHierarchyNode } from '@/types';

interface ConceptFormProps {
  open: boolean;
  title: string;
  initial?: Concept | null;
  conceptTree: ConceptHierarchyNode[];
  onOk: (values: ConceptCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

function buildTreeSelect(nodes: ConceptHierarchyNode[]): { value: string; title: string; children?: unknown[] }[] {
  return nodes.map((node) => ({
    value: node.conceptId,
    title: `${node.name} (${node.code})`,
    children: node.children && node.children.length > 0 ? buildTreeSelect(node.children) : undefined,
  }));
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export default function ConceptForm({
  open,
  title,
  initial,
  conceptTree,
  onOk,
  onCancel,
  confirmLoading,
}: ConceptFormProps) {
  const [form] = Form.useForm<ConceptCreateRequest>();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initial) {
        form.setFieldsValue({
          code: initial.code,
          name: initial.name,
          description: initial.description,
          parentConceptId: initial.parentConceptId,
          icon: initial.icon,
        });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          name="code"
          label="概念编码"
          rules={[
            { required: true, message: '请输入概念编码' },
            { max: 100, message: '最多 100 个字符' },
            { pattern: CODE_PATTERN, message: '必须以大写字母开头，仅包含大写字母、数字、下划线' },
          ]}
        >
          <Input placeholder="例如：CUSTOMER" disabled={!!initial} />
        </Form.Item>
        <Form.Item
          name="name"
          label="概念名称"
          rules={[
            { required: true, message: '请输入概念名称' },
            { max: 50, message: '最多 50 个字符' },
          ]}
        >
          <Input placeholder="例如：客户" />
        </Form.Item>
        <Form.Item
          name="parentConceptId"
          label="父概念"
        >
          <TreeSelect
            treeData={buildTreeSelect(conceptTree) as any}
            placeholder="请选择父概念"
            allowClear
            treeDefaultExpandAll
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="描述"
          rules={[{ max: 500, message: '最多 500 个字符' }]}
        >
          <Input.TextArea rows={3} placeholder="请输入描述" />
        </Form.Item>
        <Form.Item
          name="icon"
          label="图标"
          rules={[{ max: 64, message: '最多 64 个字符' }]}
        >
          <Input placeholder="例如：UserOutlined" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
