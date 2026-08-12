import { useEffect, useState } from 'react';
import { Button, Card, Empty, Spin, Tag, Timeline, Typography } from '@douyinfe/semi-ui';
import { ReloadOutlined } from '@ant-design/icons';
import { getEmployeeVersions } from '@/api/dw/employees';
import type { EmployeeVersion } from '@/api/dw/types';

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
        headerExtraContent={
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
    <Card title="版本历史" headerExtraContent={<Button icon={<ReloadOutlined />} onClick={load} size="small">刷新</Button>}>
      {versions.length === 0 ? (
        <Empty description="暂无版本" />
      ) : (
        <Timeline>
          {versions.map((v) => (
            <Timeline.Item key={v.version} color="blue">
              <div>
                <Typography.Text strong>v{v.version}</Typography.Text>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {new Date(v.timestamp).toLocaleString('zh-CN')}
                </Tag>
                <div>
                  <Typography.Text type="tertiary">{v.changeLog}</Typography.Text>
                </div>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Card>
  );
}
