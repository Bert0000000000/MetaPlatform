import { useEffect, useState } from 'react';
import { Button, Form, Modal, Space, Table, Toast, Popconfirm } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/api/mcphub/tools';
import type { McpToolCategory, McpToolCategoryCreateRequest } from '@/api/mcphub/types';

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
      form.reset();
      setEditing(null);
    }
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateCategory(editing.id, values);
      Toast.success('分类已更新');
    } else {
      await createCategory(values);
      Toast.success('分类已创建');
    }
    form.reset();
    setEditing(null);
    load();
  };

  const handleEdit = (category: McpToolCategory) => {
    setEditing(category);
    form.setValues({
      name: category.name,
      code: category.code,
      description: category.description,
      sortOrder: category.sortOrder,
      parentId: category.parentId,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteCategory(id);
    Toast.success('分类已删除');
    load();
  };

  const columns: ColumnProps<McpToolCategory>[] = [
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
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button theme="borderless" type="danger" icon={<DeleteOutlined />}>
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
      visible={open}
      width={760}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
    >
      <Space vertical style={{ width: '100%' }}>
        <Form form={form} labelPosition="left" style={{ marginBottom: 16 }}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} placeholder="分类名称" />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} placeholder="分类编码" disabled={!!editing} />
          <Form.Input field="description" label="描述" placeholder="描述" />
          <Form.Input field="sortOrder" label="排序" type="number" placeholder="0" />
          <div style={{ marginTop: 12 }}>
            <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={handleSubmit}>
              {editing ? '更新' : '添加'}
            </Button>
            {editing && (
              <Button style={{ marginLeft: 8 }} onClick={() => { form.reset(); setEditing(null); }}>
                取消
              </Button>
            )}
          </div>
        </Form>

        <Table
          rowKey="id"
          dataSource={categories}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content' }}
        />
      </Space>
    </Modal>
  );
}
