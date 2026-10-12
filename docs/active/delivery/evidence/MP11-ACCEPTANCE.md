# MetaPlatform1.1.0 candidate acceptance

Status: implementation verification handoff; independent task and whole-branch reviews pending. BASE2f869020a50707857fb5e42151ddd5dcbef03f8c. Source hashes and commit mapping are in mp11-candidate/source-manifest.json and commit-mapping.json. Full report: mp11-candidate/implementer-report.md.

The usable signed current-source preview is http://127.0.0.1:9368/website/ . Use normal login with writer/readonly/neighbor and the owner-local ACL-protected inputs documented in scripts/acceptance/mp11/README.md. No password or bearer token is published here. Existing9200/9361 and shared Docker application images are preserved.

Actual Keycloak25.0.6 + AuthService + verified signed tenant/scopes + real Redis + guarded PostgreSQL exercised discovered source, object draft/publication, mapping/sync/cursor, relations, published app/runtime, human deadline confirmation/execution, receipt/relogin/restart/replay, MCP initialize/list/query/revocation, fresh/0020 upgrade and named fault recovery. The detailed receipts are in acceptance.json and migration-chains.json.

Validation is full suites plus final covering amendments: web123, sharedlogin3, types/build0; Platform325,DATA129,MCP277,Auth14; kernel733+1 historical then15cover; AppHub216+1 then1cover; ONT678+1+13skip then14cover. Browser full43 produced42PASS+1FAIL; amended objectflow1PASS and added impactflow1PASS. See final-validation-coverage.json and original logs rather than interpreting focused browser-checks.json as the full run.

The eight privileged-role RLS cases are NOT_EXERCISED. Five memory parameterizations require PG and have passing PG counterparts. Exact IDs in skips.json. LocalRSA fixtures prove negative guards separately from actual Keycloak positive/negative scopes, readonly, unknown, expiry and provider logout. A truncated ephemeral localRSA token appeared in original RED output; durable evidence is sanitized, original tool output remains.

Native browser WS gateway integration, immediate direct-API access-token revocation, external bus/client delivery, formal deployment,72-hour SLO and user study are explicit limits. Consumer recovery used bounded polling plus explicit owned API restart, not automatic LISTEN reconnection. No GA claim.

Run `./scripts/acceptance/run-mp11-acceptance.ps1 -Phase Verify` for a normal signed business probe. Other deliberate phases and data-retaining teardown are documented in README. Do not run the old shared root compose/down-v workflow or delete plan Scratch while Task6API55510 still depends on it.

Canonical evidence is three separate checks: official OpenAPI3.1 structural0errors, exact block-move parsed semantic equality, and13 live moved operation IDs matching. DATA seven decorator-only additions have AST equality after removing operation_id. These do not imply whole runtime contract equality.

Task8 fix round1 source 726be90950e42d650bd6dc73f34cd9b8cceeef64: strict authoritative tenant validation and fresh additive Browser fixtures. Focused signed/SEC-IAM188PASS/1 inherited warning; advertised default Browser44/44 passed twice consecutively (bf7ce3d0ff0d,1194b651968c), separate full logs/receipts, prior fixtures retained. Signed retained order/app/receipt/audit continuity passed after owned API/Auth restart. See mp11-candidate/fix-round-1-coverage.json and appended implementer report. Original43/covering history retained; scoped/whole-branch reviews pending, no Task8 verified/Goal/GA claim.
