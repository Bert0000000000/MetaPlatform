import type { ChatMessageMetadata } from '@/api/superai/types';

/**
 * Fails closed for a single assistant turn: a malformed routing event makes
 * every earlier trace untrustworthy, so the UI must not retain it.
 */
export function clearRoutingDecisionForStreamError(
  metadata: ChatMessageMetadata | undefined,
  message: string,
): ChatMessageMetadata {
  return {
    ...(metadata ?? {}),
    routingDecisions: [],
    routingDecisionError: message,
  };
}
