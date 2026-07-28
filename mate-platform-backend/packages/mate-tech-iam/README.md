# mate-tech-iam

TECH-IAM (Identity & Access Management) admin service.

Provides admin APIs for the management dashboard (FR-DASH-006-01~05):

- User CRUD, status, password reset, CSV import, login logs
- Role CRUD, user-role binding, permission matrix
- Organization tree, positions, reporting, transfer
- Audit log query and export
- System configuration (SSO, LICENSE, message, rate limit, security)

## Endpoints

All endpoints are exposed under `/api/v1/admin/*` and require a platform admin
caller (`PLATFORM_ADMIN`, `PLATFORM_ADMIN_VIEWER`, or `ROLE_PLATFORM_ADMIN`).