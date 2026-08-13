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
  Toast,
  Spin,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  ArrowLeftOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getApp, updateApp } from '@/api/apphub/apps';
import { publishApp } from '@/api/apphub/runtime';
import type { AppItem, AppStatus } from '@/api/apphub/types';

const STATUS_MAP: Record<AppStatus, { label: string; color: TagColor }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'grey' },
};

export default function AppLifecyclePage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOfflineOpen, setConfirmOfflineOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    Toast.success('应用已下线');
    setConfirmOfflineOpen(false);
    load();
  };

  const handleOnline = async () => {
    setPublishing(true);
    try {
      await updateApp(app.appId, { status: 'PUBLISHED' });
      await publishApp(app.appId);
      Toast.success('应用已恢复上线');
      load();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/${appId}`)}>
          返回
        </Button>
        <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        {app.status !== 'PUBLISHED' && (
          <Button
            theme="solid"
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleOnline}
            loading={publishing}
          >
            发布
          </Button>
        )}
        {app.status === 'PUBLISHED' && (
          <Button type="danger" icon={<PauseCircleOutlined />} onClick={() => setConfirmOfflineOpen(true)}>
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
        <Steps current={currentStep} type="basic">
          <Steps.Step title="设计" icon={<ClockCircleOutlined/>} />
          <Steps.Step title="已发布" icon={<CloudUploadOutlined/>} />
          <Steps.Step title="已下线" icon={<PauseCircleOutlined/>} />
        </Steps>
      </Card>

      <Card title="基本信息">
        <Descriptions
          column={2}
          size="small"
          data={[
            { key: '应用名称', value: app.name },
            { key: '应用编码', value: app.code },
            {
              key: '状态',
              value: (
                <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
              ),
            },
            { key: '模块数', value: app.moduleCount },
            { key: '创建时间', value: app.createdAt },
            { key: '更新时间', value: app.updatedAt },
          ]}
        />
      </Card>

      <Card title="操作记录" style={{ marginTop: 16 }}>
        <Timeline
          dataSource={[
            {
              color: 'var(--semi-color-success)',
              content: `创建应用 ${new Date(app.createdAt).toLocaleString()}`,
            },
            {
              color: 'var(--semi-color-primary)',
              content: `最近更新 ${new Date(app.updatedAt).toLocaleString()}`,
            },
            app.status === 'OFFLINE' && {
              color: 'var(--semi-color-danger)',
              content: <span>应用已下线（用户访问将被拒绝）</span>,
            },
            app.status === 'PUBLISHED' && {
              color: 'var(--semi-color-success)',
              content: <span>应用正在服务</span>,
            },
          ].filter(Boolean) as never[]}
        />
      </Card>

      <Modal
        title="确认下线"
        visible={confirmOfflineOpen}
        onCancel={() => setConfirmOfflineOpen(false)}
        onOk={handleOffline}
        okText="确认下线"
        okType="danger"
      >
        <Typography.Paragraph>
          下线后用户将无法访问此应用，但已发布的版本快照仍保留，可在需要时恢复。
        </Typography.Paragraph>
        <Typography.Paragraph type="tertiary">
          目标应用：<strong>{app.name}</strong>
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
