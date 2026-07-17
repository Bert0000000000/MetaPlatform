import { Card, Tag, Timeline, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { ConversationRecord } from '@/api/evaluations';

interface ReplayPanelProps {
  conversation: ConversationRecord;
}

const ICON: Record<string, ReactNode> = {
  user: '👤',
  assistant: '🤖',
  tool: '🛠',
};

export default function ReplayPanel({ conversation }: ReplayPanelProps) {
  return (
    <Card title={`对话回放 - ${conversation.conversationId}`}>
      <Timeline
        items={conversation.messages.map((m) => ({
          color: m.role === 'user' ? 'blue' : m.role === 'assistant' ? 'green' : 'purple',
          children: (
            <div>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Typography.Text strong>
                  {ICON[m.role]} {m.role}
                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {new Date(m.timestamp).toLocaleString()}
                  </Typography.Text>
                </Typography.Text>
                <Typography.Paragraph style={{ marginTop: 4 }}>
                  {m.content}
                </Typography.Paragraph>
                {m.toolCall && (
                  <Card type="inner" size="small" style={{ background: '#fafafa' }}>
                    <Tag color="purple">tool: {m.toolCall.name}</Tag>
                    <pre style={{ margin: '8px 0 0 0', fontSize: 11, fontFamily: 'monospace' }}>
                      {JSON.stringify(m.toolCall.args, null, 2)}
                    </pre>
                    {m.toolCall.result && (
                      <pre style={{ margin: '8px 0 0 0', fontSize: 11, fontFamily: 'monospace' }}>
                        {JSON.stringify(m.toolCall.result, null, 2)}
                      </pre>
                    )}
                  </Card>
                )}
              </Space>
            </div>
          ),
        }))}
      />
    </Card>
  );
}

import { Space } from 'antd';
