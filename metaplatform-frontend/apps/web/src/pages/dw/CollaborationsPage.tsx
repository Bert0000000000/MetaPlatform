import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { listCollaborations, type CollaborationTask } from '@/api/dw/collaborations';

export default function CollaborationsPage() {
  const [items, setItems] = useState<CollaborationTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listCollaborations()
      .then((res: CollaborationTask[] | { items?: CollaborationTask[] }) => {
        if (!mounted) return;
        setItems(Array.isArray(res) ? res : (res?.items ?? []));
      })
      .catch(() => {
        if (mounted) setItems([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <Spin tip="加载中" />;
  }

  return (
    <List
      header={<h2>协作任务列表</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无协作任务" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.collaborationId}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.status ?? 'UNKNOWN'}</Tag>
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}