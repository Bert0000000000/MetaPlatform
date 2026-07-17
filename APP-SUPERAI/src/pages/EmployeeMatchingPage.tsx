import { useState } from 'react';
import { Card, Empty, Input, Progress, Space, Table, Tag, Typography, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ThunderboltOutlined } from '@ant-design/icons';
import { matchEmployees } from '@/api/schedule';

export default function EmployeeMatchingPage() {
  const [intent, setIntent] = useState('汇总本月销售数据并发送邮件');
  const [results, setResults] = useState<Array<{ employeeId: string; name: string; confidence: number }>>([]);
  const [loading, setLoading] = useState(false);

  const handleMatch = async () => {
    setLoading(true);
    try {
      const r = await matchEmployees(intent);
      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<{ employeeId: string; name: string; confidence: number }> = [
    { title: '员工', dataIndex: 'name' },
    { title: 'ID', dataIndex: 'employeeId' },
    {
      title: '置信度',
      dataIndex: 'confidence',
      render: (v) => (
        <Space direction="vertical" size={0} style={{ width: 200 }}>
          <Progress percent={Math.round(v * 100)} size="small" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {(v * 100).toFixed(1)}%
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '行动',
      key: 'actions',
      render: (_, r) => <Button type="link">分配给此员工</Button>,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>员工匹配</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Input.TextArea
          rows={2}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleMatch}
        >
          匹配员工
        </Button>
      </Card>

      {results.length === 0 ? (
        <Empty description="点击上方按钮匹配" />
      ) : (
        <Card title={`匹配结果（${results.length} 个）`}>
          <Table rowKey="employeeId" dataSource={results} columns={columns} />
        </Card>
      )}
    </div>
  );
}
