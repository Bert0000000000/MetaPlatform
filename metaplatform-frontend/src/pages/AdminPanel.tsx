import React, { useEffect, useState, useCallback } from "react";
import {
  getAuditLogs,
  getLineageRecords,
  listProcessInstances,
  listProcessDefinitions,
  getProcessHistory,
  listAgentExecutions,
  listAgents,
  getDataSyncStats,
  getSchemaGraph,
} from "../api/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "audit" | "lineage" | "process" | "agent" | "sync" | "ontology";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "audit", label: "审计日志", icon: "\u{1F4CB}" },
  { key: "lineage", label: "数据血缘", icon: "\u{1F517}" },
  { key: "process", label: "流程监控", icon: "⚙️" },
  { key: "agent", label: "Agent 监控", icon: "\u{1F916}" },
  { key: "sync", label: "数据同步", icon: "\u{1F504}" },
  { key: "ontology", label: "本体管理", icon: "\u{1F9E0}" },
];

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("audit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  // Lineage
  const [lineageRecords, setLineageRecords] = useState<Record<string, unknown>[]>([]);
  // Process
  const [processInstances, setProcessInstances] = useState<Record<string, unknown>[]>([]);
  const [processDefs, setProcessDefs] = useState<Record<string, unknown>[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<Record<string, unknown>[] | null>(null);
  // Agent
  const [agentExecutions, setAgentExecutions] = useState<Record<string, unknown>[]>([]);
  const [agents, setAgents] = useState<Record<string, unknown>[]>([]);
  // Sync
  const [syncStats, setSyncStats] = useState<Record<string, unknown> | null>(null);
  // Ontology
  const [schemaGraph, setSchemaGraph] = useState<Record<string, unknown> | null>(null);

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case "audit":
          setAuditLogs(await getAuditLogs());
          break;
        case "lineage":
          setLineageRecords(await getLineageRecords());
          break;
        case "process":
          setProcessInstances(await listProcessInstances());
          setProcessDefs(await listProcessDefinitions());
          break;
        case "agent":
          setAgentExecutions(await listAgentExecutions());
          setAgents(await listAgents());
          break;
        case "sync":
          setSyncStats(await getDataSyncStats());
          break;
        case "ontology":
          setSchemaGraph(await getSchemaGraph());
          break;
      }
    } catch (e: unknown) {
      console.warn(`Failed to load ${tab}:`, e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  const handleShowHistory = async (instanceId: string) => {
    try {
      setSelectedHistory(await getProcessHistory(instanceId));
    } catch {
      setSelectedHistory([]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">平台管理</h1>
        <p className="text-sm text-muted-foreground mt-1">审计、血缘、流程、Agent、数据同步、本体管理</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Tab); setSelectedHistory(null); }}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              <span>{t.icon}</span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            加载中...
          </div>
        )}

        {/* Audit logs */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">审计日志 ({auditLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无审计记录</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>资源类型</TableHead>
                      <TableHead>资源ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{String(log.createdAt || "").slice(0, 19)}</TableCell>
                        <TableCell><Badge variant="secondary">{String(log.action)}</Badge></TableCell>
                        <TableCell>{String(log.resourceType)}</TableCell>
                        <TableCell className="font-mono text-xs">{String(log.resourceId || "").slice(0, 8)}...</TableCell>
                        <TableCell>{String(log.userId || "-")}</TableCell>
                        <TableCell className="font-mono text-xs">{String(log.ipAddress || "-")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data lineage */}
        <TabsContent value="lineage">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">数据血缘记录 ({lineageRecords.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {lineageRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无血缘记录</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>源</TableHead>
                      <TableHead>→</TableHead>
                      <TableHead>目标</TableHead>
                      <TableHead>用户</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineageRecords.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{String(r.createdAt || "").slice(0, 19)}</TableCell>
                        <TableCell><Badge variant="secondary">{String(r.operation)}</Badge></TableCell>
                        <TableCell><code className="text-xs">{String(r.sourceType)}</code>:{String(r.sourceId || "").slice(0, 8)}</TableCell>
                        <TableCell>→</TableCell>
                        <TableCell><code className="text-xs">{String(r.targetType)}</code>:{String(r.targetId || "").slice(0, 8)}</TableCell>
                        <TableCell>{String(r.userId || "-")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Process monitoring */}
        <TabsContent value="process">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">流程定义 ({processDefs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {processDefs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processDefs.map((d, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium">{String(d.name)}</div>
                        <div className="text-xs text-muted-foreground mt-1">版本 {String(d.version)} | {String(d.status)}</div>
                        <div className="text-sm text-muted-foreground mt-2">{String(d.description || "无描述")}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">流程实例 ({processInstances.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {processInstances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无流程实例</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>标题</TableHead>
                        <TableHead>发起人</TableHead>
                        <TableHead>当前节点</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processInstances.map((inst, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{String(inst.id || "").slice(0, 8)}...</TableCell>
                          <TableCell>{String(inst.title || "-")}</TableCell>
                          <TableCell>{String(inst.initiatorId || "-")}</TableCell>
                          <TableCell className="font-mono text-xs">{String(inst.currentNodeId || "-")}</TableCell>
                          <TableCell>
                            <Badge variant={inst.status === "running" ? "default" : "secondary"}>
                              {String(inst.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{String(inst.startedAt || "").slice(0, 19)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => handleShowHistory(String(inst.id))}>
                              历史
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Process event history */}
                {selectedHistory && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">流程事件历史 ({selectedHistory.length})</h3>
                      <Button variant="outline" size="sm" onClick={() => setSelectedHistory(null)}>
                        关闭
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>事件类型</TableHead>
                          <TableHead>节点</TableHead>
                          <TableHead>数据</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHistory.map((evt, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{String(evt.createdAt || "").slice(0, 19)}</TableCell>
                            <TableCell><Badge variant="secondary">{String(evt.eventType)}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{String(evt.nodeId || "-")}</TableCell>
                            <TableCell className="font-mono text-xs truncate max-w-[200px]">{JSON.stringify(evt.data || {}).slice(0, 60)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agent monitoring */}
        <TabsContent value="agent">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Agent 定义 ({agents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {agents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((a, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium">{String(a.name)}</div>
                        <div className="text-xs text-muted-foreground mt-1">模型: {String(a.model || "default")} | 最大步数: {String(a.maxSteps || 10)}</div>
                        <div className="text-sm text-muted-foreground mt-2">{String(a.description || "无描述")}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">执行记录 ({agentExecutions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {agentExecutions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无 Agent 执行记录</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>任务</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>步数</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>耗时</TableHead>
                        <TableHead>开始时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentExecutions.map((ex, i) => {
                        const steps = ex.steps as unknown[] | undefined;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{String(ex.id || "").slice(0, 8)}...</TableCell>
                            <TableCell className="truncate max-w-[200px]">{String(ex.taskDescription || "").slice(0, 40)}</TableCell>
                            <TableCell>
                              <Badge variant={ex.status === "completed" ? "default" : ex.status === "running" ? "secondary" : "outline"}>
                                {String(ex.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>{steps?.length || 0}</TableCell>
                            <TableCell>{String(ex.totalTokens || 0)}</TableCell>
                            <TableCell>{ex.totalDurationMs ? `${(Number(ex.totalDurationMs) / 1000).toFixed(1)}s` : "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{String(ex.startedAt || "").slice(0, 19)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data sync */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">数据同步统计</CardTitle>
            </CardHeader>
            <CardContent>
              {syncStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold">{String(syncStats.totalRecords || 0)}</div>
                    <div className="text-sm text-muted-foreground mt-1">总记录数</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-sm font-medium">{String(syncStats.lastSyncTime || "-")}</div>
                    <div className="text-sm text-muted-foreground mt-1">最近同步</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无同步数据</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ontology management */}
        <TabsContent value="ontology">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schema 图谱</CardTitle>
            </CardHeader>
            <CardContent>
              {schemaGraph ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{(schemaGraph.nodes as unknown[] || []).length}</div>
                      <div className="text-sm text-muted-foreground mt-1">节点 (ObjectType)</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{(schemaGraph.edges as unknown[] || []).length}</div>
                      <div className="text-sm text-muted-foreground mt-1">边 (关系)</div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold">节点列表</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>类型</TableHead>
                        <TableHead>编码</TableHead>
                        <TableHead>显示名</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schemaGraph.nodes as Record<string, unknown>[] || []).map((n, i) => (
                        <TableRow key={i}>
                          <TableCell><code className="text-xs">{String(n.type || "")}</code></TableCell>
                          <TableCell>{String(n.code || n.id || "")}</TableCell>
                          <TableCell>{String(n.displayName || n.name || "")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">暂无 Schema 数据</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
