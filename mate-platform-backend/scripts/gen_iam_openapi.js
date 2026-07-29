const fs = require('fs');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, '..', 'packages', 'mate-tech-iam', 'openapi', 'iam.yaml');
const P = [];
P.push(`openapi: 3.1.0
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
`);

P.push(`paths:
  /healthz:
    get:
      summary: Liveness probe
      tags: [meta]
      security: []
      responses:
        "200": {description: OK}
  /readyz:
    get:
      summary: Readiness (DB ping)
      tags: [meta]
      security: []
      responses:
        "200": {description: OK}
  /api/v1/iam/auth/login:
    post:
      summary: Username + password (bcrypt) -> access + refresh JWT
      tags: [iam-auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          description: Bad credentials or disabled user
  /api/v1/iam/auth/refresh:
    post:
      summary: Exchange refresh token for new pair
      tags: [iam-auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: {type: string}
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          description: Invalid or non-refresh token
  /api/v1/iam/auth/logout:
    post:
      summary: Logout (bump updated_at; best-effort)
      tags: [iam-auth]
      responses:
        "200": {description: OK}
        "401": {description: Missing Bearer token}
  /api/v1/iam/auth/me:
    get:
      summary: Current user (inline bearer parse)
      tags: [iam-auth]
      responses:
        "200": {description: OK}
        "401": {description: Bad token}
        "404": {description: User not found}
  /api/v1/iam/sso-providers:
    get:
      summary: List SSO providers (empty by default)
      tags: [iam-auth]
      security: []
      parameters:
        - {in: query, name: page,         schema: {type: integer, default: 1}}
        - {in: query, name: size,         schema: {type: integer, default: 100}}
        - {in: query, name: keyword,      schema: {type: string}}
        - {in: query, name: enabled_only, schema: {type: boolean, default: false}}
      responses:
        "200": {description: OK}
`);

P.push(`  /api/v1/admin/users:
    get:
      summary: List users (paginated, filterable)
      tags: [admin-users]
      parameters:
        - {in: query, name: keyword,    schema: {type: string}}
        - {in: query, name: status,     schema: {$ref: "#/components/schemas/UserStatus"}}
        - {in: query, name: department, schema: {type: string}}
        - {in: query, name: role_id,    schema: {type: integer}}
        - {in: query, name: page,       schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize,   schema: {type: integer, minimum: 1, maximum: 200, default: 20}}
      responses:
        "200": {description: OK}
        "403": {description: Not platform admin}
    post:
      summary: Create user
      tags: [admin-users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UserCreate"
      responses:
        "201": {description: Created}
        "409": {description: Username already exists}
  /api/v1/admin/users/import:
    post:
      summary: Bulk import users from CSV
      tags: [admin-users]
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: "CSV header: username,real_name,email,phone,department,position,password,status"
      responses:
        "200": {description: OK}
  /api/v1/admin/users/export:
    get:
      summary: Export users as CSV
      tags: [admin-users]
      responses:
        "200":
          description: text/csv stream
          content:
            text/csv: {}
  /api/v1/admin/users/{user_id}:
    parameters:
      - {in: path, name: user_id, required: true, schema: {type: integer}}
    get:
      summary: Get one user
      tags: [admin-users]
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    put:
      summary: Update user
      tags: [admin-users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UserUpdate"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    delete:
      summary: Delete user (cascades UserRole)
      tags: [admin-users]
      responses:
        "200": {description: OK}
        "403": {description: Trying to delete super admin without super admin caller}
        "404": {description: Not found}
  /api/v1/admin/users/{user_id}/reset-password:
    parameters:
      - {in: path, name: user_id, required: true, schema: {type: integer}}
    post:
      summary: Reset password (returns new temporary password)
      tags: [admin-users]
      responses:
        "200": {description: "OK, body includes temporary_password"}
        "404": {description: Not found}
  /api/v1/admin/users/{user_id}/status:
    parameters:
      - {in: path, name: user_id, required: true, schema: {type: integer}}
    post:
      summary: Enable / disable user
      tags: [admin-users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status:
                  $ref: "#/components/schemas/UserStatus"
      responses:
        "200": {description: OK}
        "403": {description: Disable super admin without super admin caller}
        "404": {description: Not found}
  /api/v1/admin/users/{user_id}/verify-password:
    parameters:
      - {in: path, name: user_id, required: true, schema: {type: integer}}
    post:
      summary: Verify a plaintext password against the stored hash
      tags: [admin-users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password]
              properties:
                password: {type: string}
      responses:
        "200": {description: "OK, body { matched: bool }"}
        "404": {description: User not found or no password set}
  /api/v1/admin/users/{user_id}/login-logs:
    parameters:
      - {in: path, name: user_id, required: true, schema: {type: integer}}
    get:
      summary: Recent login logs for a user
      tags: [admin-users]
      parameters:
        - {in: query, name: page,     schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize, schema: {type: integer, minimum: 1, maximum: 200, default: 20}}
      responses:
        "200": {description: OK}
        "404": {description: Not found}
`);

P.push(`  /api/v1/admin/orgs/tree:
    get:
      summary: Org tree (root -> children)
      tags: [admin-orgs]
      responses:
        "200": {description: OK}
  /api/v1/admin/orgs:
    get:
      summary: List orgs (paginated)
      tags: [admin-orgs]
      parameters:
        - {in: query, name: keyword,  schema: {type: string}}
        - {in: query, name: type,     schema: {type: string, enum: [DEPARTMENT, COMPANY, TEAM, VIRTUAL]}}
        - {in: query, name: page,     schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize, schema: {type: integer, minimum: 1, maximum: 200, default: 20}}
      responses:
        "200": {description: OK}
    post:
      summary: Create org
      tags: [admin-orgs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/OrgCreate"
      responses:
        "201": {description: Created}
  /api/v1/admin/orgs/{org_id}:
    parameters:
      - {in: path, name: org_id, required: true, schema: {type: integer}}
    put:
      summary: Update org
      tags: [admin-orgs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/OrgUpdate"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    delete:
      summary: Delete org (rejected when children exist)
      tags: [admin-orgs]
      responses:
        "200": {description: OK}
        "409": {description: Children / positions still exist}
        "404": {description: Not found}
  /api/v1/admin/orgs/positions:
    get:
      summary: List positions
      tags: [admin-orgs]
      parameters:
        - {in: query, name: org_id,    schema: {type: integer}}
        - {in: query, name: page,      schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize,  schema: {type: integer, minimum: 1, maximum: 200, default: 20}}
      responses:
        "200": {description: OK}
    post:
      summary: Create position
      tags: [admin-orgs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PositionCreate"
      responses:
        "201": {description: Created}
  /api/v1/admin/orgs/positions/{position_id}:
    parameters:
      - {in: path, name: position_id, required: true, schema: {type: integer}}
    put:
      summary: Update position
      tags: [admin-orgs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PositionUpdate"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    delete:
      summary: Delete position (rejected when employees still attached)
      tags: [admin-orgs]
      responses:
        "200": {description: OK}
        "409": {description: Holders still attached}
        "404": {description: Not found}
  /api/v1/admin/orgs/transfer:
    post:
      summary: Transfer an employee to a target org/position
      tags: [admin-orgs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/TransferPayload"
      responses:
        "200": {description: OK}
        "404": {description: User or target org not found}
        "409": {description: Target org has no position}
`);

P.push(`  /api/v1/admin/permissions/roles:
    get:
      summary: List roles
      tags: [admin-permissions]
      parameters:
        - {in: query, name: keyword,  schema: {type: string}}
        - {in: query, name: page,     schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize, schema: {type: integer, minimum: 1, maximum: 200, default: 20}}
      responses:
        "200": {description: OK}
    post:
      summary: Create role
      tags: [admin-permissions]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RoleCreate"
      responses:
        "201": {description: Created}
        "409": {description: Role code already exists}
  /api/v1/admin/permissions/roles/{role_id}:
    parameters:
      - {in: path, name: role_id, required: true, schema: {type: integer}}
    get:
      summary: Role + permission detail
      tags: [admin-permissions]
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    put:
      summary: Update role
      tags: [admin-permissions]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RoleUpdate"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    delete:
      summary: Delete role (rejected if users still assigned)
      tags: [admin-permissions]
      responses:
        "200": {description: OK}
        "409": {description: Role still has assignments}
        "404": {description: Not found}
  /api/v1/admin/permissions/catalog:
    get:
      summary: Permission catalog (resource + actions)
      tags: [admin-permissions]
      responses:
        "200": {description: OK}
  /api/v1/admin/permissions/assign:
    post:
      summary: Assign permissions to a user or a role
      tags: [admin-permissions]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AssignPayload"
      responses:
        "200": {description: OK}
        "400": {description: bad type/role_ids combination}
  /api/v1/admin/permissions/matrix:
    get:
      summary: Role x permission matrix
      tags: [admin-permissions]
      parameters:
        - {in: query, name: role_id, schema: {type: integer}}
      responses:
        "200": {description: OK}
  /api/v1/admin/logs/audit:
    get:
      summary: Audit log query
      tags: [admin-logs]
      parameters:
        - {in: query, name: actor,         schema: {type: string}}
        - {in: query, name: module,        schema: {type: string}}
        - {in: query, name: action,        schema: {$ref: "#/components/schemas/AuditAction"}}
        - {in: query, name: resource_type, schema: {type: string}}
        - {in: query, name: resource_id,   schema: {type: string}}
        - {in: query, name: start,         schema: {type: string, format: date-time}}
        - {in: query, name: end,           schema: {type: string, format: date-time}}
        - {in: query, name: page,          schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize,      schema: {type: integer, minimum: 1, maximum: 500, default: 50}}
      responses:
        "200": {description: OK}
  /api/v1/admin/logs/audit/export:
    get:
      summary: Export audit log (csv | json), max 50000 rows
      tags: [admin-logs]
      parameters:
        - {in: query, name: actor,   schema: {type: string}}
        - {in: query, name: module,  schema: {type: string}}
        - {in: query, name: action,  schema: {$ref: "#/components/schemas/AuditAction"}}
        - {in: query, name: start,   schema: {type: string, format: date-time}}
        - {in: query, name: end,     schema: {type: string, format: date-time}}
        - {in: query, name: fmt,     schema: {type: string, enum: [csv, json], default: csv}}
      responses:
        "200":
          description: text/csv | application/json stream
  /api/v1/admin/logs/audit/{log_id}:
    parameters:
      - {in: path, name: log_id, required: true, schema: {type: integer}}
    get:
      summary: Audit log detail
      tags: [admin-logs]
      responses:
        "200": {description: OK}
        "404": {description: Not found}
  /api/v1/admin/logs/modules:
    get:
      summary: Distinct module/action counts (for filter UI)
      tags: [admin-logs]
      responses:
        "200": {description: OK}
  /api/v1/admin/configs:
    get:
      summary: List system configs
      tags: [admin-configs]
      parameters:
        - {in: query, name: category,  schema: {$ref: "#/components/schemas/ConfigCategory"}}
        - {in: query, name: keyword,   schema: {type: string}}
        - {in: query, name: page,      schema: {type: integer, minimum: 1, default: 1}}
        - {in: query, name: pageSize,  schema: {type: integer, minimum: 1, maximum: 200, default: 50}}
      responses:
        "200": {description: OK}
  /api/v1/admin/configs/categories:
    get:
      summary: Distinct category counts
      tags: [admin-configs]
      responses:
        "200": {description: OK}
  /api/v1/admin/configs/{key}:
    parameters:
      - {in: path, name: key, required: true, schema: {type: string}}
    put:
      summary: Update a system config (with audit)
      tags: [admin-configs]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ConfigUpdate"
      responses:
        "200": {description: OK}
        "400": {description: Bad key or value not in enum}
        "404": {description: Not found}
`);

P.push(`  /api/v1/dashboard/auth/login:
    post:
      summary: "Workbench login (DEV: returns synthetic tokens, NOT real IAM)"
      tags: [dashboard]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: {type: string, minLength: 1}
                password: {type: string, minLength: 1}
                tenantId: {type: string}
      responses:
        "200": {description: OK}
        "400": {description: Missing username or password}
  /api/v1/dashboard/profile:
    get:
      summary: Current user profile (synthetic)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/profile/permissions:
    get:
      summary: Aggregated permissions (synthetic)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/settings:
    get:
      summary: Get user preferences
      tags: [dashboard]
      parameters:
        - {in: query, name: userId, schema: {type: string}}
      responses:
        "200": {description: OK}
    put:
      summary: Update user preferences
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SettingsUpdate"
      responses:
        "200": {description: OK}
  /api/v1/dashboard/sessions:
    get:
      summary: Active sessions (synthetic)
      tags: [dashboard]
      parameters:
        - {in: query, name: userId, schema: {type: string}}
      responses:
        "200": {description: OK}
  /api/v1/dashboard/sessions/{session_id}:
    parameters:
      - {in: path, name: session_id, required: true, schema: {type: string}}
    delete:
      summary: Revoke session
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/api-keys:
    get:
      summary: List API keys (synthetic)
      tags: [dashboard]
      parameters:
        - {in: query, name: tenantId, schema: {type: string}}
        - {in: query, name: page,     schema: {type: integer, default: 0}}
        - {in: query, name: size,     schema: {type: integer, default: 100}}
      responses:
        "200": {description: OK}
    post:
      summary: Create API key
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ApiKeyCreate"
      responses:
        "200": {description: OK}
  /api/v1/dashboard/api-keys/{api_key_id}:
    parameters:
      - {in: path, name: api_key_id, required: true, schema: {type: string}}
    delete:
      summary: Revoke API key
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/notifications:
    get:
      summary: List notifications (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/notifications/unread-count:
    get:
      summary: Unread notification count
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/notifications/{notification_id}/read:
    parameters:
      - {in: path, name: notification_id, required: true, schema: {type: string}}
    put:
      summary: Mark one notification read
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/notifications/read-all:
    post:
      summary: Mark all notifications read
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/notifications/settings:
    get:
      summary: Get notification preferences
      tags: [dashboard]
      responses:
        "200": {description: OK}
    put:
      summary: Update notification preferences
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NotificationSettingsUpdate"
      responses:
        "200": {description: OK}
  /api/v1/dashboard/metrics:
    get:
      summary: Metric cards (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/metrics/trend:
    get:
      summary: Metric trend (in-memory)
      tags: [dashboard]
      parameters:
        - {in: query, name: metric, schema: {type: string}}
        - {in: query, name: range,  schema: {type: string}}
      responses:
        "200": {description: OK}
  /api/v1/dashboard/todos:
    get:
      summary: Pending todos (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/todos/done:
    get:
      summary: Done todos (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/todos/{task_id}/action:
    parameters:
      - {in: path, name: task_id, required: true, schema: {type: string}}
    post:
      summary: Approve / reject todo
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/TodoActionRequest"
      responses:
        "200": {description: OK}
  /api/v1/dashboard/workers:
    get:
      summary: List digital workers (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/deliverables:
    get:
      summary: List deliverables (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
  /api/v1/dashboard/deliverables/{deliverable_id}/download:
    parameters:
      - {in: path, name: deliverable_id, required: true, schema: {type: string}}
    post:
      summary: Generate a one-shot download URL
      tags: [dashboard]
      requestBody:
        required: false
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DownloadRequest"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
  /api/v1/dashboard/deliverables/{deliverable_id}:
    parameters:
      - {in: path, name: deliverable_id, required: true, schema: {type: string}}
    delete:
      summary: Delete deliverable
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/anomalies:
    get:
      summary: List anomaly events (in-memory)
      tags: [dashboard]
      parameters:
        - {in: query, name: status, schema: {type: string, enum: [OPEN, ANALYZING, RESOLVED]}}
      responses:
        "200": {description: OK}
  /api/v1/dashboard/anomalies/{anomaly_id}:
    parameters:
      - {in: path, name: anomaly_id, required: true, schema: {type: string}}
    get:
      summary: Anomaly detail
      tags: [dashboard]
      responses:
        "200": {description: OK}
        "404": {description: Not found}
  /api/v1/dashboard/anomalies/{anomaly_id}/analyze:
    parameters:
      - {in: path, name: anomaly_id, required: true, schema: {type: string}}
    post:
      summary: RCA (synthetic)
      tags: [dashboard]
      responses:
        "200": {description: OK}
        "404": {description: Not found}
  /api/v1/dashboard/anomalies/{anomaly_id}/remediate:
    parameters:
      - {in: path, name: anomaly_id, required: true, schema: {type: string}}
    post:
      summary: Trigger remediation (synthetic; mode=AUTO executes, mode=ADVISE suggests)
      tags: [dashboard]
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                mode: {type: string, enum: [AUTO, ADVISE], default: ADVISE}
                actionCode: {type: string}
      responses:
        "200": {description: OK}
        "404": {description: Not found}
  /api/v1/dashboard/anomaly-rules:
    get:
      summary: List anomaly detection rules (in-memory)
      tags: [dashboard]
      responses:
        "200": {description: OK}
    post:
      summary: Create anomaly rule
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AnomalyRuleCreate"
      responses:
        "200": {description: Created}
  /api/v1/dashboard/anomaly-rules/{rule_id}:
    parameters:
      - {in: path, name: rule_id, required: true, schema: {type: string}}
    put:
      summary: Update anomaly rule
      tags: [dashboard]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AnomalyRuleCreate"
      responses:
        "200": {description: OK}
        "404": {description: Not found}
    delete:
      summary: Delete anomaly rule
      tags: [dashboard]
      responses:
        "204": {description: No Content}
  /api/v1/dashboard/search:
    get:
      summary: Global search (in-memory index)
      tags: [dashboard]
      parameters:
        - {in: query, name: keyword, schema: {type: string}}
      responses:
        "200": {description: OK}
`);

P.push(`components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    LoginRequest:
      type: object
      required: [username, password]
      properties:
        username: {type: string}
        password: {type: string}
        tenantId: {type: string, nullable: true}
    AuthResponse:
      type: object
      required: [accessToken, refreshToken, userId, username, user]
      properties:
        loginResult: {type: string, default: SUCCESS}
        userId: {type: string}
        username: {type: string}
        realName: {type: string, nullable: true}
        accessToken: {type: string}
        refreshToken: {type: string}
        tokenType: {type: string, default: Bearer}
        expiresIn: {type: integer}
        refreshExpiresIn: {type: integer}
        requirePasswordReset: {type: boolean}
        mfaRequired: {type: boolean}
        user:
          $ref: "#/components/schemas/UserInfo"
        loginAt: {type: string, format: date-time}
        loginIp: {type: string, nullable: true}
    UserInfo:
      type: object
      required: [id, username]
      properties:
        id: {type: string}
        username: {type: string}
        email: {type: string, nullable: true}
        realName: {type: string, nullable: true}
        status: {type: string, nullable: true}
    UserStatus:
      type: string
      enum: [ACTIVE, DISABLED, LOCKED]
    UserCreate:
      type: object
      required: [username]
      properties:
        username: {type: string, minLength: 2, maxLength: 64}
        real_name: {type: string, nullable: true}
        email: {type: string, nullable: true}
        phone: {type: string, nullable: true}
        department: {type: string, nullable: true}
        position: {type: string, nullable: true}
        password: {type: string, minLength: 8, maxLength: 128, nullable: true}
        status:
          $ref: "#/components/schemas/UserStatus"
        is_super_admin: {type: boolean, default: false}
        role_ids:
          type: array
          items: {type: integer}
    UserUpdate:
      type: object
      properties:
        real_name: {type: string, nullable: true}
        email: {type: string, nullable: true}
        phone: {type: string, nullable: true}
        department: {type: string, nullable: true}
        position: {type: string, nullable: true}
        avatar: {type: string, nullable: true}
        status:
          $ref: "#/components/schemas/UserStatus"
        is_super_admin: {type: boolean, nullable: true}
        role_ids:
          type: array
          nullable: true
          items: {type: integer}
    OrgCreate:
      type: object
      required: [code, name]
      properties:
        parent_id: {type: integer, nullable: true}
        code: {type: string, minLength: 1, maxLength: 64}
        name: {type: string, minLength: 1, maxLength: 128}
        type: {type: string, enum: [DEPARTMENT, COMPANY, TEAM, VIRTUAL], default: DEPARTMENT}
        leader_id: {type: integer, nullable: true}
        sort_order: {type: integer, default: 0}
        description: {type: string, nullable: true, maxLength: 512}
    OrgUpdate:
      type: object
      properties:
        parent_id: {type: integer, nullable: true}
        name: {type: string, nullable: true}
        type: {type: string, enum: [DEPARTMENT, COMPANY, TEAM, VIRTUAL], nullable: true}
        leader_id: {type: integer, nullable: true}
        sort_order: {type: integer, nullable: true}
        description: {type: string, nullable: true}
    PositionCreate:
      type: object
      required: [org_id, code, name]
      properties:
        org_id: {type: integer}
        code: {type: string, minLength: 1, maxLength: 64}
        name: {type: string, minLength: 1, maxLength: 128}
        level: {type: string, nullable: true}
        description: {type: string, nullable: true}
    PositionUpdate:
      type: object
      properties:
        name: {type: string, nullable: true}
        level: {type: string, nullable: true}
        description: {type: string, nullable: true}
    TransferPayload:
      type: object
      required: [user_id, target_org_id]
      properties:
        user_id: {type: integer}
        target_org_id: {type: integer}
        target_position_id: {type: integer, nullable: true}
        reports_to: {type: integer, nullable: true}
        reason: {type: string, nullable: true}
    RoleCreate:
      type: object
      required: [code, name]
      properties:
        code: {type: string, minLength: 2, maxLength: 64}
        name: {type: string, minLength: 1, maxLength: 128}
        description: {type: string, nullable: true}
        data_scope: {type: string, enum: [ALL, DEPT, DEPT_AND_SUB, SELF, CUSTOM], default: SELF}
        permission_ids:
          type: array
          items: {type: integer}
    RoleUpdate:
      type: object
      properties:
        name: {type: string, nullable: true}
        description: {type: string, nullable: true, maxLength: 8192}
        data_scope: {type: string, enum: [ALL, DEPT, DEPT_AND_SUB, SELF, CUSTOM], nullable: true}
        permission_ids:
          type: array
          nullable: true
          items: {type: integer}
    AssignPayload:
      type: object
      required: [type, target_id]
      properties:
        type: {type: string, enum: [user, role]}
        target_id: {type: integer}
        permission_ids:
          type: array
          items: {type: integer}
        role_ids:
          type: array
          nullable: true
          description: required when type=user
          items: {type: integer}
    AuditAction:
      type: string
      enum: [CREATE, UPDATE, DELETE, ENABLE, DISABLE, RESET_PASSWORD, LOGIN, LOGOUT, IMPORT, EXPORT, CONFIG_CHANGE]
    ConfigCategory:
      type: string
      enum: [GENERAL, SECURITY, INTEGRATION, NOTIFICATION, BILLING, AI]
    ConfigUpdate:
      type: object
      required: [value]
      properties:
        value: {}
        note: {type: string, nullable: true, maxLength: 512}
    SettingsUpdate:
      type: object
      properties:
        userId: {type: string, nullable: true}
        language: {type: string, nullable: true}
        timezone: {type: string, nullable: true}
        dateFormat: {type: string, nullable: true}
        defaultPage: {type: string, nullable: true}
        theme: {type: string, nullable: true}
        layout:
          type: array
          nullable: true
          items: {type: string}
    NotificationSettingsUpdate:
      type: object
      properties:
        userId: {type: string, nullable: true}
        approval: {type: boolean, nullable: true}
        task: {type: boolean, nullable: true}
        system: {type: boolean, nullable: true}
        mention: {type: boolean, nullable: true}
        alert: {type: boolean, nullable: true}
        email: {type: boolean, nullable: true}
        push: {type: boolean, nullable: true}
    ApiKeyCreate:
      type: object
      required: [name]
      properties:
        tenantId: {type: string, default: tenant-default}
        name: {type: string}
        userId: {type: string, nullable: true}
        scopes:
          type: array
          items: {type: string}
        expiresAt: {type: string, format: date-time, nullable: true}
    DownloadRequest:
      type: object
      required: [format]
      properties:
        format: {type: string}
    TodoActionRequest:
      type: object
      required: [action]
      properties:
        action: {type: string, enum: [approve, reject]}
        comment: {type: string, nullable: true}
    AnomalyRuleCreate:
      type: object
      required: [name, metricType, conditionOperator, threshold, timeWindowSeconds, aggregationFunction, severity]
      properties:
        name: {type: string}
        metricType: {type: string}
        conditionOperator: {type: string}
        threshold: {type: number}
        timeWindowSeconds: {type: integer}
        aggregationFunction: {type: string}
        severity: {type: string, enum: [INFO, WARNING, CRITICAL]}
        enabled: {type: boolean, default: true}
`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, P.join(''), 'utf8');
let raw = fs.readFileSync(out);
if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) { fs.writeFileSync(out, raw.slice(3)); }
console.log('wrote', out, 'bytes', fs.statSync(out).size);
