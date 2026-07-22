import { useEffect, useState } from 'react';
import {
  Card,
  List,
  Tag,
  Space,
  Typography,
  Button,
  Empty,
  Spin,
  Rate,
  Timeline,
  Badge,
} from 'antd';
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
} from '@/api/learning';
import type {
  Employee,
  FeedbackRecord,
  FeedbackType,
  LearnedKnowledge,
  LearningStats,
} from '@/types';

interface LearningRecordsPanelProps {
  employee: Employee;
}

const FEEDBACK_ICON: Record<FeedbackType, React.ReactNode> = {
  thumb_up: <LikeOutlined />,
  thumb_down: <DislikeOutlined />,
  suggestion: <EditOutlined />,
};

const FEEDBACK_COLOR: Record<FeedbackType, string> = {
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
      setRecords(feedbackRes.items);
      setKnowledge(knowledgeRes.items);
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
        <Card size="small" title="学习统计" style={{ minWidth: 240 }}>
          {stats ? (
            <Space direction="vertical" size={4}>
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
                {stats.topTags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card size="small" title="操作" style={{ minWidth: 200 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              icon={<SyncOutlined spin={extracting} />}
              loading={extracting}
              onClick={handleExtract}
              block
            >
              提炼知识
            </Button>
            <Button
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

      <Typography.Title level={5}>学习记录</Typography.Title>
      {records.length === 0 ? (
        <Empty description="暂无学习记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          items={records.map((record) => ({
            color: FEEDBACK_COLOR[record.feedbackType],
            dot: FEEDBACK_ICON[record.feedbackType],
            children: (
              <Card size="small" style={{ marginBottom: 8 }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space>
                    <Badge
                      status={
                        record.executionResult === 'success'
                          ? 'success'
                          : record.executionResult === 'failed'
                            ? 'error'
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
                    {record.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(record.createdAt).toLocaleString()}
                  </Typography.Text>
                </Space>
              </Card>
            ),
          }))}
        />
      )}

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        知识片段
      </Typography.Title>
      {knowledge.length === 0 ? (
        <Empty description="暂无知识片段" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={knowledge}
          renderItem={(item) => (
            <List.Item>
              <Card
                size="small"
                title={item.title}
                extra={
                  <Space>
                    <Tag color={item.syncedToKb ? 'green' : 'default'}>
                      {item.syncedToKb ? '已同步' : '未同步'}
                    </Tag>
                    <Rate disabled defaultValue={Math.round(item.confidence * 5)} count={5} />
                  </Space>
                }
                style={{ width: '100%' }}
              >
                <Typography.Paragraph>{item.content}</Typography.Paragraph>
                <Space wrap>
                  {item.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}

    </div>
  );
}
