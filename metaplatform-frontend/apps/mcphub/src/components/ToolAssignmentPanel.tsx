import { Card, Empty, Tag, Typography } from 'antd';
import type { McpServer, McpTool } from '@/types';

interface ToolAssignmentPanelProps {
  server: McpServer;
  tools: McpTool[];
}

export default function ToolAssignmentPanel({ server, tools }: ToolAssignmentPanelProps) {
  const assigned = tools.filter((t) => server.toolIds.includes(t.id));
  const unassigned = tools.filter((t) => !server.toolIds.includes(t.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Card title={`已分配 (${assigned.length})`} size="small">
        {assigned.length === 0 ? (
          <Empty description="未分配任何工具" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {assigned.map((t) => (
              <Tag color="blue" key={t.id}>
                {t.name}
              </Tag>
            ))}
          </div>
        )}
      </Card>
      <Card title={`未分配 (${unassigned.length})`} size="small">
        {unassigned.length === 0 ? (
          <Empty description="所有工具都已分配" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unassigned.map((t) => (
              <Tag key={t.id}>{t.name}</Tag>
            ))}
          </div>
        )}
      </Card>
      {assigned.length === 0 && (
        <Typography.Paragraph
          type="warning"
          style={{ gridColumn: 'span 2' }}
        >
          提示：当前 Server 未暴露任何工具，外部 MCP Client 无法调用。
        </Typography.Paragraph>
      )}
    </div>
  );
}
