import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无抽取记录" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.name}
            description={
              <>
                <Tag>{item.type}</Tag>
                <Tag>{item.status}</Tag>
                <span style={{ marginLeft: 8 }}>置信度 {item.confidence}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}