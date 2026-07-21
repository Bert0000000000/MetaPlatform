import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, CloudUploadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  createVersion,
  deleteVersion,
  listVersions,
  updateVersion,
} from '@/api/versions';
import VersionCompare from '@/components/VersionCompare';
import VersionTimeline from '@/components/VersionTimeline';
import type { OntologyVersion } from '@/api/versions';

const STATUS_COLOR: Record<OntologyVersion['status'], string> = {
  DRAFT: 'default',
  PUBLISHED: 'green',
  ARCHIVED: 'default',
};

export default function VersionPage() {
  const [versions, setVersions] = useState<OntologyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedA, setSelectedA] = useState<string>();
  const [selectedB, setSelectedB] = useState<string>();
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const v = await listVersions();
      setVersions(v);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await createVersion({
        code: v.code,
        description: v.description,
        snapshot: JSON.stringify({ concepts: [], entities: [], relations: [] }),
        status: 'DRAFT',
        createdBy: 'admin',
      });
      message.success('版本已创建');
      setCreateOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (v: OntologyVersion) => {
    await updateVersion(v.versionId, { status: 'PUBLISHED', publishedAt: new Date().toISOString() });
    message.success('已发布');
    load();
  };

  const columns: ColumnsType<OntologyVersion> = [
    {
      title: 'A/B',
      key: 'select',
      width: 100,
      render: (_, v) => (
        <Space>
          <Button
            size="small"
            type={selectedA === v.versionId ? 'primary' : 'default'}
            onClick={() => setSelectedA(v.versionId)}
          >
            A
          </Button>
          <Button
            size="small"
            type={selectedB === v.versionId ? 'primary' : 'default'}
            onClick={() => setSelectedB(v.versionId)}
          >
            B
          </Button>
        </Space>
      ),
    },
    {
      title: '版本',
      key: 'version',
      render: (_, v) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>v{v.code}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {v.description}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v as OntologyVersion['status']]}>{v}</Tag>,
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '发布',
      dataIndex: 'publishedAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, v) => (
        <Space>
          {v.status !== 'PUBLISHED' && (
            <Button type="link" icon={<CloudUploadOutlined />} onClick={() => handlePublish(v)}>
              发布
            </Button>
          )}
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteVersion(v.versionId);
              message.success('已删除');
              load();
            }}
          >
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
          本体版本管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建版本
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'list',
            label: '版本列表',
            children: (
              <Card>
                {versions.length === 0 && !loading ? (
                  <Empty description="还没有版本" />
                ) : (
                  <Table
                    rowKey="versionId"
                    dataSource={versions}
                    columns={columns}
                    loading={loading}
                    pagination={false} scroll={{ x: 'max-content' }} />
                )}
              </Card>
            ),
          },
          {
            key: 'diff',
            label: '版本对比',
            children: <VersionCompare aId={selectedA} bId={selectedB} />,
          },
          {
            key: 'timeline',
            label: '时间线',
            children: (
              <Card>
                <VersionTimeline
                  versions={versions}
                  selectedId={selectedA}
                  onSelect={(id) => (selectedA ? setSelectedB(id) : setSelectedA(id))}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="创建版本"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="版本号" rules={[{ required: true }, { pattern: /^\d+\.\d+\.\d+$/, message: '语义化版本' }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="description" label="变更说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
