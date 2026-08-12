import { useEffect, useState } from 'react';
import {
  Card,
  Tag,
  Space,
  Typography,
  Button,
  Empty,
  Spin,
  Rating,
  Timeline,
  Badge,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  LikeOutlined,
  DislikeOutlined,
  EditOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  listFeedback,
  listKnowledge,
  extractKnowledge,
  syncToKnowledgeBase,
  getLearningStats,
} from '@/api/dw/learning';
import type {
  Employee,
  FeedbackRecord,
  FeedbackType,
  LearnedKnowledge,
  LearningStats,
} from '@/api/dw/types';

interface LearningRecordsPanelProps {
  employee: Employee;
}

const FEEDBACK_ICON: Record<FeedbackType, React.ReactNode> = {
  thumb_up: <LikeOutlined />,
  thumb_down: <DislikeOutlined />,
  suggestion: <EditOutlined />,
};

const FEEDBACK_COLOR: Record<FeedbackType, TagColor> = {
  thumb_up: 'green',
  thumb_down: 'red',
  suggestion: 'blue',
};

const FEEDBACK_LABEL: Record<FeedbackType, string> = {
  thumb_up: '点赞',
  thumb_down: '点踩',
  suggestion: '建议',
};

export default function LearningRecordsPanel({ employee }: LearningRecordsPanelProps) {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [knowledge, setKnowledge] = useState<LearnedKnowledge[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [feedbackRes, knowledgeRes, statsRes] = await Promise.all([
        listFeedback({ employeeId: employee.employeeId }),
        listKnowledge(employee.employeeId),
        getLearningStats(employee.employeeId),
      ]);
      // Backend's feedback items use snake_case fields (id/tenant_id/scenario/rating/comment/feedback_at).
      // Frontend FeedbackRecord expects camelCase (feedbackId/taskId/taskTitle/feedbackType/executionResult/suggestion/tags/createdAt).
      // Map the backend fields onto the frontend shape so the panel can render without crashing on missing fields.
      const normalizedFeedback = (feedbackRes.items ?? []).map((raw: any) => ({
        feedbackId: raw.feedbackId ?? raw.id,
        employeeId: raw.employeeId ?? raw.employee_id,
        taskId: raw.taskId ?? raw.id ?? 'unknown',
        taskTitle: raw.taskTitle ?? raw.scenario ?? raw.comment ?? '反馈记录',
        executionResult: raw.executionResult ?? (raw.rating != null ? (raw.rating >= 4 ? 'success' : 'partial') : 'partial'),
        feedbackType: raw.feedbackType ?? (raw.rating != null ? (raw.rating >= 4 ? 'thumb_up' : 'thumb_down') : 'suggestion'),
        suggestion: raw.suggestion ?? raw.comment ?? '',
        tags: raw.tags ?? [],
        createdAt: raw.createdAt ?? raw.feedback_at ?? raw.created_at ?? new Date().toISOString(),
      }));
      setRecords(normalizedFeedback);
      setKnowledge(knowledgeRes.items ?? []);
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employee.employeeId]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      await extractKnowledge(employee.employeeId);
      await load();
    } finally {
      setExtracting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncToKnowledgeBase(employee.employeeId);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (loading && records.length === 0) {
    return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Card title="学习统计" style={{ minWidth: 240 }}>
          {stats ? (
            <Space vertical spacing={4}>
              <Typography.Text>反馈总数：{stats.totalFeedback}</Typography.Text>
              <Typography.Text>
                <LikeOutlined /> {stats.thumbUp} &nbsp;
                <DislikeOutlined /> {stats.thumbDown} &nbsp;
                <EditOutlined /> {stats.suggestions}
              </Typography.Text>
              <Typography.Text>
                成功率：{(stats.successRate * 100).toFixed(0)}%
              </Typography.Text>
              <Typography.Text>知识片段：{stats.knowledgeFragments}</Typography.Text>
              <Typography.Text>已同步：{stats.syncedFragments}</Typography.Text>
              <Space wrap>
                {stats.topTags?.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </Space>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="操作" style={{ minWidth: 200 }}>
          <Space vertical style={{ width: '100%' }}>
            <Button
              icon={<SyncOutlined spin={extracting} />}
              loading={extracting}
              onClick={handleExtract}
              block
            >
              提炼知识
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              loading={syncing}
              onClick={handleSync}
              block
            >
              同步到知识库
            </Button>
          </Space>
        </Card>
      </Space>

      <Typography.Title heading={5}>学习记录</Typography.Title>
      {records.length === 0 ? (
        <Empty description="暂无学习记录" />
      ) : (
        <Timeline>
          {records.map((record) => (
            <Timeline.Item
              key={record.feedbackId}
              color={FEEDBACK_COLOR[record.feedbackType]}
              dot={FEEDBACK_ICON[record.feedbackType]}
            >
              <Card style={{ marginBottom: 8 }}>
                <Space vertical spacing={4} style={{ width: '100%' }}>
                  <Space>
                    <Badge
                      type={
                        record.executionResult === 'success'
                          ? 'success'
                          : record.executionResult === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                    <Typography.Text strong>
                      {record.taskTitle || record.taskId}
                    </Typography.Text>
                    <Tag color={FEEDBACK_COLOR[record.feedbackType]}>
                      {FEEDBACK_LABEL[record.feedbackType]}
                    </Tag>
                  </Space>
                  {record.suggestion && (
                    <Typography.Text type="secondary">
                      {record.suggestion}
                    </Typography.Text>
                  )}
                  <Space wrap>
                    {record.tags?.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(record.createdAt).toLocaleString()}
                  </Typography.Text>
                </Space>
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <Typography.Title heading={5} style={{ marginTop: 16 }}>
        知识片段
      </Typography.Title>
      {knowledge.length === 0 ? (
        <Empty description="暂无知识片段" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {knowledge.map((item) => (
            <Card
              key={item.knowledgeId}
              title={item.title}
              headerExtraContent={
                <Space>
                  <Tag color={item.syncedToKb ? 'green' : 'grey'}>
                    {item.syncedToKb ? '已同步' : '未同步'}
                  </Tag>
                  <Rating disabled defaultValue={Math.round(item.confidence * 5)} count={5} />
                </Space>
              }
            >
              <Typography.Paragraph>{item.content}</Typography.Paragraph>
              <Space wrap>
                {item.tags?.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
