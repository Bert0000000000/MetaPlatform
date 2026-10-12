# MP11 existing realm scope migration design and implementation plan

> Applies to the user-authorized MP11 main integration and Tencent demo upgrade. Preserve existing identities, credentials, databases and shared infrastructure; use isolated CI for validation.

**Goal:** Existing cloud accounts can use the authorized 1.1 read policy after an application upgrade; only existing holders of `PLATFORM_ADMIN` obtain `platform.write`.

**Architecture:** Run Keycloak's bundled `kcadm.sh` through the existing Compose service. Read bootstrap administrator credentials only inside that container, use a private temporary CLI configuration, and clean it in `finally`. Preserve users, passwords, client secrets, user/group roles, existing default scopes, and shared infrastructure.

**Tech stack:** Python 3.12 standard library, Docker Compose, Keycloak 25 Admin CLI; standard-library tests exercise migration logic through a stateful fake CLI boundary; actual Keycloak acceptance is separate CI evidence.

## Decision and boundaries

- Choose the existing container CLI over host REST: the cloud overlay removes Keycloak host ports, while the existing service listens on container loopback `http://127.0.0.1:8080`. No new host endpoint or credential export is needed.
- Keep `ci_server.py`, `prepare.py`, all private configuration, and account role assignments unchanged. The existing controller already calls the new release's `bootstrap.py` during fresh verification.
- Require the existing `metaplatform` realm, `metaplatform-backend` client, and `PLATFORM_ADMIN` role before any mutation. Missing, malformed, ambiguous, or conflicting responses fail closed.
- Create missing `platform.read` and `platform.write` scopes with `include.in.token.scope=true`. Read has no role mapping. Write has only the existing administrator role and no client role mappings.
- For an unlinked write scope, establish and read back the role restriction before adding any default link. An already linked unrestricted write scope or additional role mappings is a conflict, not an opportunity to grant permissions.
- Append scopes through the individual default-client-scope endpoint. Never replace the whole client or realm representation. Read back all prior default IDs plus the two required scopes.
- Preserve `profile`, `roles`, session mappers, and every other existing default link. Reuse a compatible `preferred_username` mapper on the client or an unrestricted existing default scope; a role-restricted profile stays intact and receives an equivalent direct mapper instead; otherwise append the standard username property mapper through the single-mapper endpoint. A conflicting signed claim source fails without overwriting it.
- Record only fixed names, resource IDs, stage, mutation metadata, and safe error classifications in an ignored JSONL journal, including partial failures. Never log credential values, tokens, CLI stderr, or arbitrary server response bodies.
- Application rollback leaves this additive realm configuration in place. Record previous metadata for a separate manual authentication rollback; existing application backups do not include the Keycloak database. Existing access tokens need a new login to gain new scopes.

## Implementation steps

1. [x] Add `infra/demo-cloud/tests/test_configure_auth.py`. Start with an old realm containing unrelated `profile` and `roles` defaults, unchanged users and secret, and no platform scopes. Assert safe ordering, strict administrator restriction, preservation, and idempotence; then verify RED before implementation.
2. [x] Cover missing prerequisites, conflicting scope/mapping data, malformed CLI responses, six partial mutation failures followed by reruns, authentication/cleanup failures, compatible and conflicting username mappers, and sanitized journals. Fail the fake runner on any unexpected endpoint or user/client/role mutation.
3. [x] Implement `infra/demo-cloud/configure_auth.py` with an injectable subprocess runner. Support repeated `--compose-file`, optional `--project` and `--env-file`, `--no-sudo`, and `--journal` so CI can use its existing ontology stack without cloud private files.
4. [x] Add behavioral tests for bootstrap migration ordering and for verify's JWT scope requirements and read-only Data/AppHub calls; watch RED, then hook auth migration first, the root-owned schema helper second, and extend `verify.py`.
5. [x] Run all demo-cloud tests, scoped Ruff and formatting checks, and inspect the owned diff. Local result: 23 auth/bootstrap/access tests plus 17 existing CI/CD tests and 3 startup-boundary tests, 43 passed with no skips. The restricted-profile regressions failed before the implementation correction and passed afterward. Real Keycloak and cloud acceptance remain root-owned CI/deployment evidence.

## Verification commands

```powershell
python -B -m unittest discover -s infra/demo-cloud/tests -p "test_*.py" -v
python -B infra/demo-cloud/configure_auth.py --help
```

CI invocation against an existing explicitly selected stack:

```sh
python3 infra/demo-cloud/configure_auth.py --no-sudo \
  --compose-file docker-compose.yml \
  --compose-file docker-compose.override.yml \
  --compose-file .tmp/ontology-core-ci.compose.json \
  --journal .ci/mp11-auth-scope-migration.jsonl
```

The root integration owner supplies the real CI Compose file set. Required live checks: run twice; real administrator and ordinary-user tokens; explicit ordinary-user write-scope request still denied; actual Data/AppHub reads; existing native ontology acceptance remains intact. No local Docker evidence is claimed.

## Existing database compatibility prerequisite

The runtime currently copies packages/services but no Alembic sources. The raw SQL bootstrap only creates Copilot tables; ORM `create_all()` does not add missing columns to existing AppHub/MCP tables. The root integration owner separately handles the official `0021_apphub_publication` and `0022_mcp_key_scopes` additions after checking the actual `metaplatform` database schema. Do not stamp a fictitious baseline or replay migrations from zero. Legacy key scopes remain `[]`; additive schema rollback does not drop columns. Authentication and Data/AppHub verification remain separate evidence from that schema upgrade.
