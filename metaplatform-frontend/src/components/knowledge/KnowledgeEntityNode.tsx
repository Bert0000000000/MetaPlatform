/**
 * KnowledgeEntityNode -- 知识图谱实体节点
 *
 * 与 LineageNode/OntologyObjectNode 不同：圆形节点，更紧凑
 * 设计规范：
 *   - 圆形 r=28 (直径 56px，满足最小点击区)
 *   - 字号 11px 实体名
 *   - 按 type 分色 (entity=蓝, concept=紫, relation=粉)
 *   - hover/selected 加 ring 高亮
 *   - 暗色模式适配
 */

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type KnowledgeEntityType = "entity" | "concept" | "relation";

export const ENTITY_COLORS: Record<
  string,
  { bg: string; ring: string; label: string }
> = {
  entity: { bg: "bg-blue-500", ring: "ring-blue-400", label: "实体" },
  concept: { bg: "bg-primary", ring: "ring-violet-400", label: "概念" },
  relation: { bg: "bg-primary", ring: "ring-pink-400", label: "关系" },
};

export interface KnowledgeEntityNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  selected: boolean;
  dim: boolean;
  /** 可选：节点度数 (知识图谱中心性展示) */
  degree?: number;
}

export function KnowledgeEntityNode({ data }: NodeProps) {
  const d = data as unknown as KnowledgeEntityNodeData;
  const colors = ENTITY_COLORS[d.type] ?? ENTITY_COLORS.entity;
  const displayName = d.name.length > 4 ? d.name.slice(0, 4) : d.name;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !bg-transparent !border-0 !opacity-0"
      />
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-full transition-shadow duration-150",
          "size-14 cursor-pointer select-none shadow-sm",
          colors.bg,
          d.selected && `ring-4 ring-offset-2 ring-offset-background ${colors.ring}`,
          d.dim && "opacity-25",
        )}
        data-testid={`kg-node-${d.id}`}
        role="button"
        aria-label={d.name}
        title={`${d.name} (${colors.label})${d.degree != null ? ` · 度 ${d.degree}` : ""}`}
      >
        {d.degree != null ? (
          <>
            <span className="text-xs font-bold text-white leading-none">{d.degree}</span>
            <span className="text-xs text-white/80 leading-tight mt-0.5 px-1 text-center">{displayName}</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-white text-center leading-tight px-1">
            {displayName}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !bg-transparent !border-0 !opacity-0"
      />
    </>
  );
}
