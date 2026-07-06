import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Monitor, Tablet, Smartphone, Bot, Hash, Clock, X } from "lucide-react";
import { TYPE_META, type PageVersion } from "./types";
import { AICoPilot } from "./AICoPilot";

interface EditorShellProps {
  pageName: string;
  onPageNameChange: (name: string) => void;
  pageType: string;
  dirty: boolean;
  currentVersion: number;
  versions: PageVersion[];
  onRestoreVersion: (ver: PageVersion) => void;
  device: "desktop" | "tablet" | "mobile";
  onDeviceChange: (d: "desktop" | "tablet" | "mobile") => void;
  showAI: boolean;
  onToggleAI: () => void;
  saving: boolean;
  onSave: () => void;
  onBack?: () => void;
  children: ReactNode;
}

export function EditorShell({
  pageName, onPageNameChange, pageType, dirty, currentVersion, versions,
  onRestoreVersion, device, onDeviceChange, showAI, onToggleAI, saving, onSave, onBack, children
}: EditorShellProps) {
  const [showVersions, setShowVersions] = useState(false);
  const typeMeta = TYPE_META[pageType] || TYPE_META.lowcode;

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <Input value={pageName} onChange={(e) => onPageNameChange(e.target.value)}
            className="h-7 w-48 text-sm font-semibold border-none shadow-none focus-visible:ring-0 px-0" />
          <Badge variant="outline" className={`text-[10px] ${typeMeta.color}`}>
            {typeMeta.label}
          </Badge>
          {dirty && <Badge variant="secondary" className="text-[10px] gap-1">
            <span className="size-1.5 rounded-full bg-orange-400 inline-block" />未保存
          </Badge>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
            <Hash className="size-3" /> v{currentVersion}
          </button>
          <div className="flex gap-0.5 border rounded p-0.5">
            {(["desktop", "tablet", "mobile"] as const).map(d => (
              <button key={d} onClick={() => onDeviceChange(d)}
                className={`p-1 rounded ${device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {d === "desktop" ? <Monitor className="size-3.5" /> : d === "tablet" ? <Tablet className="size-3.5" /> : <Smartphone className="size-3.5" />}
              </button>
            ))}
          </div>
          <Button variant={showAI ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={onToggleAI}>
            <Bot className="size-3.5" /> AI 助手
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Save className="size-3 mr-1" />}
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
      </div>

      {/* Version History Panel */}
      {showVersions && (
        <div className="border-b bg-muted/30 px-4 py-3 max-h-40 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">版本历史</span>
            <button onClick={() => setShowVersions(false)}><X className="size-3.5 text-muted-foreground" /></button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无版本记录</p>
          ) : (
            [...versions].reverse().map(ver => (
              <div key={ver.version} className={`flex items-center justify-between px-2 py-1 rounded text-xs ${ver.version === currentVersion ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{ver.version}</span>
                  <span className="text-muted-foreground">{ver.components?.length || 0} 个组件</span>
                  <span className="text-muted-foreground/60 flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {ver.timestamp ? new Date(ver.timestamp).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "--"}
                  </span>
                </div>
                {ver.version === currentVersion && <Badge variant="default" className="text-[10px] py-0">当前</Badge>}
                {ver.version !== currentVersion && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5"
                    onClick={() => onRestoreVersion(ver)}>恢复</Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
