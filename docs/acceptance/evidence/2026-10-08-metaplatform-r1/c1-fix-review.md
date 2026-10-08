- **Required database gate accepted incomplete execution and inherited pytest selectors** — **ADDRESSED**. `scripts/ci/verify_ont_postgres.py:76-86` removes inherited `PYTEST_ADDOPTS` and stale collection destinations for both collection and execution. `:89-112` generates a fresh collection manifest and rejects nonzero collection exits and empty/duplicate identities. `:115-143` requires one exact identity property per executed case and rejects missing, extra or duplicate identities. `:160-182` uses the same sanitized environment and identity plugin for both subprocesses and cannot return success for nonzero execution. `scripts/ci/ont_required_pytest.py:8-19` preserves complete pytest node IDs, including parameterized suffixes, and serializes only node IDs.

### New Breakage in the Fix Diff

- **None** — no new Critical, Important or Minor breakage found in the four-file fix diff.

### Out-of-Scope Observations

- **None**.

### Checks

- Read the supplied `461da4a9..473b9051` diff once; inspected the scoped brief, prior finding, appended fix report and relevant current line references. No Git commands, suite reruns, subagents, source edits or resource mutations were performed. Only this review report was written.
- Confirmed the retained backend pytest `addopts` at `mate-platform-backend/pyproject.toml:110` contain reporting, strictness, import mode and temporary-directory settings, with no case selectors; clearing `PYTEST_ADDOPTS` therefore produces an unfiltered collection for this configuration.
- Inspected `c1-completeness-red.xml`: 22 cases, 5 failures, 0 errors/skips. The five failures are the three missing/duplicate/extra variants, exact parameterized identity test and inherited-selector collection test. Inspected `c1-completeness-green.xml`: all 27 covering cases pass, with 0 failures/errors/skips. The new behavioral coverage corresponds to `scripts/ci/tests/test_ont_postgres_gate.py:118-169`; the selector test invokes actual temporary-case collection and checks both parameterized suffixes.
- Inspected `c1-completeness-postgres.xml` and its collection JSON: 68 collected identities and 68 recorded execution identities match exactly, with 0 duplicates, failures, errors or skips. All six required suites and the original family-publish case are present. Inspected `c1-completeness-rls.xml` and its collection JSON: 8 collected/executed identities match exactly, also with 0 duplicates, failures, errors or skips. Each JSON has only the `nodeids` key; each execution XML has only the `ont_required_nodeid` property name. The workflow diff uploads the matching `.collection.json` artifacts alongside both JUnit reports.
- Inspected the preservation probe source and omitted-case artifact without executing them. The altered XML contains 67 successful cases, and its identity difference from the full XML is solely `TestReattachOnFamilyPublish::test_family_publish_carries_instances_and_records_run`. The new set comparison necessarily rejects this artifact with one missing identity; the recorded old-checker acceptance and corrected rejection are consistent with the code.
- Evidence boundary: the XML/JSON directly substantiate execution completeness and outcomes. pgvector 0.8.6, business-role attributes, target ports and intentionally inherited launch options are recorded in `task-2-report.md:89-91`; JUnit/identity manifests do not independently attest those environment facts. Sanitized subprocess construction supports the reported selector bypass. No new live database queries or remote CI verification were performed.

### Verdict

- **Fix round: All findings addressed, no new Critical/Important breakage.** The incomplete-required-case finding is closed; remote CI, deployment and broader R1 acceptance remain outside this scoped re-review.
