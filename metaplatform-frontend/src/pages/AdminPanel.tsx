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
  { key: "audit", label: "\u5BA1\u8BA1\u65E5\u5FD7", icon: "\u{1F4CB}" },
  { key: "lineage", label: "\u6570\u636E\u8840\u7F18", icon: "\u{1F517}" },
  { key: "process", label: "\u6D41\u7A0B\u76D1\u63A7", icon: "\u2699\uFE0F" },
  { key: "agent", label: "Agent \u76D1\u63A7", icon: "\u{1F916}" },
  { key: "sync", label: "\u6570\u636E\u540C\u6B65", icon: "\u{1F504}" },
  { key: "ontology", label: "\u672C\u4F53\u7BA1\u7406", icon: "\u{1F9E0}" },
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
        <h1 className="text-2xl font-semibold tracking-tight">\u5E73\u53F0\u7BA1\u7406</h1>
        <p className="text-sm text-muted-foreground mt-1">\u5BA1\u8BA1\u3001\u8840\u7F18\u3001\u6D41\u7A0B\u3001Agent\u3001\u6570\u636E\u540C\u6B65\u3001\u672C\u4F53\u7BA1\u7406</p>
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
            \u52A0\u8F7D\u4E2D...
          </div>
        )}

        {/* Audit logs */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">\u5BA1\u8BA1\u65E5\u5FD7 ({auditLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0\u5BA1\u8BA1\u8BB0\u5F55</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>\u65F6\u95F4</TableHead>
                      <TableHead>\u64CD\u4F5C</TableHead>
                      <TableHead>\u8D44\u6E90\u7C7B\u578B</TableHead>
                      <TableHead>\u8D44\u6E90ID</TableHead>
                      <TableHead>\u7528\u6237</TableHead>
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
              <CardTitle className="text-lg">\u6570\u636E\u8840\u7F18\u8BB0\u5F55 ({lineageRecords.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {lineageRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0\u8840\u7F18\u8BB0\u5F55</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>\u65F6\u95F4</TableHead>
                      <TableHead>\u64CD\u4F5C</TableHead>
                      <TableHead>\u6E90</TableHead>
                      <TableHead>\u2192</TableHead>
                      <TableHead>\u76EE\u6807</TableHead>
                      <TableHead>\u7528\u6237</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineageRecords.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{String(r.createdAt || "").slice(0, 19)}</TableCell>
                        <TableCell><Badge variant="secondary">{String(r.operation)}</Badge></TableCell>
                        <TableCell><code className="text-xs">{String(r.sourceType)}</code>:{String(r.sourceId || "").slice(0, 8)}</TableCell>
                        <TableCell>\u2192</TableCell>
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
                <CardTitle className="text-lg">\u6D41\u7A0B\u5B9A\u4E49 ({processDefs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {processDefs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processDefs.map((d, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium">{String(d.name)}</div>
                        <div className="text-xs text-muted-foreground mt-1">\u7248\u672C {String(d.version)} | {String(d.status)}</div>
                        <div className="text-sm text-muted-foreground mt-2">{String(d.description || "\u65E0\u63CF\u8FF0")}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">\u6D41\u7A0B\u5B9E\u4F8B ({processInstances.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {processInstances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0\u6D41\u7A0B\u5B9E\u4F8B</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>\u6807\u9898</TableHead>
                        <TableHead>\u53D1\u8D77\u4EBA</TableHead>
                        <TableHead>\u5F53\u524D\u8282\u70B9</TableHead>
                        <TableHead>\u72B6\u6001</TableHead>
                        <TableHead>\u5F00\u59CB\u65F6\u95F4</TableHead>
                        <TableHead>\u64CD\u4F5C</TableHead>
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
                              \u5386\u53F2
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
                      <h3 className="text-sm font-semibold">\u6D41\u7A0B\u4E8B\u4EF6\u5386\u53F2 ({selectedHistory.length})</h3>
                      <Button variant="outline" size="sm" onClick={() => setSelectedHistory(null)}>
                        \u5173\u95ED
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>\u65F6\u95F4</TableHead>
                          <TableHead>\u4E8B\u4EF6\u7C7B\u578B</TableHead>
                          <TableHead>\u8282\u70B9</TableHead>
                          <TableHead>\u6570\u636E</TableHead>
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
                <CardTitle className="text-lg">Agent \u5B9A\u4E49 ({agents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {agents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((a, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium">{String(a.name)}</div>
                        <div className="text-xs text-muted-foreground mt-1">\u6A21\u578B: {String(a.model || "default")} | \u6700\u5927\u6B65\u6570: {String(a.maxSteps || 10)}</div>
                        <div className="text-sm text-muted-foreground mt-2">{String(a.description || "\u65E0\u63CF\u8FF0")}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">\u6267\u884C\u8BB0\u5F55 ({agentExecutions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {agentExecutions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0 Agent \u6267\u884C\u8BB0\u5F55</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>\u4EFB\u52A1</TableHead>
                        <TableHead>\u72B6\u6001</TableHead>
                        <TableHead>\u6B65\u6570</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>\u8017\u65F6</TableHead>
                        <TableHead>\u5F00\u59CB\u65F6\u95F4</TableHead>
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
              <CardTitle className="text-lg">\u6570\u636E\u540C\u6B65\u7EDF\u8BA1</CardTitle>
            </CardHeader>
            <CardContent>
              {syncStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-2xl font-bold">{String(syncStats.totalRecords || 0)}</div>
                    <div className="text-sm text-muted-foreground mt-1">\u603B\u8BB0\u5F55\u6570</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-sm font-medium">{String(syncStats.lastSyncTime || "-")}</div>
                    <div className="text-sm text-muted-foreground mt-1">\u6700\u8FD1\u540C\u6B65</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0\u540C\u6B65\u6570\u636E</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ontology management */}
        <TabsContent value="ontology">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schema \u56FE\u8C31</CardTitle>
            </CardHeader>
            <CardContent>
              {schemaGraph ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{(schemaGraph.nodes as unknown[] || []).length}</div>
                      <div className="text-sm text-muted-foreground mt-1">\u8282\u70B9 (ObjectType)</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{(schemaGraph.edges as unknown[] || []).length}</div>
                      <div className="text-sm text-muted-foreground mt-1">\u8FB9 (\u5173\u7CFB)</div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold">\u8282\u70B9\u5217\u8868</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>\u7C7B\u578B</TableHead>
                        <TableHead>\u7F16\u7801</TableHead>
                        <TableHead>\u663E\u793A\u540D</TableHead>
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
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">\u6682\u65E0 Schema \u6570\u636E</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
