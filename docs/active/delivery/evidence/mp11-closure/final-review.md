# MetaPlatform 1.1.0 — single final whole-branch review

Review date: 2026-10-12 (Asia/Shanghai). **Verdict: Needs fixes. Critical 0 / Important 4 / Minor 2.**

Fixed original BASE: `2c13952c0ceb2c792b8192fab966a4deed2926f4`. Fixed HEAD: `38ff11900b9d72560afe20db4715d344c1370a23`.
Supplied package: `review-2c13952c..38ff1190.diff`, 3,516,052 bytes, SHA256 `c4c5780d5c21b9354ebe255ef84d16bc432a9d0fc5c64b5905afe29938c14053`. Package hash and checkout HEAD independently matched. The last commit is documentation/evidence only.

This is the one whole-branch gate following eight accepted task gates. It does not revoke their scoped findings or authorize a remote merge/deployment. Binding authority: `docs/active/specs/2026-10-11-metaplatform-product-v1.1.md`, the complete approved implementation plan, global constraints, archived accepted task reviews and the progress/Ruling ledger. The completion matrix is a useful requirement/evidence index, not an approval.

## Strengths

- Relationship integrity is enforced inside the PostgreSQL write transaction, with explicit strict HTTP mode and compatible direct-repository defaults. Definition locks, ordered endpoint lifetime locks and delete-before-cascade locking address the original races. Same-family publication and compound edit-set execution take schema locks in consistent order; current source retains the accepted deadlock regression and checksum-confirmation fix.
- Source discovery resolves the actual selected SQL/in-memory source before invoking PostgreSQL/CSV adapters. Public source configuration is whitelisted; connection errors have safe categories/trace IDs. Qualified relation resolution and a durable non-secret checkpoint identity protect retargeting after bounded run history expires. Recovery rereads history after owning its lock; CSV checks canonicalized keys before any writes. Source deletes, full upsert and CSV batch boundaries are stated rather than silently advertised as CDC.
- AppHub stores definitions, versions, release decisions and shortlinks through SQL. Application revision CAS protects publication/history; captured runtime context carries the exact published snapshot ID. Actual typed model/Action/relationship checks and ObjectSet evaluation precede publication and proposals. Application attribution is verified across the two services, and kind-specific action/edit-set provenance filtering occurs before history LIMIT.
- Human confirmation/execution uses verified caller identity and server-owned deadlines. Proposal effects/state/receipt/key share the relevant PostgreSQL transaction; the borrowed connection is limited to legacy kinds, and optional vector upgrades are deferred outside that lease. Stored replay remains distinct from claims about arbitrary external exactly-once effects. ActionService audit UUIDs are unique per record.
- MCP grants are persisted, limited to the verified human issuer's granted subset, tenant-bound and revocable. Discovery and invocation share concrete capability checks; unknown dynamic/federated tools and human-only tools fail closed. Signed USER/SERVICE classification, authoritative tenant-shape validation, actual provider logout and conservative compatibility behavior are explicit.
- The candidate evidence establishes real Keycloak → AuthService → verified context → Redis/PG → AppHub/Ontology/MCP consumption, with named IDs and persisted receipts. Fresh/0020 upgrade chains, source interruption/retry, human compensation and consumer polling recovery are recorded separately. Two fresh full Browser runs retain distinct fixture identities, each with 44 passing cases and no failed/skipped cases. Preserving failed historical runs and source/commit mapping makes the evidence materially stronger than a health-only result.

### Issues

#### Critical (Must Fix)

None established.

#### Important (Should Fix)

1. **I1 — App ID/code collisions still break or select the wrong application outside deletion.**

   - Files: `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py:174` (`OR` predicate at 182); `repositories/in_memory.py:413`; `runtime/loader.py:36`; `api/app.py:193` and `:343`.
   - Trigger: same-tenant app A has code `collision-key`, while app B has ID `collision-key` and a different code. Both are allowed identities; a user can also register a new code equal to an existing returned app ID. SQL `get_app` combines ID and code then calls `scalar_one_or_none`, so two matches raise `MultipleResultsFound`. Memory returns the first ID-or-code match, which can be A. Detail and update likewise resolve the first mixed match. The accepted deletion fix gives exact IDs precedence, but that rule is not shared by runtime/detail/update.
   - Evidence: a narrowly scoped current-source SQLite `:memory:` probe inserted these two records and returned `MultipleResultsFound`; the process-local memory probe selected `different-id` instead of exact ID `collision-key`. No file database, live service or external data was used. Runtime calls that same SQL lookup; source establishes the resulting unhandled 500. Memory/wrong mixed lookup can load or update another app in the same tenant.
   - Impact: valid identities can make a published shortlink/runtime unavailable or resolve a different application, contrary to APP-02/04 and the precise publication-attribution boundary. This is not a demonstrated cross-tenant escape.
   - Fix: one exact-ID-first, then tenant-local-code resolver, used consistently by SQL/memory, loader, detail and update. Keep old IDs/codes and existing data. Add collision regressions for runtime/detail/PATCH as well as the already covered DELETE, preserving the unrelated app.

2. **I2 — Direct non-action Proposal routes bypass the new write-scope boundary.**

   - Files: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:3482` (propose_instance), `:3518` (propose_object_type), `:3926` (merge proposal); `api.py:350` shows that `_ctx` checks tenant, not write scopes. PG persistence: `pg_repo.py:5963`, `:6007`, `:6028`.
   - Trigger: a normally verified same-tenant USER with only `platform.read ont.read` posts to `/classes/{rid}/propose-instance` or `/object-types/propose`. Unlike ordinary Action and edit-set proposals, these handlers never require `platform.write` before persisting a Proposal. The merge-proposal handler has the same missing guard by source inspection. MCP filters the corresponding tools, but the same caller can use the HTTP routes directly.
   - Evidence: a process-local FastAPI app used the actual installed AuthMiddleware/TokenVerifier, a synthetic RSA-signed readonly token, and the actual Ontology router with InMemory repository. Both named routes returned HTTP 200 and added one stored proposal each; the ordinary Action proposal returned 403 and added none. PG methods call the same persisted `propose_action` INSERT. This is signed negative-guard evidence, not a new real-provider/PG acceptance run.
   - Impact: read-only authority can mutate persistent proposal state and bypass the intended shared API/tool capability distinction. No unauthorized execution or business-data mutation was demonstrated; existing human execution guards remain intact. The current `ont.write` contract metadata and MCP scope map do not enforce these ordinary handlers.
   - Fix: apply the same runtime `platform.write` check to all three proposal-creation handlers; preserve the existing documented metadata/runtime distinction and tenant checks. Cover direct signed readonly denial with no stored proposal, permitted scoped proposals, and the unchanged human/deadline/replay boundaries. Do not make readonly scopes writable or remove the tools.

3. **I3 — New downstream catalog consumers silently stop at the first 100 object types.**

   - Files: `metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.tsx:33`; `pages/apphub/components/OrderReviewBinding.tsx:17`; `pages/dashboard/components/ProductOnboarding.tsx:62`. Existing client/API contract: `src/api/ont/kernel.ts:102`; backend `v2_kernel/api.py:1961`.
   - Trigger: authorized Order/Customer models fall after the default first 100 entries. All three new consumers call `listObjectTypes()` once without limit/offset or a continuation/search control. App binding filters that already truncated result for active models, so even fewer eligible models may appear.
   - Impact: the relation editor now correctly supports later-page types, but those same models cannot be selected for source mapping or the object-driven order app, and saved onboarding selection is treated as missing after refresh. This leaves a cross-task break in DATA-02 / APP-03 / UX-01. The 104-type Browser fixture verifies the relationship editor, not these consumers.
   - Fix: use the existing authorized pagination contract to read all pages, or offer real paged/search selection and resolve saved selections explicitly. Reuse a small shared catalog reader where appropriate, with no-progress/failed-page handling. Add focused UI/HTTP behavior coverage with >100 types and late-page Order/Customer; retain loading/error states and tenant filtering. Raising a hardcoded cap alone just moves the failure.

4. **I4 — Stop re-fetches a PID without rechecking its identity at the termination point.**

   - File: `scripts/acceptance/mp11/manage.py:248`.
   - Trigger: its first PowerShell loop validates every recorded PID/executable/command/CreationTicks. Its second loop fetches the PID again but checks only existence before `Stop-Process`. If an owned process exits and its PID is reused between the loops, the second loop can terminate the replacement process without comparing its identity. Several records are handled, so the first validation is not the immediate termination guard.
   - Impact: the new lifecycle launcher promises to stop only exactly owned processes and preserve user/shared services. This source-visible race weakens that specific safeguard. No process was stopped or live PID reuse attempted in this review.
   - Fix: revalidate the full recorded identity immediately in the same guarded termination loop, fail closed on mismatch and preserve the absent-process behavior. A harmless mocked process-query regression can change CreationTicks/executable between observations and assert no termination occurs; no real service stop is needed for that negative case.

#### Minor (Nice to Have)

1. **M1 — Consolidated inherited fixture/dependency/build warning follow-up remains open.**

   - Evidence: `docs/active/delivery/evidence/mp11-candidate/fix-round-1-signed-final-green.log:4`; `mate-tech-data.log:12`; `mate-tech-mcp.log:34` and `:38`; `web-build.log:264`.
   - Remaining categories: Starlette/httpx and FastAPI lifecycle deprecations, short HMAC/class-shaped fixtures outside the repaired scopes, and large SPA chunks. These are disclosed local validation/maintenance issues, not proven product authentication defects or failed assertions. The focused reviewer probe emitted the same inherited Starlette warning.
   - Triage: keep shared fixture cleanup, supported dependency/lifespan migration and bundle/performance work with their respective owners. Do not blanket-filter warnings, demand unchanged full reruns, or imply P95/user-study measurements from a successful build. This one consolidated Minor represents the repeated Task1/2/3/4/5/6/7/8 warning entries, not eight duplicate findings.

2. **M2 — The end-to-end sample differs from the plan's declared uniform sample.**

   - Files: implementation plan's “统一验收样例”; `scripts/acceptance/mp11/verify.py:118`–120; `docs/active/delivery/evidence/mp11-candidate/acceptance.json:63`.
   - Actual retained PG/fresh/upgrade chain uses Customer `id/name`, Order `id/total/status`, numeric identities 1/2 and explicit relationship instances. It does not use the plan's exact Order `customer_id/amount` fields and C001/O001/O002 identifiers. The relationship Browser fixtures exercise other identifiers separately.
   - Impact: the generic actual-column/typed binding and same-object/provider chain are substantive; this difference alone does not demonstrate missing generic functionality. However, those receipts should not be described as literal coverage of every field/ID in the uniform declared example.
   - Triage: add a single canonical retained fixture for the declared sample, or obtain an explicit documented equivalent-sample ruling and reconcile the sample description without rewriting historical evidence. Keep `customer_id` as an ordinary field and an explicit LinkInstance as the business relationship; do not imply foreign-key text automatically created the relationship.

### Recommendations

Route I1–I4 together into the controller's one unified final fix dispatch, followed by the one scoped re-review of those findings/new breakage. Each has a concrete narrow regression; existing unchanged suites/builds need no repetition absent a related source change or unresolved failure. M1/M2 remain explicitly nonblocking maintenance/sample follow-ups once triaged, rather than silently discarded.

Keep the current candidate and protected recovery inputs outside plan Scratch. Before deleting Scratch, complete the controller's archival/retirement audit. The controller reports the old 55510 listener and historical 62164/65568 PIDs are now absent; this is later current-state evidence, not a reason to rewrite older runtime ledgers. This reviewer neither accessed private credential contents nor stopped resources.

### Requirement, risk and evidence assessment

| Area | Whole-branch result and limit |
| --- | --- |
| ONT object/draft/publish, relation type/instance lifecycle | Strict-new intent, WIP/checksum conflict recovery, typed/cardinality/tenant checks and schema-lock continuity have accepted current-source/PG proof. No additional lock-cycle finding established. |
| DATA discovery/mapping/cursor/retry/restart | Retarget identity survives >20 runs; equal-time PK, qualified-table, normalized CSV and interrupted-run evidence retained. I3 blocks late-page UI selection. |
| AppHub metadata/template/binding/publication/history | SQL/CAS, typed dependencies, actual checklist, exact snapshot attribution and both legal edit-set aliases are present. I1 identity ambiguity and I3 catalog truncation remain. |
| Proposal kinds/approval/transaction/compensation | Durable deadlines/state/replay and lease/vector fallback integrate coherently. Human/service/key refusal is retained. I2 is the direct creation-scope gap, not a claim execution is unguarded. |
| MCP discovery/invocation/forwarding | Persisted scoped keys, issuer subset, revocation and unknown external-tool denial are implemented; ordinary bearer forwarding and key-service forwarding retain their documented authority checks. Native clients remain 1.1.1. |
| Website/login/logout/version intro | Canonical public source, safe configured/no-JS CTA, mobile/keyboard checks and actual provider logout/relogin are recorded. Public DNS/HTTPS/user study are separate. |
| Owned runner/new+upgrade/fault recovery | Current effective factories/signatures/Redis/PG and retained fresh/upgrade business receipts are evidenced. I4 is the remaining launcher ownership race. Source and consumer faults have named bounded targets; polling plus explicit LISTEN restart is accurately disclosed. |
| Canonical contracts | Four official 3.1 structures, 719 reference/relocation checks and 13 selected live operation IDs are distinct evidence, not whole runtime-contract equality. Proposal metadata/runtime distinction is preserved; I2 needs handler enforcement. |
| Coverage, provenance and scope | Controller matrix's 48 steps/22 P0/88 file-applicability entries were read as an index. Existing `test_ontology_api.py` execution and Dockerfile's dist COPY are justified unchanged entries. Current SHA256s for all 47 overlaid Task8 source paths match the controller manifest; HEAD's doc-only commit does not pretend to be a fresh suite run. No GA/status rewrite or shared source deployment is approved. |

Existing execution evidence, inspected rather than rerun: web123/shared3/types/build exit0; Platform325/DATA129/MCP277/Auth14; kernel733+1 historical failure then15 covering, AppHub216+1 then1 covering, ONT678+1+13 skips then14 covering; original Browser42+1 of43 followed by named amendments. The fix adds signed/SEC-IAM188 PASS/1 inherited warning and two distinct default Browser44/44 runs (`bf7ce3d0ff0d`, `1194b651968c`), whose final logs were checked. Counts are not summed into a fabricated monolithic green run.

The original first fresh-DDL log is not completely reconstructible. `mp11-plan/task-8-original-fresh-migration-receipt.json` retains the eight original displayed upgrade lines0015..0022 and its provenance; later no-op log, actual fresh creation guard/revision and signed receipt remain separate. This is adequate bounded fresh/upgrade evidence, not invented complete historical DDL output.

All 13 historical skips remain distinguished: eight privileged-role RLS cases are **NOT_EXERCISED**; five InMemory parameterizations have actual PG counterparts. G23 is mandatory in the candidate and only optionally skipped in the ordinary absent-DSN/no-required CI profile. Remote CI was not run. No successful nonprivileged RLS, direct-JWT immediate logout revocation, native-browser WS gateway, arbitrary external bus/effect delivery, true dsh/WorkBuddy, public rollout, 72-hour SLO or first-user measurement is inferred.

### Deferred-minor and Ruling disposition

| Earlier entry | Final triage |
| --- | --- |
| Task1 M1; Task2 M3; Task3 bundle warning; Task4/5 M1; Task6 M2; Task7/8 M1 | Consolidated as M1 above; inherited, disclosed, nonblocking maintenance, no warning suppression. |
| Task2 M1 unsupported individual load-more; M2 failed-page previous navigation | Closed by accepted scoped fix and current real-API semantics. Not reintroduced as findings. |
| Task2 M4 ProposalConfirmDrawer fixture baseline | Closed in Task7's owned correction; Task8 full web output retains the five passing drawer tests. Not parked or deleted. |
| Task3 literal replacement-token URL defect | Closed by callback-based generator and no-JS/configured URL regression. |
| Task3 revision NO_COLOR/FORCE_COLOR warning; Task7 deprecated MCP client spelling | Candidate environment removes FORCE_COLOR; accepted Task8 helper correction/fresh Browser logs resolve the owned cases. Earlier warning logs remain historical. |
| Task6 release array DTO and completedAt/endTime residual | Closed by accepted Fix2 canonical correction and actual COMPLETED sample assertions. |
| Earlier Important findings | Accepted scoped fixes retained; no Important was silently parked/downgraded. I1–I4 above are this whole-branch review's distinct remaining gaps. |
| Release/P1/P2/operational boundaries | Rulings separating native clients, public deployment, user study/SLO, direct JWT expiry, browser WS and explicit LISTEN restart are retained. Archival/retirement is still controller-owned. |

### Review method and read-only contract

Used the supplied package and byte-offset index for source/contract/evidence passes; no regenerated diff or second reviewer. Read the full spec/plan, progress/deferred ledger, archived original/accepted scoped task reviews, current Task8 review/fix, cross-task/provenance records and completion matrix. Current-source reads completed concrete caller/storage contracts beyond hunk cutoffs. Large formatting-only contract/store replacements were inspected through their current/addition form with necessary prior-review context; this report does not assert every unchanged formatting line was independently re-audited.

Focused execution was limited to the two named unanswered I1/I2 concerns: SQLite memory lookup and actual local RSA-signed HTTP scope checks. Synthetic inputs stayed in one child process; bytecode writes were disabled. No provider/database/network/runtime mutation, credential/token/DSN output, authenticated media, suite/build rerun, index/HEAD/branch/source change, checkout, subagent or second opinion. The sole authored file is this report. Tool-output truncations were handled by smaller named cutoffs; a few command parsing/path guesses failed without executing mutations.

### Assessment

**Ready to merge? No.**

**Reasoning:** The candidate has substantial, truthfully bounded real-provider/consumer and persistence/recovery evidence, and all earlier task-scoped fixes are retained. Four concrete authorization, application identity/catalog integration and launcher ownership gaps still prevent whole-branch candidate approval; fix and scope-review them before Goal completion, with M1/M2 explicitly tracked. No remote merge/deployment authorization is implied.
