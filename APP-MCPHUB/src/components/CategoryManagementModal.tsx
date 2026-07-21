import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/api/tools';
import type { McpToolCategory, McpToolCategoryCreateRequest } from '@/types';

interface CategoryManagementModalProps {
  open: boolean;
  onCancel: () => void;
}

export default function CategoryManagementModal({ open, onCancel }: CategoryManagementModalProps) {
  const [categories, setCategories] = useState<McpToolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<McpToolCategoryCreateRequest>();
  const [editing, setEditing] = useState<McpToolCategory | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCategories();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      form.resetFields();
      setEditing(null);
    }
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateCategory(editing.id, values);
      message.success('分类已更新');
    } else {
      await createCategory(values);
      message.success('分类已创建');
    }
    form.resetFields();
    setEditing(null);
    load();
  };

  const handleEdit = (category: McpToolCategory) => {
    setEditing(category);
    form.setFieldsValue({
      name: category.name,
      code: category.code,
      description: category.description,
      sortOrder: category.sortOrder,
      parentId: category.parentId,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteCategory(id);
    message.success('分类已删除');
    load();
  };

  const columns: ColumnsType<McpToolCategory> = [
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '编码',
      dataIndex: 'code',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="分类管理"
      open={open}
      width={760}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="分类名称" />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input placeholder="分类编码" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="描述" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <Input type="number" placeholder="0" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleSubmit}>
              {editing ? '更新' : '添加'}
            </Button>
            {editing && (
              <Button style={{ marginLeft: 8 }} onClick={() => { form.resetFields(); setEditing(null); }}>
                取消
              </Button>
            )}
          </Form.Item>
        </Form>

        <Table
          rowKey="id"
          dataSource={categories}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 8 }}
          size="small" scroll={{ x: 'max-content' }} />
      </Space>
    </Modal>
  );
}
