import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin, Button, Toast, Tooltip } from '@douyinfe/semi-ui';
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

  const handlePromote = async (feedbackId: string | undefined) => {
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
      renderItem={(item) => {
        // Resolve the source feedback id once per row. Previously the code
        // fell back to `item.knowledgeId` when `sourceFeedbackIds` was empty,
        // which caused the promote call to land on a non-existent feedback
        // id and the backend returned 404. Disable the button + show a
        // Tooltip instead so the user understands why promote is unavailable.
        const feedbackId = item.sourceFeedbackIds?.[0];
        const noFeedback = !feedbackId;
        const button = (
          <Button
            size="small"
            type="secondary"
            theme="light"
            loading={promoting === feedbackId}
            disabled={item.syncedToKb || noFeedback}
            onClick={() => handlePromote(feedbackId)}
          >
            提升至知识库
          </Button>
        );
        return (
          <List.Item>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
                <Tag>{item.knowledgeType}</Tag>
                <Tag>{item.syncedToKb ? '已同步' : '未同步'}</Tag>
                置信度 {item.confidence}
                {noFeedback && (
                  <Tag color="orange">无可用 feedback id</Tag>
                )}
              </div>
            </div>
            {noFeedback ? (
              <Tooltip content="该条目没有关联的 sourceFeedbackIds，无法调用 promote 接口">
                <span>{button}</span>
              </Tooltip>
            ) : (
              button
            )}
          </List.Item>
        );
      }}
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
