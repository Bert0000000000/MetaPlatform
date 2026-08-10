import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
import { getTraceSpans, type ObsSpan } from '@/api/dw/obs';

export default function ObsPage() {
  const [items, setItems] = useState<ObsSpan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getTraceSpans('latest')
      .then((res: ObsSpan[]) => {
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
      header={<h2>可观测 Span</h2>}
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无 span 数据" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={`${item.serviceName} / ${item.operationName}`}
            description={
              <>
                <Tag>{item.status}</Tag>
                <span style={{ marginLeft: 8 }}>{item.durationUs} µs</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}