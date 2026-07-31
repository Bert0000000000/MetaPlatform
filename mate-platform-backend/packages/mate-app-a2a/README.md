# mate-app-a2a

Mate Platform - APP-A2A Agent-to-Agent protocol center for
inter-agent delegation, external agent discovery, and task routing.

This package is part of the P2-W3 batch and is exposed under
`/api/v1/a2a/*` via `mate_app_a2a.api.app`. The copilot package
proxies its `/a2a/delegate` and `/a2a/external` endpoints to this
service.

Data sources for this batch are in-memory (see
`mate_app_a2a.repositories.in_memory`). Persistent storage
(Paimon / Postgres) lands in v3.2.
