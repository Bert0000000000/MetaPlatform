# mate-app-copilot

Mate Platform — **APP-COPILOT** AI business assistant.

Exposes 33 endpoints under `/api/v1/copilot/*` (FR-COPILOT-001..033)
covering chat / multimodal, NL2SQL analysis, code generation, action
matching, scheduling intent detection, knowledge-base search, ontology
graph traversal, datasource listing, and A2A delegation.

Follows the ADR-0014 5-step integration pattern (install_auth →
require_tenant → outbox → ACL client stub → cross-tenant negatives).
