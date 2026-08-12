import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { listExternalAgents, type ExternalAgent } from '@/api/dw/a2a';

export default function A2APage() {
  const [items, setItems] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listExternalAgents()
      .then((res: ExternalAgent[]) => {
        if (mounted) setItems(res ?? []);
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
      header={<h2>外部 Agent（A2A）</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无外部 Agent" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.status}</Tag>
                <Tag>{item.authType}</Tag>
                评分 {item.rating}
                委派 {item.totalDelegations}
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}