import { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { RelationType } from '@/api/relations';

interface RelationTypeFormProps {
  open: boolean;
  initial?: RelationType | null;
  concepts: Array<{ conceptId: string; name: string }>;
  onOk: (values: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function RelationTypeForm({
  open,
  initial,
  concepts,
  onOk,
  onCancel,
  confirmLoading,
}: RelationTypeFormProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue(initial);
      } else {
        form.resetFields();
        form.setFieldsValue({ cardinality: '1-N' });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const v = await form.validateFields();
    onOk(v);
  };

  return (
    <Modal
      open={open}
      title={initial ? '编辑关系类型' : '新建关系类型'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="code" label="编码" rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母数字下划线' }]}>
          <Input disabled={!!initial} />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="sourceConceptId" label="源概念" rules={[{ required: true }]}>
          <Select
            showSearch
            options={concepts.map((c) => ({ label: c.name, value: c.conceptId }))}
          />
        </Form.Item>
        <Form.Item name="targetConceptId" label="目标概念" rules={[{ required: true }]}>
          <Select
            showSearch
            options={concepts.map((c) => ({ label: c.name, value: c.conceptId }))}
          />
        </Form.Item>
        <Form.Item name="cardinality" label="基数" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '1-1', value: '1-1' },
              { label: '1-N', value: '1-N' },
              { label: 'N-1', value: 'N-1' },
              { label: 'N-N', value: 'N-N' },
            ]}
          />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
