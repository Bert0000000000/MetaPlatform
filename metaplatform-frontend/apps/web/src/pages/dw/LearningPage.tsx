import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin, Button, Toast } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { listKnowledge } from '@/api/dw/learning';
import { promoteFeedback } from '@/api/dw/learning';
import type { LearnedKnowledge } from '@/api/dw/types';

export default function LearningPage() {
  const [items, setItems] = useState<LearnedKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);

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

  const handlePromote = async (feedbackId: string) => {
    if (!feedbackId) {
      Toast.error('该条目未关联 feedback id,无法提升');
      return;
    }
    setPromoting(feedbackId);
    try {
      const res = await promoteFeedback(feedbackId);
      Toast.success(`已提升至知识库 (${res.promotedDocumentId ?? res.promoted_document_id})`);
    } catch (err) {
      Toast.error('提升失败,请稍后重试');
    } finally {
      setPromoting(null);
    }
  };

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
          <Button
            size="small"
            type="secondary"
            theme="light"
            loading={promoting === (item.sourceFeedbackIds?.[0] ?? item.knowledgeId)}
            disabled={item.syncedToKb}
            onClick={() => handlePromote(item.sourceFeedbackIds?.[0] ?? item.knowledgeId)}
          >
            提升至知识库
          </Button>
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
