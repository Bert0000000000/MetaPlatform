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
import { EmptyState, PageHeader } from '@/components/skeleton';

const STATUS_MAP: Record<AppStatus, { label: string; color: TagColor }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'grey' },
};

export default function AppLifecyclePage({ appId: appIdProp }: { appId?: string } = {}) {
  const { appId: routeAppId } = useParams<{ appId: string }>();
  const appId = appIdProp || routeAppId;
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOfflineOpen, setConfirmOfflineOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    if (!appId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const a = await getApp(appId);
      setApp(a);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '生命周期读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appId]);

  if (loadError) {
    return <div><PageHeader title="应用生命周期" /><div role="alert"><EmptyState illustration="failure" title="应用状态暂不可用" desc={loadError} actions={<Button type="primary" onClick={load}>重试</Button>} /></div></div>;
  }
  if (!appId) return <div><PageHeader title="应用生命周期" /><EmptyState title="未选择应用" actions={<Button onClick={() => navigate('/apps/mine')}>返回应用列表</Button>} /></div>;
  if (loading || !app) {
    return (
      <div>
        <PageHeader title="应用生命周期" />
        <div className="mp-app-loading"><Spin tip="正在读取应用…" /></div>
      </div>
    );
  }

  const statusInfo = app.status ? STATUS_MAP[app.status] : undefined;
  const currentStep = app.status === 'DESIGNING' ? 0 : app.status === 'PUBLISHED' ? 1 : app.status === 'OFFLINE' ? 2 : undefined;
  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : '—';
  };

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
      <PageHeader title="应用生命周期" desc={app.name} />
      <Space className="mp-mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/mine?app=${appId}`)}>
          返回
        </Button>
        <Tag color={statusInfo?.color ?? 'grey'}>{statusInfo?.label ?? '未提供'}</Tag>
      </Space>

      <Space className="mp-mb-4">
        {statusInfo && app.status !== 'PUBLISHED' && (
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

      <Card title="生命周期阶段" className="mp-mb-4">
        {currentStep === undefined ? <Typography.Text type="tertiary">未提供</Typography.Text> : <Steps current={currentStep} type="basic">
          <Steps.Step title="设计" icon={<ClockCircleOutlined/>} />
          <Steps.Step title="已发布" icon={<CloudUploadOutlined/>} />
          <Steps.Step title="已下线" icon={<PauseCircleOutlined/>} />
        </Steps>}
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
                <Tag color={statusInfo?.color ?? 'grey'}>{statusInfo?.label ?? '未提供'}</Tag>
              ),
            },
            { key: '模块数', value: app.moduleCount ?? '—' },
            { key: '创建时间', value: app.createdAt || '—' },
            { key: '更新时间', value: app.updatedAt || '—' },
          ]}
        />
      </Card>

      <Card title="操作记录" className="mp-mt-4">
        <Timeline
          dataSource={[
            {
              color: 'var(--semi-color-success)',
              content: `创建应用 ${formatDate(app.createdAt)}`,
            },
            {
              color: 'var(--semi-color-primary)',
              content: `最近更新 ${formatDate(app.updatedAt)}`,
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
