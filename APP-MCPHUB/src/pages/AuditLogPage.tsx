import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, AuditOutlined } from '@ant-design/icons';
import { listAuditLogs } from '@/api/audit';
import TokenUsageChart from '@/components/TokenUsageChart';
import ErrorTrendChart from '@/components/ErrorTrendChart';
import type { AuditLog } from '@/types';

const STATUS_MAP: Record<AuditLog['status'], { label: string; color: string }> = {
  success: { label: '成功', color: 'success' },
  error: { label: '失败', color: 'error' },
  timeout: { label: '超时', color: 'warning' },
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAuditLogs({ keyword, status });
      setLogs(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, status]);

  const columns: ColumnsType<AuditLog> = [
    {
      title: '工具',
      key: 'tool',
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <AuditOutlined /> {l.toolName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {l.method}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, l) => (
        <Tag color={STATUS_MAP[l.status].color}>{STATUS_MAP[l.status].label}</Tag>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      render: (v) => `${v} ms`,
    },
    {
      title: 'Token',
      key: 'tokens',
      render: (_, l) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          <span>输入：{l.inputTokens || 0}</span>
          <span>输出：{l.outputTokens || 0}</span>
          <Typography.Text strong>总计：{l.totalTokens || 0}</Typography.Text>
        </Space>
      ),
    },
    { title: '调用方', dataIndex: 'userId' },
    {
      title: '时间',
      key: 'timestamp',
      render: (_, l) => new Date(l.timestamp).toLocaleString(),
    },
    {
      title: 'Trace',
      dataIndex: 'traceId',
      render: (v) => (v ? <code>{v}</code> : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, l) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/audit/${l.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          调用审计
        </Typography.Title>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <TokenUsageChart />
        </Col>
        <Col span={12}>
          <ErrorTrendChart />
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索工具名/用户/trace"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 140 }}
          value={status}
          onChange={setStatus}
          options={[
            { label: '成功', value: 'success' },
            { label: '失败', value: 'error' },
            { label: '超时', value: 'timeout' },
          ]}
        />
      </Space>

      <Card>
        <Table
          rowKey="id"
          dataSource={logs}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
}
