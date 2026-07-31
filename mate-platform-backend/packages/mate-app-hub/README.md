# mate-app-hub

Mate Platform - APP-HUB application registry / grouping / module
catalog / page templates (FR-APP-HUB-001..005).

This package is part of the P2-W2 batch (PR#12) and is exposed
under `/api/v1/apphub/*` via `mate_app_hub.api.app`.

Data sources for this batch are in-memory (see
`mate_app_hub.repositories.in_memory`). Persistent storage
(Paimon / Postgres) lands in v3.2.
