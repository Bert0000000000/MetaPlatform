import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Tag, Typography } from 'antd';
import { PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import { compareVersions } from '@/api/versions';

interface VersionCompareProps {
  aId?: string;
  bId?: string;
}

export default function VersionCompare({ aId, bId }: VersionCompareProps) {
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

  if (!aId || !bId) return <Empty description="请选择两个版本对比" />;
  if (aId === bId) return <Empty description="请选择不同版本" />;
  if (loading) return <Spin />;
  if (!diff) return null;

  return (
    <Card title="版本对比" size="small">
      <div style={{ marginBottom: 12 }}>
        <Tag icon={<PlusOutlined />} color="green">新增 {diff.added.length}</Tag>
        <Tag icon={<MinusOutlined />} color="red">删除 {diff.removed.length}</Tag>
        <Tag icon={<EditOutlined />} color="orange">修改 {diff.modified.length}</Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {(['added', 'removed', 'modified'] as const).map((k) => (
          <Card type="inner" title={k === 'added' ? '新增' : k === 'removed' ? '删除' : '修改'} size="small" key={k}>
            {diff[k].length === 0 ? <Typography.Text type="secondary">无</Typography.Text> :
              diff[k].map((item) => (
                <div
                  key={item}
                  style={{ color: k === 'added' ? '#52c41a' : k === 'removed' ? '#f5222d' : '#fa8c16' }}
                >
                  {k === 'added' ? '+' : k === 'removed' ? '-' : '~'} {item}
                </div>
              ))}
          </Card>
        ))}
      </div>
    </Card>
  );
}
