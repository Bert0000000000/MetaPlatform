import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Tag, Typography } from 'antd';
import { PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import { compareVersions } from '@/api/versions';

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
    <Card title="版本差异" size="small">
      <div style={{ marginBottom: 12 }}>
        <Tag icon={<PlusOutlined />} color="green">
          新增 {diff.added.length}
        </Tag>
        <Tag icon={<MinusOutlined />} color="red">
          删除 {diff.removed.length}
        </Tag>
        <Tag icon={<EditOutlined />} color="orange">
          修改 {diff.modified.length}
        </Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Card type="inner" title="新增" size="small">
          {diff.added.length === 0 ? (
            <Typography.Text type="secondary">无</Typography.Text>
          ) : (
            diff.added.map((k) => (
              <div key={k} style={{ color: '#52c41a' }}>+ {k}</div>
            ))
          )}
        </Card>
        <Card type="inner" title="删除" size="small">
          {diff.removed.length === 0 ? (
            <Typography.Text type="secondary">无</Typography.Text>
          ) : (
            diff.removed.map((k) => (
              <div key={k} style={{ color: '#f5222d' }}>- {k}</div>
            ))
          )}
        </Card>
        <Card type="inner" title="修改" size="small">
          {diff.modified.length === 0 ? (
            <Typography.Text type="secondary">无</Typography.Text>
          ) : (
            diff.modified.map((k) => (
              <div key={k} style={{ color: '#fa8c16' }}>~ {k}</div>
            ))
          )}
        </Card>
      </div>
    </Card>
  );
}
