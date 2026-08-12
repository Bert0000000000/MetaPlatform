import { useEffect } from 'react';
import { Modal, Form, Button, Space, ArrayField } from '@douyinfe/semi-ui';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { McpTool, McpToolCreateRequest, ToolParam } from '@/api/mcphub/types';

interface ToolFormProps {
  open: boolean;
  initial?: McpTool | null;
  categories: string[];
  onOk: (values: McpToolCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const TYPE_OPTIONS = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '对象', value: 'object' },
  { label: '数组', value: 'array' },
];

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
        form.setValues({
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
        form.reset();
        form.setValues({ enabled: true, outputType: 'json', inputSchema: [] });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validate();
    onOk(values);
  };

  return (
    <Modal
      visible={open}
      title={initial ? '编辑工具' : '创建工具'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={760}
    >
      <Form form={form}>
        <Form.Input
          field="name"
          label="工具名称"
          rules={[{ required: true, message: '请输入名称' }]}
          placeholder="例如：查询员工数据库"
        />
        <Form.Input
          field="code"
          label="工具编码"
          rules={[
            { required: true, message: '请输入编码' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母、数字、下划线' },
          ]}
          placeholder="例如：query_employees"
          disabled={!!initial}
        />
        <Form.Select
          field="category"
          label="工具分类"
          rules={[{ required: true, message: '请选择或输入分类' }]}
          placeholder="选择分类"
          multiple
          maxTagCount={1}
          optionList={categories.map((c) => ({ label: c, value: c }))}
        />
        <Form.TextArea field="description" label="工具描述" rows={2} placeholder="工具作用说明" />
        <Form.Select
          field="outputType"
          label="输出类型"
          optionList={TYPE_OPTIONS}
        />
        <Form.Switch field="enabled" label="启用" />

        <ArrayField field="inputSchema">
          {({ arrayFields, addWithInitValue }) => (
            <>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>输入参数</div>
              {arrayFields.map((f) => (
                <Space key={f.key} style={{ marginBottom: 8 }} wrap>
                  <Form.Input
                    field={`${f.field}[name]`}
                    rules={[{ required: true, message: '名称' }]}
                    placeholder="参数名"
                  />
                  <Form.Select
                    field={`${f.field}[type]`}
                    initValue="string"
                    style={{ width: 120 }}
                    optionList={TYPE_OPTIONS}
                  />
                  <Form.Switch
                    field={`${f.field}[required]`}
                    initValue={false}
                    checkedText="必填"
                    uncheckedText="可选"
                  />
                  <Form.Input
                    field={`${f.field}[description]`}
                    placeholder="描述（可选）"
                    style={{ width: 200 }}
                  />
                  <Button type="danger" icon={<DeleteOutlined />} onClick={f.remove} />
                </Space>
              ))}
              <Button
                theme="borderless"
                onClick={() =>
                  addWithInitValue({ name: '', type: 'string', required: false } as ToolParam)
                }
                icon={<PlusOutlined />}
                block
              >
                添加参数
              </Button>
            </>
          )}
        </ArrayField>

        <Form.Select
          field="tags"
          label="标签"
          style={{ marginTop: 16 }}
          multiple
          placeholder="输入标签后回车"
          optionList={[]}
        />
      </Form>
    </Modal>
  );
}
