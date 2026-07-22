import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Popconfirm,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listApps, deleteApp, createApp, updateApp, listGroups } from '@/api/apps';
import AppForm from '@/components/AppForm';
import type { AppItem, AppCreateRequest, AppUpdateRequest, AppStatus } from '@/types';
import type { MenuProps } from 'antd';
import { SearchInput } from '@mate/shared';

const { Meta } = Card;

const STATUS_MAP: Record<AppStatus, { label: string; color: string }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
};

export default function AppListPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [groups, setGroups] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listApps({ keyword, group, status });
      setApps(res.items);
      const g = await listGroups();
      setGroups(g);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, group, status]);

  const handleCreate = async (values: AppCreateRequest) => {
    setSubmitting(true);
    try {
      await createApp(values);
      message.success('应用创建成功');
      setFormOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: AppUpdateRequest) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateApp(editing.appId, values);
      message.success('应用更新成功');
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (app: AppItem) => {
    await deleteApp(app.appId);
    message.success('应用已删除');
    load();
  };

  const formatTime = (v: string) => {
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 更新`;
  };

  const renderCardActions = (app: AppItem): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑',
      onClick: () => {
        setEditing(app);
        setFormOpen(true);
      },
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除应用「${app.name}」吗？`}
          onConfirm={() => handleDelete(app)}
        >
          <span>删除应用</span>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <SearchInput
          placeholder="搜索应用名称"
          onSearch={setKeyword}
          width={240}
        />
        <Select
          placeholder="应用分组"
          allowClear
          style={{ width: 160 }}
          value={group}
          onChange={setGroup}
        >
          {groups.map((g) => (
            <Select.Option key={g} value={g}>
              {g}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="应用状态"
          allowClear
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
        >
          <Select.Option value="DESIGNING">设计中</Select.Option>
          <Select.Option value="PUBLISHED">已发布</Select.Option>
          <Select.Option value="OFFLINE">已下线</Select.Option>
        </Select>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          创建应用
        </Button>
      </Space>

      {apps.length === 0 && !loading ? (
        <Empty
          description="还没有应用，点击创建第一个应用吧"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            创建应用
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {apps.map((app) => (
            <Card
              key={app.appId}
              hoverable
              loading={loading}
              onClick={() => navigate(`/apps/${app.appId}`)}
              actions={[
                <span key="modules">{app.moduleCount} 个模块</span>,
                <span key="updated">{formatTime(app.updatedAt)}</span>,
              ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Meta
                  avatar={
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: '#f0f5ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                      }}
                    >
                      {app.icon === 'FileTextOutlined' ? (
                        <FileTextOutlined />
                      ) : (
                        <AppstoreOutlined />
                      )}
                    </div>
                  }
                  title={
                    <Space>
                      <Typography.Text strong>{app.name}</Typography.Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {app.code}
                      </Typography.Text>
                      <div>
                        <Typography.Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                          {app.description || '-'}
                        </Typography.Text>
                      </div>
                    </div>
                  }
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Dropdown menu={{ items: renderCardActions(app) }}>
                      <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AppForm
        open={formOpen}
        title={editing ? '编辑应用' : '创建应用'}
        initial={editing}
        groups={groups}
        onOk={(values) => {
          if (editing) {
            return handleUpdate(values as AppUpdateRequest);
          }
          return handleCreate(values as AppCreateRequest);
        }}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
      />
    </div>
  );
}
