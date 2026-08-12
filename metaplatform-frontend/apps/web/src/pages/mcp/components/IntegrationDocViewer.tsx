import { Card, TabPane, Tabs, Typography } from '@douyinfe/semi-ui';
import type { Integration } from '@/api/mcphub/types';

interface IntegrationDocViewerProps {
  integration: Integration;
}

export default function IntegrationDocViewer({ integration }: IntegrationDocViewerProps) {
  return (
    <Card title={`配置指南：${integration.name}`}>
      <Tabs>
        <TabPane tab="MCP 配置片段" itemKey="config">
          <pre style={codeStyle}>
            <code>{integration.configSnippet}</code>
          </pre>
        </TabPane>
        <TabPane tab="端点信息" itemKey="endpoint">
          <Typography.Paragraph>
            <strong>Endpoint：</strong>
            <code>{integration.endpoint}</code>
            <br />
            <strong>传输：</strong>SSE（Server-Sent Events）
            <br />
            <strong>协议版本：</strong>2025-03-26
          </Typography.Paragraph>
        </TabPane>
        <TabPane tab="文档" itemKey="docs">
          <Typography.Paragraph>
            1. 在你的 AI IDE 中打开 MCP 设置；
            <br />
            2. 新增 Server 节点，类型选择 <code>stdio</code> 或 <code>sse</code>；
            <br />
            3. 粘贴「MCP 配置片段」中的 JSON；
            <br />
            4. 保存后 IDE 重启即可在聊天中使用平台暴露的 tools/resources/prompts。
          </Typography.Paragraph>
        </TabPane>
      </Tabs>
    </Card>
  );
}

const codeStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 400,
  overflow: 'auto',
};
