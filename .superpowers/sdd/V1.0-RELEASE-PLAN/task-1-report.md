# Task 1 Report — FOLLOW-UP-A

Date: 2026-08-27

Base commit: `edc693e29bc597e6026884c296dcd3cd3b7e7cf9`
Implementation commit: `dec65fb3f4e1faecc32f73d10ecac1e4ba271676`

## Files changed

- `infra/tests/test_g5_security_parity.py`
- `infra/tests/test_service_security_segments.py`
- `mate-platform-backend/contracts/openapi/services/copilot.yaml`
- `mate-platform-backend/contracts/openapi/services/marketplace.yaml`
- `mate-platform-backend/contracts/openapi/services/mcp.yaml`
- `mate-platform-backend/contracts/openapi/services/ont.yaml`
- `mate-platform-backend/contracts/openapi/services/orchestrator.yaml`

## Chosen query-POST policy

For POST operations that are semantically reads, the contract now makes the read authorization explicit with `x-required-scopes: [platform.read]`. The parity test uses that field as the effective-scope source instead of forcing all POST endpoints into the method-only `platform.write` bucket.

Applied read-query exceptions in scope:

- `copilot.yaml`
  - `/api/v1/copilot/analysis/explain-sql`
  - `/api/v1/copilot/generate/process`
  - `/api/v1/copilot/ontology/graph/query`
  - `/api/v1/copilot/scheduling/employees/match`
  - `/api/v1/copilot/search`
- `ont.yaml`
  - `/api/v1/ont/federation/query`
  - `/api/v1/ont/v2/object-sets/query`
  - `/api/v1/ont/v2/object-query`
  - `/api/v1/ont/v2/object-search`

Applied write requirement in scope:

- `mcp.yaml`
  - `/mcp-protocol` POST now requires `platform.write` and declares `x-required-scopes: [platform.write]`

Additional contract alignment in scope:

- `marketplace.yaml`
  - canonical top-level read security
  - canonical read/write scopes on secured operations
  - explicit write security added to skill mutation operations
  - inline canonical security scheme definitions replace the previous local `$ref` entries
- `orchestrator.yaml`
  - top-level read security default added
  - explicit write security added to scheduling mutation POSTs
  - `/healthz` metadata completed for contract validation

## RED evidence

Command:

```powershell
pytest -q infra/tests/test_g5_security_parity.py -k "read_post_endpoints_declare_x_required_scopes"
```

Output summary:

```text
10 failed, 932 deselected in 1.35s
```

Representative failures:

```text
AssertionError: copilot.yaml POST /api/v1/copilot/analysis/explain-sql must declare x-required-scopes: [platform.read]
AssertionError: mcp.yaml POST /mcp-protocol must declare x-required-scopes: [platform.read]
AssertionError: ont.yaml POST /api/v1/ont/v2/object-query must declare x-required-scopes: [platform.read]
```

This was the expected RED signal: query-shaped POST reads lacked explicit `x-required-scopes`, and the MCP command POST still sat in the read bucket before the fix.

## GREEN evidence

Focused GREEN commands:

```powershell
pytest -q infra/tests/test_g5_security_parity.py -k "read_post_endpoints_declare_x_required_scopes or all_twenty_one_services_present"
pytest -q infra/tests/test_service_security_segments.py -k "security_schemes_well_formed or contract_and_endpoints_declare_security or all_twenty_one_services_covered"
```

Focused GREEN outputs:

```text
10 passed, 943 deselected in 1.10s
43 passed, 21 deselected in 2.05s
```

Required full-suite GREEN commands:

```powershell
pytest -q infra/tests/test_service_security_segments.py
pytest -q infra/tests/test_g5_security_parity.py
```

Required full-suite GREEN outputs:

```text
64 passed in 2.98s
953 passed in 1.99s
```

## Contract validation

Command:

```powershell
python mate-platform-backend/contracts/scripts/validate_contracts.py
```

Output:

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.worktrees\ga-v1-followups\mate-platform-backend\contracts\openapi\services\mcp.yaml:/mcp-protocol: path must start /api/v1/
```

Result: still failing, but the remaining failure is the pre-existing `/mcp-protocol` path-shape rule, not introduced by this task's scope/security changes. Diff against the base commit shows this task changed only the POST scope metadata on that endpoint, not the endpoint path itself.

## git diff --check

Command:

```powershell
git diff --check
```

Output:

```text
warning: in the working copy of 'infra/tests/test_g5_security_parity.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'infra/tests/test_service_security_segments.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'mate-platform-backend/contracts/openapi/services/copilot.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'mate-platform-backend/contracts/openapi/services/marketplace.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'mate-platform-backend/contracts/openapi/services/mcp.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'mate-platform-backend/contracts/openapi/services/ont.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'mate-platform-backend/contracts/openapi/services/orchestrator.yaml', LF will be replaced by CRLF the next time Git touches it
```

Result: no whitespace errors were reported; only line-ending warnings.

## Commits

- Base: `edc693e29bc597e6026884c296dcd3cd3b7e7cf9`
- Final: `dec65fb3f4e1faecc32f73d10ecac1e4ba271676`
- Commit message: `fix: align gate0 follow-up-a security parity`

## Concerns

- `validate_contracts.py` still fails on the pre-existing `mcp.yaml` path `/mcp-protocol` because the repository-wide validator requires `/api/v1/` prefixes. Changing that path would expand this task beyond the brief's security/scope parity remit and risks contract/runtime divergence, so I left it unchanged and recorded it here.

---

## Fix Round 1

Issue addressed:

`infra/tests/test_g5_security_parity.py` read-POST coverage was self-selecting because it discovered candidates from the current `oidcScopes: [platform.read]` state. That could let a required read-POST endpoint disappear from coverage if it regressed to default POST write scope.

Fix:

- pinned the required Copilot and Ontology read-POST endpoint identities explicitly
- derived the parametrized regression set from those fixed endpoint ids
- strengthened the regression assertion so each pinned endpoint must both:
  - declare `x-required-scopes: [platform.read]`
  - keep effective `oidcScopes` exactly `[platform.read]`

RED command:

```powershell
pytest -q infra/tests/test_g5_security_parity.py -k "required_read_post_endpoint_inventory_is_pinned or read_post_endpoints_declare_x_required_scopes"
```

RED output:

```text
=================================== ERRORS ====================================
_________________ ERROR collecting test_g5_security_parity.py _________________
infra\tests\test_g5_security_parity.py:284: in <module>
    READ_POST_ENDPOINTS = REQUIRED_READ_POST_ENDPOINTS_DATA
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
E   NameError: name 'REQUIRED_READ_POST_ENDPOINTS_DATA' is not defined
=========================== short test summary info ===========================
ERROR infra\tests\test_g5_security_parity.py - NameError: name 'REQUIRED_READ...
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 error in 1.24s
```

GREEN commands:

```powershell
pytest -q infra/tests/test_g5_security_parity.py -k "required_read_post_endpoint_inventory_is_pinned or read_post_endpoints_declare_x_required_scopes"
pytest -q infra/tests/test_service_security_segments.py
pytest -q infra/tests/test_g5_security_parity.py
```

GREEN outputs:

```text
10 passed, 944 deselected in 1.15s
64 passed in 3.31s
954 passed in 2.09s
```

Fix round 1 commit: `<pending>`
