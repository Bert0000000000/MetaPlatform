import { useEffect, useState } from 'react';
import { Card, Empty, Tag, Timeline, Typography, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getEmployeeVersions } from '@/api/employees';
import type { EmployeeVersion } from '@/types';

interface EmployeeVersionHistoryProps {
  employeeId: string;
}

export default function EmployeeVersionHistory({ employeeId }: EmployeeVersionHistoryProps) {
  const [versions, setVersions] = useState<EmployeeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeVersions(employeeId);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employeeId]);

  if (loading) {
    return (
      <Card title="版本历史">
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="版本历史"
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} size="small">
            重试
          </Button>
        }
      >
        <Empty description={`加载失败：${error.message}`} />
      </Card>
    );
  }

  return (
    <Card title="版本历史" extra={<Button icon={<ReloadOutlined />} onClick={load} size="small">刷新</Button>}>
      {versions.length === 0 ? (
        <Empty description="暂无版本" />
      ) : (
        <Timeline
          items={versions.map((v) => ({
            color: 'blue',
            children: (
              <div>
                <Typography.Text strong>v{v.version}</Typography.Text>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {new Date(v.timestamp).toLocaleString('zh-CN')}
                </Tag>
                <div>
                  <Typography.Text type="secondary">{v.changeLog}</Typography.Text>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
}
