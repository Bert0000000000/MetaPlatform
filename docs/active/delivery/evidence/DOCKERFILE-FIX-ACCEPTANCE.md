# Dockerfile runtime dependency fix — acceptance evidence

> Status: **Accepted**
> Commit: `677a8697`

## Scope

The auth-service image now includes the runtime dependencies required by its
IAM routes and the mate-tech-ont image includes the workspace kernel and
PostgreSQL driver required by the v2 runtime.

## Evidence

- `mate-platform-backend/services/auth-service/Dockerfile` adds the auth
  service runtime dependencies and uses the configured package mirror.
- `mate-platform-backend/packages/mate-tech-ont/Dockerfile` includes
  `mate_kernel` and `psycopg2-binary`.
- The runtime smoke test changes are included in the same commit and are
  covered by the existing Docker acceptance workflow.

This file records the acceptance evidence for the Program Board Dockerfile
fix row; it does not assert that a production image has been deployed.
