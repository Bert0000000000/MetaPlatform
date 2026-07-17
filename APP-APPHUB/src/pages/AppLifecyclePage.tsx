import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Space,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getApp, updateApp } from '@/api/apps';
import type { AppItem, AppStatus } from '@/types';

const STATUS_MAP: Record<AppStatus, { label: string; color: string }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
};

export default function AppLifecyclePage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOfflineOpen, setConfirmOfflineOpen] = useState(false);

  const load = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const a = await getApp(appId);
      setApp(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appId]);

  if (loading || !app) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const currentStep = app.status === 'DESIGNING' ? 0 : app.status === 'PUBLISHED' ? 1 : 2;

  const handleOffline = async () => {
    await updateApp(app.appId, { status: 'OFFLINE' });
    message.success('应用已下线');
    setConfirmOfflineOpen(false);
    load();
  };

  const handleOnline = async () => {
    await updateApp(app.appId, { status: 'PUBLISHED' });
    message.success('应用已恢复上线');
    load();
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/${appId}`)}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          应用生命周期 - {app.name}
        </Typography.Title>
        <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        {app.status !== 'PUBLISHED' && (
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleOnline}
          >
            发布
          </Button>
        )}
        {app.status === 'PUBLISHED' && (
          <Button danger icon={<PauseCircleOutlined />} onClick={() => setConfirmOfflineOpen(true)}>
            下线
          </Button>
        )}
        {app.status === 'OFFLINE' && (
          <Button icon={<PlayCircleOutlined />} onClick={handleOnline}>
            恢复上线
          </Button>
        )}
      </Space>

      <Card title="生命周期阶段" style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          items={[
            { title: '设计', icon: <ClockCircleOutlined /> },
            { title: '已发布', icon: <CloudUploadOutlined /> },
            { title: '已下线', icon: <PauseCircleOutlined /> },
          ]}
        />
      </Card>

      <Card title="基本信息">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="应用名称">{app.name}</Descriptions.Item>
          <Descriptions.Item label="应用编码">{app.code}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="模块数">{app.moduleCount}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{app.createdAt}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{app.updatedAt}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="操作记录" style={{ marginTop: 16 }}>
        <Timeline
          items={[
            {
              color: 'green',
              children: `创建应用 ${new Date(app.createdAt).toLocaleString()}`,
            },
            {
              color: 'blue',
              children: `最近更新 ${new Date(app.updatedAt).toLocaleString()}`,
            },
            app.status === 'OFFLINE' && {
              color: 'red',
              children: <span>应用已下线（用户访问将被拒绝）</span>,
            },
            app.status === 'PUBLISHED' && {
              color: 'green',
              children: <span>应用正在服务</span>,
            },
          ].filter(Boolean) as never[]}
        />
      </Card>

      <Modal
        title="确认下线"
        open={confirmOfflineOpen}
        onCancel={() => setConfirmOfflineOpen(false)}
        onOk={handleOffline}
        okText="确认下线"
        okButtonProps={{ danger: true }}
      >
        <Typography.Paragraph>
          下线后用户将无法访问此应用，但已发布的版本快照仍保留，可在需要时恢复。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          目标应用：<strong>{app.name}</strong>
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
