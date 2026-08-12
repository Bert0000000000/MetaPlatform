import React, { useEffect, useRef, useState } from 'react';
import { SideSheet, Input, Button, Empty, Spin, Tag, Space, Toast } from '@douyinfe/semi-ui';
import { SendOutlined, RobotOutlined } from '@mate/shared';
import {
  InteractionProvider, useInteractionContext, toInteractionContextJson,
  streamAgentRun, ClaimRenderer, EvidenceRenderer,
} from '@mate/shared';

/**
 * 客户详情 Object Copilot Drawer（P4.2.1）。
 */
function CustomerCopilotInner({ customerId, customerName }: { customerId: string; customerName: string }) {
  const interaction = useInteractionContext();
  const [messages, setMessages] = useState<Array<{ role: string; content: string; claims?: any[]; evidences?: any[] }>>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    interaction.setSubject({ conceptCode: 'Customer', objectId: customerId });
  }, [customerId]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setStreaming(true);

    const ctx = toInteractionContextJson(interaction, input);
    const assistant = { role: 'assistant', content: '', claims: [], evidences: [] as any[] };
    setMessages(m => [...m, assistant]);
    const assistantIdx = messages.length + 1;

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      await streamAgentRun({
        agentId: 'customer-copilot',
        request: ctx,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'claim' || ev.type === 'CLAIM_PRODUCED') {
            setMessages(m => m.map((x, i) => i === assistantIdx ? { ...x, claims: [...(x.claims ?? []), ev.data] } : x));
          } else if (ev.type === 'evidence' || ev.type === 'EVIDENCE_ATTACHED') {
            setMessages(m => m.map((x, i) => i === assistantIdx ? { ...x, evidences: [...(x.evidences ?? []), ev.data] } : x));
          } else if (ev.type === 'message' || ev.type === 'token') {
            const text = String(ev.data?.content ?? ev.data?.text ?? '');
            setMessages(m => m.map((x, i) => i === assistantIdx ? { ...x, content: x.content + text } : x));
          }
        },
        onError: (err) => {
          Toast.error('流式响应失败：' + (err as Error).message);
        },
      });
    } catch (e) {
      Toast.error('调用失败：' + (e as Error).message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 12, padding: 8, background: 'var(--muted)', borderRadius: 6 }}>
        <Space>
          <RobotOutlined />
          <strong>{customerName}</strong>
          <Tag color="blue">Customer / {customerId}</Tag>
          <Tag color="purple">P4.2 Object Copilot MVP</Tag>
        </Space>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <Empty description="开始提问，让 AI 帮你分析当前客户" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ border: 'none', padding: '8px 0' }}>
                {msg.role === 'user' ? (
                  <div style={{ background: 'var(--semi-color-primary)', color: 'white', padding: 8, borderRadius: 6, maxWidth: '80%', marginLeft: 'auto' }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{ maxWidth: '90%' }}>
                    {msg.content && (
                      <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 6, marginBottom: 8 }}>
                        {msg.content}
                      </div>
                    )}
                    {msg.claims?.map((c: any, i: number) => <ClaimRenderer key={i} claim={c} />)}
                    {(msg.evidences ?? []).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>证据：</strong>
                        <div style={{ marginTop: 4 }}>
                          {(msg.evidences ?? []).map((e: any, i: number) => (
                            <EvidenceRenderer key={i} evidence={e} />
                          ))}
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

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Input
          style={{ flex: 1 }}
          value={input}
          onChange={(v) => setInput(v)}
          onEnterPress={send}
          placeholder={`分析 ${customerName}...`}
          disabled={streaming}
        />
        <Button theme="solid" type="primary" icon={<SendOutlined />} loading={streaming} onClick={send}>
          发送
        </Button>
      </div>
    </div>
  );
}

export interface CustomerCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export function CustomerCopilotDrawer(props: CustomerCopilotDrawerProps) {
  return (
    <SideSheet
      title="SuperAI 客户分析"
      visible={props.open}
      onCancel={props.onClose}
      width={560}
      keepDOM={false}
    >
      <InteractionProvider appCode="dw" pageCode="customer-detail">
        <CustomerCopilotInner customerId={props.customerId} customerName={props.customerName} />
      </InteractionProvider>
    </SideSheet>
  );
}
