import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Space, Spin, Timeline, Typography } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { getEmployeeOperationLogs } from '@/api/dw/employees';
import type { EmployeeOperationLog } from '@/api/dw/types';
import { EmptyState } from '@/components/skeleton';
import '../agents.css';

const { Text } = Typography;

interface OperationLogPanelProps {
  employeeId: string;
}

function formatTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    CLONE: '克隆',
    ACTIVATE: '启用',
    DEACTIVATE: '停用',
    CONFIG_UPDATE: '配置变更',
  };
  return map[action] || action;
}

/** 员工操作日志（Card 区块 + Semi Timeline）。数据面沿用 /dw/employees/{id}/logs。 */
export default function OperationLogPanel({ employeeId }: OperationLogPanelProps) {
  const [logs, setLogs] = useState<EmployeeOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await getEmployeeOperationLogs(employeeId));
    } catch (e) {
      setLogs([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dataSource = useMemo(
    () =>
      logs.map((log) => ({
        time: formatTime(log.timestamp),
        type: (log.status === 'success' ? 'success' : 'error') as 'success' | 'error',
        extra: log.actor,
        content: (
          <Space spacing={4} wrap>
            <Text strong>{actionLabel(log.action)}</Text>
            {log.resource ? <Text type="tertiary">· {log.resource}</Text> : null}
            {log.ip ? <Text type="tertiary">· {log.ip}</Text> : null}
          </Space>
        ),
      })),
    [logs],
  );

  return (
    <Card
      title="操作日志"
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
          title="操作日志加载失败"
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
      ) : logs.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="暂无操作日志"
          desc="对该员工的启用、停用、配置变更都会记录在这里。"
        />
      ) : (
        <Timeline dataSource={dataSource} />
      )}
    </Card>
  );
}
