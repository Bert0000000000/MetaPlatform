import React, { useCallback, useMemo } from 'react';
import { Alert, Button, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import { PlayCircleOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useAgentStream, useInteractionContext } from '@/api/superai/types';
import { ClaimRenderer } from './ClaimRenderer';
import { EvidenceRenderer } from './EvidenceRenderer';
import type { Claim, Evidence, InteractionContext } from '@/api/superai/types';

const { Text, Paragraph } = Typography;

export interface AgentChatPanelProps {
  /** Optional message override (e.g. from query param). */
  initialMessage?: string;
  /** Optional context overrides. */
  subject?: { conceptCode: string; objectId: string };
  /** Placeholder text for the input area. */
  placeholder?: string;
}

/**
 * P4.2 AgentChatPanel - SuperAI chat panel driven by useAgentStream.
 *
 * <p>Wires InteractionContextProvider + useAgentStream into a single chat-like
 * UI: send button streams RunEvents, displays Claims + Evidence in real time,
 * shows the final answer, and supports abort.</p>
 */
export function AgentChatPanel({ initialMessage, subject, placeholder }: AgentChatPanelProps) {
  const { context, setMessage, setSubject } = useInteractionContext();
  const { send, abort, status, runId, events, claims, evidence, answer, error, streaming } = useAgentStream({
    baseContext: useMemo<InteractionContext>(
      () => ({ ...context, message: context.message || (initialMessage ?? '') }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [context],
    ),
    onDone: (r) => {
      // eslint-disable-next-line no-console
      console.info('[AgentChatPanel] run done', r);
    },
  });

  const onSend = useCallback(() => {
    if (!context.message.trim() || streaming) return;
    send(context.message, subject ? { subject } : undefined);
  }, [context.message, subject, streaming, send]);

  const onAbort = useCallback(() => {
    abort();
  }, [abort]);

  // Apply subject override when prop changes
  React.useEffect(() => {
    if (subject) setSubject(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.conceptCode, subject?.objectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined />
            <Text strong>SuperAI Agent Run</Text>
            {runId && <Tag color="blue">{runId}</Tag>}
            <Tag color={statusColor(status)}>{status}</Tag>
            {streaming && <Spin size="small" />}
          </Space>
        }
        extra={
          <Space>
            {streaming ? (
              <Button danger icon={<StopOutlined />} onClick={onAbort}>
                Stop
              </Button>
            ) : (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={onSend}>
                Run
              </Button>
            )}
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          发送消息 → Agent Run 流式返回 RunEvents → Claim/Evidence 实时绑定。
        </Paragraph>
        <textarea
          rows={3}
          style={{ width: '100%', padding: 8, border: '1px solid #d9d9d9', borderRadius: 6, fontFamily: 'inherit' }}
          placeholder={placeholder || '请输入分析问题，例如：分析 CUST-10086 最近的销售下降原因'}
          value={context.message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={streaming}
        />
      </Card>

      {error && <Alert type="error" message={error} showIcon />}

      <Card size="small" title={<Text strong>Run Events ({events.length})</Text>}>
        {events.length === 0 ? (
          <Empty description="No events yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {events.slice(-10).map((ev) => (
              <Space key={ev.eventId} size={6}>
                <Tag color={eventColor(ev.type)} style={{ minWidth: 130, textAlign: 'center' }}>
                  {ev.type}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {ev.type === 'CLAIM_PRODUCED'
                    ? 'Claim ' + ((ev.payload.claim as { claimId?: string })?.claimId ?? '')
                    : ev.type === 'EVIDENCE_ATTACHED'
                    ? 'Evidence ' + ((ev.payload.evidence as { evidenceId?: string })?.evidenceId ?? '')
                    : JSON.stringify(ev.payload).slice(0, 80)}
                </Text>
              </Space>
            ))}
          </Space>
        )}
      </Card>

      {answer && (
        <Card size="small" title={<Text strong>Final Answer</Text>}>
          <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{answer}</Paragraph>
        </Card>
      )}

      {claims.length > 0 && (
        <Card size="small" title={<Text strong>Claims ({claims.length})</Text>}>
          {claims.map((c: Claim) => (
            <ClaimRenderer key={c.claimId} claim={c} />
          ))}
        </Card>
      )}

      {evidence.length > 0 && (
        <Card size="small" title={<Text strong>Evidence ({evidence.length})</Text>}>
          <EvidenceRenderer evidenceList={evidence} />
        </Card>
      )}
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed': return 'green';
    case 'failed': return 'red';
    case 'aborted': return 'orange';
    case 'running': return 'blue';
    case 'starting': return 'cyan';
    default: return 'default';
  }
}

function eventColor(t: string): string {
  if (t.startsWith('RUN_COMPLETED') || t === 'CLAIM_PRODUCED') return 'green';
  if (t.startsWith('RUN_FAILED') || t === 'TOOL_FAILED') return 'red';
  if (t === 'EVIDENCE_ATTACHED') return 'geekblue';
  if (t.startsWith('TOOL_')) return 'blue';
  return 'default';
}

export default AgentChatPanel;
