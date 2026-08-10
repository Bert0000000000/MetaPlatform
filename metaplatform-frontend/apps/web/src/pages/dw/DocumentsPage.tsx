import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
import { listDocuments } from '@/api/dw/documents';
import type { DocumentItem } from '@/api/dw/types';

export default function DocumentsPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listDocuments('')
      .then((res: DocumentItem[] | { items?: DocumentItem[] }) => {
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
      header={<h2>知识文档列表</h2>}
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无文档" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.filename}
            description={
              <>
                <Tag>{item.status}</Tag>
                <span style={{ marginLeft: 8 }}>{item.fileType}</span>
                <span style={{ marginLeft: 8 }}>{item.fileSize} B</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}