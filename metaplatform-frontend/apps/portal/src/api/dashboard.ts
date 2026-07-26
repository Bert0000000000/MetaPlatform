// 工作台页面 API 客户端
// 数据来源：BFF at /api/v1/dashboard/page/*
// 后端表：metaplatform_dashboard.dashboard_page_*

import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1/dashboard',
  timeout: 10000,
});

/**
 * 响应处理：兼容两种返回格式
 * - 包装式：{ code: 0, message: "success", data: <payload> }（项目约定 ApiResponse.success）
 * - 直返式：<payload>（APP-DASHBOARD 当前控制器风格）
 * 业务码非 0 时抛错。
 */
async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await client.get(url, { params });
  const body = res.data;
  if (body && typeof body === 'object' && 'code' in body) {
    const code = (body as { code: unknown }).code;
    const isOk =
      code === 0 ||
      code === '0' ||
      code === 'SUCCESS' ||
      code === '200' ||
      code === 200;
    if (!isOk) {
      const msg = (body as { message?: string }).message;
      throw new Error(msg || 'API error: ' + url);
    }
    return (body as { data: T }).data;
  }
  // 直返式（无 code 包装）
  return body as T;
}

// ============ 类型定义（与 BFF 返回对齐） ============

export interface DashboardStat {
  label: string;
  value: string;
  trend_label: string | null;
  trend_value: string | null;
  trend_up: boolean;
  icon: string;
}

export interface RecentTask {
  name: string;
  type_label: string;
  type_class: string;
  agent: string;
  status: string;
  status_class: string;
  time: string;
}

export interface RecentTaskPage {
  items: RecentTask[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SystemHealthItem {
  dot_class: string;
  name: string;
  detail: string;
  status: string;
}

export interface ActiveAgent {
  dot_class: string;
  name: string;
  type: string;
  tasks: number;
  status_bg: string;
  status_color: string;
  status_label: string;
}

export interface QuickLink {
  id: string;
  label: string;
  icon: string;
  link: string;
}

export interface DashboardSummary {
  stats: DashboardStat[];
  recentTasks: RecentTask[];
  systemHealth: SystemHealthItem[];
  activeAgents: ActiveAgent[];
  quickLinks: QuickLink[];
  /** 后端 summary 接口返回的总任务数（用于分页显示） */
  recentTasksTotal?: number;
}

// ============ 子页面类型定义 ============

export interface MyAppItem {
  name: string;
  type: string;
  type_label: string;
  description: string;
  last_used: string | null;
  date: string | null;
  usage: string | null;
  icon: string;
  pinned: boolean;
}

export interface MyAgentItem {
  name: string;
  type: string;
  type_label: string;
  status: string;
  status_class: string;
  description: string;
  tasks: number;
  success_rate: number;
  icon: string;
}

export interface AgentExecLogItem {
  log_id: string;
  agent: string;
  agent_id: string;
  exec_time: string;
  duration: string;
  status: string;
  status_class: string;
  dot_class: string;
  trigger: string;
  tokens: string;
}

export interface MessageItem {
  msg_id: string;
  sender: string;
  avatar_class: string;
  icon: string | null;
  title: string;
  summary: string;
  time: string;
  priority: string;
  unread: boolean;
  attachments: number;
}

export interface PortalItem {
  name: string;
  kind: string;            // 'internal' | 'external'
  description: string;
  icon: string;
  visits: number;
  last_visit: string;
  url: string;
}

export interface DeliverableItem {
  name: string;
  type_label: string;
  type_class: string;
  project: string;
  gen_class: string;       // 'ai' | 'human'
  gen_name: string;
  format: string;
  size: string;
  date: string;
  status: string;
  status_class: string;
  icon: string;
}

export interface DeliverableTimelineItem {
  time_label: string;
  title: string;
  description: string;
  icon: string;
}

export interface DeliverableSummary {
  deliverables: DeliverableItem[];
  timeline: DeliverableTimelineItem[];
}

// ============ API 调用 ============

/** 一次拉所有数据（推荐：减少 waterfall）。 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  return getData<DashboardSummary>('/page/summary');
}

/** 单独：统计卡片 */
export async function getStats(): Promise<DashboardStat[]> {
  return getData<DashboardStat[]>('/page/stats');
}

/** 单独：最近任务（分页） */
export async function getRecentTasks(page = 1, pageSize = 10): Promise<RecentTaskPage> {
  return getData<RecentTaskPage>('/page/recent-tasks', { page, pageSize });
}

/** 单独：系统健康 */
export async function getSystemHealth(): Promise<SystemHealthItem[]> {
  return getData<SystemHealthItem[]>('/page/system-health');
}

/** 单独：活跃数字员工 */
export async function getActiveAgents(): Promise<ActiveAgent[]> {
  return getData<ActiveAgent[]>('/page/active-agents');
}

/** 单独：快捷入口 */
export async function getQuickLinks(): Promise<QuickLink[]> {
  return getData<QuickLink[]>('/page/quick-links');
}

/** 我的应用列表 */
export async function getMyApps(): Promise<MyAppItem[]> {
  return getData<MyAppItem[]>('/myapps');
}

/** 我的数字员工列表 */
export async function getMyAgents(): Promise<MyAgentItem[]> {
  return getData<MyAgentItem[]>('/myagents');
}

/** 数字员工执行日志 */
export async function getAgentExecLogs(): Promise<AgentExecLogItem[]> {
  return getData<AgentExecLogItem[]>('/myagents/logs');
}

/** 消息列表 */
export async function getMessages(): Promise<MessageItem[]> {
  return getData<MessageItem[]>('/messages');
}

/** 门户列表（可按 kind 过滤：internal / external） */
export async function getPortals(kind?: 'internal' | 'external'): Promise<PortalItem[]> {
  return getData<PortalItem[]>('/portal', kind ? { kind } : undefined);
}

/** 交付材料 + 时间线 聚合 */
export async function getDeliverablesSummary(): Promise<DeliverableSummary> {
  return getData<DeliverableSummary>('/deliverables/summary');
}