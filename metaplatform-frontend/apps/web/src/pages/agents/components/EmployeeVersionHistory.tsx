import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Timeline, Typography } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { getEmployeeVersions } from '@/api/dw/employees';
import type { EmployeeVersion } from '@/api/dw/types';
import { EmptyState } from '@/components/skeleton';
import '../agents.css';

interface EmployeeVersionHistoryProps {
  employeeId: string;
}

function formatTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('zh-CN');
}

/** 员工版本历史（Card 区块 + Semi Timeline）。数据面沿用 /dw/employees/{id}/versions。 */
export default function EmployeeVersionHistory({ employeeId }: EmployeeVersionHistoryProps) {
  const [versions, setVersions] = useState<EmployeeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setVersions(await getEmployeeVersions(employeeId));
    } catch (e) {
      setVersions([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card
      title="版本历史"
      headerExtraContent={
        <Button
          size="small"
          icon={<RefreshCw size={14} strokeWidth={1.5} />}
          loading={loading}
          onClick={() => void load()}
        >
          刷新
        </Button>
      }
    >
      {error ? (
        <EmptyState
          illustration="failure"
          title="版本历史加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : versions.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="暂无版本"
          desc="员工配置发生变更后，这里会留下版本快照。"
        />
      ) : (
        <Timeline>
          {versions.map((v) => (
            <Timeline.Item key={v.version} time={formatTime(v.timestamp)}>
              <Typography.Text strong>v{v.version}</Typography.Text>
              <Typography.Paragraph type="tertiary">{v.changeLog || '—'}</Typography.Paragraph>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Card>
  );
}
