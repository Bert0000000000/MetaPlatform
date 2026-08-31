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

import { parseRoutingDecisionEvent, streamAgentChat } from './chat';

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
