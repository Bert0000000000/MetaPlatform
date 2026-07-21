import { Card, Empty, Space, Tag, Timeline, Typography } from 'antd';
import type { ReactNode } from 'react';
import ReplayPlayer from './ReplayPlayer';
import type { ConversationRecord } from '@/api/evaluations';

interface ReplayPanelConversationProps {
  conversation: ConversationRecord;
  traceId?: never;
}

interface ReplayPanelTraceProps {
  traceId: string;
  conversation?: never;
}

type ReplayPanelProps = ReplayPanelConversationProps | ReplayPanelTraceProps;

const ICON: Record<string, ReactNode> = {
  user: '👤',
  assistant: '🤖',
  tool: '🛠',
};

function isConversationProps(props: ReplayPanelProps): props is ReplayPanelConversationProps {
  return 'conversation' in props;
}

export default function ReplayPanel(props: ReplayPanelProps) {
  if (isConversationProps(props)) {
    const { conversation } = props;
    return (
      <Card title={`对话回放 - ${conversation.conversationId}`}>
        <Timeline
          items={conversation.messages.map((m) => ({
            color: m.role === 'user' ? 'blue' : m.role === 'assistant' ? 'green' : 'purple',
            children: (
              <div>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Typography.Text strong>
                    {ICON[m.role] ?? null} {m.role}
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {new Date(m.timestamp).toLocaleString()}
                    </Typography.Text>
                  </Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 4 }}>{m.content}</Typography.Paragraph>
                  {m.toolCall && (
                    <Card type="inner" size="small" style={{ background: '#fafafa' }}>
                      <Tag color="purple">tool: {m.toolCall.name}</Tag>
                      <pre style={{ margin: '8px 0 0 0', fontSize: 11, fontFamily: 'monospace' }}>
                        {JSON.stringify(m.toolCall.args, null, 2)}
                      </pre>
                      {m.toolCall.result != null && (
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

  const { traceId } = props;
  if (!traceId) {
    return <Empty description="无 Trace ID" />;
  }
  return <ReplayPlayer traceId={traceId} />;
}
