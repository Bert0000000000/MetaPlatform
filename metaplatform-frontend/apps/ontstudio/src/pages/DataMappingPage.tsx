import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { createMapping, deleteMapping, listMappings, runMapping } from '@/api/mappings';
import type { DataMapping, FieldMapping } from '@/api/mappings';

export default function DataMappingPage() {
  const [mappings, setMappings] = useState<DataMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listMappings();
      setMappings(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await createMapping({
        name: v.name,
        datasourceId: v.datasourceId,
        sourceTable: v.sourceTable,
        conceptId: v.conceptId,
        fieldMappings: v.fieldMappings as FieldMapping[],
        enabled: v.enabled,
      });
      message.success('已创建');
      setEditorOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRun = async (m: DataMapping) => {
    message.loading('正在同步...');
    const res = await runMapping(m.mappingId);
    if (res.ok) {
      message.success(`同步完成，影响 ${res.rowsAffected} 行`);
    } else {
      message.error('同步失败');
    }
  };

  const columns: ColumnsType<DataMapping> = [
    {
      title: '映射',
      key: 'name',
      render: (_, m) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{m.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {m.sourceTable} → 概念 {m.conceptId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '字段映射',
      dataIndex: 'fieldMappings',
      render: (v: FieldMapping[]) => <Tag color="blue">{v.length} 个字段</Tag>,
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      render: (v) => (v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">手动</Typography.Text>),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, m) => (
        <Space>
          <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleRun(m)}>
            立即执行
          </Button>
          <Popconfirm title="确定删除？" onConfirm={async () => {
            await deleteMapping(m.mappingId);
            message.success('已删除');
            load();
          }}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          数据映射
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields();
          form.setFieldsValue({ enabled: true, fieldMappings: [] });
          setEditorOpen(true);
        }}>
          新建映射
        </Button>
      </div>

      <Card>
        {mappings.length === 0 && !loading ? (
          <Empty description="还没有映射" />
        ) : (
          <Table rowKey="mappingId" dataSource={mappings} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title="新建映射"
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="映射名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="datasourceId" label="数据源" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sourceTable" label="源表" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="conceptId" label="目标概念" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="fieldMappings" label="字段映射" extra="JSON 格式">
            <Input.TextArea rows={6} placeholder='[{"sourceField":"emp_id","targetAttribute":"code"}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
