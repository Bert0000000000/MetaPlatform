import { Card, Empty, Space, Tag, Timeline, Typography } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';
import ReplayPlayer from './ReplayPlayer';
import type { ConversationRecord } from '@/api/dw/evaluations';

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
        <Timeline>
          {conversation.messages.map((m, idx) => (
            <Timeline.Item
              key={idx}
              color={
                m.role === 'user'
                  ? 'var(--semi-color-primary)'
                  : m.role === 'assistant'
                    ? 'var(--semi-color-success)'
                    : 'var(--semi-color-data-3)'
              }
            >
              <div>
                <Space vertical spacing={0} style={{ width: '100%' }}>
                  <Typography.Text strong>
                    {ICON[m.role] ?? null} {m.role}
                    <Typography.Text type="tertiary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {new Date(m.timestamp).toLocaleString()}
                    </Typography.Text>
                  </Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 4 }}>{m.content}</Typography.Paragraph>
                  {m.toolCall && (
                    <Card style={{ background: 'var(--semi-color-fill-0)' }}>
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
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    );
  }

  const { traceId } = props;
  if (!traceId) {
    return <Empty description="无 Trace ID" />;
  }
  return <ReplayPlayer traceId={traceId} />;
}
