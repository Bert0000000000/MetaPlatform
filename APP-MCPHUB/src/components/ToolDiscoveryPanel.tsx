import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import type { McpClient } from '@/types';

interface ToolDiscoveryPanelProps {
  client: McpClient;
}

interface DiscoveredTool {
  id: string;
  name: string;
  description: string;
  server?: string;
}

export default function ToolDiscoveryPanel({ client }: ToolDiscoveryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<DiscoveredTool[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const n = client.discoveredTools || 0;
      const arr: DiscoveredTool[] = Array.from({ length: n }).map((_, i) => ({
        id: `dist-${client.id}-${i}`,
        name: `${client.name}_tool_${i + 1}`,
        description: '由第三方 MCP Server 提供的远程工具',
        server: client.name,
      }));
      setTools(arr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [client.id]);

  const columns: ColumnsType<DiscoveredTool> = [
    { title: '工具名', dataIndex: 'name' },
    { title: '来源 Server', dataIndex: 'server', render: (v) => <Tag>{v}</Tag> },
    { title: '描述', dataIndex: 'description' },
  ];

  return (
    <Card
      title={`发现工具 (${tools.length})`}
      extra={
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          重新发现
        </Button>
      }
    >
      {loading ? (
        <Spin />
      ) : tools.length === 0 ? (
        <Empty
          description={
            client.status === 'connected'
              ? '外部 MCP Server 未发现工具'
              : '请先连接 MCP Client 以发现工具'
          }
        />
      ) : (
        <Table
          rowKey="id"
          dataSource={tools}
          columns={columns}
          pagination={{ pageSize: 10 }}
          size="small" scroll={{ x: 'max-content' }} />
      )}
    </Card>
  );
}
