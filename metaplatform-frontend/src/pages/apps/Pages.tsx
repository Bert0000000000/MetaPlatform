import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { appsApi, ontologyApi, type AppPage, type OntologyObject, type OntologyProperty, type OntologyRelation } from "@/lib/api";
import {
  Plus, Search, FileText, Loader2, Trash2, Edit, Wand2,
  Monitor, Smartphone, Tablet, FolderOpen, ChevronRight, ChevronDown, Copy,
  FileCode, FileEdit, LayoutDashboard, Palette, Sparkles,
  Save, RotateCcw, Clock, Hash, X,
  Type, Image, Square, List, Table2, CreditCard, Minus,
  GripVertical, Eye, Settings, Menu, Database, BarChart3,
  GitBranch, FileJson, Layers, BookOpen, Bot,
  Link2, KeyRound, CircleDot, Box, ChevronLeft,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  FormLowCodeEditor, ListPageEditor, ReportEditor, BIEditor,
} from "./editors";
import {
  TYPE_META, COMPONENT_PALETTE, PAGE_TYPE_OPTIONS,
} from "./editors/types";
import { usePageEditor } from "./editors/usePageEditor";
import { EditorShell } from "./editors/EditorShell";
import { ProcessDesignerV2 } from "@/components/flow-designer/ProcessDesignerV2";
import type { PageComponent, PageVersion } from "./editors/types";

/** 分类定义 — 对应截图中的彩色图标分类 */
interface TreeCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;       // tailwind color class
  bgColor: string;     // background color for icon
  typeFilter: string[]; // which page types belong here
  expanded: boolean;
}

/** 分类配置 */
const TREE_CATEGORIES: TreeCategory[] = [
  {
    id: "business-model", label: "业务模型", icon: <Database className="size-3.5" />,
    color: "text-red-500", bgColor: "bg-red-50", typeFilter: [],
    expanded: true,
  },
  {
    id: "forms", label: "表单页面", icon: <FileEdit className="size-3.5" />,
    color: "text-blue-500", bgColor: "bg-blue-50", typeFilter: ["form", "lowcode"],
    expanded: false,
  },
  {
    id: "lists", label: "列表页面", icon: <LayoutDashboard className="size-3.5" />,
    color: "text-green-500", bgColor: "bg-green-50", typeFilter: ["list"],
    expanded: false,
  },
  {
    id: "vue-pages", label: "Vue 页面", icon: <FileJson className="size-3.5" />,
    color: "text-emerald-500", bgColor: "bg-emerald-50", typeFilter: ["vue", "procode"],
    expanded: false,
  },
  {
    id: "workflows", label: "业务流程", icon: <GitBranch className="size-3.5" />,
    color: "text-amber-500", bgColor: "bg-amber-50", typeFilter: ["workflow"],
    expanded: false,
  },
  {
    id: "reports", label: "报表页面", icon: <BarChart3 className="size-3.5" />,
    color: "text-indigo-500", bgColor: "bg-indigo-50", typeFilter: ["report", "dashboard"],
    expanded: false,
  },
  {
    id: "bi", label: "商业智能", icon: <Layers className="size-3.5" />,
    color: "text-violet-500", bgColor: "bg-violet-50", typeFilter: ["bi", "analytics"],
    expanded: false,
  },
];

/* ── State ── */

/** ER 关系图组件 — 纯 HTML/CSS 卡片 + SVG 连线叠加方案 */
function ERDiagram({
  allObjects,
  relations,
  currentEntityId,
  entityNameMap,
  entityPropertiesMap,
}: {
  allObjects: OntologyObject[];
  relations: OntologyRelation[];
  currentEntityId: string;
  entityNameMap: (id: string) => string;
  entityPropertiesMap: Record<string, OntologyProperty[]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [, forceRender] = useState(0);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Filter relations that involve the current entity
  const relevantRelations = relations.filter(
    (r) => r.source_object_id === currentEntityId || r.target_object_id === currentEntityId
  );

  if (relevantRelations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Link2 className="size-6 mb-2 opacity-30" />
        <p className="text-xs">该实体暂无关联关系</p>
      </div>
    );
  }

  // Collect unique entity IDs from relevant relations
  const entityIds = new Set<string>();
  entityIds.add(currentEntityId);
  relevantRelations.forEach((r) => {
    entityIds.add(r.source_object_id);
    entityIds.add(r.target_object_id);
  });
  const uniqueEntities = Array.from(entityIds);

  // Layout constants
  const cardHeaderHeight = 42;
  const fieldRowHeight = 24;
  const cardGap = 40;
  const containerPadding = 40;
  const legendHeight = 120;
  const legendGap = 30;
  const cardsTopY = containerPadding + legendHeight + legendGap;

  // Calculate dynamic card width based on longest field name
  const charWidth = 7.2;
  const cardWidthMap: Record<string, number> = {};
  uniqueEntities.forEach((eid) => {
    const fields = entityPropertiesMap[eid] || [];
    const longestName = fields.reduce((max, f) => Math.max(max, f.name.length), 0);
    cardWidthMap[eid] = Math.max(180, Math.min(280, Math.ceil(longestName * charWidth) + 80));
  });
  const defaultCardWidth = Math.max(...Object.values(cardWidthMap));

  // Calculate card heights (account for collapse state)
  const cardHeights: Record<string, number> = {};
  uniqueEntities.forEach((eid) => {
    const fields = entityPropertiesMap[eid] || [];
    const collapsed = collapsedCards[eid];
    if (collapsed || fields.length === 0) {
      cardHeights[eid] = cardHeaderHeight + 30;
    } else {
      cardHeights[eid] = cardHeaderHeight + 30 + 22 + fields.length * fieldRowHeight + 12;
    }
  });

  // Calculate total dimensions
  const maxCardHeight = Math.max(...Object.values(cardHeights));
  const totalWidth = containerPadding * 2 + uniqueEntities.reduce((sum, eid) => sum + (cardWidthMap[eid] || defaultCardWidth), 0) + (uniqueEntities.length - 1) * cardGap;
  const totalHeight = cardsTopY + maxCardHeight + containerPadding;

  // Initialize positions (horizontal layout) — use per-card widths
  const getEntityPositions = (): Record<string, { x: number; y: number }> => {
    const result: Record<string, { x: number; y: number }> = {};
    let xOffset = containerPadding;
    uniqueEntities.forEach((eid) => {
      const saved = positionsRef.current[eid];
      const cw = cardWidthMap[eid] || defaultCardWidth;
      result[eid] = saved || { x: xOffset, y: cardsTopY };
      xOffset += cw + cardGap;
    });
    return result;
  };
  const entityPositions = getEntityPositions();

  // ─── Drag handlers (HTML div-based, no SVG viewBox scaling) ───
  const handleMouseDown = (eid: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    // No scaling needed — HTML cards are positioned in pixel coordinates directly
    const mouseX = e.clientX - containerRect.left + (containerRef.current?.scrollLeft || 0);
    const mouseY = e.clientY - containerRect.top + (containerRef.current?.scrollTop || 0);
    const curPos = entityPositions[eid];
    draggingRef.current = eid;
    dragOffsetRef.current = { x: mouseX - curPos.x, y: mouseY - curPos.y };

    const onMove = (ev: MouseEvent) => {
      const cr = containerRef.current?.getBoundingClientRect();
      if (!cr || !draggingRef.current) return;
      const mx = ev.clientX - cr.left + (containerRef.current?.scrollLeft || 0);
      const my = ev.clientY - cr.top + (containerRef.current?.scrollTop || 0);
      positionsRef.current = {
        ...positionsRef.current,
        [draggingRef.current]: {
          x: mx - dragOffsetRef.current.x,
          y: my - dragOffsetRef.current.y,
        },
      };
      forceRender((n) => n + 1);
    };
    const onUp = () => {
      draggingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      forceRender((n) => n + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ─── Relation type label ───
  const getRelationLabel = (type: string) => {
    switch (type) {
      case "1:N": case "one_to_many": return "1 : N";
      case "N:1": case "many_to_one": return "N : 1";
      case "N:N": case "many_to_many": return "N : M";
      case "1:1": case "one_to_one": return "1 : 1";
      default: return type;
    }
  };

  // ─── Map field types to Chinese labels ───
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "text": return "短文本";
      case "number": return "数字";
      case "date": return "日期";
      case "datetime": return "日期";
      case "select": return "短文本";
      case "boolean": return "短文本";
      case "reference": return "关联键";
      case "array": return "数组";
      case "enum": return "短文本";
      case "id": return "短文本";
      default: return type;
    }
  };

  // ─── Toggle card collapse ───
  const toggleCollapse = (eid: string) => {
    setCollapsedCards((prev) => ({ ...prev, [eid]: !prev[eid] }));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: totalHeight,
        overflow: "auto",
        cursor: draggingRef.current ? "grabbing" : "default",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ═══════════════════════════════════════════════ */}
      {/* Legend Panel (top-left, HTML div) */}
      {/* ═══════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: containerPadding,
          left: containerPadding,
          zIndex: 10,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderRadius: "8px",
          padding: "12px 14px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          fontSize: "11px",
          lineHeight: "22px",
          color: "#334155",
          userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "11px", color: "#1e293b" }}>图例</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#22c55e" /></svg>
          <span>实体业务模型</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#eab308" /></svg>
          <span>虚拟业务模型</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
            <text x="6" y="6.5" textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#b45309" fontWeight="700">K</text>
          </svg>
          <span>主键</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
            <text x="6" y="6.5" textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#1d4ed8" fontWeight="700">R</text>
          </svg>
          <span>关联键</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* SVG Connection Layer (bezier curves + labels) */}
      {/* ═══════════════════════════════════════════════ */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          overflow: "visible",
        }}
      >
        <defs>
          <marker id="er-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
          <marker id="er-arrow-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
          </marker>
        </defs>

        {relevantRelations.map((rel) => {
          const srcPos = entityPositions[rel.source_object_id];
          const tgtPos = entityPositions[rel.target_object_id];
          if (!srcPos || !tgtPos) return null;

          const srcIdx = uniqueEntities.indexOf(rel.source_object_id);
          const tgtIdx = uniqueEntities.indexOf(rel.target_object_id);

          // Source: right center; Target: left center
          const srcRight = srcIdx <= tgtIdx;
          const srcCW = cardWidthMap[rel.source_object_id] || defaultCardWidth;
          const tgtCW = cardWidthMap[rel.target_object_id] || defaultCardWidth;
          const srcX = srcRight ? srcPos.x + srcCW : srcPos.x;
          const srcY = srcPos.y + cardHeaderHeight / 2;
          const tgtX = srcRight ? tgtPos.x : tgtPos.x + tgtCW;
          const tgtY = tgtPos.y + cardHeaderHeight / 2;

          // Cubic bezier control points
          const cpOffset = Math.min(srcCW, tgtCW) / 2;
          const d = `M ${srcX} ${srcY} C ${srcX + cpOffset} ${srcY}, ${tgtX - cpOffset} ${tgtY}, ${tgtX} ${tgtY}`;

          const midX = (srcX + tgtX) / 2;
          const midY = (srcY + tgtY) / 2;

          const isCurrent = rel.source_object_id === currentEntityId || rel.target_object_id === currentEntityId;
          const lineColor = isCurrent ? "#ef4444" : "#cbd5e1";
          const lineWidth = isCurrent ? 2 : 1.5;
          const dashArray = isCurrent ? "none" : "6,4";

          const label = getRelationLabel(rel.type);
          const labelWidth = Math.max(label.length * 8 + 16, 44);

          return (
            <g key={rel.id}>
              {/* Bezier curve path */}
              <path
                d={d}
                fill="none"
                stroke={lineColor}
                strokeWidth={lineWidth}
                strokeDasharray={dashArray}
                markerEnd={isCurrent ? "url(#er-arrow-active)" : "url(#er-arrow)"}
              />

              {/* Relation type badge */}
              <rect
                x={midX - labelWidth / 2}
                y={midY - 11}
                width={labelWidth}
                height={22}
                rx={11}
                fill="white"
                stroke={isCurrent ? "#fecaca" : "#e2e8f0"}
                strokeWidth={1}
              />
              <text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="600"
                fill={isCurrent ? "#dc2626" : "#64748b"}
              >
                {label}
              </text>

              {/* Relation name label (if present) */}
              {rel.label && (
                <text
                  x={midX}
                  y={midY + 22}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                >
                  {rel.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ═══════════════════════════════════════════════ */}
      {/* HTML Card Layer */}
      {/* ═══════════════════════════════════════════════ */}
      {uniqueEntities.map((eid) => {
        const pos = entityPositions[eid];
        const isCurrent = eid === currentEntityId;
        const name = entityNameMap(eid);
        const fields = entityPropertiesMap[eid] || [];
        const cw = cardWidthMap[eid] || defaultCardWidth;
        const isCollapsed = !!collapsedCards[eid];

        return (
          <div
            key={eid}
            onMouseDown={(e) => handleMouseDown(eid, e)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: cw,
              zIndex: 1,
              background: "#fff",
              border: `1.5px solid ${isCurrent ? "#ef4444" : "#e2e8f0"}`,
              borderRadius: "10px",
              overflow: "hidden",
              boxSizing: "border-box",
              transition: "box-shadow 0.15s ease",
              boxShadow: isCurrent
                ? "0 0 0 3px rgba(239,68,68,0.08), 0 2px 8px rgba(0,0,0,0.06)"
                : "0 1px 4px rgba(0,0,0,0.05)",
              cursor: draggingRef.current === eid ? "grabbing" : "grab",
              userSelect: "none",
            }}
          >
            {/* ── Card Header ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0 14px",
                height: `${cardHeaderHeight}px`,
                background: isCurrent ? "#fef2f2" : "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {/* Database icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isCurrent ? "#ef4444" : "#6366f1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              {/* Entity name */}
              <span
                style={{
                  flex: 1,
                  fontWeight: 700,
                  fontSize: "13px",
                  color: isCurrent ? "#dc2626" : "#1e293b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {name}
              </span>
              {/* Collapse toggle chevron */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleCollapse(eid); }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            {/* ── Fields Section ── */}
            {!isCollapsed && fields.length > 0 && (
              <div>
                {/* Section title: 数据字段 (N) */}
                <div
                  style={{
                    padding: "6px 14px",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "#64748b",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fafbfc",
                    letterSpacing: "0.02em",
                  }}
                >
                  数据字段 ({fields.length})
                </div>

                {/* Field rows */}
                {fields.map((field, fi) => {
                  const isUnique = field.unique_field === 1;
                  const isForeignKey = field.name.endsWith("_id") && field.name !== "id";

                  return (
                    <div
                      key={field.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "0 14px",
                        height: `${fieldRowHeight}px`,
                        borderBottom: fi < fields.length - 1 ? "1px solid #f8fafc" : "none",
                      }}
                    >
                      {/* Field icon */}
                      <span
                        style={{
                          width: "18px",
                          height: "18px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginRight: "6px",
                        }}
                      >
                        {isUnique ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="7.5" cy="15.5" r="5.5" />
                            <path d="m21 2-9.6 9.6" />
                            <path d="m15.5 7.5 3 3L22 7l-3-3" />
                          </svg>
                        ) : isForeignKey ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        ) : (
                          <svg width="6" height="6">
                            <circle cx="3" cy="3" r="2.5" fill="#cbd5e1" />
                          </svg>
                        )}
                      </span>

                      {/* Field name (monospace) */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: "11px",
                          fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
                          color: "#334155",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {field.name}
                      </span>

                      {/* Type label (Chinese) */}
                      <span
                        style={{
                          fontSize: "10px",
                          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                          color: "#94a3b8",
                          marginLeft: "8px",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getTypeLabel(field.type)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Empty state ── */}
            {!isCollapsed && fields.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: "11px",
                  color: "#94a3b8",
                  textAlign: "center",
                }}
              >
                暂无字段
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Pages() {
  const navigate = useNavigate();
  const { appId } = useParams();

  /* ── Page list state ── */
  const [pages, setPages] = useState<AppPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<AppPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appName, setAppName] = useState("应用");
  const [categories, setCategories] = useState<TreeCategory[]>(TREE_CATEGORIES);

  /* ── Editor state ── */
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const editor = usePageEditor(appId, editingPageId);

  /* ── Dialogs ── */
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageType, setNewPageType] = useState("lowcode");
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPage, setDeletingPage] = useState<AppPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Ontology state ── */
  const [ontologyObjects, setOntologyObjects] = useState<OntologyObject[]>([]);
  const [ontologyRelations, setOntologyRelations] = useState<OntologyRelation[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<OntologyObject | null>(null);
  const [entityProperties, setEntityProperties] = useState<OntologyProperty[]>([]);
  const [entityDetailLoading, setEntityDetailLoading] = useState(false);
  const [entityPropertiesMap, setEntityPropertiesMap] = useState<Record<string, OntologyProperty[]>>({});
  const [activeDetailTab, setActiveDetailTab] = useState<"fields" | "er">("fields");

  /* ── Load page list ── */
  const loadPages = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await appsApi.listPages(appId);
      setPages(data || []);
      const app = await appsApi.get(appId);
      setAppName(app?.name || "应用");
      // Load ontology data
      try {
        const [objects, relations] = await Promise.all([
          ontologyApi.listObjects(appId),
          ontologyApi.listRelations(),
        ]);
        setOntologyObjects(objects || []);
        setOntologyRelations(relations || []);
      } catch (e) {
        console.error("加载 ontology 数据失败:", e);
      }
    } catch (err) {
      console.error("加载页面列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  /** 选中数据实体 — 加载属性详情 + 关联实体属性（供 ER 图展示） */
  const handleSelectEntity = useCallback(async (obj: OntologyObject) => {
    setSelectedEntity(obj);
    setSelectedPage(null);
    setEditingPageId(null);
    setEntityDetailLoading(true);
    setActiveDetailTab("fields");
    try {
      const detail = await ontologyApi.getObject(obj.id);
      const props = detail?.properties || [];
      setEntityProperties(props);
      setEntityPropertiesMap((prev) => ({ ...prev, [obj.id]: props }));

      // Also load properties for related entities
      const relatedIds = ontologyRelations
        .filter((r) => r.source_object_id === obj.id || r.target_object_id === obj.id)
        .flatMap((r) => [r.source_object_id, r.target_object_id])
        .filter((id) => id !== obj.id);
      const uniqueRelatedIds = [...new Set(relatedIds)];

      for (const rid of uniqueRelatedIds) {
        if (!entityPropertiesMap[rid]) {
          try {
            const relDetail = await ontologyApi.getObject(rid);
            if (relDetail?.properties) {
              setEntityPropertiesMap((prev) => ({ ...prev, [rid]: relDetail.properties }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.error("加载实体详情失败:", e);
      setEntityProperties([]);
    } finally {
      setEntityDetailLoading(false);
    }
  }, [ontologyRelations, entityPropertiesMap]);

  /** 返回数据模型概览 */
  const handleBackToOverview = useCallback(() => {
    setSelectedEntity(null);
    setEntityProperties([]);
  }, []);

  /** 获取实体名称映射 */
  const entityNameMap = useCallback((id: string) => {
    const obj = ontologyObjects.find(o => o.id === id);
    return obj?.label || obj?.name || id;
  }, [ontologyObjects]);

  /* ── Helpers ── */
  const getPageMeta = (type: string) => {
    const meta = TYPE_META[type];
    if (meta) return meta;
    return { label: type, icon: FileText, color: "text-muted-foreground" as string };
  };
  const renderPageIcon = (type: string, className = "size-3.5") => {
    const IconComp = getPageMeta(type).icon;
    return <IconComp className={className} />;
  };

  const filteredPages = pages.filter(
    (p) => p.name.includes(search) || (TYPE_META[p.type]?.label || "").includes(search)
  );

  /** 切换分类展开/折叠 */
  const toggleCategory = (catId: string) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, expanded: !c.expanded } : c));
  };

  /** 按分类分组页面 — 每个页面只归入第一个匹配的分类 */
  const groupedByCategory = categories.map(cat => ({
    ...cat,
    pages: pages.filter(p => {
      const pageType = p.type || "lowcode";
      return cat.typeFilter.includes(pageType);
    }),
  }));

  /** 未分类的页面 — 不属于任何分类的页面 */
  const categorizedTypeSet = new Set(categories.flatMap(c => c.typeFilter));
  const uncategorizedPages = pages.filter(p => !categorizedTypeSet.has(p.type || "lowcode"));

  /* ── Component operations ── */
  const addComponent = (type: string) => {
    const meta = COMPONENT_PALETTE.find(c => c.type === type);
    const newComp: PageComponent = {
      id: `comp-${Date.now()}`,
      type,
      label: meta?.label || type,
      props: {},
    };
    editor.setComponents(prev => [...prev, newComp]);
    editor.setSelectedCompId(newComp.id);
  };

  const removeComponent = (id: string) => {
    editor.setComponents(prev => prev.filter(c => c.id !== id));
    if (editor.selectedCompId === id) editor.setSelectedCompId(null);
  };

  const updateComponent = (id: string, props: Record<string, any>) => {
    editor.setComponents(prev => prev.map(c => c.id === id ? { ...c, props: { ...c.props, ...props } } : c));
  };

  const moveComponent = (fromIdx: number, toIdx: number) => {
    editor.setComponents(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const selectedComp = editor.components.find(c => c.id === editor.selectedCompId) || null;

  /* ── Page CRUD ── */
  const handleCreatePage = async () => {
    if (!appId || !newPageName.trim()) return;
    setCreating(true);
    try {
      // Create a local page since backend API may not exist
      const localPage: AppPage = {
        id: `local_${Date.now()}`,
        name: newPageName.trim(),
        type: newPageType as string,
        config: {},
        created_at: new Date().toISOString(),
      };
      setPages(prev => [...prev, localPage]);
      setNewPageDialogOpen(false);
      setNewPageName("");
      setNewPageType("lowcode");
      // Navigate to the new page
      setSelectedPage(localPage);
      setEditingPageId(localPage.id);
    } catch (e) { console.error("创建页面失败:", e); }
    finally { setCreating(false); }
  };

  const handleDuplicatePage = async (page: AppPage) => {
    if (!appId) return;
    try {
      await appsApi.createPage(appId, { name: `${page.name} (副本)`, type: page.type, config: page.config });
      await loadPages();
    } catch (e) { console.error("复制页面失败:", e); }
  };

  const handleDeleteClick = (page: AppPage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingPage(page);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!appId || !deletingPage) return;
    setDeleting(true);
    try {
      await appsApi.deletePage(appId, deletingPage.id);
      if (selectedPage?.id === deletingPage.id) {
        setSelectedPage(null);
        setEditingPageId(null);
      }
      await loadPages();
    } catch (e) { console.error("删除页面失败:", e); }
    finally { setDeleting(false); setDeleteDialogOpen(false); setDeletingPage(null); }
  };

  const deviceWidth = editor.device === "desktop" ? "100%" : editor.device === "tablet" ? "768px" : "375px";

  /* ── Render canvas ── */
  const renderCanvas = () => {
    if (editor.components.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
          <LayoutDashboard className="size-10 mb-3 opacity-20" />
          <p className="text-sm">从左侧拖拽组件到此处</p>
          <p className="text-xs mt-1">或点击组件添加</p>
        </div>
      );
    }
    return editor.components.map((comp, idx) => (
      <div key={comp.id}
        draggable
        onDragStart={() => setDraggedType(comp.type)}
        onClick={() => editor.setSelectedCompId(comp.id)}
        className={`group relative p-3 border rounded-md mb-2 cursor-pointer transition-all ${
          editor.selectedCompId === comp.id
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border hover:border-primary/30 hover:bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-medium text-muted-foreground">{comp.label}</span>
            <span className="text-[10px] text-muted-foreground/50 font-mono">{comp.id.slice(-6)}</span>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {idx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); moveComponent(idx, idx - 1); }}
                className="p-0.5 rounded hover:bg-muted text-xs" title="上移">↑</button>
            )}
            {idx < editor.components.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); moveComponent(idx, idx + 1); }}
                className="p-0.5 rounded hover:bg-muted text-xs" title="下移">↓</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive" title="删除">
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs">
          {comp.type === "heading" && <h2 className="text-lg font-bold">{comp.props.text || "标题文本"}</h2>}
          {comp.type === "text" && <p className="text-muted-foreground">{comp.props.text || "这是一段文本内容..."}</p>}
          {comp.type === "button" && <Button size="sm" variant="outline">{comp.props.text || "按钮"}</Button>}
          {comp.type === "input" && <Input placeholder={comp.props.placeholder || "输入框"} className="h-8" />}
          {comp.type === "divider" && <hr className="my-1 border-border" />}
          {comp.type === "container" && <div className="border border-dashed rounded p-4 text-center text-xs text-muted-foreground">容器区域</div>}
          {comp.type === "card" && <div className="border rounded p-3 bg-card text-xs">卡片内容</div>}
          {comp.type === "list" && <div className="text-xs text-muted-foreground space-y-1"><p>• 列表项 1</p><p>• 列表项 2</p><p>• 列表项 3</p></div>}
          {comp.type === "table" && <table className="w-full text-xs border border-border"><thead><tr><th className="border border-border p-1 text-left">列1</th><th className="border border-border p-1 text-left">列2</th></tr></thead><tbody><tr><td className="border border-border p-1">-</td><td className="border border-border p-1">-</td></tr></tbody></table>}
          {comp.type === "image" && <div className="bg-muted h-16 rounded flex items-center justify-center text-xs text-muted-foreground">图片占位</div>}
        </div>
      </div>
    ));
  };

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-0 p-6 h-[calc(100vh-100px)]">
      <PageHeader
        title="页面"
        description="管理应用页面结构"
        action={
          <Button className="gap-2" onClick={() => setNewPageDialogOpen(true)}>
            <Plus className="size-4" /> 新建页面
          </Button>
        }
      />

      <div className="flex flex-1 border rounded-lg overflow-hidden mt-4">
        {/* ── Left: Page Tree Panel (截图风格) ── */}
        <div className="w-72 border-r bg-white flex flex-col">
          {/* Header: 应用搭建 + 菜单图标 */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">应用搭建</span>
            <button className="p-1 rounded hover:bg-muted text-muted-foreground">
              <Menu className="size-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="请输入" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm pr-8 bg-muted/30" />
            </div>
          </div>

          {/* Module Section Header: 模块 + add button */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-xs font-semibold text-muted-foreground">模块</span>
            <button className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="新建模块"
              onClick={() => setNewPageDialogOpen(true)}>
              <Plus className="size-3.5" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FolderOpen className="size-8 mb-2 opacity-30" />
                <p className="text-xs">暂无页面</p>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setNewPageDialogOpen(true)}>
                  <Plus className="size-3 mr-1" /> 创建第一个页面
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Root module node */}
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground">
                  <ChevronDown className="size-3" />
                  <FolderOpen className="size-3.5 text-amber-500" />
                  <span>{appName}</span>
                </div>

                {/* Category groups */}
                {groupedByCategory
                  .filter(cat => cat.pages.length > 0 || cat.id === "business-model" || !search)
                  .map(cat => {
                    const catPages = search
                      ? cat.pages.filter(p => p.name.includes(search))
                      : cat.pages;
                    const isBusinessModel = cat.id === "business-model";
                    const filteredEntities = isBusinessModel
                      ? ontologyObjects.filter(o => !search || o.label.includes(search) || o.name.includes(search))
                      : [];
                    const itemCount = isBusinessModel ? filteredEntities.length : catPages.length;

                    return (
                      <div key={cat.id}>
                        {/* Category header (expandable) */}
                        <div
                          onClick={() => toggleCategory(cat.id)}
                          className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded cursor-pointer text-sm hover:bg-muted/50 transition-colors"
                        >
                          {cat.expanded ? (
                            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                          )}
                          <span className={`${cat.color} shrink-0`}>{cat.icon}</span>
                          <span className="flex-1 text-[13px] font-medium">{cat.label}</span>
                          {itemCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{itemCount}</span>
                          )}
                        </div>

                        {/* Business Model: show ontology objects */}
                        {isBusinessModel && cat.expanded && filteredEntities.length > 0 && (
                          <div className="space-y-0.5">
                            {filteredEntities.map(obj => {
                              const isSelected = selectedEntity?.id === obj.id;
                              return (
                                <div key={obj.id}
                                  onClick={() => handleSelectEntity(obj)}
                                  className={`group flex items-center gap-2 pl-14 pr-2 py-1 rounded cursor-pointer text-[13px] transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted/50 text-foreground"
                                  }`}
                                >
                                  <span className={`shrink-0 ${isSelected ? "text-primary" : "text-red-500"}`}>
                                    <Box className="size-3.5" />
                                  </span>
                                  <span className="flex-1 truncate">{obj.label || obj.name}</span>
                                  <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                                    {obj.properties_count} 字段
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Other categories: show pages (as before) */}
                        {!isBusinessModel && cat.expanded && catPages.length > 0 && (
                          <div className="space-y-0.5">
                            {catPages.map(page => {
                              const meta = getPageMeta(page.type);
                              const isSelected = selectedPage?.id === page.id;
                              return (
                                <div key={page.id}
                                  onClick={() => { setSelectedPage(page); setEditingPageId(page.id); }}
                                  className={`group flex items-center gap-2 pl-14 pr-2 py-1 rounded cursor-pointer text-[13px] transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted/50 text-foreground"
                                  }`}
                                >
                                  <span className={`shrink-0 ${isSelected ? "text-primary" : meta.color}`}>
                                    {renderPageIcon(page.type)}
                                  </span>
                                  <span className="flex-1 truncate">{page.name}</span>
                                  {/* Hover actions */}
                                  <div className={`flex gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPage(page); setEditingPageId(page.id); }}
                                      className="p-0.5 rounded hover:bg-muted" title="编辑">
                                      <Edit className="size-3" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteClick(page, e)}
                                      className="p-0.5 rounded hover:bg-destructive/20 text-destructive" title="删除">
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Uncategorized pages (shown in default category) */}
                {uncategorizedPages.length > 0 && (
                  <div>
                    <div
                      onClick={() => toggleCategory("uncategorized")}
                      className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded cursor-pointer text-sm hover:bg-muted/50 transition-colors"
                    >
                      <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-gray-400 shrink-0"><FileText className="size-3.5" /></span>
                      <span className="flex-1 text-[13px] font-medium">其他页面</span>
                      <span className="text-[10px] text-muted-foreground">{uncategorizedPages.length}</span>
                    </div>
                    {search && uncategorizedPages.map(page => {
                      const meta = getPageMeta(page.type);
                      const isSelected = selectedPage?.id === page.id;
                      return (
                        <div key={page.id}
                          onClick={() => { setSelectedPage(page); setEditingPageId(page.id); }}
                          className={`group flex items-center gap-2 pl-14 pr-2 py-1 rounded cursor-pointer text-[13px] transition-colors ${
                            isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <span className={`shrink-0 ${isSelected ? "text-primary" : meta.color}`}>{renderPageIcon(page.type)}</span>
                          <span className="flex-1 truncate">{page.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Inline Editor ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPage ? (
            <EditorShell
              pageName={editor.pageName}
              onPageNameChange={(name) => { editor.setPageName(name); editor.markDirty(); }}
              pageType={selectedPage.type}
              dirty={editor.dirty}
              currentVersion={editor.currentVersion}
              versions={editor.versions}
              onRestoreVersion={editor.restoreVersion}
              device={editor.device}
              onDeviceChange={editor.setDevice}
              showAI={editor.showAI}
              onToggleAI={() => editor.setShowAI(!editor.showAI)}
              saving={editor.saving}
              onSave={editor.savePage}
            >
              {selectedPage.type === "list" ? (
                <ListPageEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : selectedPage.type === "dashboard" || selectedPage.type === "report" ? (
                <ReportEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : selectedPage.type === "workflow" ? (
                <ProcessDesignerV2 className="flex-1" />
              ) : selectedPage.type === "bi" ? (
                <BIEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : (
                /* Default: form/lowcode */
                <FormLowCodeEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} selectedCompId={editor.selectedCompId} setSelectedCompId={editor.setSelectedCompId} />
              )}
            </EditorShell>
          ) : selectedEntity ? (
            /* ── Entity Detail View ── */
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Entity header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b bg-white shrink-0">
                <button onClick={handleBackToOverview}
                  className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="返回概览">
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-red-50 text-red-500">
                    <Box className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{selectedEntity.label || selectedEntity.name}</h2>
                    <p className="text-xs text-muted-foreground">{selectedEntity.description || "数据实体"}</p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    selectedEntity.status === "active" || selectedEntity.status === "published"
                      ? "bg-green-50 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {selectedEntity.status === "active" || selectedEntity.status === "published" ? "已发布" : selectedEntity.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {entityProperties.length} 个字段
                  </span>
                </div>
              </div>

              {/* Entity content */}
              <div className="flex-1 p-6 space-y-6">
                {entityDetailLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* ── Info Card ── */}
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                        <CircleDot className="size-3" />
                        实体信息
                      </h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">名称</span>
                          <span className="font-medium">{selectedEntity.label || selectedEntity.name}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">标识</span>
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{selectedEntity.name}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">状态</span>
                          <span className="font-medium">{selectedEntity.status === "active" || selectedEntity.status === "published" ? "已发布" : selectedEntity.status}</span>
                        </div>
                        {selectedEntity.description && (
                          <div className="col-span-3">
                            <span className="text-xs text-muted-foreground block mb-1">描述</span>
                            <span className="text-sm">{selectedEntity.description}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Fields & ER Diagram (Tab View) ── */}
                    <div className="border rounded-lg bg-white overflow-hidden">
                      {/* Tab bar */}
                      <div className="flex border-b">
                        <button
                          onClick={() => setActiveDetailTab("fields")}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                            activeDetailTab === "fields"
                              ? "border-primary text-primary bg-primary/5"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          <Table2 className="size-3.5" />
                          字段列表
                          <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">{entityProperties.length}</span>
                        </button>
                        <button
                          onClick={() => setActiveDetailTab("er")}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                            activeDetailTab === "er"
                              ? "border-primary text-primary bg-primary/5"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          <Link2 className="size-3.5" />
                          ER 关系图
                        </button>
                      </div>

                      {/* Tab content */}
                      {activeDetailTab === "fields" ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">字段名</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">中文名</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">类型</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">必填</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">唯一</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entityProperties.map((prop) => (
                              <tr key={prop.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2">
                                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{prop.name}</span>
                                </td>
                                <td className="px-4 py-2 text-sm">{prop.label}</td>
                                <td className="px-4 py-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{prop.type}</span>
                                </td>
                                <td className="px-4 py-2">
                                  {prop.required ? (
                                    <span className="text-xs text-amber-600 font-medium">是</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">否</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {prop.unique_field ? (
                                    <KeyRound className="size-3 text-amber-500" />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {entityProperties.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                  暂无字段数据
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4">
                          <p className="text-[10px] text-muted-foreground mb-2">拖拽实体卡片可自由调整布局</p>
                          <ERDiagram
                            allObjects={ontologyObjects}
                            relations={ontologyRelations}
                            currentEntityId={selectedEntity.id}
                            entityNameMap={entityNameMap}
                            entityPropertiesMap={entityPropertiesMap}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Monitor className="size-12 mb-3 opacity-20" />
              <p className="text-sm">选择左侧页面或数据实体开始</p>
              <p className="text-xs mt-1">或点击「新建页面」创建</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Page Dialog ── */}
      <Dialog open={newPageDialogOpen} onOpenChange={setNewPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建页面</DialogTitle>
            <DialogDescription>选择页面类型并命名</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-page-name">页面名称 *</Label>
              <Input id="new-page-name" value={newPageName} onChange={(e) => setNewPageName(e.target.value)}
                placeholder="如：客户详情页、订单列表" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>页面类型</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAGE_TYPE_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setNewPageType(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg transition-all ${
                      newPageType === t.value ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    }`}>
                    <div className={newPageType === t.value ? "text-primary" : "text-muted-foreground"}>{t.icon}</div>
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={creating}>取消</Button></DialogClose>
            <Button onClick={handleCreatePage} disabled={creating || !newPageName.trim()}>
              {creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Plus className="size-4 mr-1" />}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除页面</DialogTitle>
            <DialogDescription>确定要删除页面「{deletingPage?.name}」吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={deleting}>取消</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
