import React, { useEffect, useRef, useState } from 'react';
import { Card, Input, Button, Empty, Tag, Space, Select, message, Row, Col, Statistic } from 'antd';
import { SendOutlined, ThunderboltOutlined, useApiErrorBoundary } from '@mate/shared';
import {
  InteractionProvider, useInteractionContext, toInteractionContextJson,
  streamAgentRun, ClaimRenderer, EvidenceRenderer,
} from '@mate/shared';

/**
 * SuperAI 对话页（P4.3.1）。
 */
function SuperAIInner() {
  const { report } = useApiErrorBoundary();

  const interaction = useInteractionContext();
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [messages, setMessages] = useState<Array<{ role: string; content: string; claims?: any[]; evidences?: any[]; subAgents?: any[] }>>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef<number>(0);

  const send = async () => {
    if (!input.trim() || streaming) return;
    setMessages(m => [...m, { role: 'user', content: input }]);
    setInput('');
    setStreaming(true);
    setLatency(null);
    startRef.current = Date.now();

    const ctx = toInteractionContextJson(interaction, input);
    const idx = messages.length + 1;
    setMessages(m => [...m, { role: 'assistant', content: '', claims: [], evidences: [], subAgents: [] }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      await streamAgentRun({
        agentId: mode === 'fast' ? 'superai-fast' : 'superai-deep',
        request: ctx,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'CLAIM_PRODUCED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, claims: [...(x.claims ?? []), ev.data] } : x));
          } else if (ev.type === 'EVIDENCE_ATTACHED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, evidences: [...(x.evidences ?? []), ev.data] } : x));
          } else if (ev.type === 'SUBAGENT_STARTED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, subAgents: [...(x.subAgents ?? []), ev.data] } : x));
          } else if (ev.type === 'token' || ev.type === 'message') {
            const text = String(ev.data?.content ?? ev.data?.text ?? '');
            setMessages(m => m.map((x, i) => i === idx ? { ...x, content: x.content + text } : x));
          } else if (ev.type === 'RUN_COMPLETED' || ev.type === 'end') {
            setLatency(Date.now() - startRef.current);
          }
        },
        onError: (e) => report(e),
      });
    } catch (e) {
      report(e);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Space><ThunderboltOutlined /> SuperAI 统一入口</Space>}
        extra={
          <Space>
            <Select value={mode} onChange={setMode} options={[
              { value: 'fast', label: 'Fast Query (简单事实)' },
              { value: 'deep', label: 'Deep Task (深度分析)' },
            ]} style={{ width: 220 }} />
            <Tag color={mode === 'fast' ? 'green' : 'orange'}>
              预期延迟 {mode === 'fast' ? '< 1.5s' : '< 30s'}
            </Tag>
          </Space>
        }
      >
        {latency != null && (
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={8}><Statistic title="总耗时" value={latency} suffix="ms" /></Col>
            <Col span={8}><Statistic title="模式" value={mode === 'fast' ? 'Fast' : 'Deep'} /></Col>
            <Col span={8}><Statistic title="消息数" value={messages.length} /></Col>
          </Row>
        )}

        <div style={{ minHeight: 400, maxHeight: 600, overflowY: 'auto', border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
          {messages.length === 0 ? (
            <Empty description="输入问题开始对话" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ border: 'none', padding: '6px 0' }}>
                  {msg.role === 'user' ? (
                    <div style={{ background: '#1677ff', color: 'white', padding: 8, borderRadius: 6, maxWidth: '80%', marginLeft: 'auto' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div style={{ maxWidth: '95%' }}>
                      {msg.subAgents && msg.subAgents.length > 0 && (
                        <Space wrap style={{ marginBottom: 8 }}>
                          {msg.subAgents.map((sa: any, k: number) => (
                            <Tag color="purple" key={k}>Sub-Agent: {sa.name ?? sa.agentId ?? `#${k}`}</Tag>
                          ))}
                        </Space>
                      )}
                      {msg.content && (
                        <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, marginBottom: 8 }}>{msg.content}</div>
                      )}
                      {msg.claims?.map((c: any, k: number) => <ClaimRenderer key={k} claim={c} />)}
                      {(msg.evidences ?? []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>证据：</strong>
                          <div style={{ marginTop: 4 }}>
                            {(msg.evidences ?? []).map((e: any, k: number) => <EvidenceRenderer key={k} evidence={e} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Input.Group compact style={{ marginTop: 12 }}>
          <Input
            style={{ width: '85%' }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onPressEnter={send}
            placeholder="例如：分析华东区销售下降原因"
            disabled={streaming}
          />
          <Button type="primary" icon={<SendOutlined />} loading={streaming} onClick={send}>发送</Button>
        </Input.Group>
      </Card>
    </div>
  );
}

export default function SuperAIChatPage() {
  const { report } = useApiErrorBoundary();
  return (
    <InteractionProvider appCode="superai" pageCode="chat">
      <SuperAIInner />
    </InteractionProvider>
  );
}
