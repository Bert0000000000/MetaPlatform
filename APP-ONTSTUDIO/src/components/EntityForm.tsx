import { useEffect, useState } from 'react';
import { Form, Input, TreeSelect, Modal, Spin, Select } from 'antd';
import { listAttributes } from '@/api/attributes';
import type { Entity, EntityCreateRequest, Attribute, ConceptHierarchyNode } from '@/types';

interface EntityFormProps {
  open: boolean;
  title: string;
  initial?: Entity | null;
  conceptTree: ConceptHierarchyNode[];
  onOk: (values: EntityCreateRequest) => void;
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

export default function EntityForm({
  open,
  title,
  initial,
  conceptTree,
  onOk,
  onCancel,
  confirmLoading,
}: EntityFormProps) {
  const [form] = Form.useForm<EntityCreateRequest>();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);

  const selectedConceptId = Form.useWatch('conceptId', form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initial) {
        const attrValues: Record<string, unknown> = {};
        if (initial.attributes) {
          Object.entries(initial.attributes).forEach(([key, attr]) => {
            attrValues[key] = attr.value;
          });
        }
        form.setFieldsValue({
          conceptId: initial.conceptId,
          name: initial.name,
          code: initial.code,
          description: initial.description,
          attributes: attrValues,
        });
      }
    }
  }, [open, initial, form]);

  useEffect(() => {
    if (!selectedConceptId) {
      setAttributes([]);
      return;
    }
    setLoadingAttrs(true);
    listAttributes({ conceptId: selectedConceptId })
      .then((res) => setAttributes(res.items || []))
      .finally(() => setLoadingAttrs(false));
  }, [selectedConceptId]);

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
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          name="conceptId"
          label="所属概念"
          rules={[{ required: true, message: '请选择所属概念' }]}
        >
          <TreeSelect
            treeData={buildTreeSelect(conceptTree) as any}
            placeholder="请选择所属概念"
            treeDefaultExpandAll
            disabled={!!initial}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="实体名称"
          rules={[
            { required: true, message: '请输入实体名称' },
            { max: 100, message: '最多 100 个字符' },
          ]}
        >
          <Input placeholder="例如：张三" />
        </Form.Item>
        <Form.Item
          name="code"
          label="实体编码"
          rules={[{ max: 100, message: '最多 100 个字符' }]}
        >
          <Input placeholder="例如：CUSTOMER_001" />
        </Form.Item>
        <Form.Item
          name="description"
          label="描述"
          rules={[{ max: 500, message: '最多 500 个字符' }]}
        >
          <Input.TextArea rows={2} placeholder="请输入描述" />
        </Form.Item>

        {selectedConceptId && (
          <Spin spinning={loadingAttrs}>
            <Form.Item label="属性值">
              {attributes.length === 0 && !loadingAttrs ? (
                <div style={{ color: '#888' }}>该概念下暂无属性</div>
              ) : (
                attributes.map((attr) => (
                  <Form.Item
                    key={attr.attributeId}
                    name={['attributes', attr.code]}
                    label={attr.name}
                    rules={
                      attr.required
                        ? [{ required: true, message: `请输入${attr.name}` }]
                        : []
                    }
                  >
                    <AttrInput attribute={attr} />
                  </Form.Item>
                ))
              )}
            </Form.Item>
          </Spin>
        )}
      </Form>
    </Modal>
  );
}

function AttrInput({ attribute }: { attribute: Attribute }) {
  const { dataType } = attribute;
  if (dataType === 'Boolean') {
    return (
      <Select
        placeholder="请选择"
        options={[
          { label: '是', value: true },
          { label: '否', value: false },
        ]}
      />
    );
  }
  if (dataType === 'Integer' || dataType === 'Long' || dataType === 'Double' || dataType === 'Decimal') {
    return <Input type="number" placeholder={`请输入${attribute.name}`} />;
  }
  if (dataType === 'Date' || dataType === 'DateTime') {
    return <Input type="datetime-local" placeholder={`请输入${attribute.name}`} />;
  }
  return <Input placeholder={`请输入${attribute.name}`} />;
}
