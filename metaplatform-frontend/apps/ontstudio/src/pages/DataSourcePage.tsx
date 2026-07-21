import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, CheckCircleOutlined, DeleteOutlined, ApiOutlined, DatabaseOutlined } from '@ant-design/icons';
import { createDataSource, deleteDataSource, listDataSources, testConnection } from '@/api/datasources';
import type { DataSource } from '@/api/datasources';

const TYPE_COLORS: Record<DataSource['type'], string> = {
  mysql: 'blue',
  postgresql: 'geekblue',
  oracle: 'red',
  api: 'purple',
  csv: 'gold',
};

export default function DataSourcePage() {
  const [ds, setDs] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; tables?: string[] } | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listDataSources();
      setDs(res.items);
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
      await createDataSource({
        name: v.name,
        type: v.type,
        connectionConfig: {
          host: v.host,
          port: v.port,
          database: v.database,
          username: v.username,
          password: v.password,
          url: v.url,
        },
        enabled: true,
      });
      message.success('数据源已创建');
      setEditorOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    const v = await form.validateFields();
    const res = await testConnection({
      name: v.name,
      type: v.type,
      connectionConfig: {} as Record<string, unknown>,
      enabled: true,
    });
    setTestResult(res);
  };

  const columns: ColumnsType<DataSource> = [
    {
      title: '数据源',
      key: 'name',
      render: (_, d) => (
        <Space>
          {d.type === 'api' ? <ApiOutlined /> : <DatabaseOutlined />}
          <Typography.Text strong>{d.name}</Typography.Text>
          <Tag color={TYPE_COLORS[d.type]}>{d.type}</Tag>
        </Space>
      ),
    },
    {
      title: '配置',
      key: 'config',
      render: (_, d) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <code>{JSON.stringify(d.connectionConfig).slice(0, 60)}...</code>
        </Typography.Text>
      ),
    },
    {
      title: '表数',
      dataIndex: 'tables',
      render: (v: string[]) => (v ? v.length : 0),
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, d) => (
        <Popconfirm title="确定删除？" onConfirm={async () => {
          await deleteDataSource(d.id);
          message.success('已删除');
          load();
        }}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          数据源管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields();
          form.setFieldsValue({ type: 'mysql' });
          setEditorOpen(true);
        }}>
          添加数据源
        </Button>
      </div>

      <Card>
        {ds.length === 0 && !loading ? (
          <Empty description="还没有数据源" />
        ) : (
          <Table rowKey="id" dataSource={ds} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title="添加数据源"
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'MySQL', value: 'mysql' },
                { label: 'PostgreSQL', value: 'postgresql' },
                { label: 'Oracle', value: 'oracle' },
                { label: 'REST API', value: 'api' },
                { label: 'CSV', value: 'csv' },
              ]}
            />
          </Form.Item>
          <Space wrap>
            <Form.Item name="host" label="Host">
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item name="port" label="端口">
              <Input placeholder="3306" />
            </Form.Item>
          </Space>
          <Form.Item name="database" label="数据库名">
            <Input />
          </Form.Item>
          <Space wrap>
            <Form.Item name="username" label="用户名">
              <Input />
            </Form.Item>
            <Form.Item name="password" label="密码">
              <Input.Password />
            </Form.Item>
          </Space>
          <Form.Item name="url" label="API URL（API 类型时使用）">
            <Input />
          </Form.Item>

          <Space>
            <Button onClick={handleTest}>测试连接</Button>
            {testResult && (
              <span style={{ color: testResult.ok ? '#52c41a' : '#f5222d' }}>
                <CheckCircleOutlined /> {testResult.message}
                {testResult.tables && ` · ${testResult.tables.length} 张表`}
              </span>
            )}
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
