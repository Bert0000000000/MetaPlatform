import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { listCollaborationSessions, type CollaborationSession } from '@/api/dw/collaborations';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 协作会话。GET /dw/collaborations 返回员工之间的会话记录。
 */

export default function CollaborationsPage() {
  const [items, setItems] = useState<CollaborationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listCollaborationSessions();
      setItems(res.items);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableProProps<CollaborationSession>['columns'] = [
    {
      title: '会话 ID',
      dataIndex: 'sessionId',
      width: 220,
      ellipsis: true,
    },
    {
      title: '数字员工',
      dataIndex: 'employeeId',
      width: 240,
      ellipsis: true,
    },
    { title: '协作员工', dataIndex: 'peerEmployeeId', width: 240, ellipsis: true },
    { title: '开始时间', dataIndex: 'startedAt', width: 180 },
    { title: '耗时 (ms)', dataIndex: 'durationMs', width: 110 },
  ];

  return (
    <>
      <PageHeader
        title="协作会话列表"
        desc={error ? undefined : loading ? '正在加载协作会话…' : `共 ${items.length} 个协作会话`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="协作会话加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : (
        <Card>
          <DataTablePro<CollaborationSession>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无协作会话"
                desc="员工之间产生协作会话后，记录会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
