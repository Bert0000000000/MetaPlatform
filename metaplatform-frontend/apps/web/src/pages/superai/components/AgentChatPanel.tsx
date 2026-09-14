import React, { useCallback, useMemo } from 'react';
import { Banner, Button, Card, List, Space, Spin, Tag, TextArea, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Play, Square, Zap } from 'lucide-react';
import { useAgentStream, useInteractionContext } from '@/api/superai/types';
import { EmptyState } from '@/components/skeleton';
import '../superai.css';
import { ClaimRenderer } from './ClaimRenderer';
import { EvidenceRenderer } from './EvidenceRenderer';
import type { InteractionContext } from '@/api/superai/types';

const { Text } = Typography;

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
 *
 * 版式走 Calm Density：外层 mp-exec-col 负责纵向节奏，事件流走 Semi List。
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
    <div className="mp-exec-col">
      <Card
        title={
          <Space>
            <Zap size={15} strokeWidth={1.5} />
            <Text strong>SuperAI Agent Run</Text>
            {runId && <Tag color="blue" type="light">{runId}</Tag>}
            <Tag color={statusColor(status)} type="light">{status}</Tag>
            {streaming && <Spin size="small" />}
          </Space>
        }
        headerExtraContent={
          streaming ? (
            <Button type="danger" icon={<Square size={14} strokeWidth={1.5} />} onClick={onAbort}>
              Stop
            </Button>
          ) : (
            <Button theme="solid" type="primary" icon={<Play size={15} strokeWidth={1.5} />} onClick={onSend}>
              Run
            </Button>
          )
        }
      >
        <div className="mp-exec-col">
          <Text type="secondary">发送消息 → Agent Run 流式返回 RunEvents → Claim/Evidence 实时绑定。</Text>
          <TextArea
            rows={3}
            placeholder={placeholder || '请输入分析问题，例如：分析 CUST-10086 最近的销售下降原因'}
            value={context.message}
            onChange={(v) => setMessage(v)}
            disabled={streaming}
          />
        </div>
      </Card>

      {error ? <Banner type="danger" closeIcon={null} description={error} /> : null}

      <Card title={<Text strong>Run Events ({events.length})</Text>}>
        {events.length === 0 ? (
          <EmptyState illustration="idle" title="暂无事件" desc="发送消息后 RunEvent 会实时出现在这里。" />
        ) : (
          <List
            dataSource={events.slice(-10)}
            renderItem={(ev) => (
              <List.Item
                main={
                  <Space>
                    <Tag color={eventColor(ev.type)} type="light">{ev.type}</Tag>
                    <Text type="secondary">{eventSummary(ev)}</Text>
                  </Space>
                }
              />
            )}
          />
        )}
      </Card>

      {answer ? (
        <Card title={<Text strong>Final Answer</Text>}>
          {answer.split('\n').map((line, i) => (
            <div key={i}>
              <Text>{line.length > 0 ? line : ' '}</Text>
            </div>
          ))}
        </Card>
      ) : null}

      {claims.length > 0 ? (
        <Card title={<Text strong>Claims ({claims.length})</Text>}>
          <div className="mp-exec-col">
            {claims.map((c) => (
              <ClaimRenderer key={c.claimId} claim={c} />
            ))}
          </div>
        </Card>
      ) : null}

      {evidence.length > 0 ? (
        <Card title={<Text strong>Evidence ({evidence.length})</Text>}>
          <EvidenceRenderer evidenceList={evidence} />
        </Card>
      ) : null}
    </div>
  );
}

function eventSummary(ev: { type: string; payload: Record<string, unknown> }): string {
  if (ev.type === 'CLAIM_PRODUCED') {
    return `Claim ${((ev.payload.claim as { claimId?: string })?.claimId ?? '')}`;
  }
  if (ev.type === 'EVIDENCE_ATTACHED') {
    return `Evidence ${((ev.payload.evidence as { evidenceId?: string })?.evidenceId ?? '')}`;
  }
  return JSON.stringify(ev.payload).slice(0, 80);
}

function statusColor(s: string): TagColor {
  switch (s) {
    case 'completed': return 'green';
    case 'failed': return 'red';
    case 'aborted': return 'orange';
    case 'running': return 'blue';
    case 'starting': return 'cyan';
    default: return 'grey';
  }
}

function eventColor(t: string): TagColor {
  if (t.startsWith('RUN_COMPLETED') || t === 'CLAIM_PRODUCED') return 'green';
  if (t.startsWith('RUN_FAILED') || t === 'TOOL_FAILED') return 'red';
  if (t === 'EVIDENCE_ATTACHED') return 'violet';
  if (t.startsWith('TOOL_')) return 'blue';
  return 'grey';
}

export default AgentChatPanel;
