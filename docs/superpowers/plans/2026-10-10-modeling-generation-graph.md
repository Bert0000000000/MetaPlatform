# AI generation reliability and candidate graph

User-approved scope: fix the failed AI generation and add a native-style ontology graph in the preview step. Preserve real source drafts and published definitions.

1. Reproduce the 25-sheet generation failure read-only, record bounded machine diagnostics without credentials or raw provider content in logs. Add regression tests for the demonstrated cause, preserve cross-class/source checks, and correct only technical transport/ID issues automatically.
2. Reuse ModelGraphCanvas with candidate-to-native view data. Show class/property/identity cards, business links and parent-child inheritance; zoom, drag, selection and complete property details remain local. Preview is available independently of instance readiness and never creates native definitions.
3. Run core/AI/ACL and graph tests, typecheck/build; actual independent PostgreSQL native gate and browser generation/preview/publication checks. Record evidence and read-only real-source verification.

Completed with 179 core/AI tests, 26 frontend tests, 123 native PostgreSQL cases and 5 browser cases; see the acceptance record for live generation limits and evidence.

Follow-up: confirmed ConnectError was incorrectly classified as invalid JSON. Separate transport, timeout, authorization, rate limit and format diagnostics. Retry only connect failures and transient HTTP statuses, at most three attempts; do not repeat read-timeout generations. Verify real authenticated HTTP generation on the latest failed source profile without changing that source.
