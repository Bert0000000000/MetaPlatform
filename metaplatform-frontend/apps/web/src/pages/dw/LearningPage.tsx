import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin, Statistic, Row as ARow, Col } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无学习沉淀" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.title}
            description={
              <>
                <Tag>{item.knowledgeType}</Tag>
                <Tag>{item.syncedToKb ? '已同步' : '未同步'}</Tag>
                <span style={{ marginLeft: 8 }}>置信度 {item.confidence}</span>
              </>
            }
          />
        </List.Item>
      )}
    >
      <ARow gutter={16}>
        <Col span={8}>
          <Statistic title="沉淀条目数" value={items.length} />
        </Col>
        <Col span={8}>
          <Statistic title="已同步" value={items.filter((i) => i.syncedToKb).length} />
        </Col>
      </ARow>
    </List>
  );
}