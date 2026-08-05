import { useEffect, useState } from 'react';
import { Card, Tag, Typography, Space, Empty, Button, Statistic, Row, Col } from 'antd';
import { ArrowRightOutlined, RobotOutlined } from '@ant-design/icons';
import { getEmployeeStatus } from '@/api/dashboard/employees';
import type { WorkerStatus } from '@/api/dashboard/types';

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
      extra={<Button type="text" icon={<ArrowRightOutlined />} onClick={handleJumpToDW} />}
      loading={loading}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic title="在线员工" value={activeCount} prefix={<RobotOutlined />} />
        </Col>
        <Col span={8}>
          <Statistic title="运行中任务" value={totalRunning} />
        </Col>
        <Col span={8}>
          <Statistic title="今日完成" value={workers.reduce((s, w) => s + w.completedToday, 0)} />
        </Col>
      </Row>
      {workers.length === 0 ? (
        <Empty description="暂无数字员工" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ flexShrink: 0 }}>
                  <RobotOutlined style={{ fontSize: 24, color: w.status === 'ACTIVE' ? '#52c41a' : '#999' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>
                    <Space>
                      <Typography.Text strong>{w.name}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{w.code}</Typography.Text>
                    </Space>
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      运行中 {w.runningTasks} · 今日完成 {w.completedToday}
                      {w.lastActiveAt && ` · 最后活跃 ${new Date(w.lastActiveAt).toLocaleString('zh-CN')}`}
                    </Typography.Text>
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Tag color={w.status === 'ACTIVE' ? 'green' : 'default'}>
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
