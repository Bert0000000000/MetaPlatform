/**
 * 本体引擎 — 全局事件总线 (in-memory pub/sub)
 *
 * 设计要点:
 *  - 单例: 跨 React 组件订阅同一条事件流
 *  - 类型安全: 通过 `EventMap` 强约束 event payload
 *  - 不依赖后端: 完全 in-memory, 适合 mock / 演示 / 离线开发
 *  - 跨页面: 多 tab 同时订阅, 触发后所有订阅者实时更新
 *
 * 业务事件 (purchasing P2P 场景):
 *  - object.created / object.updated  : 对象实例变化 (新 PR / PO / 收货)
 *  - action.executed                  : 动作执行 (提交审批 / 转 PO)
 *  - rule.triggered / rule.violated   : 规则触发 (超阈值 / 库存不足)
 *  - workflow.started / .step / .done : 服务编排生命周期
 *  - alert.raised                     : 业务告警 (需关注)
 *
 * 用法:
 *   bus.on('action.executed', (e) => console.log(e));
 *   bus.emit('action.executed', { actionId, name, result });
 *   bus.off('action.executed', handler);
 */
import { useEffect, useState } from "react";

export type ObjectKind =
  | "Supplier"        // 供应商
  | "PurchaseRequest" // 采购申请 (PR)
  | "PurchaseOrder"   // 采购订单 (PO)
  | "GoodsReceipt"    // 收货单 (GR)
  | "Invoice"         // 发票
  | "Payment";        // 付款

export type EventLevel = "info" | "success" | "warning" | "error";

export interface OntologyEvent {
  id: string;                  // ULID-like
  ts: number;                  // Date.now()
  type:
    | "object.created"
    | "object.updated"
    | "object.deleted"
    | "action.executed"
    | "rule.triggered"
    | "rule.violated"
    | "workflow.started"
    | "workflow.step"
    | "workflow.completed"
    | "alert.raised";
  level: EventLevel;
  message: string;             // 人读描述
  payload?: Record<string, unknown>;
}

type Handler = (e: OntologyEvent) => void;

class EventBus {
  private subs: Map<OntologyEvent["type"] | "*", Set<Handler>> = new Map();
  private history: OntologyEvent[] = [];
  private maxHistory = 200;

  on(type: OntologyEvent["type"] | "*", h: Handler): () => void {
    if (!this.subs.has(type)) this.subs.set(type, new Set());
    this.subs.get(type)!.add(h);
    return () => this.off(type, h);
  }

  off(type: OntologyEvent["type"] | "*", h: Handler) {
    this.subs.get(type)?.delete(h);
  }

  emit(e: Omit<OntologyEvent, "id" | "ts">) {
    const evt: OntologyEvent = {
      ...e,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
    };
    this.history.unshift(evt);
    if (this.history.length > this.maxHistory) this.history.pop();
    // 类型订阅
    this.subs.get(evt.type)?.forEach((h) => h(evt));
    // 全部订阅
    this.subs.get("*")?.forEach((h) => h(evt));
    return evt;
  }

  /** 当前事件历史 (新 → 旧) */
  getHistory(): OntologyEvent[] {
    return this.history;
  }

  /** 清空历史 (调试用) */
  clear() {
    this.history = [];
  }
}

export const ontologyBus = new EventBus();

/** React hook: 订阅指定 type 的事件, 组件 unmount 自动 off */
export function useOntologyEvents(
  type: OntologyEvent["type"] | "*",
  onEvent?: (e: OntologyEvent) => void,
): OntologyEvent[] {
  const [events, setEvents] = useState<OntologyEvent[]>(ontologyBus.getHistory());
  useEffect(() => {
    const off = ontologyBus.on(type, (e) => {
      setEvents(ontologyBus.getHistory());
      onEvent?.(e);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  return events;
}

/** 简易 level -> Tailwind class 映射 */
export const LEVEL_CLS: Record<EventLevel, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-primary text-amber-700 dark:bg-primary/30 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/** 事件 type -> 中文 label */
export const TYPE_LABEL: Record<OntologyEvent["type"], string> = {
  "object.created": "新建对象",
  "object.updated": "更新对象",
  "object.deleted": "删除对象",
  "action.executed": "执行动作",
  "rule.triggered": "规则触发",
  "rule.violated": "规则违反",
  "workflow.started": "流程开始",
  "workflow.step": "流程步骤",
  "workflow.completed": "流程完成",
  "alert.raised": "业务告警",
};
