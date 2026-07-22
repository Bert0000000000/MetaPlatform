import { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { McpTool, McpToolCreateRequest, ToolParam } from '@/types';

interface ToolFormProps {
  open: boolean;
  initial?: McpTool | null;
  categories: string[];
  onOk: (values: McpToolCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function ToolForm({
  open,
  initial,
  categories,
  onOk,
  onCancel,
  confirmLoading,
}: ToolFormProps) {
  const [form] = Form.useForm<McpToolCreateRequest>();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue({
          name: initial.name,
          code: initial.code,
          category: initial.category,
          description: initial.description,
          outputType: initial.outputType,
          enabled: initial.enabled,
          tags: initial.tags,
          inputSchema: initial.inputSchema,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ enabled: true, outputType: 'json', inputSchema: [] });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      open={open}
      title={initial ? '编辑工具' : '创建工具'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={760}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="工具名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="例如：查询员工数据库" />
        </Form.Item>
        <Form.Item
          name="code"
          label="工具编码"
          rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母、数字、下划线' }]}
        >
          <Input placeholder="例如：query_employees" disabled={!!initial} />
        </Form.Item>
        <Form.Item
          name="category"
          label="工具分类"
          rules={[{ required: true, message: '请选择或输入分类' }]}
        >
          <Select
            placeholder="选择分类"
            mode="tags"
            maxCount={1}
            options={categories.map((c) => ({ label: c, value: c }))}
          />
        </Form.Item>
        <Form.Item name="description" label="工具描述">
          <Input.TextArea rows={2} placeholder="工具作用说明" />
        </Form.Item>
        <Form.Item name="outputType" label="输出类型">
          <Select
            options={[
              { label: '文本', value: 'text' },
              { label: 'JSON', value: 'json' },
              { label: '表格', value: 'table' },
              { label: '文件', value: 'file' },
            ]}
          />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.List name="inputSchema">
          {(fields, { add, remove }) => (
            <>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>输入参数</div>
              {fields.map((field) => (
                <Space key={field.key} align="baseline" style={{ marginBottom: 8 }} wrap>
                  <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: '名称' }]}>
                    <Input placeholder="参数名" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'type']} initialValue="string">
                    <Select
                      style={{ width: 120 }}
                      options={[
                        { label: '字符串', value: 'string' },
                        { label: '数字', value: 'number' },
                        { label: '布尔', value: 'boolean' },
                        { label: '对象', value: 'object' },
                        { label: '数组', value: 'array' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={[field.name, 'required']} valuePropName="checked" initialValue={false}>
                    <Switch checkedChildren="必填" unCheckedChildren="可选" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'description']}>
                    <Input placeholder="描述（可选）" style={{ width: 200 }} />
                  </Form.Item>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                  />
                </Space>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ name: '', type: 'string', required: false } as ToolParam)}
                icon={<PlusOutlined />}
                block
              >
                添加参数
              </Button>
            </>
          )}
        </Form.List>

        <Form.Item name="tags" label="标签" style={{ marginTop: 16 }}>
          <Select mode="tags" placeholder="输入标签后回车" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
