// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ChatMessageMetadata, RoutingDecision } from '@/api/superai/types';
import { clearRoutingDecisionForStreamError } from './routingDecisionState';

const preScreen: RoutingDecision = {
  candidates: [],
  selected: null,
  taken_path: 'semantic_router',
  reason: 'semantic_router pre-screen',
  stage: 'pre_screen',
  outcome: null,
  reason_code: 'semantic_pre_screen',
  policy_version: 'semantic-router-v1',
  seq: 1,
  ts: '2026-08-31T00:00:00Z',
};

describe('routing decision message state', () => {
  it('clears the current turn routing trace when the stream reports a malformed event', () => {
    const metadata: ChatMessageMetadata = { routingDecisions: [preScreen] };

    expect(clearRoutingDecisionForStreamError(metadata, 'contract error')).toEqual({
      routingDecisions: [],
      routingDecisionError: 'contract error',
    });
  });
});
