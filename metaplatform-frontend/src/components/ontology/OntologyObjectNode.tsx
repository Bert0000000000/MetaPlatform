/**
 * OntologyObjectNode —— 本体对象节点 (E-R 关系图)
 *
 * 较 LineageNode 更"信息密度高"：
 *   - 标题 (name)
 *   - 描述 (description)
 *   - 角标 (properties / actions / rules 计数)
 *   - 右上角打开详情按钮
 *   - 流入流出 Handle 走 React Flow 标准
 *
 * 设计规范 token：
 *   - 圆角 --radius-md (6px)
 *   - 字号 12px / 10px
 *   - 激活/聚焦 border-primary；hover 上抬 1px 阴影
 */

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ExternalLink, Database, Box } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OntologyObjectNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  label: string;
  description?: string;
  properties_count: number;
  actions_count: number;
  rules_count: number;
  status: string;
  selected: boolean;
  dim: boolean;
  onOpenDetail: (id: string) => void;
}

export function OntologyObjectNode({ data }: NodeProps) {
  const d = data as unknown as OntologyObjectNodeData;
  const isActive = d.status === "active";
  const Icon = isActive ? Database : Box;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-primary !border-2 !border-background"
      />
      <div
        className={cn(
          "lineage-node group relative w-[180px] min-h-[68px] px-3 py-2 border rounded-md cursor-grab select-none",
          "flex flex-col gap-1 bg-white dark:bg-card shadow-sm",
          isActive ? "border-slate-200 dark:border-slate-700" : "border-amber-200 dark:border-amber-700",
          d.selected && "ring-2 ring-primary selected",
          d.dim && "dim",
        )}
        data-testid={`ontology-object-node-${d.id}`}
        role="button"
        aria-label={d.name}
      >
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "flex-none size-5 rounded-sm grid place-items-center",
              isActive ? "bg-blue-50 dark:bg-blue-950/30" : "bg-primary dark:bg-primary/30",
            )}
          >
            <Icon className={cn("size-3.5", isActive ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate" title={d.name}>
              {d.name}
            </div>
            <div className="text-xs text-muted-foreground truncate" title={d.label}>
              {d.label}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onOpenDetail(d.id);
            }}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "flex-none size-5 grid place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            title="查看对象详情"
            aria-label={`打开 ${d.name} 详情`}
          >
            <ExternalLink className="size-3" />
          </button>
        </div>
        {d.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 leading-tight">{d.description}</div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>属性 {d.properties_count}</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>动作 {d.actions_count}</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>规则 {d.rules_count}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-primary !border-2 !border-background"
      />
    </>
  );
}
