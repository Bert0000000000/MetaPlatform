# FOLLOW-UP-A — OpenAPI security parity acceptance evidence

> Scope status: **Accepted for the focused parity gate**
> Commits: `dec65fb3` → `0b2e770b`

## Result

The canonical 21-service contract inventory is used by the parity checks.
Marketplace and Orchestrator security declarations, MCP command scope, and
query-shaped POST read/write scope are covered by explicit contract metadata.

## Verification

- `infra/tests/test_service_security_segments.py`: 64 passed.
- `infra/tests/test_g5_security_parity.py`: 954 passed.
- The repository contract validator still reports the pre-existing legacy
  public `/mcp-protocol` path migration as a separate API migration item; this
  focused parity acceptance does not claim that migration is complete.
