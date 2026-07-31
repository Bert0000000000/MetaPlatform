# MetaPlatform Unified OpenAPI Spec

This directory contains the **unified OpenAPI 3.1 schema** that merges all
MetaPlatform app packages' FastAPI routers into a single document.

## Files

| File | Description |
|------|-------------|
| `openapi.json` | Generated unified OpenAPI spec (do not edit manually) |

## Regenerating the spec

```bash
# From mate-platform-backend/
$env:INSECURE_SKIP_SIGNATURE="1"
$env:KEYCLOAK_URL="http://localhost:8080"
$env:SERVICE_CLIENT_SECRET="test-secret"
python scripts/generate_openapi.py
```

The script prints a summary of total paths, operations per HTTP method, and
operations per tag.

## Viewing the spec

### Swagger UI / Redoc (online)

Upload `openapi.json` to any of these:

- [Swagger Editor](https://editor.swagger.io/)
- [Redocly](https://redocly.com/redoc)

### Local viewers

```bash
# Swagger UI via npx
npx @redocly/cli preview-docs docs/api/openapi.json

# Or serve with Python
python -m http.server 8080 --directory docs/api
# Then open http://localhost:8080/openapi.json in Swagger Editor
```

### FastAPI docs (per-service)

Each individual service also exposes its own Swagger UI at `/docs` and
ReDoc at `/redoc` when running.

## API structure (tags → packages)

| Tag(s) | Package | Prefix |
|--------|---------|--------|
| `copilot` | `mate-app-copilot` | `/api/v1/copilot` |
| `a2a` | `mate-app-a2a` | `/api/v1/a2a` |
| `arch` | `mate-app-arch` | `/api/v1/arch` |
| `apphub` | `mate-app-hub` | `/api/v1/apphub` |
| `kb`, `kb-deprecated` | `mate-app-kb` | `/api/v1/kb`, `/api/v1/app-kb` |
| `iam-auth` | `mate-tech-iam` | `/api/v1/iam` |
| `dashboard` | `mate-tech-iam` | `/api/v1/dashboard` |
| `admin-users`, `admin-orgs`, `admin-permissions`, `admin-logs`, `admin-configs` | `mate-tech-iam` | `/api/v1/admin/*` |

## Notes

- The unified spec is for documentation and client-generation purposes only.
  At runtime, each service runs independently behind the API gateway.
- The `kb-deprecated` tag marks legacy `/api/v1/app-kb/*` paths that are
  deprecated aliases of the canonical `/api/v1/kb/*` paths.
