import { useEffect, useState } from 'react';
import { Card, Empty, Rate, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listConversations, scoreConversation } from '@/api/evaluations';
import type { ConversationRecord } from '@/api/evaluations';

interface ConversationListProps {
  employeeId?: string;
  onSelect: (c: ConversationRecord) => void;
}

export default function ConversationList({ employeeId, onSelect }: ConversationListProps) {
  const [convs, setConvs] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const items = await listConversations(employeeId);
      setConvs(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employeeId]);

  const handleRate = async (c: ConversationRecord, score: number) => {
    await scoreConversation(c.conversationId, score, 'admin');
    message.success(`已为对话评分：${score}`);
    load();
  };

  const columns: ColumnsType<ConversationRecord> = [
    {
      title: '对话',
      key: 'id',
      render: (_, c) => (
        <Typography.Text>
          <a onClick={() => onSelect(c)}>{c.conversationId}</a>
        </Typography.Text>
      ),
    },
    {
      title: '消息数',
      key: 'count',
      render: (_, c) => c.messages.length,
    },
    {
      title: '任务',
      dataIndex: 'taskId',
    },
    {
      title: '评分',
      dataIndex: 'qualityScore',
      render: (v?: number, r?: ConversationRecord) => (
        v ? (
          <Rate disabled value={Math.round(v * 5)} />
        ) : (
          <Rate onChange={(s) => r && handleRate(r, s / 5)} />
        )
      ),
    },
    {
      title: '已评分',
      key: 'evaluated',
      render: (_, c) => (c.evaluatedBy ? <Tag color="green">{c.evaluatedBy}</Tag> : <Typography.Text type="secondary">未评分</Typography.Text>),
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
  ];

  if (convs.length === 0 && !loading) {
    return <Empty description="没有可用的对话记录" />;
  }

  return (
    <Card title="对话记录" loading={loading}>
      <Table
        rowKey="conversationId"
        dataSource={convs}
        columns={columns}
        pagination={{ pageSize: 10 }}
        size="small" scroll={{ x: 'max-content' }} />
    </Card>
  );
}
