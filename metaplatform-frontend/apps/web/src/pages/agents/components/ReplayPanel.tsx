import { Bot, User, Wrench } from 'lucide-react';
import { Card, Tag, Timeline, Typography } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';
import ReplayPlayer from './ReplayPlayer';
import type { ConversationRecord } from '@/api/dw/evaluations';
import { EmptyState } from '@/components/skeleton';

interface ReplayPanelConversationProps {
  conversation: ConversationRecord;
  traceId?: never;
}

interface ReplayPanelTraceProps {
  traceId: string;
  conversation?: never;
}

type ReplayPanelProps = ReplayPanelConversationProps | ReplayPanelTraceProps;

/** 角色 → 图标 / Timeline 圆点色（圆点色走 DSM 主题令牌）。 */
const ICON: Record<string, ReactNode> = {
  user: <User size={13} strokeWidth={1.5} />,
  assistant: <Bot size={13} strokeWidth={1.5} />,
  tool: <Wrench size={13} strokeWidth={1.5} />,
};

const DOT_COLOR: Record<string, string> = {
  user: 'var(--semi-color-primary)',
  assistant: 'var(--semi-color-success)',
  tool: 'var(--semi-color-data-3)',
};

function isConversationProps(props: ReplayPanelProps): props is ReplayPanelConversationProps {
  return 'conversation' in props;
}

/**
 * 回放面板（评估页右栏 + 任务详情页共用）。
 *
 * - 传 conversation：逐条渲染对话消息（含 tool call 入参/结果）
 * - 传 traceId：交给 ReplayPlayer 做执行步骤回放
 *
 * 注意：本组件是 TaskDetailPage 与 EvaluationPage 的共享出口，props 形态保持不变。
 */
export default function ReplayPanel(props: ReplayPanelProps) {
  if (isConversationProps(props)) {
    const { conversation } = props;
    return (
      <Card title={`对话回放 · ${conversation.conversationId}`}>
        {conversation.messages.length === 0 ? (
          <EmptyState illustration="no-content" title="这段对话没有消息" />
        ) : (
          <Timeline>
            {conversation.messages.map((m, idx) => (
              <Timeline.Item
                key={`${m.id}-${idx}`}
                color={DOT_COLOR[m.role] ?? 'var(--semi-color-text-3)'}
              >
                <Typography.Paragraph>
                  <span className="mp-agent-line">
                    <Typography.Text strong>
                      {ICON[m.role] ?? null} {m.role}
                    </Typography.Text>
                    <Typography.Text type="tertiary" size="small">
                      {new Date(m.timestamp).toLocaleString()}
                    </Typography.Text>
                  </span>
                </Typography.Paragraph>

                <Typography.Paragraph>{m.content}</Typography.Paragraph>

                {m.toolCall ? (
                  <Card title={<Tag color="purple" type="light">tool · {m.toolCall.name}</Tag>}>
                    <Typography.Text type="tertiary" size="small">
                      参数
                    </Typography.Text>
                    <pre>{JSON.stringify(m.toolCall.args, null, 2)}</pre>
                    {m.toolCall.result != null ? (
                      <>
                        <Typography.Text type="tertiary" size="small">
                          结果
                        </Typography.Text>
                        <pre>{JSON.stringify(m.toolCall.result, null, 2)}</pre>
                      </>
                    ) : null}
                  </Card>
                ) : null}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    );
  }

  const { traceId } = props;
  if (!traceId) {
    return <EmptyState illustration="no-content" title="无 Trace ID" />;
  }
  return <ReplayPlayer traceId={traceId} />;
}
