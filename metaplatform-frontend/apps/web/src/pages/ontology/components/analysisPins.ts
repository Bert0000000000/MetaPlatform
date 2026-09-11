// analysisPins - 分析工作台 → 仪表盘的 Pin 存储（L6，Quiver → Carbon 对位）。
//
// 「Pin 到仪表盘」= 纯前端 localStorage 持久化（key: ont-analysis-pins）；
// 仪表盘读取后按 config 重新调 object-query 聚合，渲染实时迷你卡片
// （不存渲染结果，只存查询配置 —— 数据始终最新）。

import type { ChartType } from './ChartSvg';

export const ANALYSIS_PINS_KEY = 'ont-analysis-pins';

/** 单条 Pin 的查询配置（与 POST /object-query 聚合入参一一对应）。 */
export interface AnalysisPinConfig {
  /** ObjectType rid（object-query source）。 */
  source: string;
  /** 分组字段 slug 短键。 */
  dimension: string;
  /** 度量字段 slug 短键；count * 时为空串。 */
  metric: string;
  /** 聚合函数 sum/count/avg/min/max。 */
  fn: string;
  /** 图表形态 bar/pie/line。 */
  chartType: ChartType;
}

export interface AnalysisPin {
  id: string;
  title: string;
  config: AnalysisPinConfig;
  created_at?: string;
}

function isPin(v: unknown): v is AnalysisPin {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<AnalysisPin>;
  return typeof p.id === 'string'
    && typeof p.title === 'string'
    && !!p.config
    && typeof (p.config as AnalysisPinConfig).source === 'string'
    && typeof (p.config as AnalysisPinConfig).dimension === 'string';
}

/** 读取全部 Pin（损坏 / 非法条目自动丢弃）。 */
export function readAnalysisPins(): AnalysisPin[] {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_PINS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPin);
  } catch {
    return [];
  }
}

/** 追加一条 Pin（最新在前）并返回完整记录。 */
export function saveAnalysisPin(pin: Omit<AnalysisPin, 'id' | 'created_at'>): AnalysisPin {
  const item: AnalysisPin = {
    ...pin,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  const pins = readAnalysisPins();
  pins.unshift(item);
  window.localStorage.setItem(ANALYSIS_PINS_KEY, JSON.stringify(pins));
  return item;
}

/** 按 id 移除一条 Pin。 */
export function removeAnalysisPin(id: string): void {
  const next = readAnalysisPins().filter((p) => p.id !== id);
  window.localStorage.setItem(ANALYSIS_PINS_KEY, JSON.stringify(next));
}
