import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Database, Globe, Code2, FileCode, Workflow, Webhook, Clock, Plus, Settings, Trash2, Play, Pause, Loader2, Pencil, ChevronRight, Zap, AlertCircle } from "lucide-react";

// ─── Types ──────────────────────────────────────────────
interface Orchestration {
  id: string;
  name: string;
  type: string;
  adapters: string[];
  status: "active" | "draft" | "error";
  lastRun?: string;
  triggerType: string;
}

interface AdapterConfig {
  sql?: { databaseUrl: string; queryTemplate: string };
  http?: { url: string; method: string; headers: string; bodyTemplate: string };
  script?: { language: string; script: string };
  connector?: { connectorType: string; config: string };
}

// ─── Adapter definitions ────────────────────────────────
const ADAPTER_TYPES = [
  { id: "sql", name: "SQL 适配器", icon: Database, desc: "编写 SQL 语句操作数据", color: "bg-blue-500" },
  { id: "http", name: "HTTP 适配器", icon: Globe, desc: "将外部 HTTP 接口包装为服务", color: "bg-green-500" },
  { id: "groovy", name: "Groovy 适配器", icon: Code2, desc: "Groovy 脚本编写业务逻辑", color: "bg-purple-500" },
  { id: "js", name: "JS 表达式适配器", icon: FileCode, desc: "前后端通用 JS 脚本", color: "bg-primary" },
  { id: "java", name: "Java 适配器", icon: Code2, desc: "Java 代码实现业务逻辑", color: "bg-red-500" },
  { id: "connector", name: "连接器服务", icon: Workflow, desc: "企微/邮箱/钉钉/飞书连接器", color: "bg-primary" },
];

const TRIGGER_TYPES = [
  { id: "webhook", name: "webhook 触发", icon: Webhook, desc: "指定 URL 被动接收数据时触发" },
  { id: "timer", name: "定时触发", icon: Clock, desc: "Cron 循环周期触发" },
  { id: "data", name: "模型数据触发", icon: Database, desc: "数据 CRUD 时触发" },
];

const NODE_TYPES = [
  { name: "调用服务", icon: Workflow, desc: "调用 4 类服务" },
  { name: "SQL 节点", icon: Database, desc: "执行 SQL 脚本" },
  { name: "Groovy 节点", icon: Code2, desc: "执行 Groovy 脚本" },
  { name: "高级 http 节点", icon: Globe, desc: "调用 HTTP 服务" },
  { name: "排他网关", icon: "x", desc: "XOR 路由" },
  { name: "包容网关", icon: "o", desc: "OR 路由" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "运行中", variant: "default" },
  draft: { label: "草稿", variant: "secondary" },
  error: { label: "异常", variant: "destructive" },
};

// ─── Component ──────────────────────────────────────────
export default function Orchestration() {
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────
  const [orchestrations, setOrchestrations] = useState<Orchestration[]>([]);
  const [loading, setLoading] = useState(false);

  // Create/Edit dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingOrchestration, setEditingOrchestration] = useState<Orchestration | null>(null);
  const [formName, setFormName] = useState("");
  const [formTriggerType, setFormTriggerType] = useState("webhook");
  const [formAdapters, setFormAdapters] = useState<string[]>([]);

  // Adapter config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedAdapter, setSelectedAdapter] = useState<string | null>(null);

  // Adapter configs
  const [adapterConfigs, setAdapterConfigs] = useState<Record<string, AdapterConfig>>({});

  // ─── Load orchestrations from backend ──────────────
  const loadOrchestrations = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("mp_token");
      const res = await fetch("/api/orchestrations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        const parsed = json.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          type: row.type || "custom",
          adapters: row.adapters ? JSON.parse(row.adapters) : [],
          status: row.status || "draft",
          lastRun: row.last_run,
          triggerType: row.trigger_type || "manual",
        }));
        setOrchestrations(parsed);
      }
    } catch {
      // Fallback to empty if API not available
      setOrchestrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrchestrations();
  }, [loadOrchestrations]);

  // ─── Create orchestration ──────────────────────────
  const handleCreate = useCallback(async () => {
    try {
      const token = localStorage.getItem("mp_token");
      await fetch("/api/orchestrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          type: "custom",
          adapters: formAdapters,
          trigger_type: formTriggerType,
          config: {},
        }),
      });
      setCreateDialogOpen(false);
      resetForm();
      loadOrchestrations();
    } catch (err) {
      console.error("Failed to create orchestration:", err);
    }
  }, [formName, formAdapters, formTriggerType, loadOrchestrations]);

  // ─── Edit orchestration ────────────────────────────
  const handleEdit = useCallback((orch: Orchestration) => {
    setEditingOrchestration(orch);
    setFormName(orch.name);
    setFormTriggerType(orch.triggerType);
    setFormAdapters([...orch.adapters]);
    setCreateDialogOpen(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editingOrchestration) return;
    try {
      const token = localStorage.getItem("mp_token");
      await fetch(`/api/orchestrations/${editingOrchestration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          adapters: formAdapters,
        }),
      });
      setCreateDialogOpen(false);
      resetForm();
      loadOrchestrations();
    } catch (err) {
      console.error("Failed to update orchestration:", err);
    }
  }, [editingOrchestration, formName, formAdapters, loadOrchestrations]);

  // ─── Delete orchestration ──────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("确定删除此编排？")) return;
    try {
      const token = localStorage.getItem("mp_token");
      await fetch(`/api/orchestrations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadOrchestrations();
    } catch (err) {
      console.error("Failed to delete orchestration:", err);
    }
  }, [loadOrchestrations]);

  // ─── Toggle status ─────────────────────────────────
  const handleToggleStatus = useCallback(async (orch: Orchestration) => {
    const newStatus = orch.status === "active" ? "draft" : "active";
    try {
      const token = localStorage.getItem("mp_token");
      await fetch(`/api/orchestrations/${orch.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrchestrations();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }, [loadOrchestrations]);

  // ─── Adapter config dialog ─────────────────────────
  const handleOpenAdapterConfig = useCallback((adapterId: string) => {
    setSelectedAdapter(adapterId);
    if (!adapterConfigs[adapterId]) {
      // Initialize default config
      const defaults: Record<string, AdapterConfig> = {
        sql: { sql: { databaseUrl: "", queryTemplate: "SELECT * FROM table_name" } },
        http: { http: { url: "", method: "GET", headers: "{}", bodyTemplate: "" } },
        groovy: { script: { language: "groovy", script: "// Groovy script" } },
        js: { script: { language: "javascript", script: "// JavaScript" } },
        java: { script: { language: "java", script: "// Java code" } },
        connector: { connector: { connectorType: "wechat", config: "{}" } },
      };
      setAdapterConfigs((prev) => ({ ...prev, [adapterId]: defaults[adapterId] || {} }));
    }
    setConfigDialogOpen(true);
  }, [adapterConfigs]);

  const handleSaveAdapterConfig = useCallback(() => {
    setConfigDialogOpen(false);
    setSelectedAdapter(null);
  }, []);

  const resetForm = useCallback(() => {
    setEditingOrchestration(null);
    setFormName("");
    setFormTriggerType("webhook");
    setFormAdapters([]);
  }, []);

  const toggleAdapterSelection = useCallback((adapterId: string) => {
    setFormAdapters((prev) =>
      prev.includes(adapterId) ? prev.filter((a) => a !== adapterId) : [...prev, adapterId],
    );
  }, []);

  // ─── Render adapter config form ────────────────────
  const renderAdapterConfigForm = () => {
    if (!selectedAdapter) return null;
    const adapter = ADAPTER_TYPES.find((a) => a.id === selectedAdapter);
    if (!adapter) return null;
    const config = adapterConfigs[selectedAdapter] || {};

    switch (selectedAdapter) {
      case "sql":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">数据库连接 URL</Label>
              <Input
                value={config.sql?.databaseUrl || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { sql: { ...prev[selectedAdapter]?.sql, databaseUrl: e.target.value } },
                  }))
                }
                placeholder="jdbc:mysql://localhost:3306/dbname"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">SQL 查询模板</Label>
              <textarea
                value={config.sql?.queryTemplate || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { sql: { ...prev[selectedAdapter]?.sql, queryTemplate: e.target.value } },
                  }))
                }
                placeholder="SELECT * FROM table_name WHERE id = {{input.id}}"
                className="mt-1 w-full border rounded p-2 text-sm font-mono"
                rows={6}
              />
            </div>
          </div>
        );
      case "http":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">请求 URL</Label>
              <Input
                value={config.http?.url || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { http: { ...prev[selectedAdapter]?.http, url: e.target.value } },
                  }))
                }
                placeholder="https://api.example.com/data"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">请求方法</Label>
              <select
                value={config.http?.method || "GET"}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { http: { ...prev[selectedAdapter]?.http, method: e.target.value } },
                  }))
                }
                className="mt-1 w-full border rounded p-2 text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div>
              <Label className="text-sm">请求头 (JSON)</Label>
              <textarea
                value={config.http?.headers || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { http: { ...prev[selectedAdapter]?.http, headers: e.target.value } },
                  }))
                }
                placeholder='{"Content-Type": "application/json"}'
                className="mt-1 w-full border rounded p-2 text-sm font-mono"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-sm">请求体模板</Label>
              <textarea
                value={config.http?.bodyTemplate || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { http: { ...prev[selectedAdapter]?.http, bodyTemplate: e.target.value } },
                  }))
                }
                placeholder='{"key": "{{input.value}}"}'
                className="mt-1 w-full border rounded p-2 text-sm font-mono"
                rows={4}
              />
            </div>
          </div>
        );
      case "groovy":
      case "js":
      case "java":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">脚本语言</Label>
              <div className="mt-1 text-sm bg-muted rounded px-2 py-1">
                {adapter.name}
              </div>
            </div>
            <div>
              <Label className="text-sm">脚本编辑器</Label>
              <textarea
                value={config.script?.script || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { script: { ...prev[selectedAdapter]?.script, script: e.target.value } },
                  }))
                }
                placeholder={`// ${adapter.name} code`}
                className="mt-1 w-full border rounded p-2 text-sm font-mono"
                rows={10}
              />
            </div>
          </div>
        );
      case "connector":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">连接器类型</Label>
              <select
                value={config.connector?.connectorType || "wechat"}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { connector: { ...prev[selectedAdapter]?.connector, connectorType: e.target.value } },
                  }))
                }
                className="mt-1 w-full border rounded p-2 text-sm"
              >
                <option value="wechat">企业微信</option>
                <option value="dingtalk">钉钉</option>
                <option value="feishu">飞书</option>
                <option value="email">邮件</option>
                <option value="sms">短信</option>
              </select>
            </div>
            <div>
              <Label className="text-sm">配置 (JSON)</Label>
              <textarea
                value={config.connector?.config || ""}
                onChange={(e) =>
                  setAdapterConfigs((prev) => ({
                    ...prev,
                    [selectedAdapter]: { connector: { ...prev[selectedAdapter]?.connector, config: e.target.value } },
                  }))
                }
                placeholder='{"app_id": "...", "secret": "..."}'
                className="mt-1 w-full border rounded p-2 text-sm font-mono"
                rows={6}
              />
            </div>
          </div>
        );
      default:
        return <div className="text-sm text-muted-foreground">暂无配置项</div>;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="服务编排"
        description="6 大适配器 + 3 触发方式 + 节点类型"
        action={
          <Button className="gap-2" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
            <Plus className="size-4" /> 新建编排
          </Button>
        }
      />

      {/* ─── 6 Adapters Section ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">6 大适配器</CardTitle>
          <CardDescription>SQL / HTTP / Groovy / JS / Java / 连接器 - 点击配置</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADAPTER_TYPES.map((a) => {
              const Icon = a.icon;
              return (
                <Card
                  key={a.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleOpenAdapterConfig(a.id)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`${a.color} text-white size-10 rounded-lg flex items-center justify-center`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{a.name}</CardTitle>
                        <CardDescription>{a.desc}</CardDescription>
                      </div>
                      <Settings className="size-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Orchestrations List ─────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">编排列表</CardTitle>
            <CardDescription>已创建的编排流程 ({orchestrations.length})</CardDescription>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
            <Plus className="size-3 mr-1" /> 新建
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : orchestrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无编排，点击上方"新建编排"创建
            </div>
          ) : (
            <div className="space-y-2">
              {orchestrations.map((orch) => {
                const statusInfo = STATUS_MAP[orch.status] || STATUS_MAP.draft;
                return (
                  <div key={orch.id} className="flex items-center gap-3 p-3 border rounded hover:border-primary transition-colors">
                    <Workflow className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{orch.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {orch.adapters.length > 0
                          ? `适配器: ${orch.adapters.map((a) => ADAPTER_TYPES.find((at) => at.id === a)?.name || a).join(", ")}`
                          : "未配置适配器"}
                        {orch.lastRun && <span className="ml-2">最后运行: {new Date(orch.lastRun).toLocaleString()}</span>}
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(orch)}>
                      {orch.status === "active" ? <Pause className="size-3" /> : <Play className="size-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(orch)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(orch.id)}>
                      <Trash2 className="size-3 text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Triggers & Node Types ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">触发方式</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {TRIGGER_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 border rounded">
                    <Icon className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">节点类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {NODE_TYPES.map((n) => {
                const Icon = typeof n.icon === "string" ? null : n.icon;
                return (
                  <div key={n.name} className="flex items-center gap-3 p-3 border rounded">
                    {Icon ? (
                      <Icon className="size-5 text-primary" />
                    ) : (
                      <span className="size-5 flex items-center justify-center text-primary font-bold">
                        {n.icon as string}
                      </span>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{n.name}</div>
                      <div className="text-xs text-muted-foreground">{n.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Create/Edit Orchestration Dialog ──────────── */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="size-5" />
              {editingOrchestration ? "编辑编排" : "新建编排"}
            </DialogTitle>
            <DialogDescription>
              {editingOrchestration ? "修改编排配置" : "创建一个新的服务编排流程"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">编排名称</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="输入编排名称"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">触发方式</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {TRIGGER_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormTriggerType(t.id)}
                      className={`p-2 border rounded text-center text-xs transition-colors ${
                        formTriggerType === t.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <Icon className="size-4 mx-auto mb-1" />
                      <div>{t.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-sm">选择适配器</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ADAPTER_TYPES.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAdapterSelection(a.id)}
                      className={`flex items-center gap-2 p-2 border rounded text-xs transition-colors ${
                        formAdapters.includes(a.id)
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className={`${a.color} text-white size-6 rounded flex items-center justify-center`}>
                        <Icon className="size-3" />
                      </div>
                      <span>{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              取消
            </Button>
            <Button onClick={editingOrchestration ? handleUpdate : handleCreate} disabled={!formName}>
              {editingOrchestration ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Adapter Configuration Dialog ──────────────── */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAdapter && (() => {
                const adapter = ADAPTER_TYPES.find((a) => a.id === selectedAdapter);
                if (!adapter) return null;
                const Icon = adapter.icon;
                return (
                  <>
                    <div className={`${adapter.color} text-white size-8 rounded-lg flex items-center justify-center`}>
                      <Icon className="size-4" />
                    </div>
                    {adapter.name} 配置
                  </>
                );
              })()}
            </DialogTitle>
            <DialogDescription>配置适配器参数</DialogDescription>
          </DialogHeader>

          {renderAdapterConfigForm()}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfigDialogOpen(false); setSelectedAdapter(null); }}>
              取消
            </Button>
            <Button onClick={handleSaveAdapterConfig}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
