import type React from "react";
import {
  FileEdit, LayoutDashboard, BarChart3, GitBranch, Layers,
  Palette, FileCode, Sparkles, Type, FileText, Square, List,
  Table2, CreditCard, Minus, Image, Wand2,
} from "lucide-react";

/* ── Interfaces ── */

/** 页面组件定义 */
export interface PageComponent {
  id: string;
  type: string;
  label: string;
  props: Record<string, any>;
  children?: PageComponent[];
  span?: number;
}

/** 版本历史记录 */
export interface PageVersion {
  version: number;
  timestamp: string;
  components: PageComponent[];
}

/** 所有编辑器共有的 props */
export interface BaseEditorProps {
  components: PageComponent[];
  setComponents: React.Dispatch<React.SetStateAction<PageComponent[]>>;
  setDirty: (dirty: boolean) => void;
}

/** 带选中组件的编辑器 props */
export interface FormEditorProps extends BaseEditorProps {
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
}

/** ListPageEditor 配置 */
export interface ListPageConfig {
  supportSearch: boolean;
  includeChildren: boolean;
  selectLevel: "all" | "children" | "leaf";
  defaultExpand: "all" | "level1" | "none";
  expandLevel: number;
}

export type PageType = "form" | "list" | "dashboard" | "report" | "workflow" | "bi" | "custom" | "lowcode" | "procode" | "ai";

/* ── Type Meta ── */

export interface PageTypeInfo {
  label: string;
  icon: any;
  color: string;
}

export const TYPE_META: Record<string, PageTypeInfo> = {
  form:      { label: "表单页面", icon: FileEdit,         color: "text-blue-500" },
  list:      { label: "列表页面", icon: LayoutDashboard,  color: "text-green-500" },
  dashboard: { label: "仪表盘",   icon: BarChart3,        color: "text-purple-500" },
  report:    { label: "报表页面", icon: BarChart3,        color: "text-indigo-500" },
  workflow:  { label: "业务流程", icon: GitBranch,        color: "text-amber-500" },
  bi:        { label: "商业智能", icon: Layers,           color: "text-violet-500" },
  custom:    { label: "自定义",   icon: Palette,          color: "text-orange-500" },
  lowcode:   { label: "LowCode",  icon: Palette,          color: "text-blue-500" },
  procode:   { label: "ProCode",  icon: FileCode,         color: "text-emerald-500" },
  ai:        { label: "AI 生成",  icon: Sparkles,         color: "text-purple-500" },
};

/* ── Page Type Options (for new page dialog) ── */

export const PAGE_TYPE_OPTIONS = [
  { value: "list",      label: "列表页面", icon: <LayoutDashboard className="size-4" />, color: "text-green-500" },
  { value: "form",      label: "表单页面", icon: <FileEdit className="size-4" />,        color: "text-blue-500" },
  { value: "lowcode",   label: "LowCode",  icon: <Palette className="size-4" />,         color: "text-blue-500" },
  { value: "dashboard", label: "仪表盘",   icon: <BarChart3 className="size-4" />,       color: "text-purple-500" },
  { value: "report",    label: "报表页面", icon: <BarChart3 className="size-4" />,       color: "text-indigo-500" },
  { value: "workflow",  label: "业务流程", icon: <GitBranch className="size-4" />,       color: "text-amber-500" },
  { value: "bi",        label: "商业智能", icon: <Layers className="size-4" />,          color: "text-violet-500" },
  { value: "procode",   label: "ProCode",  icon: <FileCode className="size-4" />,        color: "text-emerald-500" },
  { value: "ai",        label: "AI 生成",  icon: <Sparkles className="size-4" />,        color: "text-purple-500" },
];

/* ── Component Palette ── */

export interface ComponentItem {
  type: string;
  label: string;
  icon: React.ReactNode;
}

export const COMPONENT_PALETTE: ComponentItem[] = [
  { type: "heading",   label: "标题",   icon: <Type className="size-3.5" /> },
  { type: "text",      label: "文本",   icon: <FileText className="size-3.5" /> },
  { type: "button",    label: "按钮",   icon: <Square className="size-3.5" /> },
  { type: "input",     label: "输入框", icon: <CreditCard className="size-3.5" /> },
  { type: "image",     label: "图片",   icon: <Image className="size-3.5" /> },
  { type: "container", label: "容器",   icon: <Square className="size-3.5" /> },
  { type: "list",      label: "列表",   icon: <List className="size-3.5" /> },
  { type: "table",     label: "表格",   icon: <Table2 className="size-3.5" /> },
  { type: "card",      label: "卡片",   icon: <CreditCard className="size-3.5" /> },
  { type: "divider",   label: "分割线", icon: <Minus className="size-3.5" /> },
];
