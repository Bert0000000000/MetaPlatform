import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { listKnowledge } from '@/api/dw/learning';
import type { LearnedKnowledge } from '@/api/dw/types';

export default function LearningPage() {
  const [items, setItems] = useState<LearnedKnowledge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listKnowledge('')
      .then((res: LearnedKnowledge[] | { items?: LearnedKnowledge[] }) => {
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
      header={<h2>学习沉淀</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无学习沉淀" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <Tag>{item.knowledgeType}</Tag>
              <Tag>{item.syncedToKb ? '已同步' : '未同步'}</Tag>
              置信度 {item.confidence}
            </div>
          </div>
        </List.Item>
      )}
    >
      <Row gutter={16}>
        <Col span={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>沉淀条目数</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{items.length}</span>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>已同步</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{items.filter((i) => i.syncedToKb).length}</span>
          </div>
        </Col>
      </Row>
    </List>
  );
}
