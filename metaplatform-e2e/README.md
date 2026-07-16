# MetaPlatform E2E Integration Test Harness

End-to-end integration test suite for the MetaPlatform nine-layer architecture. Tests all services via their REST APIs using bash scripts with `curl` + `jq`.

## Quick Start

```bash
# 1. Start infrastructure and services
./scripts/start-all.sh

# 2. Run all E2E tests
./scripts/run-e2e.sh

# 3. Stop services
./scripts/stop-all.sh
```

## Prerequisites

- Docker and Docker Compose v2
- `curl` and `jq` in PATH
- Bash 4+ (Git Bash on Windows)
- All application JARs/binaries pre-built

## Directory Structure

```
metaplatform-e2e/
├── .env                            # Unified port mapping and config
├── .gitignore
├── README.md
├── scripts/
│   ├── init-multi-db.sh            # PostgreSQL multi-database init
│   ├── wait-for-healthy.sh         # Health check poller
│   ├── start-all.sh                # Start all services
│   ├── stop-all.sh                 # Stop all services
│   └── run-e2e.sh                  # One-click test runner
└── e2e/
    ├── shell/
    │   ├── _common.sh              # Shared test helper library
    │   ├── s01_platform_base.sh    # Multi-tenant / RBAC / Audit
    │   ├── s02_ai_substrate.sh     # LLM Gateway / Embedding / Context
    │   ├── s03_business_object.sh  # ObjectType + Instance lifecycle
    │   ├── s04_page_generator.sh   # Schema-to-UI auto-generation
    │   ├── s05_process_automation.sh # Workflow DSL + execution
    │   ├── s06_rag_mdm.sh         # RAG knowledge + MDM golden records
    │   ├── s07_dialogue.sh         # Conversation + intent routing
    │   ├── s08_capability_library.sh # Atomic capabilities + pipeline
    │   └── s09_full_chain.sh       # Full cross-service integration
    └── fixtures/
        ├── process-dsl.json        # Process definition DSL test data
        ├── test-document.txt       # Document for RAG upload test
        └── customer-object-type.json # ObjectType definition fixture
```

## Port Allocation

All ports are defined in `.env`. Default mapping:

| Service             | Port | Layer |
|---------------------|------|-------|
| Ontology Engine     | 8080 | L2-2  |
| Data Stack          | 8081 | L2-3  |
| Platform Base       | 8082 | L2-1  |
| AI Substrate        | 8083 | L2-4  |
| Page Generator      | 8084 | L1-3  |
| Dialogue            | 8085 | L1-4  |
| Capability Library  | 8086 | L1-5  |
| Process Engine      | 8087 | L1-6  |
| RAG/MDM             | 8090 | L1-7  |
| PostgreSQL          | 5432 | Infra |
| Redis               | 6379 | Infra |
| Kafka               | 9092 | Infra |
| Neo4j (HTTP/Bolt)   | 7474/7687 | Infra |

## Test Scenarios

| # | Scenario | What it tests |
|---|----------|---------------|
| S01 | Platform Base | Create tenant, create role, verify audit log |
| S02 | AI Substrate | LLM chat, embedding, context session, billing |
| S03 | Business Object | ObjectType CRUD, instance creation, lifecycle transition |
| S04 | Page Generator | Schema-to-UI generation (TABLE/FORM), templates |
| S05 | Process Automation | DSL definition, instance start, task completion, history |
| S06 | RAG/MDM | Knowledge base, document upload, semantic search, golden records |
| S07 | Dialogue | Conversation creation, message send, intent listing, export |
| S08 | Capability Library | List capabilities, execute validation, pipeline CRUD |
| S09 | Full Chain | Cross-service chain: all 9 services in sequence |

## Running Individual Scenarios

```bash
# Run a single scenario
bash e2e/shell/s01_platform_base.sh

# Run specific scenarios via the runner
./scripts/run-e2e.sh s01 s03 s09

# List all available scenarios
./scripts/run-e2e.sh --list

# Debug mode (verbose HTTP logging)
DEBUG=1 bash e2e/shell/s02_ai_substrate.sh
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/init-multi-db.sh` | Creates all 9 PostgreSQL databases. Mount as docker-entrypoint-initdb.d |
| `scripts/wait-for-healthy.sh` | Polls health endpoints for all or specific services |
| `scripts/start-all.sh` | Starts infrastructure containers + application services |
| `scripts/stop-all.sh` | Stops all containers. Use `--clean` to also remove volumes |
| `scripts/run-e2e.sh` | One-click runner: start services, run tests, produce report |

## Test Results

Results are saved to `e2e/results/e2e-YYYYMMDD-HHMMSS.log` with full stdout from every scenario plus a summary.

## Adapting to Your Environment

1. Copy `.env` to `.env.local` and override ports/hosts as needed
2. Ensure application JARs are built before running tests
3. The tests gracefully handle partial availability (warn instead of fail when a service is not yet implemented)
4. For services not yet deployed, the test scripts will report warnings but continue with remaining steps

## Database Initialization

The `scripts/init-multi-db.sh` script creates these databases in a single PostgreSQL instance:

- `platform_base` — Multi-tenant / RBAC / Audit
- `ai_substrate` — LLM Gateway / Embedding / Billing
- `ontology_meta` — Ontology Engine metadata
- `data_stack` — Data Stack metadata
- `page_generator` — Page/Form Generator configs
- `dialogue` — Conversations / Messages / Intents
- `capability` — Capability Library / Pipelines
- `process_engine` — Process definitions / instances / tasks
- `rag_mdm` — Documents / Knowledge / Golden Records
