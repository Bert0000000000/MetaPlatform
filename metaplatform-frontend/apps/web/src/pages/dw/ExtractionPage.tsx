import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { getExtractionsByEmployee } from '@/api/dw/extraction';
import type { ExtractionItem } from '@/api/dw/types';

export default function ExtractionPage() {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getExtractionsByEmployee('')
      .then((res: ExtractionItem[]) => {
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
      header={<h2>概念抽取列表</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无抽取记录" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.type}</Tag>
                <Tag>{item.status}</Tag>
                置信度 {item.confidence}
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}