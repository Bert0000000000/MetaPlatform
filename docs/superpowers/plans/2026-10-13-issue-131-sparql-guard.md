# Issue 131 SPARQL syntax guard implementation plan

> **For agentic workers:** Use executing-plans for this single repair and requesting-code-review before merging.

**Goal:** Reject unsupported FILTER/OPTIONAL syntax explicitly without rejecting the same text in RDF terms or changing supported tenant-scoped SELECT results.

**Architecture:** Validate lexical tokens before the existing simplified parser. Ignore comments, quoted literals, IRI references, variables and prefixed names when identifying unsupported syntax; raise ValueError so the existing HTTP parse-error handler returns 400. Keep the legacy InstanceStore and middleware tenant authority.

**Tech Stack:** Python 3.12, frozen backend uv.lock, FastAPI, pytest, existing OpenAPI bundle tools and Tencent main CI/CD.

**Spec:** [GitHub issue #131](https://github.com/Bert0000000000/MetaPlatform/issues/131), [AGENTS](../../../AGENTS.md), [ont contract](../../../mate-platform-backend/contracts/openapi/services/ont.yaml). Token distinctions follow [W3C SPARQL lexical grammar](https://www.w3.org/TR/sparql11-query/#sparqlGrammar).

## Global constraints

- Isolated branch codex/issue-131-sparql-guard starts at dc8980d3e129e94f0bc55190705ede7cbe304ba0. Preserve primary WIP and the active prior automation's #113/#115/#116 and PR #109 worktree.
- No database migration, v2 semantics, auth bypass, shared service restart, destructive cleanup or shared-branch force push.
- This is a syntax rejection guard, not complete SPARQL support. Keep existing INSERT/DELETE translation tools. A baseline DELETE translation AttributeError is repaired locally to restore the existing test.
- Local InstanceStore tests prove the compatibility route only. Record actual required PostgreSQL/browser CI separately; never count missing environments or skips as passing.
- Merge only after refreshing main and verifying required checks on the final head. Verify main SHA, exact-revision release CI, Tencent artifact and actual repaired behavior.
- Open issue count is 24 and the no-issue streak is 0. Pause the schedule only after four consecutive successful empty surveys.

## Task 1: Reject unsupported syntax and preserve compatibility

**Files:** contracts/openapi/services/ont.yaml and generated/bundled.yaml; packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py; packages/mate-tech-ont/tests/test_sparql_supported_syntax.py (all backend paths are under mate-platform-backend).

- [ ] Document the existing ontPostOntSparql 400 response for unsupported FILTER/OPTIONAL and regenerate/lint the bundle.
- [ ] Add parameterized parser and HTTP regressions for mixed case, adjacent parentheses/braces, comments, quoted/escaped/long strings, IRI paths, variable names and prefixed names.

```python
with pytest.raises(ValueError, match="Unsupported SPARQL syntax: FILTER"):
    parse_sparql("SELECT ?s WHERE { ?s rdf:type ?o . FILTER(?o = 'x') }")
```

- [ ] Execute the new tests before the fix and retain the failures. Execute HTTP requests through the real auth middleware; seed independent same-tenant and other-tenant InstanceStore records and verify SELECT/LIMIT and zero mutations for rejected queries.
- [ ] Add a lexical token guard called at the start of parse_sparql; raise a constant keyword-only message before execution. Repair DELETE translation by taking the subject from each triple, rather than calling string methods on a tuple.
- [ ] Run parser, compatibility business, actual HTTP, tenant isolation and explain regressions; run ruff/format and contract checks. Record counts, failures and skips.
- [ ] Request independent review and fix material findings.

## Task 2: Publish and verify

- [ ] Re-fetch main, merge new commits without losing concurrent work, rerun affected checks, push and open a PR with available codex/codex-automation labels.
- [ ] Wait for every required/affected check and actual PostgreSQL/browser evidence; merge with the reviewed head SHA, preserving existing worktrees.
- [ ] Verify remote main and the corresponding Tencent Demo Deploy artifact. Confirm repaired HTTP behavior on the actual deployed service using synthetic read-only queries and a trusted test identity; preserve existing data.
- [ ] Record release/rollback boundaries and update the automation ledger. Close #131 only when its current acceptance evidence is complete.

## Baseline evidence

On the starting SHA, the existing parser/security/business suite ran 33 tests: 32 passed, 1 failed (DELETE translation treats a tuple as a string), 0 skipped. JUnit is local .ci/issue131-baseline.xml. Python 3.12.13 and locked runtime/dev dependencies are installed in this worktree only. Shared local Docker was reported unavailable by the prior run; required real database/browser checks remain CI responsibilities.
