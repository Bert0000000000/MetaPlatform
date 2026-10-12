# MP11 Agent compatibility — 1.1.0 candidate

The Agent configuration page prepares native HTTP client configuration and verifies an actual MCP connection against an existing published application object. This is local candidate evidence, not signed-issuer acceptance, external-client acceptance, deployment or GA.

## Export targets

- **dsh native Cordis**: `@deepseek-ai/dsh-mcp-client`, `config.transport: streamable-http`, `config.url`, and `headers.Authorization` using the Cordis `!!js` environment expression for `METAPLATFORM_API_KEY`. Insert the exported plugin entry into the user's Cordis configuration. [Official package reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md), [overlay context](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/mcp-memory.md), checked 2026-10-12.
- **WorkBuddy official connector**: `mcp.json` with `mcpServers.metaplatform.type: streamableHttp`, URL, headers and `Bearer ${METAPLATFORM_API_KEY}`. This export targets the connector, whose spelling differs from Enterprise CLI configuration. [Official connector reference](https://open.workbuddy.cn/docs/connector), checked 2026-10-12.
- Exported credentials are environment references only. The entered test key stays in component memory; no local storage or configuration export includes it. URLs containing credentials, query strings or fragments are rejected; remote endpoints require HTTPS (loopback HTTP is supported).
- dsh/WorkBuddy installation, startup, login and real client interoperability: **NOT EXERCISED**, planned for 1.1.1. No implemented stdio bridge exists, and no invented bridge command is exported.

## Authority and compatibility

| Surface | Required verified authority / behavior |
| --- | --- |
| Key administration | AuthMethod.USER and a verified tenant. SERVICE/API_KEY cannot list, mint or revoke keys. |
| Key issuance | Nonempty subset (equality allowed) of actual issuer scopes, limited to `platform.read`, `platform.write`, `ont.read`, `ont.write`. UI selection or role/permission labels do not mint authority. |
| Ontology query/discovery | `ont.read` metadata authority plus endpoint runtime `platform.read`. |
| Ontology pending proposals | `ont.write` metadata authority plus endpoint runtime `platform.write`; query-and-propose UI additionally checks read discovery. |
| Preflight validation | All four scopes: schema inspection is read, and the composite also calls the canonical SHACL validation operation requiring `ont.write` + `platform.write`. Its read category is not authorization. |
| Human approval/execution | Not Agent-invokable; tools are hidden and calls denied even with forged `__caller__`. Existing authenticated USER+write HTTP path remains authoritative. |
| Unknown ordinary tools | Hidden/denied for external callers unless concrete required capability metadata is declared. |
| Dynamic/federated tools | Hidden/denied externally until trusted per-operation authorization metadata is available. Existing management/registration is preserved. |

Protocol and REST discovery/invocation use the same verified caller context. External caller-hint strings are removed. Key scopes persist in the existing key table through additive Alembic `0022_mcp_key_scopes` (after `0021_apphub_publication`); run the normal migration before serving upgraded key storage. Legacy rows receive `[]` and authorize no external tools. Reissue under a verified human's actual grants; the key UI states this explicitly. Revocation/expiry is checked on each HTTP message, including an already initialized session. A supplied foreign workspace header is rejected.

API keys remain MCP-service credentials. They cannot be forwarded directly as Ontology bearer tokens. The existing proxy uses its configured service transport identity only after exact tool/capability/tenant checks; it cannot reach human approval/execution through Agent tooling. This requires the existing downstream service token and tenant-switch configuration to work. Signed issuer USER/SERVICE classification and real provider scope assignment remain Task8; fixture JWT claims do not establish that acceptance.

## Connection UI

The user selects workspace, capability and export target, provides endpoint/key plus an existing published app/page, then runs **发现并查询**. Only successful HTTP `initialize`, `notifications/initialized`, `tools/list`, and an `ont_object_query` containing the same object from that published page mark **已连接**. Template generation alone does not. Errors identify the failed step without echoing upstream payloads or credentials; retries are supported. Endpoint, key, workspace, capability, app/page or target changes abort/reset prior results. The temporary MCP session is released after probing.

The safe query checks the first published page object against at most 200 returned rows. Empty published sets, missing permissions, paging that excludes that object, cross-origin restrictions or upstream service errors fail the test rather than claim connection. App/page identifiers are entered explicitly. The existing remote-client page labels stored connection records as unverified business queries.

## Approval validity

`ActionProposal.approval_expires_at` is server-owned, nullable for existing rows, and persisted in the existing Proposal table. Authenticated confirmation sets `confirmed_at + ONT_APPROVAL_TTL_SECONDS`; default **900 seconds**, accepted integer range **60–86400**. Invalid configuration raises before confirmation and does not authorize execution. The preview exposes the configured duration; confirmed records expose the actual deadline. Client deadline/actor fields cannot create or extend authority. An idempotent confirmation returns its original deadline.

Pending, expired and legacy undated approvals cannot perform a new execution. Legacy undated confirmed proposals must be replaced by a fresh approved proposal. Completed execution replay with the same command key returns the existing receipt even after expiry; it performs no new effect. The existing enum, identity, receipt and idempotency store are retained.

Deadline/state is checked under the existing action/edit-set transaction guard. For the supported legacy create-instance/model-type/merge-suggestion branches, one private borrowed connection covers mutation, transition and receipt. Lock order is shared create/exclusive model+merge schema, command key, Proposal row, then object mutations. Only the outer execution commits/rolls back/closes; context owner/tenant/lifetime is checked and reset in finally. No external function side-effect atomicity is claimed.

## Evidence and boundaries

- Actual FastMCP HTTP on temporary checked-free loopback55517, persistent scoped keys in `codex_mp11_agent_fresh_20261012`, existing accepted Order data in `codex_mp11_apphub_20261011`, both on explicit loopback55497. Read-only Task6 API55510 supplied the accepted publication binding. All temporary HTTP servers stop in finally; protocol keys are revoked.
- Same published object: app `app-e1598b1298475cdf91c87b5bf7ecca26`, page `page-f5329031a0285d1d9d4fb07a9eae7409`, object `ont.mp11-app-ui.ind.order.alias-f321163f85f14837b5e1e859341f0066`. No substitute success seed.
- Actual negatives: read-key proposal denial; hidden/denied approval, execution and unknown fallback tools; foreign tenant source/key; expired key; revoked initialized session401; SERVICE/API_KEY creator and human-route403. Empty legacy grants list no tools.
- Actual HTTP pending preview900/null, server confirmation+900 seconds, ignored forged actor/deadline, unchanged confirm replay deadline, expired execution409. Real response JSON Schema and operationIds checked against canonical MCP/Ontology contracts.
- Actual PostgreSQL fresh0022 and0021 upgrade, nullable legacy deadlines/empty key grants and independent-process persistence. Tests cover valid, pending/expired/undated, stale locked state, completed replay/new-process replay, and injected pre-receipt failure without partial mutation for all three legacy kinds. Ordinary repository commit visibility is retained.
- UI mocked connection/retry/reset and approval duration/deadline tests are separate from actual HTTP/PostgreSQL evidence. Task8 still owns all-web suite, signed provider identities and full candidate acceptance.
- Preexisting unrelated Ontology OpenAPI paths nested beneath `components` were observed; this task validates only the changed owned key/Proposal paths and does not claim global contract repair.

Rate limiting was an explicit in-process fixture for the REST authorization probe and remains **NOT_EXERCISED**. A preliminary harness configuration mistakenly attempted the default Redis connection and timed out during connection/HELLO; no verified no-touch claim is made. No shared Redis cleanup was performed. Task8 must test the normal limiter with explicitly owned isolated Redis.

## Accepted Task7 source and retained evidence

Scoped Task7 gate accepted `664aba15..e9ef0de6` after independent review and one fix re-review: I1 addressed, new C0/I0/M0. The optional pgvector upgrade is deferred during an active Proposal lease; JSONB embedding generation/writes remain in the same mutation/receipt transaction. Ordinary vector upgrade, indexing, KNN and hybrid behavior retain actual PostgreSQL coverage.

Initial backend157 belongs to `35f00e8d`; amended backend/vector28 belongs to `e9ef0de6`. Unchanged frontend9, silent command-gated `tsc --noEmit` exit0 and build are recovered original-run evidence, not rerun or combined whole-candidate counts. The focused GREEN log alone retains only one dot; the complete28-pass covering run supports both added regressions.

Durable [implementation/fix report](mp11-agent/task-7-report.md), [initial review](mp11-agent/task-7-review.md), [fix re-review](mp11-agent/task-7-rereview1.md), [original UI/typecheck receipt](mp11-agent/task-7-original-ui-typecheck-receipt.md) and [archive manifest](mp11-agent/task-7-archive-manifest.json) preserve commands, source ranges and boundaries. Reports retain their historical pending-gate wording; this paragraph records the accepted current gate.

Two harness incidents remain explicit: the preliminary default Redis connection timed out before a successful REST response, without verified no-touch evidence; an original RED fixture output revealed only a password prefix for the owned PostgreSQL fixture. Its durable log is sanitized and representation corrected, but original tool output remains visible. The [categorical incident receipt](mp11-agent/task-7-fix1-repr-incident.md) contains no credential fragments. No speculative shared cleanup or credential rotation was performed.

M1 inherited deprecation/chunk output and the unchanged vector class-fixture warning remain Task8/final-review owned. Actual signed identities/grants, normal isolated Redis limiter, full candidate/contract/all-web checks and durable preview remain mandatory Task8 work. True external clients, public deployment,72h SLO and user trial retain the stated later boundaries.
