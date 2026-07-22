import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DiffOutlined } from '@ant-design/icons';
import {
  listVersions,
  createVersion,
  publishVersion,
  rollbackVersion,
  deleteVersion,
} from '@/api/versions';
import { getApp } from '@/api/apps';
import VersionList from '@/components/VersionList';
import RollbackConfirm from '@/components/RollbackConfirm';
import VersionDiff from '@/components/VersionDiff';
import type { AppVersion } from '@/api/versions';
import type { AppItem } from '@/types';

export default function VersionManagementPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState<AppVersion | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<AppVersion | null>(null);
  const [selectedA, setSelectedA] = useState<string>();
  const [selectedB, setSelectedB] = useState<string>();
  const [form] = Form.useForm();

  const load = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const [a, v] = await Promise.all([getApp(appId), listVersions(appId)]);
      setApp(a);
      setVersions(v.items);
      const published = v.items.find((x) => x.status === 'PUBLISHED');
      if (published) setSelectedA(published.versionId);
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

  const handleCreate = async () => {
    if (!appId) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createVersion({
        appId,
        version: values.version,
        changeLog: values.changeLog,
        snapshot: JSON.stringify(app),
      });
      message.success('版本草稿已创建');
      setCreateOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (v: AppVersion) => {
    await publishVersion(v.versionId);
    message.success('版本已发布');
    load();
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    await rollbackVersion(rollbackTarget.versionId);
    message.success('已回滚');
    setRollbackTarget(null);
    load();
  };

  const published = versions.find((v) => v.status === 'PUBLISHED');

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/${appId}`)}>
          返回应用
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          版本管理 - {app.name}
        </Typography.Title>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          创建版本快照
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <DiffOutlined />
          <Typography.Text>
            选中两个版本（A 和 B）查看差异。当前线上版本：
          </Typography.Text>
          {published && <strong>v{published.version}</strong>}
        </Space>
        <VersionDiff aId={selectedA} bId={selectedB} />
      </Card>

      <Card title="所有版本">
        {versions.length === 0 ? (
          <Empty description="还没有版本快照" />
        ) : (
          <VersionList
            versions={versions}
            selectedA={selectedA}
            selectedB={selectedB}
            onSelectA={setSelectedA}
            onSelectB={setSelectedB}
            onPublish={handlePublish}
            onRollback={(v) => setRollbackTarget(v)}
            onDelete={async (v) => {
              await deleteVersion(v.versionId);
              message.success('已删除');
              load();
            }}
            onPreview={(v) => setPreviewing(v)}
          />
        )}
      </Card>

      <Modal
        title="创建版本快照"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="version" label="版本号" rules={[{ required: true }, { pattern: /^\d+\.\d+\.\d+$/, message: '语义化版本，例如 1.0.0' }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="changeLog" label="变更说明">
            <Input.TextArea rows={3} placeholder="本次变更内容..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="版本预览"
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={
          <Button onClick={() => setPreviewing(null)}>关闭</Button>
        }
        width={720}
      >
        {previewing && (
          <pre style={codeStyle}>
            {JSON.stringify(JSON.parse(previewing.snapshot || '{}'), null, 2)}
          </pre>
        )}
      </Modal>

      <Modal
        title="版本回滚确认"
        open={!!rollbackTarget}
        onCancel={() => setRollbackTarget(null)}
        onOk={handleRollback}
        okText="确认回滚"
        okButtonProps={{ danger: true }}
      >
        {rollbackTarget && published && (
          <RollbackConfirm current={published} target={rollbackTarget} />
        )}
      </Modal>
    </div>
  );
}

const codeStyle: CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 400,
  overflow: 'auto',
};
