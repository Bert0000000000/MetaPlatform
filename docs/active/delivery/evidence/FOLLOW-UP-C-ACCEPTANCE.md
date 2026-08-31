# FOLLOW-UP-C — Copilot isolation and guard acceptance evidence

> Scope status: **Accepted for the focused Copilot security/runtime gate**
> Commits: `790caaf4` → `e54361b8` and `bde1f45c`

## Result

Copilot SQL execution now fails closed for dangerous or cross-tenant input;
conversation reads do not fall back to in-memory data. Streaming chat and agent
paths enforce a bounded request envelope and sanitize prompt-leak markers before
emitting or persisting a response. A2A delegation authorizes the target from
the verified tenant-scoped registry before dispatch.

## Verification

- Copilot stream/payload/prompt guard slices: passed (8 focused cases).
- Copilot tenant integration: 10 passed.
- Copilot application/A2A coverage: 30 passed in the focused application run.
- SQL and A2A adversarial checks: passed.
- Ruff import/format focused checks and `git diff --check`: passed.

The full legacy adversarial file contains slower unrelated cases; this evidence
records only the deterministic security and persistence boundaries in scope.
