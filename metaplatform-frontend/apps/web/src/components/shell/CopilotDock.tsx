import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { useLocation } from 'react-router-dom';
import { ArrowUp, Check, Sparkles, Square, X } from 'lucide-react';
import { streamAgentChat, type StreamMessage } from '@/api/superai/chat';
import { detectIntent, generatePlan } from '@/api/superai/schedule';
import {
  buildAssistantContextEnvelope,
  getOntologyContextSnapshot,
  type AssistantInteractionContext,
  type AssistantNavigationState,
} from '@/pages/ontology/hooks/assistantContext';
import { resolveDomain, resolveDomainTab } from './domains';
import { useShell } from './ShellContext';

interface ToolTrace {
  callId: string;
  tool: string;
  status: 'running' | 'success' | 'error';
}

interface DockPlan {
  planId: string;
  steps: string[];
  /** 后端 copilot 在 dev 是 stub：只有回显，无逐步骤状态 */
  stub: boolean;
}

interface DockMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string;
  tools?: ToolTrace[];
  decision?: string;
  plan?: DockPlan;
  error?: string;
}

let seq = 0;
const nextId = () => `dock-${Date.now()}-${seq++}`;

/**
 * Copilot 全局侧栏（DESIGN-SPEC §6.2）。
 *
 * UI-P0 只交付了壳体；本批接线到真实的 agent 流：
 *  - `streamAgentChat`（POST /copilot/chat/agent/stream，dev 实测 200 + SSE）
 *  - 上下文条读取当前路由（域 / 页内 tab）
 *  - 计划卡片：路由决策 + 「生成执行计划」→ `schedule.detectIntent` → `generatePlan`
 *
 * 诚实边界：dev 的 copilot 是 stub（`[stub-copilot] Acknowledged:`），计划只回显
 * plan_id 与一条步骤字符串；因此计划卡片如实标注「stub 回显」，不伪造步骤状态与费用。
 * 也正因没有「按计划算钱」的接口，卡片不显示金额。
 */
export default function CopilotDock() {
  const location = useLocation();
  const { copilotOpen, toggleCopilot } = useShell();

  const [messages, setMessages] = useState<DockMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const domain = resolveDomain(location.pathname);
  const tab = domain ? resolveDomainTab(domain, location.pathname) : undefined;
  const contextLabel = domain ? `${domain.label} / ${tab?.label ?? '—'}` : '当前页面';

  // ADR-0065 S2：把"已感知当前页面"这句话**真的发出去**。此前这里只把路由渲染成
  // contextLabel 给人看，请求体里一个字段都没带——面板说感知到了，agent 其实看不到。
  // 放进 ref：`send` 的依赖数组不该为了跟随每次路由变化而重建。
  const interactionRef = useRef<AssistantInteractionContext>({
    appCode: 'app-superai',
    pageCode: 'shell',
    pageUrl: '/',
  });
  const navigationRef = useRef<AssistantNavigationState | null>(null);
  useEffect(() => {
    interactionRef.current = {
      appCode: 'app-superai',
      pageCode: domain ? `${domain.key}-${tab?.key ?? 'unknown'}` : 'shell',
      pageUrl: location.pathname,
    };
    navigationRef.current = domain
      ? {
        view: tab ? `${domain.key}-${tab.key}` : domain.key,
        tab: tab?.key,
        url: `${location.pathname}${location.search}`,
      }
      : null;
  }, [domain, tab, location.pathname, location.search]);

  useEffect(() => {
    if (!copilotOpen) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, copilotOpen]);

  // 关闭 / 卸载时中止在途流
  useEffect(() => {
    if (!copilotOpen) abortRef.current?.abort();
  }, [copilotOpen]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((id: string, next: Partial<DockMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: DockMessage = { id: nextId(), role: 'user', text };
    const assistantId = nextId();
    const history: StreamMessage[] = [...messages, userMsg]
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.text }));

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '' }]);
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const tools: ToolTrace[] = [];

    // 上下文在**发送这一刻**组装：navigation 取当前路由，selection 取本体域 store
    // 里最新的那份（只有对象浏览器在发布；其它域为空，就不落 selection 键）。
    const context = buildAssistantContextEnvelope({
      interaction: interactionRef.current,
      navigation: navigationRef.current,
      selection: getOntologyContextSnapshot().selection,
    });

    try {
      await streamAgentChat(
        history,
        {
          onReasoning: (t) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, reasoning: `${m.reasoning ?? ''}${t}` } : m,
              ),
            );
          },
          onToolCall: (call) => {
            tools.push({ callId: call.callId, tool: call.tool, status: 'running' });
            patch(assistantId, { tools: [...tools] });
          },
          onToolResult: (res) => {
            const hit = tools.find((t) => t.callId === res.callId);
            if (hit) hit.status = res.status === 'success' ? 'success' : 'error';
            patch(assistantId, { tools: [...tools] });
          },
          onRoutingDecision: (event) => {
            const d = event.decision as unknown as {
              outcome?: string;
              reason_code?: string;
              candidates?: Array<{ role_slug?: string }>;
              selected?: { role_slug?: string } | null;
            };
            const picked = d.selected?.role_slug ?? '—';
            const count = d.candidates?.length ?? 0;
            patch(assistantId, {
              decision: `调度决策：${d.outcome ?? '—'}（${d.reason_code ?? ''}）· 候选 ${count} · 选中 ${picked}`,
            });
          },
          onRoutingDecisionError: (event) => {
            patch(assistantId, { decision: `调度未完成：${event.message}` });
          },
          onDelta: (delta) => {
            // 逐块追加：流式正文要看得见（否则长回答期间面板是空的）
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + delta } : m)),
            );
          },
          onDone: (content) => {
            // 若已按 delta 渲染过正文则以增量结果为准，避免重复拼接
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text || content || '（本次没有文本回复）' } : m,
              ),
            );
          },
          onError: (message) => {
            patch(assistantId, { error: message, text: '' });
          },
        },
        controller.signal,
        { context },
      );
    } catch (e) {
      patch(assistantId, { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, messages, patch]);

  /** 中止在途流（后端在路由拒绝时会把 SSE 挂着不吐数据，用户需要能停）。 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return prev.map((m) =>
        m.id === last.id
          ? { ...m, text: m.text || '', error: m.error ?? '已停止等待后端响应' }
          : m,
      );
    });
  }, []);

  /** 计划卡片：用当前最后一条用户输入走 detect → generate。 */
  const makePlan = useCallback(
    async (messageId: string, seed: string) => {
      try {
        const intentRes = (await detectIntent(seed)) as unknown as {
          intentId?: string;
          intent?: string;
        };
        const intentId = intentRes.intentId ?? intentRes.intent ?? seed;
        const plan = (await generatePlan(intentId)) as unknown as {
          planId?: string;
          plan_id?: string;
          steps?: string[];
        };
        const steps = plan.steps ?? [];
        patch(messageId, {
          plan: {
            planId: plan.planId ?? plan.plan_id ?? '—',
            steps,
            stub: steps.some((s) => s.startsWith('[stub')),
          },
        });
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [patch],
  );

  return (
    <aside className="mp-dock" aria-label="SuperAI Copilot" aria-hidden={!copilotOpen}>
      <div className="mp-dock-head">
        <span className="mp-dock-name">
          <Sparkles size={16} strokeWidth={1.5} />
          SuperAI Copilot
        </span>
        <span className="mp-dock-ctx" title={contextLabel}>
          {contextLabel}
        </span>
        <Button
          theme="borderless"
          type="tertiary"
          icon={<X size={16} strokeWidth={1.5} />}
          aria-label="收起 Copilot"
          onClick={toggleCopilot}
        />
      </div>

      <div className="mp-dock-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="mp-dock-note">
            已感知当前页面：<strong>{contextLabel}</strong>。
            直接在下面提问，或在任意页面按 ⌘K 检索对象后回来追问。
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`mp-dock-msg is-${m.role}`}>
              <span className="mp-dock-who">{m.role === 'user' ? '我' : 'AI'}</span>
              <div className="mp-dock-bubble">
                {m.reasoning ? (
                  <details className="mp-dock-reasoning">
                    <summary>思考过程</summary>
                    <div>{m.reasoning}</div>
                  </details>
                ) : null}

                {m.tools && m.tools.length > 0 ? (
                  <ul className="mp-dock-tools">
                    {m.tools.map((t) => (
                      <li key={t.callId}>
                        <span className={`mp-dock-tool-dot is-${t.status}`} />
                        {t.tool}
                        <span className="mp-dock-tool-status">
                          {t.status === 'running' ? '调用中' : t.status === 'success' ? '成功' : '失败'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {m.decision ? <div className="mp-dock-decision">{m.decision}</div> : null}

                {m.text ? <div className="mp-dock-say">{m.text}</div> : null}
                {m.error ? <div className="mp-dock-error">{m.error}</div> : null}

                {m.role === 'assistant' && m.text && !m.plan ? (
                  <div className="mp-dock-plan-actions">
                    <Button
                      theme="borderless"
                      type="primary"
                      size="small"
                      icon={<Check size={13} strokeWidth={1.6} />}
                      onClick={() => void makePlan(m.id, m.text)}
                    >
                      生成执行计划
                    </Button>
                  </div>
                ) : null}

                {m.plan ? (
                  <div className="mp-dock-plan">
                    <div className="mp-dock-plan-head">
                      执行计划 · {m.plan.planId}
                      <span className="mp-dock-plan-count">{m.plan.steps.length} 步</span>
                    </div>
                    <ol>
                      {m.plan.steps.map((s, i) => (
                        <li key={`${s}-${i}`}>{s}</li>
                      ))}
                    </ol>
                    {m.plan.stub ? (
                      <div className="mp-dock-plan-note">
                        后端 copilot 当前为 stub，只回显计划骨架；执行与逐步骤状态待接口就绪。
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mp-dock-foot">
        <div className="mp-dock-input">
          <textarea
            className="mp-dock-textarea"
            rows={1}
            value={input}
            placeholder="向 SuperAI 提问，或描述一个任务…"
            aria-label="向 SuperAI 提问"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className={`mp-dock-send${busy ? ' is-stop' : ''}`}
            aria-label={busy ? '停止等待' : '发送'}
            disabled={!busy && !input.trim()}
            onClick={() => (busy ? stop() : void send())}
          >
            {busy ? <Square size={13} strokeWidth={2} /> : <ArrowUp size={15} strokeWidth={1.8} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
