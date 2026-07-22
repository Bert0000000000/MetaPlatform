import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, InteractionOutlined } from '@ant-design/icons';
import { listCollaborations } from '@/api/collaborations';
import type { CollaborationAudit, PageResponse } from '@/types';

const PROTOCOL_OPTIONS = [
  { label: 'MCP', value: 'MCP' },
  { label: 'A2A', value: 'A2A' },
];

const STATUS_OPTIONS = [
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'ERROR', value: 'ERROR' },
  { label: 'TIMEOUT', value: 'TIMEOUT' },
];

const STATUS_MAP: Record<CollaborationAudit['status'], { label: string; color: string }> = {
  SUCCESS: { label: '成功', color: 'success' },
  ERROR: { label: '失败', color: 'error' },
  TIMEOUT: { label: '超时', color: 'warning' },
};

export default function CollaborationAuditPage() {
  const [data, setData] = useState<PageResponse<CollaborationAudit> | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CollaborationAudit | null>(null);
  const [filters, setFilters] = useState({
    callerId: '',
    calleeId: '',
    protocolType: undefined as string | undefined,
    status: undefined as string | undefined,
    traceId: '',
    page: 1,
    size: 10,
  });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        ...filters,
      };
      const res = await listCollaborations(params);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const columns: ColumnsType<CollaborationAudit> = [
    {
      title: '调用方',
      key: 'caller',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.callerId}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.callerType}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '被调用方',
      key: 'callee',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.calleeId}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.calleeType}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'operation',
      render: (v) => v || '-',
    },
    {
      title: '协议',
      dataIndex: 'protocolType',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: CollaborationAudit['status']) => (
        <Tag color={STATUS_MAP[v].color}>{STATUS_MAP[v].label}</Tag>
      ),
    },
    {
      title: '耗时 (ms)',
      dataIndex: 'durationMs',
      render: (v) => v,
    },
    {
      title: '调用时间',
      dataIndex: 'calledAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: 'traceId',
      dataIndex: 'traceId',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          <InteractionOutlined /> 协作审计
        </Typography.Title>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="调用方 ID"
          allowClear
          onSearch={(v) => setFilters((prev) => ({ ...prev, callerId: v, page: 1 }))}
          style={{ width: 200 }}
        />
        <Input.Search
          placeholder="被调用方 ID"
          allowClear
          onSearch={(v) => setFilters((prev) => ({ ...prev, calleeId: v, page: 1 }))}
          style={{ width: 200 }}
        />
        <Select
          placeholder="协议类型"
          allowClear
          options={PROTOCOL_OPTIONS}
          style={{ width: 140 }}
          value={filters.protocolType}
          onChange={(v) => setFilters((prev) => ({ ...prev, protocolType: v, page: 1 }))}
        />
        <Select
          placeholder="状态"
          allowClear
          options={STATUS_OPTIONS}
          style={{ width: 140 }}
          value={filters.status}
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v, page: 1 }))}
        />
        <Input.Search
          placeholder="traceId"
          allowClear
          onSearch={(v) => setFilters((prev) => ({ ...prev, traceId: v, page: 1 }))}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {data?.items.length === 0 && !loading ? (
          <Empty description="还没有协作记录" />
        ) : (
          <Table
            rowKey="id"
            dataSource={data?.items || []}
            columns={columns}
            loading={loading}
            pagination={{
              current: data?.page || 1,
              pageSize: data?.size || 10,
              total: data?.total || 0,
              showSizeChanger: true,
              onChange: (page, size) => setFilters((prev) => ({ ...prev, page, size })),
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <Modal
        open={!!detail}
        title="协作详情"
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Paragraph>
              <Typography.Text strong>ID: </Typography.Text>
              {detail.id}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>调用方: </Typography.Text>
              {detail.callerId} ({detail.callerType})
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>被调用方: </Typography.Text>
              {detail.calleeId} ({detail.calleeType})
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>操作: </Typography.Text>
              {detail.operation || '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>协议: </Typography.Text>
              {detail.protocolType}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>状态: </Typography.Text>
              <Tag color={STATUS_MAP[detail.status].color}>{STATUS_MAP[detail.status].label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>耗时: </Typography.Text>
              {detail.durationMs} ms
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>调用时间: </Typography.Text>
              {detail.calledAt ? new Date(detail.calledAt).toLocaleString() : '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>traceId: </Typography.Text>
              {detail.traceId || '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>请求: </Typography.Text>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {detail.requestPayload || '-'}
              </pre>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>响应: </Typography.Text>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {detail.responsePayload || '-'}
              </pre>
            </Typography.Paragraph>
            {detail.errorMessage && (
              <Typography.Paragraph>
                <Typography.Text strong type="danger">
                  错误:
                </Typography.Text>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {detail.errorMessage}
                </pre>
              </Typography.Paragraph>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
