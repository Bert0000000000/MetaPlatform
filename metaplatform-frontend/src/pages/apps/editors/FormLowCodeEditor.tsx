import { useState, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Type, FileText, Square, CreditCard, Image, List, Table2, Minus, LayoutDashboard, Trash2 } from "lucide-react";
import { GridLayout, SpanSelector, type GridItem, type GridSpan } from "./GridLayout";
import type { FormEditorProps, PageComponent } from "./types";

const PALETTE_ITEMS = [
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

const COMPONENT_RENDER: Record<string, (comp: PageComponent) => React.ReactNode> = {
  heading:   (c) => <h3 className="font-semibold text-sm">{c.props.text || "标题"}</h3>,
  text:      (c) => <p className="text-xs text-muted-foreground">{c.props.text || "文本内容"}</p>,
  button:    (c) => <button className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs">{c.props.text || "按钮"}</button>,
  input:     (c) => <input placeholder={c.props.placeholder || "输入框"} className="w-full border rounded px-2 py-1 text-xs" disabled />,
  image:     (c) => <div className="bg-muted h-12 rounded flex items-center justify-center text-xs text-muted-foreground">图片</div>,
  container: (c) => <div className="border border-dashed rounded p-3 text-center text-xs text-muted-foreground">容器区域</div>,
  card:      (c) => <div className="bg-muted/50 rounded p-2 text-xs">卡片内容</div>,
  list:      (c) => <div className="text-xs text-muted-foreground">- 列表项 1<br/>- 列表项 2</div>,
  table:     (c) => <table className="w-full text-xs border"><thead><tr><th className="border p-1 text-left">列1</th><th className="border p-1 text-left">列2</th></tr></thead><tbody><tr><td className="border p-1">-</td><td className="border p-1">-</td></tr></tbody></table>,
  divider:   (c) => <hr className="my-1" />,
};

export function FormLowCodeEditor({ components, setComponents, selectedCompId, setSelectedCompId, setDirty }: FormEditorProps) {
  const [addSpan, setAddSpan] = useState<GridSpan>(12);

  const addComponent = (type: string) => {
    const meta = PALETTE_ITEMS.find(c => c.type === type);
    const newComp: PageComponent = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type, label: meta?.label || type, props: {}, span: addSpan,
    };
    setComponents(prev => [...prev, newComp]);
    setSelectedCompId(newComp.id);
    setDirty(true);
  };

  const removeComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
    if (selectedCompId === id) setSelectedCompId(null);
    setDirty(true);
  };

  const updateComponent = (id: string, props: Record<string, any>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, props: { ...c.props, ...props } } : c));
    setDirty(true);
  };

  const changeSpan = (id: string, span: GridSpan) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, span } : c));
    setDirty(true);
  };

  const selectedComp = components.find(c => c.id === selectedCompId);

  const gridItems: GridItem[] = components.map(comp => ({
    id: comp.id,
    span: comp.span || 12,
    label: comp.label,
    component: (
      <div className={`p-3 border rounded-lg min-h-[60px] cursor-pointer transition-all ${selectedCompId === comp.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-dashed hover:border-primary/30"}`}
        onClick={() => setSelectedCompId(comp.id)}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground">{comp.label}</span>
          <button onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
            className="p-0.5 rounded hover:bg-destructive/20 text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="size-3" /></button>
        </div>
        {COMPONENT_RENDER[comp.type]?.(comp) || <div className="text-xs text-muted-foreground">{comp.type}</div>}
      </div>
    ),
  }));

  return (
    <div className="flex gap-0 h-full">
      {/* Left: Component Palette + Span Selector */}
      <div className="w-40 border-r pr-3 shrink-0 overflow-y-auto">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">组件库</h4>
        <div className="space-y-1">
          {PALETTE_ITEMS.map(c => (
            <button key={c.type} draggable onDragStart={(e) => e.dataTransfer.setData("componentType", c.type)}
              onClick={() => addComponent(c.type)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors text-left cursor-grab">
              <span className="text-muted-foreground">{c.icon}</span><span>{c.label}</span>
            </button>
          ))}
        </div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mt-4 mb-2">布局宽度</h4>
        <SpanSelector onSelect={setAddSpan} />
        <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground">{components.length} 个组件</div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const type = e.dataTransfer.getData("componentType"); if (type) addComponent(type); }}>
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <LayoutDashboard className="size-8 mb-2 opacity-20" />
            <p className="text-sm">从左侧添加组件</p>
          </div>
        ) : (
          <GridLayout items={gridItems} editing={true}
            onSpanChange={(id, span) => changeSpan(id, span as GridSpan)}
            onRemove={removeComponent} />
        )}
      </div>

      {/* Right: Properties Panel */}
      <div className="w-48 border-l pl-3 shrink-0">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">属性</h4>
        {selectedComp ? (
          <div className="space-y-3">
            <Badge variant="outline" className="text-[10px]">{selectedComp.label}</Badge>
            <div><Label className="text-[10px] text-muted-foreground">文本</Label>
              <Input value={selectedComp.props?.text || ""} onChange={(e) => updateComponent(selectedComp.id, { text: e.target.value })}
                className="h-7 text-xs mt-0.5" placeholder="输入文本..." /></div>
            <div><Label className="text-[10px] text-muted-foreground">占位符</Label>
              <Input value={selectedComp.props?.placeholder || ""} onChange={(e) => updateComponent(selectedComp.id, { placeholder: e.target.value })}
                className="h-7 text-xs mt-0.5" placeholder="输入占位符..." /></div>
            <div className="flex items-center justify-between"><Label className="text-[10px] text-muted-foreground">必填</Label>
              <input type="checkbox" checked={selectedComp.props?.required || false}
                onChange={(e) => updateComponent(selectedComp.id, { required: e.target.checked })} className="size-3" /></div>
            <button onClick={() => removeComponent(selectedComp.id)}
              className="w-full text-xs py-1 border border-destructive/50 text-destructive rounded hover:bg-destructive/5">删除组件</button>
          </div>
        ) : <p className="text-[10px] text-muted-foreground py-4 text-center">点击组件查看属性</p>}
      </div>
    </div>
  );
}
