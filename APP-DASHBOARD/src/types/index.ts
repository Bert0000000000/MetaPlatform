export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Approval (P3-DASH-02) ============
export type TaskStatus = 'pending' | 'completed' | 'rejected' | 'cancelled';

export interface ApprovalTask {
  taskId: string;
  title: string;
  applicant: string;
  applicantId: string;
  flowName: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  comment?: string;
}

// ============ Digital Worker (P3-DASH-03) ============
export interface WorkerStatus {
  employeeId: string;
  name: string;
  code: string;
  roleCategory: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  runningTasks: number;
  completedToday: number;
  lastActiveAt?: string;
}

// ============ Metrics (P3-DASH-05) ============
export interface MetricCard {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  trendUp: boolean;
  icon: string;
}

export interface MetricTrendPoint {
  time: string;
  value: number;
  apiCalls: number;
  errors: number;
}

export type TimeRange = '1h' | '24h' | '7d' | '30d';

// ============ Notification (P3-DASH-04, 06) ============
export type NotificationType = 'approval' | 'task' | 'system' | 'mention' | 'alert';
export type NotificationReadStatus = 'all' | 'unread' | 'read';

/**
 * 通知分类筛选 Tab（V14-02）。
 * - all：全部
 * - system：系统（system + mention）
 * - workflow：流程（approval + task）
 * - alert：告警（alert）
 */
export type NotificationCategory = 'all' | 'system' | 'workflow' | 'alert';

/** 将底层 NotificationType 映射到通知面板分类 Tab。 */
export function categorizeNotification(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'system':
    case 'mention':
      return 'system';
    case 'approval':
    case 'task':
      return 'workflow';
    case 'alert':
      return 'alert';
    default:
      return 'all';
  }
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationSettings {
  approval: boolean;
  task: boolean;
  system: boolean;
  mention: boolean;
  alert: boolean;
  email: boolean;
  push: boolean;
}

// ============ Deliverables (P3-DASH-08, 09) ============
export type DeliverableType = 'report' | 'task_output' | 'schedule_summary' | 'analysis';
export type DeliverableFormat = 'pdf' | 'json' | 'markdown';

export interface Deliverable {
  id: string;
  type: DeliverableType;
  title: string;
  source: string;
  description: string;
  format: DeliverableFormat;
  status: 'ready' | 'generating' | 'failed';
  size: number;
  createdAt: string;
  createdBy: string;
  downloadUrl?: string;
}

// ============ Global Search (P3-DASH-07) ============
export type SearchCategory = 'app' | 'knowledge' | 'ontology' | 'task';

export interface SearchResult {
  category: SearchCategory;
  id: string;
  title: string;
  description: string;
  link: string;
}

// ============ Shortcut (V14-01) ============
export interface ShortcutItem {
  id: string;
  title: string;
  icon: string;
  link: string;
  color: string;
}

// ============ Settings (P3-DASH-10) ============
// theme: 'light' | 'dark' | 'system'。'system' 跟随操作系统 prefers-color-scheme。
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserSettings {
  language: string;
  timezone: string;
  /** Preferred date/time format pattern, e.g. "YYYY-MM-DD HH:mm:ss". */
  dateFormat: string;
  defaultPage: string;
  theme: ThemeMode;
  layout: string[];
}

export interface ApiToken {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

// ============ AIOps (V15-07) ============
export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AnomalyStatus = 'OPEN' | 'ANALYZING' | 'RESOLVED';
export type AnomalyMetricType = 'ERROR_RATE' | 'P99_LATENCY' | 'ERROR_CODE';
export type RemediationMode = 'ADVISE' | 'AUTO';

export interface AnomalyEvent {
  id: string;
  ruleId: string;
  anomalyType: AnomalyMetricType;
  severity: AnomalySeverity;
  serviceName: string;
  traceId?: string;
  metricValue: number;
  rootCause?: string;
  remediationAction?: string;
  status: AnomalyStatus;
  detectedAt: string;
  resolvedAt?: string;
}

export interface AnomalyDetectionRule {
  id: string;
  name: string;
  metricType: AnomalyMetricType;
  conditionOperator: string;
  threshold: number;
  timeWindowSeconds: number;
  aggregationFunction: string;
  severity: AnomalySeverity;
  enabled: boolean;
}

export interface RootCauseAnalysisResult {
  conclusion: string;
  suggestedAction: string;
  relatedLogs: Array<{
    timestamp: string;
    serviceName: string;
    level: string;
    traceId?: string;
    message?: string;
  }>;
  relatedMetrics: Record<string, number>;
}

export interface RemediationResult {
  executed: boolean;
  actionCode: string;
  actionName: string;
  message: string;
  executionId?: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
}

// ============ Current User (V12-04 个人中心) ============
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  realName?: string;
  tenantId: string;
  roles: string[];
  departments: Array<{
    departmentId: string;
    departmentCode?: string;
    departmentName?: string;
    isPrimary?: boolean;
  }>;
  permissions: Array<{
    permissionId?: string;
    permissionCode?: string;
    permissionName?: string;
    resourceType?: string;
  }>;
}

export interface UserPermissionDetail {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  resourceType: string;
  actions: string[];
  effect: 'ALLOW' | 'DENY';
}

export interface UserRoleSummary {
  roleId: string;
  roleCode: string;
  roleName: string;
  dataScope: 'ALL' | 'DEPT' | 'DEPT_AND_SUB' | 'SELF' | 'CUSTOM';
}

export interface UserPermissions {
  userId: string;
  tenantId: string;
  permissionCodes: string[];
  permissions: UserPermissionDetail[];
  roles: UserRoleSummary[];
}
