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

// ============ Settings (P3-DASH-10) ============
export type ThemeMode = 'light' | 'dark';

export interface UserSettings {
  language: string;
  timezone: string;
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

export interface ActiveSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
}
