# DeerFlow Production Integration Design

> Date: 2026-07-26
> Status: Approved for implementation
> Related baseline:
> - `docs/superpowers/specs/2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md`
> - `docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md`

## 1. Goal

Deploy a pinned DeerFlow runtime as an internal MetaPlatform execution engine and prove a real user scenario end to end today. MetaPlatform remains the control and governance plane; DeerFlow is a replaceable deep-task execution plane.

The acceptance scenario is the read-only Object Copilot flow:

1. A user submits an InteractionContext for customer `cust-10086` and asks for a recent-state analysis and follow-up recommendation.
2. TECH-AGENT creates the authoritative AgentRun, constructs a signed OntologyContextEnvelope, and selects DeerFlow for the deep task.
3. TECH-AGENT calls the real DeerFlow Gateway with service authentication and streams the real run.
4. DeerFlow uses the platform-approved model configuration and platform tools only.
5. MetaPlatform translates upstream events into RunEvent, returns a non-mock answer, and preserves trace/run correlation.
6. The flow performs no business mutation; important claims carry evidence or the run is rejected.

## 2. Architectural decision

### 2.1 Control and execution planes

MetaPlatform owns identity, tenant boundaries, routing, AgentRun state, budgets, tool authorization, Action Guard, evidence, artifacts, audit, fallback and user APIs. DeerFlow owns deep planning, sub-agent coordination, sandboxed work and generation within the granted context.

The DeerFlow frontend and public ingress are not deployed. The Gateway is reachable only through a Kubernetes ClusterIP and NetworkPolicy from TECH-AGENT. All user traffic enters through MetaPlatform.

### 2.2 Runtime policy

`native`, `deerflow`, and `hybrid` are deployment policy modes, not the routing algorithm. Runtime selection also evaluates task type, agent policy, required capability, sensitivity, token/cost/time budget, action risk and runtime health.

Initial production policy:

| Task | Runtime |
|---|---|
| Object/metric lookup | FAST_QUERY |
| Normal explanation or single-object summary | NATIVE |
| Cross-domain analysis, complex extraction or artifact generation | DEERFLOW |
| Deterministic graph | METAFLOW |
| Approval/wait/compensation | WFE |
| High-risk action | ACTION_PROPOSAL then WFE; never direct DeerFlow execution |

The initial user acceptance scenario explicitly requests the DEERFLOW capability so it cannot accidentally pass through the native mock path.

## 3. Upstream baseline and supply chain

The integration pins `https://github.com/bytedance/deer-flow.git` at commit `6e6c078595e24579a6523a42b1cf4014245a92cf`, whose Helm chart declares application version 2.1.0. This is an exact-commit integration baseline rather than a floating `main` reference. DeerFlow's latest tagged release is v2.0.0, but it does not contain the upstream Helm chart required by this deployment. Promotion beyond local acceptance requires contract, image and security gates.

The repository stores:

- an upstream lock file with repository, commit, chart version and image digests;
- MetaPlatform-owned values and overlays;
- build/deploy/smoke/rollback scripts;
- SBOM and vulnerability scan jobs;
- no copied DeerFlow application source in TECH-AGENT.

Production images must be referenced by digest. Local Docker Desktop verification may build and load exact-commit images by deterministic tags before recording their digests.

## 4. Deployment topology

Namespace: `mate-deerflow`.

Local acceptance deploys:

- one DeerFlow Gateway replica;
- one provisioner;
- per-thread sandbox pods;
- bundled PostgreSQL and Redis with PVCs;
- ClusterIP services only;
- no DeerFlow frontend, nginx or ingress.

Production values use managed PostgreSQL and Redis with isolated databases/users/secrets. Artifact history is mirrored to platform MinIO and is never dependent solely on DeerFlow workspace storage.

The Gateway remains one replica at this upstream baseline because the chart documents unresolved multi-replica run-control constraints. MetaPlatform provides circuit breaking, health-based routing and Native fallback rather than claiming unsupported DeerFlow HA.

## 5. Trust boundaries

### 5.1 Service authentication

TECH-AGENT calls DeerFlow with the upstream-supported headers:

- `X-DeerFlow-Internal-Token`
- `X-DeerFlow-Owner-User-Id`

The owner value is a stable pseudonymous MetaPlatform subject, not a raw composite credential. The internal token is supplied by Kubernetes Secret, never source control or logs.

DeerFlow receives no external model-provider secret. Its model configuration points to TECH-LLMGW's OpenAI-compatible cluster endpoint using an internal service credential. Local acceptance may inject the existing `.env` LLM values into a Kubernetes Secret, without printing or committing them.

### 5.2 Authorization

Middleware is an early guard, not the final authorization boundary. Every TECH-MCP, TECH-ONT, TECH-RAG and TECH-ACTION request revalidates tenant, subject, envelope expiry/signature and scope server-side. DeerFlow cannot directly access platform business databases.

The read-only acceptance profile has no Action tools. Later write scenarios must create an ActionProposal and pass TECH-ACTION/WFE approval and idempotency controls.

### 5.3 Sandbox

Sandbox pods run non-root, with read-only root filesystem where supported, explicit CPU/memory/ephemeral-storage/time limits, no service-account token, and default-deny ingress/egress. Allowed egress is limited to required platform services and explicitly approved external research endpoints.

## 6. Runtime contract

TECH-AGENT exposes a runtime-neutral interface:

```text
AgentRuntime
  runtimeType()
  health()
  start(request)
  stream(handle)
  status(handle)
  cancel(handle)
  artifact(handle, path)
```

`NativeAgentRuntime` and `DeerFlowAgentRuntime` implement this contract. `AgentRuntimeOrchestrator` applies policy, middleware, persistence, metrics and fallback; controllers, triggers and extraction flows call the orchestrator and never inject `DeerFlowAdapter` directly.

The DeerFlow client aligns to the pinned upstream API:

- `POST /api/threads/{threadId}/runs`
- `POST /api/threads/{threadId}/runs/stream`
- `GET /api/threads/{threadId}/runs/{runId}`
- `POST /api/threads/{threadId}/runs/{runId}/cancel`
- `GET /api/threads/{threadId}/runs/{runId}/join`
- `GET /api/threads/{threadId}/artifacts/{path}`

It uses bounded connection/read/stream timeouts, does not retry non-idempotent create blindly, surfaces typed failures instead of `null`, and records Micrometer metrics without prompt or secret contents.

## 7. AgentRun consistency

MetaPlatform AgentRun is authoritative and stores the selected runtime plus DeerFlow thread/run identifiers. The platform run id is included in upstream metadata.

Create flow:

1. persist PENDING AgentRun;
2. persist deterministic thread id and request metadata;
3. start the upstream run;
4. save upstream run id and transition RUNNING;
5. on ambiguous timeout, reconcile the thread's upstream runs by platform metadata before any retry;
6. periodically reconcile non-terminal runs and terminalize stale runs explicitly.

No path may return success with a null run id. Upstream 4xx/5xx, timeout, circuit-open and policy rejection map to distinct platform error codes.

## 8. Streaming and artifacts

A DeerFlow event translator converts upstream SSE to the stable RunEvent schema. It adds platformRunId, tenantId and traceId; filters internal implementation details; redacts sensitive tool arguments; and persists events before forwarding to the UI.

The stream uses `on_disconnect=continue`. Reconnection uses the upstream join endpoint and then state reconciliation. The frontend never consumes raw DeerFlow SSE.

Artifacts are pulled by TECH-AGENT, scanned, written to MinIO, registered in `agent_artifacts`, and exposed through platform-signed URLs.

## 9. Resilience and observability

- readiness checks require Gateway API reachability and valid configuration;
- circuit breaker excludes unhealthy DeerFlow from new routing;
- retries apply only to safe GET/status/health calls unless reconciliation proves a create did not happen;
- every request carries platformRunId, threadId and traceId;
- metrics include starts, terminal statuses, routing decisions, latency, stream disconnects, reconciliation outcomes and circuit state;
- logs exclude model keys, internal tokens, signed envelopes and unrestricted prompt/tool payloads;
- Native fallback is explicit and recorded in AgentRun/RunEvent.

## 10. Acceptance gates

### Gate A: contract

- adapter contract tests run against a real HTTP test server;
- authentication headers, payload schema, endpoint paths, SSE translation, cancellation and typed errors are verified;
- production code is written test-first.

### Gate B: deployment

- pinned DeerFlow images deploy to Docker Desktop Kubernetes;
- all pods become Ready;
- no public ingress or NodePort exists;
- NetworkPolicy and resource/security contexts are present;
- secrets are absent from rendered manifests and repository diffs.

### Gate C: real user scenario

- invoke the MetaPlatform SuperAI API with customer InteractionContext;
- observe a real DeerFlow run id and non-mock model output;
- observe normalized RUN_STARTED and RUN_COMPLETED events;
- verify selectedRuntime=DEERFLOW and trace correlation;
- verify the run has no business mutation and important claims have evidence;
- verify the answer did not originate from `NativeAgentRuntime` placeholder text.

### Gate D: failure and rollback

- make DeerFlow unavailable and prove the configured behavior is explicit Native fallback or a typed unavailable error;
- restore DeerFlow and prove health recovery;
- render and exercise the rollback script;
- record all commands and evidence in an acceptance report.

## 11. Non-goals for today's gate

Today does not enable automatic Ontology commit, direct business actions, a public DeerFlow UI, multi-replica DeerFlow Gateway, or unrestricted internet/sandbox access. These exclusions preserve the original production boundary rather than replacing the real integration with a mock.

## 12. Required deliverables

- production Runtime SPI and orchestrator;
- real DeerFlow Gateway client and event translator;
- configuration properties, health, resilience and metrics;
- pinned build/deployment manifests and scripts;
- contract/integration/security tests;
- local Kubernetes deployment;
- real Object Copilot acceptance script and evidence report;
- corrections to the two baseline documents so planned and verified status are not conflated.
