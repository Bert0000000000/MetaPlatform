import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
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
      dataSource={items}
      emptyContent={<Empty description="暂无 span 数据" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{`${item.serviceName} / ${item.operationName}`}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.status}</Tag>
                {item.durationUs} µs
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}