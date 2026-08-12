import { useEffect, useState } from 'react';
import { Card, Tag, Typography, Space, Empty, Button } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { ArrowRightOutlined, RobotOutlined } from '@ant-design/icons';
import { getEmployeeStatus } from '@/api/dashboard/employees';
import type { WorkerStatus } from '@/api/dashboard/types';

const { Text } = Typography;

export default function WorkerStatusCard() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getEmployeeStatus();
      setWorkers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = workers.filter((w) => w.status === 'ACTIVE').length;
  const totalRunning = workers.reduce((sum, w) => sum + w.runningTasks, 0);

  const handleJumpToDW = () => {
    window.open('http://localhost:9204/dw', '_blank');
  };

  return (
    <Card
      title="数字员工状态"
      headerExtraContent={
        <Button theme="borderless" icon={<ArrowRightOutlined />} onClick={handleJumpToDW} />
      }
      loading={loading}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>在线员工</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RobotOutlined style={{ fontSize: 20, color: 'var(--muted-foreground)' }} />
              {activeCount}
            </div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>运行中任务</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)' }}>{totalRunning}</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>今日完成</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)' }}>{workers.reduce((s, w) => s + w.completedToday, 0)}</div>
          </div>
        </Col>
      </Row>
      {workers.length === 0 ? (
        <Empty description="暂无数字员工" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workers.slice(0, 5).map((w) => (
            <div
              key={w.code ?? w.name}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ flexShrink: 0 }}>
                  <RobotOutlined style={{ fontSize: 24, color: w.status === 'ACTIVE' ? 'var(--success)' : 'var(--muted-foreground)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>
                    <Space spacing={8}>
                      <Text strong>{w.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{w.code}</Text>
                    </Space>
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      运行中 {w.runningTasks} · 今日完成 {w.completedToday}
                      {w.lastActiveAt && ` · 最后活跃 ${new Date(w.lastActiveAt).toLocaleString('zh-CN')}`}
                    </Text>
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Tag color={w.status === 'ACTIVE' ? 'green' : 'grey'}>
                  {w.status === 'ACTIVE' ? '在线' : '离线'}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
