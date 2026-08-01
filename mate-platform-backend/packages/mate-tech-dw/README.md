# mate-tech-dw

Mate Platform - TECH-DW digital workforce aggregation query
(FR-DW-001..015).

This package is part of the P2-W3 batch (PR#15) and is exposed
under `/api/v1/dw/*` via `mate_tech_dw.api.app`.

15 endpoints:
  - `GET  /api/v1/dw/auth/login` — digital employee login records
  - `GET  /api/v1/dw/collaborations` — peer collaboration sessions
  - `GET  /api/v1/dw/commit` — commit history (kb/agent/flow/form)
  - `GET  /api/v1/dw/documents` — documents in knowledge bases
  - `POST /api/v1/dw/documents/upload` — upload a new document (stub)
  - `GET  /api/v1/dw/employees` — digital employees
  - `GET  /api/v1/dw/employees/tasks` — employee task history
  - `GET  /api/v1/dw/evaluations` — employee evaluations
  - `GET  /api/v1/dw/extract` — fact extraction records
  - `GET  /api/v1/dw/knowledge-bases` — knowledge bases
  - `GET  /api/v1/dw/learning/extract` — learning extraction records
  - `GET  /api/v1/dw/learning/feedback` — learning feedback records
  - `GET  /api/v1/dw/models` — LLM models available
  - `GET  /api/v1/dw/tools` — tools (mcp / function / flow)
  - `GET  /api/v1/dw/traces` — invocation traces

Data sources for this batch are in-memory (see
`mate_tech_dw.repositories.in_memory`). Persistent storage and
cross-service aggregation (mate-app-kb / mate-tech-rag /
mate-tech-agent) land in P2-W5 (TD-6).
