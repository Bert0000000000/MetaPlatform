# MetaPlatform 1.1 local candidate

This retained launcher composes existing DATA, ONT, AppHub, MCP and AuthService implementations. Current-source host processes serve `http://127.0.0.1:9368/website/`; the API is55522, AuthService55523, isolated Keycloak25.0.6 is55520, Redis55521. These are separate from preserved shared Docker images and9200/9361 previews.

Run from the repository root:

```powershell
./scripts/acceptance/run-mp11-acceptance.ps1 -Phase Status
./scripts/acceptance/run-mp11-acceptance.ps1 -Phase Verify
./scripts/acceptance/run-mp11-acceptance.ps1 -Phase Browser
```

`config.example.json` explicitly declares the only approved local addresses/database names. The launcher validates them before action. Secret placeholders are documentation references; actual protected inputs and PID/container ownership records are in ignored `.tmp/codex-mp11-candidate/`, outside disposable plan scratch. The existing manifest is required. Do not rerun `manage.py setup` on this installation: it refuses existing resources. The setup code is specific to the recorded Goal PG identity and cached images, not a portable deployment provisioner.

Use the normal password login with account `writer` (tenant mp11-candidate), `readonly`, or `neighbor`. The authorized local owner can retrieve that account's password from the ACL-protected `credentials.json` without pasting it into chat/logs. The UI receives server-verified tenant and subject. Writer can review orders; readonly receives signed read scopes. Service/unknown identities cannot confirm human actions or create MCP keys. The candidate uses the supported60-second approval setting to make expiry acceptance practical; product default is900seconds.

`Start` restores only exactly recorded owned dependencies and launches hidden API/Auth/Web processes. Occupied ports fail closed, so stop existing owned roles first when deliberately restarting. `Stop` validates PID/executable/creation time/arguments and container ID/name/image/loopback bindings, then stops only those resources; it retains all data, inputs and manifests. It never stops Goal PG, shared resources,9200,9361 or legacy Task6 fixtures. Re-run Status and the normal business Verify probe after restart. No compose/down-v, database drop or scratch deletion is part of this launcher.

Validation phases: Frontend (all web tests/types/build/shared login), Backend (all affected packages on guarded owned PG targets), PrepareBrowser (new signed relationship/empty tenants), Browser (prepares fresh additive signed relationship/empty fixtures on every invocation, retains prior accounts/tenants and private inputs, writes distinct per-run logs/receipts; 47 tests including three independent103-type late-page catalog consumer checks; historical full runs were43 and44 tests across web/core projects, no authenticated trace/video/screenshots), Security (actual signed scope/unknown/WS expiry/Redis limit/deadline), Recovery (source-only disconnect and owned API interruption), Migrations (recorded fresh/0020 upgrade chains). Recovery is an acceptance fixture with retained rows and is not currently an arbitrary repeatable health command; use Verify for normal probes. Migration receipts preserve prior completed chains instead of resetting databases.

Durable sanitized receipts live at `docs/active/delivery/evidence/mp11-candidate/`. Full release/rollback limits are in `docs/active/delivery/evidence/MP11-ACCEPTANCE.md` and `MP11-RELEASE-NOTES.md`. A test pass is not a public deployment or72-hour SLO. Native browser WebSocket cannot supply Authorization headers; this acceptance uses header-capable clients against the existing secured event route. Gateway-mediated browser WS integration is separate. Direct candidate API access JWTs do not consult the AuthService blacklist; server logout revokes refresh at Keycloak, and direct API JWTs expire normally.

The G23 PG WebSocket integration fixture requires explicit `MP11_WS_PG_DSN` pointing at the approved owned55497/codex_mp11_ database. Backend phase supplies and validates it through the exact Goal PG manifest. Candidate Backend sets MP11_WS_PG_REQUIRED=1 and must execute this test: absent DSN or invalid target fails. Ordinary no-PG CI explicitly skips this one optional integration case while retaining memory producer and localRSA WS guard tests. A separately provisioned integration CI profile must supply the isolated matching PG target and required flag. The existing no-PG GA job remains compatible; the ontology-loop job runs core browser tests and does not claim this host-specific fixture. Eight pre-existing privileged-role RLS tests remain NOT_EXERCISED; five memory parameterizations require PG and have passing PG counterparts.

Additional focused verification commands use the same private input guards:
```powershell
mate-platform-backend/.venv/Scripts/python.exe scripts/acceptance/mp11/verify.py targets
mate-platform-backend/.venv/Scripts/python.exe scripts/acceptance/mp11/verify.py consumer
mate-platform-backend/.venv/Scripts/python.exe scripts/acceptance/mp11/verify.py audit
```
`consumer` is a deliberately disruptive owned API/LISTEN acceptance fault, not a health check. It recovers polling, explicitly restarts only owned API, then proves fast notifications and replay. `targets` observes actual factory base URLs and delegates normal signed HTTP unchanged; no success response or auth guard is replaced.

Final I1I4 implementation handoff evidence is retained in docs/active/delivery/evidence/mp11-final-fix/. The final fix includes normal signed direct/MCP proposal guards, exact-ID app resolution, full authorized catalog reads and immediate process identity checks. Scoped re-review and controller whole-branch acceptance/audit remain pending; historical receipts and original business data remain retained.
