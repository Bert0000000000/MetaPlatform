/**
 * LineageNode —— 自定义血缘节点
 *
 * 设计原则 (MetaPlatform 设计系统: compact minimal enterprise)
 *   - 圆角 --radius-md (6px)
 *   - 字号 text-xs (12px) 名称 / text-[10px] 类型 chip
 *   - 间距 8/12px
 *   - 节点宽度 168px，与 React Flow 推荐的 150-200 一致
 *   - 激活态：border-primary (token化) + shadow
 *   - 异常态：右上角 8px 红点 ring
 *   - 流入流出 handle 用 css 注入 primary
 */

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Database,
  GitMerge,
  LayoutGrid as TableIcon,
  BarChart3,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LineageNodeType = "source" | "etl" | "table" | "metric" | "dashboard";

export const LINEAGE_ICON: Record<LineageNodeType, React.ComponentType<{ className?: string }>> = {
  source: Database,
  etl: GitMerge,
  table: TableIcon,
  metric: BarChart3,
  dashboard: Eye,
};

export const LINEAGE_LABEL: Record<LineageNodeType, string> = {
  source: "数据源",
  etl: "ETL",
  table: "数据表",
  metric: "指标",
  dashboard: "看板",
};

/** 色卡与设计系统的 token 对齐，hover/active/dim 由 .lineage-node* 类控制 */
const NODE_STYLE: Record<LineageNodeType, { bg: string; border: string; text: string; accent: string }> = {
  source: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    accent: "ring-blue-500/30",
  },
  etl: {
    bg: "bg-primary dark:bg-primary/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    accent: "ring-orange-500/30",
  },
  table: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-300",
    accent: "ring-green-500/30",
  },
  metric: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-300",
    accent: "ring-purple-500/30",
  },
  dashboard: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    accent: "ring-red-500/30",
  },
};

export interface LineageNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  type: LineageNodeType;
  description: string;
  status: "active" | "inactive" | "error";
  selected: boolean;
  dim: boolean;
  filtered: boolean;
}

export function CustomLineageNode({ data }: NodeProps) {
  const d = data as unknown as LineageNodeData;
  const Icon = LINEAGE_ICON[d.type];
  const style = NODE_STYLE[d.type];

  return (
    <>
      {/* 流入 handle - 左侧 */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-primary !border-2 !border-background"
      />

      <div
        className={cn(
          "lineage-node relative w-[168px] min-h-[56px] px-3 py-2 border rounded-md cursor-pointer select-none bg-white dark:bg-card",
          "flex flex-col gap-1 shadow-sm",
          style.border,
          d.selected && `${style.accent} ring-2 selected`,
          d.dim && "dim",
          d.status === "error" && "error",
          // 过滤掉的时候不显示
          !d.filtered && "opacity-30 saturate-50",
        )}
        data-testid={`lineage-node-${d.id}`}
        role="button"
        aria-label={d.name}
      >
        <div className="flex items-center gap-2">
          <div className={cn("flex-none size-5 rounded-sm grid place-items-center", style.bg)}>
            <Icon className={cn("size-3.5", style.text)} />
          </div>
          <span className="flex-1 text-xs font-medium text-foreground truncate" title={d.name}>
            {d.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pl-[26px]">
          <span className={cn("inline-flex items-center text-xs font-normal", style.text)}>
            {LINEAGE_LABEL[d.type]}
          </span>
          {d.status === "inactive" && (
            <span className="text-xs text-muted-foreground">· 已停用</span>
          )}
        </div>
      </div>

      {/* 流出 handle - 右侧 */}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-primary !border-2 !border-background"
      />
    </>
  );
}
