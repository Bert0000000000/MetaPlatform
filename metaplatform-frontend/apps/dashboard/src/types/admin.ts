// =============================================================================
// 后台管理模块（FR-DASH-006）共享类型
// 与 mate-platform-backend/packages/mate-tech-iam 对齐
// =============================================================================

export type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export type OrgType = "COMPANY" | "DEPARTMENT" | "TEAM" | "VIRTUAL";
export type ConfigCategory =
  | "SSO"
  | "LICENSE"
  | "MESSAGE"
  | "RATE_LIMIT"
  | "SECURITY"
  | "BRANDING"
  | "OTHER";
export type LoginResult = "SUCCESS" | "FAILED" | "LOCKED" | "MFA_REQUIRED";
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ENABLE"
  | "DISABLE"
  | "RESET_PASSWORD"
  | "LOGIN"
  | "LOGOUT"
  | "ASSIGN"
  | "REVOKE"
  | "EXPORT"
  | "CONFIG_CHANGE"
  | "IMPORT"
  | "OTHER";

export interface AdminUser {
  id: number;
  tenantId: string;
  username: string;
  realName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  department?: string | null;
  position?: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  createdAt: string;
  updatedAt: string;
  roleIds: number[];
  roleCodes: string[];
}

export interface AdminRole {
  id: number;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  dataScope: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  permissionCount: number;
  userCount: number;
}

export interface AdminPermission {
  id: number;
  code: string;
  name: string;
  resourceType: string;
  actions: string[];
  description?: string | null;
}

export interface AdminRoleDetail extends AdminRole {
  permissions: AdminPermission[];
}

export interface AdminOrg {
  id: number;
  parentId?: number | null;
  code: string;
  name: string;
  type: OrgType;
  leaderId?: number | null;
  leaderName?: string | null;
  sortOrder: number;
  description?: string | null;
  memberCount: number;
  positionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrgTreeNode extends AdminOrg {
  children: AdminOrgTreeNode[];
}

export interface AdminPosition {
  id: number;
  orgId: number;
  orgName?: string | null;
  code: string;
  name: string;
  level?: string | null;
  description?: string | null;
  holderCount: number;
}

export interface AdminAuditLog {
  id: number;
  actorId: string;
  actorName?: string | null;
  module: string;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  summary?: string | null;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  occurredAt: string;
}

export interface AdminLoginLog {
  id: number;
  username: string;
  result: LoginResult;
  ip?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  failureReason?: string | null;
  occurredAt: string;
}

export interface AdminSystemConfig {
  id: number;
  key: string;
  value: unknown;
  rawValue?: string | null;
  valueType: "string" | "int" | "bool" | "json" | "enum";
  category: ConfigCategory;
  label?: string | null;
  description?: string | null;
  enumOptions: string[];
  isSensitive: boolean;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionMatrixResponse {
  roles: Array<{ id: number; code: string; name: string; isBuiltin: boolean }>;
  resources: string[];
  permissions: AdminPermission[];
  matrix: Array<{ roleId: number; permissionId: number; granted: boolean }>;
}

export interface OpsHealthReport {
  overall: boolean;
  summary: { total: number; healthy: number; down: number };
  components: Array<{
    name: string;
    healthy: boolean;
    detail: string;
    latencyMs: number;
  }>;
}

export interface OpsCapacityResponse {
  services: OpsHealthReport["summary"];
  alerts: { total: number; configured: boolean };
  prometheus: { configured: boolean };
  checkedAt: number;
}

export interface OpsAlertRule {
  alert: string;
  severity: string;
  for: string;
  description: string;
  summary?: string;
}

export interface OpsSelfMetrics {
  processCpuSecondsTotal?: number;
  processResidentMemoryBytes?: number;
  pythonGcObjectsCollectedTotal?: number;
  httpRequestsTotal?: number;
  httpRequestDurationSecondsCount?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  code: number | string;
  message: string;
  data: T;
}