import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Activity, Search, Play, Pause, Trash2, Filter, Database, Zap, Hash, Box, Link2 } from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * EventStream: 实例事件流 (Kafka 事件浏览器)
 *
 * 后端 v0.1 任务 5.2: trace_id 全链路串联
 * 前端模拟 8 要素相关事件:
 *   - EntityTypeCreated / Updated / Deleted
 *   - PropertyAdded / PropertyUpdated
 *   - RelationAdded / RelationUpdated
 *   - ActionInvoked / RuleTriggered
 *   - EntityInstanceCreated / Updated / Deleted
 *
 * 显示: 事件名 / 源 / 目标 / trace_id / 时间
 * ════════════════════════════════════════════════════════════════════ */

interface StreamEvent {
  id: string;
  type: string;
  source: string;
  target: string;
  payload: Record<string, unknown>;
  traceId: string;
  timestamp: string;
}

const STORAGE_KEY = "mp_ontology_events";

const SAMPLE_TYPES = [
  "EntityTypeCreated", "EntityTypeUpdated", "EntityTypeDeleted",
  "PropertyAdded", "PropertyUpdated", "PropertyDeleted",
  "RelationAdded", "RelationUpdated", "RelationDeleted",
  "ActionInvoked", "RuleTriggered", "FunctionEvaluated",
  "EntityInstanceCreated", "EntityInstanceUpdated", "EntityInstanceDeleted",
];

const SAMPLE_ENTITIES = ["Customer", "Order", "Product", "Employee", "Contract", "Invoice", "Department", "Category"];

function loadEvents(): StreamEvent[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  // 初始生成 50 条 mock 事件
  const arr: StreamEvent[] = [];
  for (let i = 0; i < 50; i++) {
    const type = SAMPLE_TYPES[Math.floor(Math.random() * SAMPLE_TYPES.length)];
    const entity = SAMPLE_ENTITIES[Math.floor(Math.random() * SAMPLE_ENTITIES.length)];
    const minutesAgo = i * 3 + Math.random() * 5;
    arr.push({
      id: `evt_${Date.now() - i * 1000}_${i}`,
      type,
      source: entity,
      target: SAMPLE_ENTITIES[Math.floor(Math.random() * SAMPLE_ENTITIES.length)],
      payload: { sample: "data", index: i, changeType: ["create", "update", "delete"][i % 3] },
      traceId: `trace_${Math.random().toString(36).slice(2, 14)}`,
      timestamp: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    });
  }
  return arr.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function saveEvents(arr: StreamEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 500))); // 限 500 条
}

function uid() { return "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }

export function EventStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  // 模拟流: 每 3s 生成一条
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      const type = SAMPLE_TYPES[Math.floor(Math.random() * SAMPLE_TYPES.length)];
      const entity = SAMPLE_ENTITIES[Math.floor(Math.random() * SAMPLE_ENTITIES.length)];
      const newEvt: StreamEvent = {
        id: uid(),
        type,
        source: entity,
        target: SAMPLE_ENTITIES[Math.floor(Math.random() * SAMPLE_ENTITIES.length)],
        payload: { live: true, changeType: ["create", "update", "delete"][Math.floor(Math.random() * 3)] },
        traceId: `trace_${Math.random().toString(36).slice(2, 14)}`,
        timestamp: new Date().toISOString(),
      };
      setEvents((arr) => {
        const next = [newEvt, ...arr].slice(0, 500);
        saveEvents(next);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [streaming]);

  // 过滤
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (search && !`${e.type} ${e.source} ${e.target} ${e.traceId}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, typeFilter, search]);

  const clearAll = () => {
    if (!confirm("清空所有事件？")) return;
    setEvents([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="size-5 text-primary" /> 事件流
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            本体引擎 Kafka 事件总线 — EntityType / Property / Relation / Action / Instance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="size-3.5 mr-1" /> 清空
          </Button>
          <Button
            size="sm"
            variant={streaming ? "destructive" : "default"}
            onClick={() => setStreaming(!streaming)}
          >
            {streaming ? <><Pause className="size-3.5 mr-1" /> 暂停流</> : <><Play className="size-3.5 mr-1" /> 开始流</>}
          </Button>
        </div>
      </div>

      {/* 过滤 */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索事件名/源/目标/trace_id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">类型:</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部 ({SAMPLE_TYPES.length} 种)</SelectItem>
                  {SAMPLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground ml-auto">
              {streaming && <Badge variant="default" className="mr-2 bg-red-500 animate-pulse">● 实时流中</Badge>}
              {filtered.length} 条
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 事件列表 */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">无事件</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  EntityType: Box, Property: Hash, Relation: Link2, Action: Zap,
};

function EventRow({ event }: { event: StreamEvent }) {
  const kind = event.type.replace(/(Created|Updated|Deleted|Added|Invoked|Triggered|Evaluated)$/, "");
  const verb = event.type.match(/(Created|Updated|Deleted|Added|Invoked|Triggered|Evaluated)$/)?.[0] || "";
  const Icon = ICON_MAP[kind] || Database;
  const verbColor = verb === "Created" || verb === "Added" ? "text-green-600"
    : verb === "Deleted" ? "text-red-600"
    : verb === "Updated" ? "text-yellow-600" : "text-primary";
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b text-xs hover:bg-muted/30">
      <Icon className={`size-3.5 shrink-0 ${verbColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{event.source}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono">{event.target}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1">{event.type}</Badge>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-[10px] mt-0.5">
          <span>trace: <span className="font-mono">{event.traceId}</span></span>
          <span>{new Date(event.timestamp).toLocaleString()}</span>
        </div>
      </div>
      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => alert(JSON.stringify(event.payload, null, 2))}>
        详情
      </Button>
    </div>
  );
}
