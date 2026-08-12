import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
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
      dataSource={items}
      emptyContent={<Empty description="暂无文档" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.filename}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.status}</Tag>
                {item.fileType}
                {item.fileSize} B
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}