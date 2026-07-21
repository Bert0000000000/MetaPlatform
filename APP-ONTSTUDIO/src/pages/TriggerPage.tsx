import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export interface DataTrigger {
  triggerId: string;
  name: string;
  source: 'cdc' | 'event' | 'cron' | 'webhook';
  target: string;
  enabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

const STORAGE_KEY = 'ontstudio_triggers';

function load(): DataTrigger[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DataTrigger[];
  } catch {
    return [];
  }
}

function save(items: DataTrigger[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `trg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function TriggerPage() {
  const [triggers, setTriggers] = useState<DataTrigger[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setTriggers(load());
  }, []);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const newTrigger: DataTrigger = {
      triggerId: generateId(),
      ...v,
      createdAt: now(),
    };
    save([...triggers, newTrigger]);
    setTriggers(load());
    setEditorOpen(false);
    form.resetFields();
    message.success('触发器已创建');
  };

  const handleDelete = (id: string) => {
    save(triggers.filter((t) => t.triggerId !== id));
    setTriggers(load());
    message.success('已删除');
  };

  const columns: ColumnsType<DataTrigger> = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '来源',
      dataIndex: 'source',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    { title: '目标', dataIndex: 'target' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '最近执行',
      dataIndex: 'lastRunAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '从未'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(t.triggerId)}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          触发器
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields();
          form.setFieldsValue({ source: 'event', enabled: true });
          setEditorOpen(true);
        }}>
          新建触发器
        </Button>
      </div>

      <Card>
        {triggers.length === 0 ? (
          <Empty description="还没有触发器" />
        ) : (
          <Table rowKey="triggerId" dataSource={triggers} columns={columns} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title="新建触发器"
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'CDC', value: 'cdc' },
                { label: 'Event', value: 'event' },
                { label: 'Cron', value: 'cron' },
                { label: 'Webhook', value: 'webhook' },
              ]}
            />
          </Form.Item>
          <Form.Item name="target" label="目标（Action 或 Flow）" rules={[{ required: true }]}>
            <Input placeholder="actionId 或 flowId" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
