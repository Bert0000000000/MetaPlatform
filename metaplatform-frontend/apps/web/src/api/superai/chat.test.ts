// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mate/shared/api', () => ({
  apiPath: () => '',
  createApiClient: () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }),
}));

vi.mock('@mate/shared', () => ({
  getToken: () => null,
  getUser: () => null,
}));

import { isAllowedNavigatePath, parseRoutingDecisionEvent, streamAgentChat } from './chat';

afterEach(() => vi.unstubAllGlobals());

describe('parseRoutingDecisionEvent', () => {
  it('rejects a final selected event without a selected authorized role', () => {
    expect(parseRoutingDecisionEvent({
      type: 'routing_decision',
      stage: 'final',
      outcome: 'selected',
      candidates: [],
      selected: null,
    })).toBeNull();
  });

  it('retains a valid final denial for the safe UI explanation', () => {
    expect(parseRoutingDecisionEvent({
      type: 'routing_decision',
      stage: 'final',
      outcome: 'denied',
      candidates: [],
      selected: null,
      reason_code: 'no_authorized_candidates',
      policy_version: 'semantic-router-v1',
    })).toMatchObject({
      stage: 'final',
      outcome: 'denied',
      reason_code: 'no_authorized_candidates',
    });
  });

  it('reports a malformed live routing event to the visible stream-error callback', async () => {
    const event = JSON.stringify({
      type: 'routing_decision',
      stage: 'final',
      outcome: 'selected',
      candidates: [],
      selected: null,
    });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${event}\n`));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const onRoutingDecision = vi.fn();
    const onRoutingDecisionError = vi.fn();

    await streamAgentChat([], {
      onRoutingDecision,
      onRoutingDecisionError,
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onRoutingDecision).not.toHaveBeenCalled();
    expect(onRoutingDecisionError).toHaveBeenCalledWith({
      message: '路由决策事件格式错误，无法安全展示本次路由结果。',
    });
  });
});

// ── ADR-0065 §3.3 navigate 回向 + 评审条件 R4（白名单校验） ──
describe('isAllowedNavigatePath（navigate 路径白名单，R4）', () => {
  it('放行应用内已知前缀的绝对路径（含 query / hash）', () => {
    expect(isAllowedNavigatePath('/ontology/objects')).toBe(true);
    expect(isAllowedNavigatePath('/ontology/objects?class=ont.t.customer.v1')).toBe(true);
    expect(isAllowedNavigatePath('/superai/chat#anchor')).toBe(true);
    expect(isAllowedNavigatePath('/home')).toBe(true);
    expect(isAllowedNavigatePath('/agents/tasks/42')).toBe(true);
  });

  it('拦截外部 URL / javascript: / protocol-relative / 未知前缀 / 路径穿越', () => {
    // 外部 URL：不以 `/` 开头 → 直接出局
    expect(isAllowedNavigatePath('https://evil.example.com/x')).toBe(false);
    expect(isAllowedNavigatePath('http://127.0.0.1:9250/ontology')).toBe(false);
    // 脚本注入
    expect(isAllowedNavigatePath('javascript:alert(1)')).toBe(false);
    expect(isAllowedNavigatePath('data:text/html,<script>1</script>')).toBe(false);
    // 协议相对：`//evil.com` 会被浏览器当外站
    expect(isAllowedNavigatePath('//evil.example.com/ontology')).toBe(false);
    // 反斜杠变体
    expect(isAllowedNavigatePath('/\\evil.example.com')).toBe(false);
    expect(isAllowedNavigatePath('\\\\evil.example.com')).toBe(false);
    // 未知前缀（应用内但没有这个顶层命名空间）
    expect(isAllowedNavigatePath('/unknown/thing')).toBe(false);
    expect(isAllowedNavigatePath('/ontologyevil')).toBe(false);
    // 路径穿越
    expect(isAllowedNavigatePath('/ontology/../../etc/passwd')).toBe(false);
    expect(isAllowedNavigatePath('/./home')).toBe(false);
    // 编码后的协议相对：首段不在白名单里
    expect(isAllowedNavigatePath('/%2F%2Fevil.example.com')).toBe(false);
    // 空白 / 控制字符
    expect(isAllowedNavigatePath('/ont ology')).toBe(false);
    expect(isAllowedNavigatePath('/ontology\n/x')).toBe(false);
    // 空 / 非字符串 / 超长
    expect(isAllowedNavigatePath('')).toBe(false);
    expect(isAllowedNavigatePath('/')).toBe(false);
    expect(isAllowedNavigatePath(undefined)).toBe(false);
    expect(isAllowedNavigatePath({ path: '/ontology' })).toBe(false);
    expect(isAllowedNavigatePath(`/ontology/${'a'.repeat(600)}`)).toBe(false);
  });
});

describe('streamAgentChat navigate 事件', () => {
  it('把 navigate 事件原样交给 onNavigate（白名单校验留给渲染层）', async () => {
    const event = JSON.stringify({
      type: 'navigate',
      target: { path: '/ontology/objects', label: '看客户详情' },
    });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${event}\n`));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const onNavigate = vi.fn();

    await streamAgentChat([], {
      onNavigate,
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onNavigate).toHaveBeenCalledWith({
      target: { path: '/ontology/objects', label: '看客户详情' },
    });
  });

  it('缺 target 的 navigate 事件不触发回调', async () => {
    const event = JSON.stringify({ type: 'navigate' });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${event}\n`));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const onNavigate = vi.fn();

    await streamAgentChat([], {
      onNavigate,
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
