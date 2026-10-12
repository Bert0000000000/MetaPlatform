# Ontology / MetaPlatform 1.1 research evidence

Snapshot date: 2026-10-11, Asia/Shanghai. Local baseline: feat/ont-migration-plan / 2c13952c.

- `github-metadata.json`: canonical repository names, exact stars/forks, last push, API license labels.
- `commit-snapshots.json`: default-branch commits used to pin source reads.
- `source-manifest.json`: successfully downloaded source paths, commit URLs and SHA-256.
- `collect-github.ps1`: cached GitHub search and candidate metadata.
- `collect-sources.ps1`: licenses and selected source trees.
- `read-core-sources.ps1`: targeted source reads.
- `cache/`, `sources/`, `official-docs/`: ignored local primary evidence, retained for review.
- `artifacts/`: ignored rendered QA artifacts.

Product design and survey live in `docs/active/specs/2026-10-11-metaplatform-product-v1.1.md` and `docs/active/research/2026-10-11-ontology-platform-survey.md`.

No candidate was installed or deployed. Source findings are not production incident reproductions. Refresh by running `collect-github.ps1 -Refresh`; archive or regenerate commit-pinned source evidence when intentionally changing the snapshot, rather than mixing dates.
