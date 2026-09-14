import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Rating, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { listConversations, scoreConversation } from '@/api/dw/evaluations';
import type { ConversationRecord } from '@/api/dw/evaluations';
import { DataTablePro, EmptyState } from '@/components/skeleton';
import '../agents.css';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

interface ConversationListProps {
  employeeId?: string;
  onSelect: (c: ConversationRecord) => void;
  /** 高亮当前正在回放的对话（可选） */
  selectedId?: string;
}

/**
 * 对话记录表（评估页左栏）：
 * - 点对话 ID / 「回放」按钮 → 交给父级做回放
 * - 未评分行可直接打星，落库后刷新列表
 *
 * 三态明确：加载（表格 loading）≠ 空（EmptyState）≠ 失败（EmptyState failure）。
 */
export default function ConversationList({ employeeId, onSelect, selectedId }: ConversationListProps) {
  const [convs, setConvs] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listConversations(employeeId);
      setConvs(items);
    } catch (e) {
      setConvs([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRate = async (c: ConversationRecord, score: number) => {
    try {
      await scoreConversation(c.conversationId, score, 'admin');
      Toast.success(`已为对话评分：${score}`);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns: SemiColumns<ConversationRecord> = [
    {
      title: '对话',
      dataIndex: 'conversationId',
      render: (v: string, c: ConversationRecord) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => onSelect(c)}
        >
          {v}
        </Button>
      ),
    },
    {
      title: '消息数',
      key: 'count',
      width: 90,
      render: (_: unknown, c: ConversationRecord) => c.messages.length,
    },
    { title: '任务', dataIndex: 'taskId', ellipsis: true },
    {
      title: '评分',
      dataIndex: 'qualityScore',
      width: 150,
      render: (v: number | undefined, c: ConversationRecord) =>
        v ? (
          <Rating disabled value={Math.round(v * 5)} allowHalf />
        ) : (
          <Rating onChange={(s: number) => void handleRate(c, s / 5)} />
        ),
    },
    {
      title: '已评分',
      key: 'evaluated',
      width: 110,
      render: (_: unknown, c: ConversationRecord) =>
        c.evaluatedBy ? (
          <Tag color="green" type="light">
            {c.evaluatedBy}
          </Tag>
        ) : (
          <Typography.Text type="tertiary">未评分</Typography.Text>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Card
      title={
        <span className="mp-agent-line">
          <span>对话记录</span>
          {selectedId ? <Tag type="light">回放中：{selectedId}</Tag> : null}
        </span>
      }
    >
      {error ? (
        <EmptyState
          illustration="failure"
          title="对话记录加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : !loading && convs.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="没有可回放的对话"
          desc="该员工执行任务产生对话后，这里会实时出现。"
        />
      ) : (
        <DataTablePro<ConversationRecord>
          rowKey="conversationId"
          dataSource={convs}
          columns={columns}
          loading={loading}
          empty={<EmptyState illustration="no-content" title="没有可回放的对话" />}
        />
      )}
    </Card>
  );
}
