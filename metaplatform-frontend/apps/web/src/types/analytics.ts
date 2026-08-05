/**
 * UV / PV / 申请 数据看板共享类型
 * 路径：/admin/analytics
 * 与后端 mate-tech-analytics 域 Pydantic schema 字段保持一致（snake_case）
 */

// ============================================================
// 总览
// ============================================================

/** 单指标在「今日 / 7 日 / 30 日」三档下的取值 */
export interface MetricTriple {
  today: number;
  last7d: number;
  last30d: number;
}

/** UV / PV 总览汇总 */
export interface UvPvSummary {
  uv: MetricTriple;
  pv: MetricTriple;
  pvPerUv: MetricTriple; // PV / UV 比值
  checkedAt: string; // ISO 8601
}

/** 申请相关总览 */
export interface ApplicationSummary {
  applicationsToday: number;
  applicationsLast7d: number;
  applicationsLast30d: number;
  approvedRate: number; // 0-1，通过率
  approvedRateDelta: number; // 与上一周期相比的百分点变化（0.01 = +1pp）
  approvalDurationHours: number; // 平均审批耗时（小时）
  checkedAt: string;
}

// ============================================================
// 趋势（按天，30 天）
// ============================================================

/** 一天一个采样点 */
export interface UvPvTrendPoint {
  date: string; // YYYY-MM-DD
  uv: number;
  pv: number;
  applications: number;
}

/** 申请单独的趋势，字段更精简 */
export interface ApplicationTrendPoint {
  date: string; // YYYY-MM-DD
  submitted: number;
  approved: number;
  rejected: number;
}

// ============================================================
// 漏斗（访问 -> Demo -> 表单 -> 申请）
// ============================================================

export interface FunnelStep {
  key: 'visit' | 'demo_click' | 'form_fill' | 'application_submit';
  label: string;
  value: number;
  /** 与上一阶段的转化率（0-1），第一阶段固定为 1 */
  conversion: number;
}

// ============================================================
// 来源 / 地域 / 设备 分布
// ============================================================

export type DistributionDimension = 'source' | 'region' | 'device';

export interface DistributionItem {
  key: string; // 维度取值，如 'google'、'北京'、'mobile'
  label: string; // 中文展示名
  value: number; // UV / PV 数值
  /** 占比 0-1 */
  ratio: number;
}

/** 三个维度打包返回 */
export interface DistributionResponse {
  source: DistributionItem[];
  region: DistributionItem[];
  device: DistributionItem[];
  checkedAt: string;
}

// ============================================================
// 时间范围
// ============================================================

export type AnalyticsRange = 'today' | '7d' | '30d';
