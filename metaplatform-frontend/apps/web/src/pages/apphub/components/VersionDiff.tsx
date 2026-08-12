import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import { compareVersions } from '@/api/apphub/versions';

interface VersionDiffProps {
  aId?: string;
  bId?: string;
}

export default function VersionDiff({ aId, bId }: VersionDiffProps) {
  const [diff, setDiff] = useState<{
    added: string[];
    removed: string[];
    modified: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aId || !bId || aId === bId) {
      setDiff(null);
      return;
    }
    setLoading(true);
    compareVersions(aId, bId).then((d) => {
      setDiff(d);
      setLoading(false);
    });
  }, [aId, bId]);

  if (!aId || !bId) {
    return <Empty description="请选择两个版本进行对比" />;
  }
  if (aId === bId) {
    return <Empty description="请选择不同的两个版本" />;
  }
  if (loading) return <Spin />;
  if (!diff) return null;

  return (
    <Card title="版本差异" bodyStyle={{ padding: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <Tag prefixIcon={<PlusOutlined />} color="green">
          新增 {diff.added.length}
        </Tag>
        <Tag prefixIcon={<MinusOutlined />} color="red">
          删除 {diff.removed.length}
        </Tag>
        <Tag prefixIcon={<EditOutlined />} color="orange">
          修改 {diff.modified.length}
        </Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Card title="新增" bordered={false} bodyStyle={{ padding: 12 }}>
          {diff.added.length === 0 ? (
            <Typography.Text type="tertiary">无</Typography.Text>
          ) : (
            diff.added.map((k) => (
              <div key={k} style={{ color: 'var(--success)' }}>+ {k}</div>
            ))
          )}
        </Card>
        <Card title="删除" bordered={false} bodyStyle={{ padding: 12 }}>
          {diff.removed.length === 0 ? (
            <Typography.Text type="tertiary">无</Typography.Text>
          ) : (
            diff.removed.map((k) => (
              <div key={k} style={{ color: 'var(--destructive)' }}>- {k}</div>
            ))
          )}
        </Card>
        <Card title="修改" bordered={false} bodyStyle={{ padding: 12 }}>
          {diff.modified.length === 0 ? (
            <Typography.Text type="tertiary">无</Typography.Text>
          ) : (
            diff.modified.map((k) => (
              <div key={k} style={{ color: 'var(--warning)' }}>~ {k}</div>
            ))
          )}
        </Card>
      </div>
    </Card>
  );
}
