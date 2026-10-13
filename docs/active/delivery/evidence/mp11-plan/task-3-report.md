# Task 3 report — 官网进入平台

Status: DONE. Scope: repository-local product 1.1 candidate; no cloud Site registration, public domain deployment, formal release or business-chain acceptance claimed.
Baseline: dispatch BASE b281a7ca7911dc8e41d4092fbe3a91409796f6b5, branch codex/product-v1.1.

## Implementation

- Canonical content is metaplatform-frontend/apps/web/public/website/index.html. Reused the existing website's dark brand tokens and component CSS, retained system font fallback, removed external font dependencies.
- Product name MetaPlatform and required title; ordered sections: proposition, data → ontology → application → Agent, existing capabilities, Order/Customer scene, 1.1 planning, FAQ, entry. Illustrations explicitly say they are model examples, not real business data. Unaccepted business-chain/client capabilities are planning or validation work.
- Removed fictional demo host, sandbox availability/latency/status, fake mailboxes, placeholder GitHub/document links, fake submitted-contact form, historic test counts and architecture-GA product promises.
- Four real entry anchors default to same-origin /home. Static website does not instantiate the SPA or issue business API requests. Existing AuthGuard/login/API configurations are untouched.
- Vite exact /website and /website/ middleware maps to /website/index.html in dev and preview, preserving a query suffix. Production directory/index is already handled by existing Nginx. Website is copied through Vite public assets into dist; existing Dockerfile copies the entire dist. No Dockerfile change necessary.
- Old metaplatform-website/index.html is a compatibility redirect with a usable non-JS anchor. README documents the canonical source, dev/build/preview and standalone publication.
- Single public meta destination defaults to empty. Runtime override accepts HTTP(S) or same-origin absolute paths and rejects dangerous protocols, scheme-relative addresses, backslashes/control characters, escaping origins, and URL userinfo. Invalid values retain /home.
- Controller approved the minimal additional metaplatform-website/configure-platform.mjs. It reads only canonical source and generates an explicitly named new publish copy; one --platform-url sets both meta and four static hrefs. Exclusive create prevents overwriting existing files/symlinks or source. Invalid URL diagnostics never echo input. Generated links work without JS.
- Semantic main/sections/headings, skip navigation, clear focus, native keyboard-accessible mobile details menu and FAQ, balanced title wrapping, reduced-motion handling. Default page/links/menu/FAQ remain usable without JS; platform SPA login itself still needs JS.

## TDD evidence

RED before source implementation:
From metaplatform-frontend/apps/web:
`$env:E2E_BASE_URL='http://127.0.0.1:9361'; pnpm exec playwright test tests/e2e/website-entry.spec.ts --project=web --grep 'anonymous website directory' --reporter=list`
Result: 1 failed, exit 1. Expected required H1 but element not found at /website/; it was falling through to SPA/login. This was the missing public entry behavior.

Intermediate focused run: 10 passed, 3 failed. Positive standalone destinations stayed /home because temporary Python editing had emitted control characters in JS regex; normalized source escapes corrected it. Cold initial SPA navigation exceeded the original 5-second URL assertion; inspected the actual served AuthGuard module and reproduced /home → /login rather than modifying auth. The login assertion now allows the existing SPA cold-load time (30 seconds); normal final runs complete handoff in roughly 0.4–1.3 seconds.
Runtime URL focused rerun: 5/5 passed. Then username/password URL rejection added: 14/14 passed.

Static-generation RED before additional helper implementation:
`pnpm --dir metaplatform-frontend/apps/web exec playwright test tests/e2e/website-entry.spec.ts --project=web --grep 'standalone generated links' --reporter=list` with E2E_BASE_URL=9361.
Result: 1 failed, exit 1. Generator executable did not exist (MODULE_NOT_FOUND); expected exit 0 but got 1. This establishes missing standalone generation required by JS-disabled navigation.
GREEN after generator implementation: 16/16 passed, exit 0.

Final covering validation after source visual review:

- `$env:E2E_BASE_URL='http://127.0.0.1:9361'; $env:MP11_ARTIFACT_MODE='dev'; pnpm --dir metaplatform-frontend/apps/web exec playwright test tests/e2e/website-entry.spec.ts --project=web --reporter=list` → 16 passed (6.0 s), exit 0.
- `pnpm --dir metaplatform-frontend --filter @mate/web build` → tsc -b + Vite, 11126 modules transformed, built in 19.65 s, exit 0. Existing large SPA chunk warning remains; no type errors. No production source changes after this final build.
- Same complete focused Playwright command using E2E_BASE_URL=http://127.0.0.1:9362 and MP11_ARTIFACT_MODE=build → 16 passed (5.3 s), exit 0.
- Source and dist website SHA256 both C0096134009F6D071D34B0D81FFBB6CF4B5631B387CCB4DA1D56DCC45897A678.
- git diff --check clean for owned changes. Search of canonical HTML found no old demo host, mailto, placeholder href, repository docs URLs, historical GA version, Google-font dependency or localhost destination.

## Actual entry / static / accessibility evidence

Real dev and built preview requests:

- /website/ → 200, correct H1, all four /home anchors.
- /website/index.html → 200, same content and anchors.
- Browser request receipts contain only the two website document paths; no /api/ calls on public page. Test asserts no business requests.
- Anonymous CTA really loads the existing SPA /home; AuthGuard routes to /login and existing username textbox is visible. No token injected, no IAM login submitted, no credentials entered, no business API mocked. This proves anonymous login entry only, not authenticated workspace success.
- Existing dev login has preset development fields/hint. Final tests turn off trace/video/automatic screenshot and do not capture login. Only public website screenshots retained; any early failed-run artifacts were replaced by final clean runs.
- Public screenshots at 360, 390, 768, 1440: scrollWidth <= viewport width; keyboard Tab reaches skip link, Enter focuses main; mobile summary is operated with keyboard Enter; order navigation works. Reduced-motion animation is none and scroll behavior auto. Native FAQ/details remain accessible without JS.
- Default JS-disabled CTA navigates to /home. Generated standalone HTML has all four hrefs set to <https://platform.example.com/home> even with JS disabled (synthetic public URL used for navigation configuration testing, not a deployed platform claim).
- javascript:, data:, scheme-relative and synthetic userinfo URLs retain /home. Valid HTTPS and same-origin path override all four links. Generator rejects userinfo without output/leaking supplied fixture.

Evidence is preserved under `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-3-evidence/`:
MP11-website-{dev,build}-{360,390,768,1440}.png and MP11-website-{dev,build}-requests.json.
Final command output: task-3-dev-tests.log, task-3-build-tests.log, task-3-build.log in the plan scratch directory.
Screenshots were visually reviewed at 360 and 1440; observed desktop orphan heading wrap was balanced and the final source rebuilt/retested.

## Files owned / self-review

1. metaplatform-frontend/apps/web/public/website/index.html
2. metaplatform-frontend/apps/web/tests/e2e/website-entry.spec.ts
3. metaplatform-frontend/apps/web/vite.config.ts
4. metaplatform-website/index.html
5. metaplatform-website/README.md
6. metaplatform-website/configure-platform.mjs

No auth, API, Dockerfile, backend, historic accepted documentation or release/Gate state changes. Initial screenshots, worktrees, examples/docs and backend pycache remain unrelated WIP and were not staged. Reused legacy stylesheet includes some now-unused component selectors; kept to preserve visual source and avoid unrelated CSS refactoring.

## Resource ownership / limits

- Vite dev: PID 58796, <http://127.0.0.1:9361/website/>. Started only after 9361 was verified free. Controller asked to retain this user-facing preview for Task 8 handoff; it remains owned by this task and is transferred to controller. When no longer needed, confirm its command line includes vite + 9361, then Stop-Process -Id 58796. Do not kill by default port or stop 9200.
- Built Vite preview: PID 13996, port 9362; stopped after final validation after checking its command line. No other services/containers/databases were restarted or stopped.
- Isolated dev uses the unchanged default API target 8100; provider/settings discovery on login can report ECONNREFUSED when that target is absent. This does not affect the public website and is not evidence of usable authenticated backend.
- No real deployed standalone/public address supplied. DNS, public release, actual account login, business-chain acceptance, user trials and long-running observations remain outside this Task 3 evidence.

Commit: 1894f18c — feat(website): add canonical public platform entry. Only the six owned files are committed; post-commit owned-path status and staged diff are clean.

## Fix round 1 — literal standalone URLs

Independent review found configure-platform.mjs:30,33 used replacement strings containing the escaped public URL. Confirmed against current source and reproduced browser behavior: JavaScript interprets dollar replacement tokens in string replacement arguments, so HTML escaping alone did not preserve destination fidelity.

Changes limited to configure-platform.mjs and website-entry.spec.ts:

- Both href and meta replacements now use callbacks returning literal attribute strings.
- Added five generated-artifact regressions for $&, dollar-backtick, dollar-apostrophe, $$ and $1. Each runs the actual generator, loads its publishing copy with JavaScript disabled, asserts exactly four entry links, verifies every href matches the original URL and verifies meta content matches the same URL.
- Protocol/userinfo validation, exclusive output creation and fixed diagnostics are unchanged; existing security/default-link checks remain in the full focused suite.

RED command (before helper fix):
`$env:E2E_BASE_URL='http://127.0.0.1:9361'; pnpm --dir metaplatform-frontend/apps/web exec playwright test tests/e2e/website-entry.spec.ts --project=web --grep 'preserves literal replacement token' --reporter=list`
Result: 4 failed, 1 passed (25.2 s), exit 1. $& produced a broken href ending value=href=; dollar-backtick injected the preceding anchor text; dollar-apostrophe removed all accessible entry links; $$ collapsed to one dollar. $1 remained literal with these no-capture expressions. This is an expected behavioral failure, not test infrastructure failure.
Saved output: task-3-fix-1-red.log.

GREEN same targeted command after callback fix: 5 passed (2.0 s), exit 0. Saved output: task-3-fix-1-green.log.
Final complete covering command:
`$env:E2E_BASE_URL='http://127.0.0.1:9361'; $env:MP11_ARTIFACT_MODE='dev'; pnpm --dir metaplatform-frontend/apps/web exec playwright test tests/e2e/website-entry.spec.ts --project=web --reporter=list`
Result: 21 passed (6.9 s), exit 0. Saved output: task-3-fix-1-suite.log. No automatic login screenshot/video/trace was enabled.

Self-review: diff contains only the two literal callbacks and covering token regressions; git diff --check is clean. Canonical HTML, Vite configuration, package/build inputs are unchanged, so no package-wide rebuild was performed solely for this helper repair. Current canonical and existing dist SHA256 still both C0096134009F6D071D34B0D81FFBB6CF4B5631B387CCB4DA1D56DCC45897A678; previous final build evidence continues to apply.
Preview ownership confirmed: 127.0.0.1:9361 remains PID 58796; no resource stopped/restarted. Root's pending plan documentation and all unrelated WIP are excluded from repair staging. No new correctness concerns; deployment/authenticated business acceptance boundaries remain as recorded above.

Fix round 1 commit: 571abb00 — fix(website): preserve literal standalone platform URLs. Only approved helper and covering test files committed.
