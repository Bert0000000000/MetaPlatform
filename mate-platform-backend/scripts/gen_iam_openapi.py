
parts = []

parts.append("""openapi: 3.1.0
info:
  title: mate-tech-iam
  version: 0.1.0
  description: |
    TECH-IAM admin service. Owns:
      /api/v1/iam/*         auth flows (login/refresh/logout/me/sso-providers)
      /api/v1/admin/users/* user CRUD + import + export + status + reset pw + login logs
      /api/v1/admin/orgs/*  org tree, position CRUD, transfer
      /api/v1/admin/permissions/* role CRUD, permission catalog, role-permission matrix, assign
      /api/v1/admin/logs/*  audit log query + export
      /api/v1/admin/configs/* system config get/update + category list
      /api/v1/dashboard/*   workbench dashboard BFF
    All /api/v1/admin/* and dashboard endpoints require:
      Authorization: Bearer <JWT>  (signed with IAM_DEV_JWT_SECRET by default)
      X-Tenant-Id: <tenant>
      role gate enforced by services/deps.py:require_admin
servers:
  - url: http://localhost:8102
    description: local dev
  - url: http://mate-tech-iam:8102
    description: docker compose
tags:
  - name: iam-auth
  - name: admin-users
  - name: admin-orgs
  - name: admin-permissions
  - name: admin-logs
  - name: admin-configs
  - name: dashboard
  - name: meta
security:
  - bearerAuth: []
""")
