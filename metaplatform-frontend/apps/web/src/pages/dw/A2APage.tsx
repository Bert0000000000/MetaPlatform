import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无外部 Agent" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.name}
            description={
              <>
                <Tag>{item.status}</Tag>
                <Tag>{item.authType}</Tag>
                <span style={{ marginLeft: 8 }}>评分 {item.rating}</span>
                <span style={{ marginLeft: 8 }}>委派 {item.totalDelegations}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}