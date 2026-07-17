import { Table, Tag, Button, Space, Popconfirm, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  RollbackOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { AppVersion } from '@/api/versions';

interface VersionListProps {
  versions: AppVersion[];
  selectedA?: string;
  selectedB?: string;
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
  onPublish: (v: AppVersion) => void;
  onRollback: (v: AppVersion) => void;
  onDelete: (v: AppVersion) => void;
  onPreview: (v: AppVersion) => void;
}

const STATUS_MAP: Record<AppVersion['status'], { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
  ROLLBACK: { label: '回滚中', color: 'orange' },
};

export default function VersionList({
  versions,
  selectedA,
  selectedB,
  onSelectA,
  onSelectB,
  onPublish,
  onRollback,
  onDelete,
  onPreview,
}: VersionListProps) {
  const columns: ColumnsType<AppVersion> = [
    {
      title: 'A/B',
      key: 'select',
      width: 120,
      render: (_, v) => (
        <Space>
          <Button
            type={selectedA === v.versionId ? 'primary' : 'default'}
            size="small"
            onClick={() => onSelectA(v.versionId)}
          >
            A
          </Button>
          <Button
            type={selectedB === v.versionId ? 'primary' : 'default'}
            size="small"
            onClick={() => onSelectB(v.versionId)}
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
          <Typography.Text strong>v{v.version}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {v.changeLog || '无变更说明'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_MAP[v as AppVersion['status']].color}>{STATUS_MAP[v as AppVersion['status']].label}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '发布/回滚',
      key: 'dates',
      render: (_, v) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          {v.publishedAt && (
            <span>发布: {new Date(v.publishedAt).toLocaleString()}</span>
          )}
          {v.rolledBackAt && (
            <span>回滚: {new Date(v.rolledBackAt).toLocaleString()}</span>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, v) => (
        <Space wrap>
          <Button type="link" icon={<EyeOutlined />} onClick={() => onPreview(v)}>
            预览
          </Button>
          {v.status !== 'PUBLISHED' && (
            <Button type="link" icon={<CloudUploadOutlined />} onClick={() => onPublish(v)}>
              发布
            </Button>
          )}
          {v.status === 'OFFLINE' && (
            <Button type="link" icon={<RollbackOutlined />} onClick={() => onRollback(v)}>
              回滚到此版本
            </Button>
          )}
          {v.status === 'DRAFT' && (
            <Popconfirm title="确定删除草稿？" onConfirm={() => onDelete(v)}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="versionId"
      dataSource={versions}
      columns={columns}
      pagination={false}
      size="small"
    />
  );
}
