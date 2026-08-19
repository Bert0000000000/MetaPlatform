import React, { useRef, useState } from 'react';
import { Card, Input, InputGroup, Button, Empty, Tag, Space, Select } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { SendOutlined, ThunderboltOutlined, useApiErrorBoundary } from '@mate/shared';
import {
  InteractionProvider, useInteractionContext, toInteractionContextJson,
  streamAgentRun, ClaimRenderer, EvidenceRenderer,
} from '@mate/shared';
import { RoutingDecisionPanel } from './components/RoutingDecisionPanel';
import type { RoutingDecision } from './hooks/useAgentStream';

/**
 * SuperAI 对话页（P4.3.1）。
 *
 * <p>订阅路由事件：<code>routing_decision</code>（MP-SR-01 task 2 后端
 * Stage 2 会发出） → 解析为 <code>RoutingDecision</code> → 渲染
 * <code>RoutingDecisionPanel</code>，每轮 assistant 消息下方挂一份。</p>
 */
function SuperAIInner() {
  const { report } = useApiErrorBoundary();

  const interaction = useInteractionContext();
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [messages, setMessages] = useState<Array<{ role: string; content: string; claims?: any[]; evidences?: any[]; subAgents?: any[]; routingDecisions?: RoutingDecision[] }>>([]);
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
    setMessages(m => [...m, { role: 'assistant', content: '', claims: [], evidences: [], subAgents: [], routingDecisions: [] }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      await streamAgentRun({
        agentId: mode === 'fast' ? 'superai-fast' : 'superai-deep',
        request: ctx,
        signal: controller.signal,
        onEvent: (ev: { type: string; payload?: Record<string, unknown>; data?: Record<string, unknown>; seq?: number; ts?: string }) => {
          if (ev.type === 'CLAIM_PRODUCED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, claims: [...(x.claims ?? []), ev.data?.claim ?? ev.payload?.claim] } : x));
          } else if (ev.type === 'EVIDENCE_ATTACHED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, evidences: [...(x.evidences ?? []), ev.data?.evidence ?? ev.payload?.evidence] } : x));
          } else if (ev.type === 'SUBAGENT_STARTED') {
            setMessages(m => m.map((x, i) => i === idx ? { ...x, subAgents: [...(x.subAgents ?? []), ev.data ?? ev.payload] } : x));
          } else if (ev.type === 'routing_decision') {
            const rd = parseRoutingDecisionFromEvent(ev);
            if (rd) {
              setMessages(m => m.map((x, i) => i === idx
                ? { ...x, routingDecisions: [...(x.routingDecisions ?? []), rd] }
                : x));
            }
          } else if (ev.type === 'token' || ev.type === 'message') {
            const text = String(ev.data?.content ?? ev.data?.text ?? ev.payload?.content ?? ev.payload?.text ?? '');
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
        headerExtraContent={
          <Space>
            <Select value={mode} onChange={(v) => setMode(v as 'fast' | 'deep')} optionList={[
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
            <Col span={8}>
              <div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>总耗时</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{latency} ms</div>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>模式</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{mode === 'fast' ? 'Fast' : 'Deep'}</div>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>消息数</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{messages.length}</div>
              </div>
            </Col>
          </Row>
        )}

        <div style={{ minHeight: 400, maxHeight: 600, overflowY: 'auto', border: '1px solid var(--border)', padding: 12, borderRadius: 6 }}>
          {messages.length === 0 ? (
            <Empty description="输入问题开始对话" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ border: 'none', padding: '6px 0' }}>
                  {msg.role === 'user' ? (
                    <div style={{ background: 'var(--primary)', color: 'var(--white, #fff)', padding: 8, borderRadius: 6, maxWidth: '80%', marginLeft: 'auto' }}>
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
                        <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 6, marginBottom: 8 }}>{msg.content}</div>
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
                      {(msg.routingDecisions ?? []).length > 0 && (
                        <RoutingDecisionPanel decision={msg.routingDecisions!} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <InputGroup style={{ marginTop: 12 }}>
          <Input
            style={{ width: '85%' }}
            value={input}
            onChange={(v) => setInput(v)}
            onEnterPress={send}
            placeholder="例如：分析华东区销售下降原因"
            disabled={streaming}
          />
          <Button theme="solid" type="primary" icon={<SendOutlined />} loading={streaming} onClick={send}>发送</Button>
        </InputGroup>
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

/**
 * Parse a routing_decision SSE event payload into the typed RoutingDecision.
 *
 * <p>这里的实现与 <code>useAgentStream</code> 内部版本同源，区别在于直接读
 * <code>ev.data</code>（SuperAIApi 的 backward-compatible alias for payload），
 * 而非 <code>ev.payload</code>，确保 SuperAIChatPage 这条独立流路径也能
 * 正确还原 RoutingDecision。</p>
 */
function parseRoutingDecisionFromEvent(
  ev: { payload?: Record<string, unknown>; data?: Record<string, unknown>; seq?: number; ts?: string },
): RoutingDecision | null {
  const p = (ev.data ?? ev.payload ?? {}) as Record<string, unknown>;
  const rawCandidates = Array.isArray(p.candidates) ? p.candidates : [];
  const candidates = rawCandidates
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const cc = c as Record<string, unknown>;
      return {
        role_slug: String(cc.role_slug ?? ''),
        role_rid: typeof cc.role_rid === 'string' ? cc.role_rid : undefined,
        display_name: String(cc.display_name ?? cc.role_slug ?? ''),
        capability_tags: Array.isArray(cc.capability_tags)
          ? (cc.capability_tags as unknown[]).map(String)
          : undefined,
        similarity: typeof cc.similarity === 'number' ? cc.similarity : 0,
        reason: typeof cc.reason === 'string' ? cc.reason : undefined,
      };
    });

  const rawSelected = p.selected;
  let selected: RoutingDecision['selected'] | null = null;
  if (rawSelected && typeof rawSelected === 'object') {
    const sel = rawSelected as Record<string, unknown>;
    selected = {
      role_slug: String(sel.role_slug ?? ''),
      reason: typeof sel.reason === 'string' ? sel.reason : undefined,
    };
  } else if (typeof rawSelected === 'string' && rawSelected.length > 0) {
    selected = { role_slug: rawSelected };
  }

  const rawTaken = p.taken_path;
  const taken_path: RoutingDecision['taken_path'] =
    rawTaken === 'llm_fc' || rawTaken === 'semantic_router' ||
    rawTaken === 'dispatcher' || rawTaken === 'keyword_fallback'
      ? rawTaken
      : null;

  const reason = typeof p.reason === 'string'
    ? p.reason
    : selected?.reason ?? (candidates.length === 0 ? 'no candidates' : 'semantic_router pre-screen');

  return {
    candidates,
    selected,
    taken_path,
    reason,
    seq: ev.seq ?? 0,
    ts: ev.ts ?? new Date().toISOString(),
  };
}
