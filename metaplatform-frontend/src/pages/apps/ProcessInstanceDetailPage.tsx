import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appServiceApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { ArrowLeft, Loader2, Clock, CheckCircle, XCircle, Activity } from "lucide-react";
import { parseBpmnXml, type BpmnNode, type BpmnEdge } from "@/lib/bpmn-generator";

interface HistoricActivity {
  activityId?: string;
  activityName?: string;
  activityType?: string;
  startTime?: string;
  endTime?: string;
}

export default function ProcessInstanceDetailPage() {
  const { appId, processInstanceId } = useParams<{ appId: string; processInstanceId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{
    instance: Record<string, unknown>;
    bpmnXml: string;
    historicActivities: HistoricActivity[];
    currentTasks: Record<string, unknown>[];
    workflowDefinition: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    if (!appId || !processInstanceId) return;
    setLoading(true);
    appServiceApi.processInstances.get(appId, processInstanceId)
      .then(setDetail)
      .catch((e) => toast.error(`加载流程实例失败：${e.message || "未知错误"}`))
      .finally(() => setLoading(false));
  }, [appId, processInstanceId]);

  const parsed = useMemo(() => {
    if (!detail?.bpmnXml) return null;
    return parseBpmnXml(detail.bpmnXml);
  }, [detail?.bpmnXml]);

  const completedIds = useMemo(() => {
    const ids = new Set<string>();
    detail?.historicActivities.forEach((a) => {
      if (a.activityId) ids.add(a.activityId);
    });
    return ids;
  }, [detail?.historicActivities]);

  const currentIds = useMemo(() => {
    const ids = new Set<string>();
    detail?.currentTasks.forEach((t) => {
      const taskDefKey = t.taskDefinitionKey || t.id;
      if (taskDefKey) ids.add(String(taskDefKey));
    });
    return ids;
  }, [detail?.currentTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const instance = detail?.instance;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">流程实例详情</h1>
          <p className="text-xs text-muted-foreground">
            {detail?.workflowDefinition?.name ?? "-"} · {processInstanceId?.slice(-8)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">状态</p>
            <p className="text-sm font-medium mt-1">{String(instance?.suspended === true ? "已挂起" : instance?.ended === true ? "已结束" : "运行中")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">发起人</p>
            <p className="text-sm font-medium mt-1">{String(instance?.startUserId || "public-form")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">启动时间</p>
            <p className="text-sm font-medium mt-1">{formatDate(String(instance?.startTime || ""))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">当前任务</p>
            <p className="text-sm font-medium mt-1">{detail?.currentTasks?.[0]?.name ?? "无"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="diagram">
        <TabsList>
          <TabsTrigger value="diagram">流程图</TabsTrigger>
          <TabsTrigger value="history">历史活动</TabsTrigger>
          <TabsTrigger value="tasks">当前任务</TabsTrigger>
        </TabsList>
        <TabsContent value="diagram">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">BPMN 流程图</CardTitle>
            </CardHeader>
            <CardContent>
              {parsed ? (
                <SimpleBpmnDiagram
                  nodes={parsed.nodes}
                  edges={parsed.edges}
                  completedIds={completedIds}
                  currentIds={currentIds}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">无法解析流程图</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">活动</th>
                    <th className="text-left px-4 py-2 font-medium">类型</th>
                    <th className="text-left px-4 py-2 font-medium">开始时间</th>
                    <th className="text-left px-4 py-2 font-medium">结束时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.historicActivities || []).map((a, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-4 py-2">{a.activityName || a.activityId || "-"}</td>
                      <td className="px-4 py-2">{a.activityType || "-"}</td>
                      <td className="px-4 py-2">{formatDate(a.startTime || "")}</td>
                      <td className="px-4 py-2">{formatDate(a.endTime || "")}</td>
                    </tr>
                  ))}
                  {(!detail?.historicActivities || detail.historicActivities.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">暂无历史活动</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <div className="grid gap-3">
            {(detail?.currentTasks || []).map((t, idx) => (
              <Card key={idx}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{String(t.name || "任务")}</p>
                    <p className="text-xs text-muted-foreground mt-1">办理人：{String(t.assignee || "未分配")}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="size-3 mr-1" />
                    {formatDate(String(t.createTime || ""))}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {(!detail?.currentTasks || detail.currentTasks.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center">无当前任务</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleBpmnDiagram({
  nodes,
  edges,
  completedIds,
  currentIds,
}: {
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  completedIds: Set<string>;
  currentIds: Set<string>;
}) {
  if (nodes.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">无节点</p>;

  const padding = 40;
  const minX = Math.min(...nodes.map((n) => n.position.x)) - padding;
  const minY = Math.min(...nodes.map((n) => n.position.y)) - padding;
  const maxX = Math.max(...nodes.map((n) => n.position.x + (n.width || 100))) + padding;
  const maxY = Math.max(...nodes.map((n) => n.position.y + (n.height || 80))) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  const scale = 0.85;
  const viewBox = `${minX} ${minY} ${width} ${height}`;

  return (
    <div className="overflow-auto border rounded bg-slate-50">
      <svg width={width * scale} height={height * scale} viewBox={viewBox} className="block">
        {edges.map((e) => {
          const source = nodes.find((n) => n.id === e.source);
          const target = nodes.find((n) => n.id === e.target);
          if (!source || !target) return null;
          const sx = source.position.x + (source.width || 100);
          const sy = source.position.y + (source.height || 80) / 2;
          const tx = target.position.x;
          const ty = target.position.y + (target.height || 80) / 2;
          const active = completedIds.has(e.source) && (completedIds.has(e.target) || currentIds.has(e.target));
          return (
            <g key={e.id}>
              <line
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke={active ? "#3b82f6" : "#94a3b8"}
                strokeWidth={active ? 2.5 : 1.5}
                markerEnd="url(#arrow)"
              />
              {e.label && (
                <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 6} textAnchor="middle" className="fill-slate-500" fontSize="11">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
        </defs>
        {nodes.map((n) => {
          const isCompleted = completedIds.has(n.id);
          const isCurrent = currentIds.has(n.id);
          const color = isCurrent ? "#3b82f6" : isCompleted ? "#22c55e" : "#cbd5e1";
          const fill = isCurrent ? "#eff6ff" : isCompleted ? "#f0fdf4" : "#ffffff";
          const cx = n.position.x + (n.width || 100) / 2;
          const cy = n.position.y + (n.height || 80) / 2;
          const isEvent = n.type.includes("Event");
          const isGateway = n.type.includes("Gateway");
          return (
            <g key={n.id}>
              {isEvent ? (
                <circle cx={cx} cy={cy} r={(n.width || 36) / 2} fill={fill} stroke={color} strokeWidth={isCurrent ? 3 : 2} />
              ) : isGateway ? (
                <polygon
                  points={`${cx},${n.position.y} ${n.position.x + (n.width || 50)},${cy} ${cx},${n.position.y + (n.height || 50)} ${n.position.x},${cy}`}
                  fill={fill}
                  stroke={color}
                  strokeWidth={isCurrent ? 3 : 2}
                />
              ) : (
                <rect
                  x={n.position.x}
                  y={n.position.y}
                  width={n.width || 100}
                  height={n.height || 80}
                  rx={6}
                  fill={fill}
                  stroke={color}
                  strokeWidth={isCurrent ? 3 : 2}
                />
              )}
              <text x={cx} y={cy + 4} textAnchor="middle" className="fill-slate-700" fontSize="12">
                {n.name || n.id}
              </text>
              {isCurrent && (
                <text x={cx} y={n.position.y - 8} textAnchor="middle" className="fill-blue-600" fontSize="11" fontWeight="bold">
                  当前
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
