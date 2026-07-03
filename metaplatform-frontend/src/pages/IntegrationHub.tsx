import React, { useState, useEffect, useCallback } from "react";
import {
  listConnectors,
  createConnector,
  deleteConnector,
  testConnection,
  syncConnector,
} from "../api/integrationApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ---- Types ---- */
interface Connector {
  id: string;
  name: string;
  type: string;
  status?: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

type ConnectorType = "rest" | "database" | "csv";

interface ConnectorFormData {
  name: string;
  type: ConnectorType;
  config: Record<string, string>;
}

/* ---- Constants ---- */
const TYPE_LABELS: Record<string, string> = {
  rest: "REST",
  database: "Database",
  csv: "CSV",
};

const TYPE_ICONS: Record<string, string> = {
  rest: "\u{1F310}",
  database: "\u{1F5C4}\u{FE0F}",
  csv: "\u{1F4C4}",
};

const DEFAULT_CONFIGS: Record<ConnectorType, Record<string, string>> = {
  rest: { baseUrl: "", authType: "none", authToken: "" },
  database: { jdbcUrl: "", username: "", password: "" },
  csv: { filePath: "", delimiter: ",", hasHeader: "true" },
};

const CONFIG_LABELS: Record<string, string> = {
  baseUrl: "基础 URL",
  authType: "认证类型",
  authToken: "认证令牌",
  jdbcUrl: "JDBC URL",
  username: "用户名",
  password: "密码",
  filePath: "文件路径",
  delimiter: "分隔符",
  hasHeader: "含表头",
};

/* ---- Component ---- */
const IntegrationHub: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<ConnectorFormData>({
    name: "",
    type: "rest",
    config: { ...DEFAULT_CONFIGS.rest },
  });
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});

  /* Load connectors */
  const loadConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConnectors();
      setConnectors(Array.isArray(data) ? data : []);
    } catch {
      setError("加载连接器列表失败");
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectors();
  }, [loadConnectors]);

  /* Change connector type in form */
  function handleTypeChange(newType: ConnectorType) {
    setFormData({
      ...formData,
      type: newType,
      config: { ...DEFAULT_CONFIGS[newType] },
    });
  }

  /* Change config field */
  function handleConfigChange(field: string, value: string) {
    setFormData({
      ...formData,
      config: { ...formData.config, [field]: value },
    });
  }

  /* Create connector */
  async function handleCreate() {
    if (!formData.name.trim()) return;
    setCreating(true);
    try {
      await createConnector({
        name: formData.name,
        type: formData.type,
        config: formData.config,
        tenantId: "00000000-0000-0000-0000-000000000001",
      });
      setShowCreate(false);
      setFormData({ name: "", type: "rest", config: { ...DEFAULT_CONFIGS.rest } });
      loadConnectors();
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        __create: { type: "error", text: "创建连接器失败" },
      }));
    } finally {
      setCreating(false);
    }
  }

  /* Delete connector */
  async function handleDelete(id: string) {
    try {
      await deleteConnector(id);
      setConnectors((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* silent */
    }
  }

  /* Test connection */
  async function handleTest(id: string) {
    setTestingId(id);
    setStatusMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await testConnection(id);
      const ok = result?.success ?? result?.status === "ok" ?? true;
      setStatusMessages((prev) => ({
        ...prev,
        [id]: {
          type: ok ? "success" : "error",
          text: ok ? "连接测试成功" : "连接测试失败",
        },
      }));
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        [id]: { type: "error", text: "连接测试失败" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  /* Sync connector */
  async function handleSync(id: string) {
    setSyncingId(id);
    setStatusMessages((prev) => {
      const next = { ...prev };
      delete next[`sync-${id}`];
      return next;
    });
    try {
      await syncConnector(id);
      setStatusMessages((prev) => ({
        ...prev,
        [`sync-${id}`]: { type: "success", text: "同步完成" },
      }));
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        [`sync-${id}`]: { type: "error", text: "同步失败" },
      }));
    } finally {
      setSyncingId(null);
    }
  }

  function getStatusVariant(connector: Connector): "default" | "secondary" | "destructive" | "outline" {
    const s = (connector.status || "").toLowerCase();
    if (s === "active" || s === "connected") return "default";
    if (s === "error" || s === "failed") return "destructive";
    return "secondary";
  }

  function getStatusLabel(connector: Connector): string {
    const s = (connector.status || "").toLowerCase();
    if (s === "active" || s === "connected") return "已连接";
    if (s === "error" || s === "failed") return "异常";
    if (s === "inactive" || s === "disconnected") return "未连接";
    return connector.status || "未知";
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">集成中心</h1>
          <p className="text-sm text-muted-foreground mt-1">管理连接器和数据同步</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          + 新建连接器
        </Button>
      </div>

      {/* Status messages */}
      {Object.entries(statusMessages).map(([key, msg]) => (
        <div
          key={key}
          className={cn(
            "rounded-md border p-4 text-sm",
            msg.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          )}
        >
          {msg.text}
        </div>
      ))}

      {/* Create connector form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">新建连接器</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                名称<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                placeholder="输入连接器名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>类型</Label>
              <div className="flex gap-2">
                {(["rest", "database", "csv"] as ConnectorType[]).map((t) => (
                  <Button
                    key={t}
                    variant={formData.type === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTypeChange(t)}
                  >
                    <span className="mr-1">{TYPE_ICONS[t]}</span>
                    {TYPE_LABELS[t]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Config fields by type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.config).map(([field, value]) => (
                <div key={field} className="space-y-2">
                  <Label>{CONFIG_LABELS[field] || field}</Label>
                  {field === "password" ? (
                    <Input
                      type="password"
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    />
                  ) : field === "hasHeader" ? (
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                onClick={handleCreate}
                disabled={!formData.name.trim() || creating}
              >
                {creating ? "创建中..." : "创建"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Connector list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : connectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          暂无连接器，请创建新连接器
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{TYPE_ICONS[c.type] || "\u{1F517}"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground truncate">{c.id}</div>
                  </div>
                  <Badge variant="secondary">{TYPE_LABELS[c.type] || c.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Badge variant={getStatusVariant(c)}>
                    {getStatusLabel(c)}
                  </Badge>
                </div>

                {/* Status message for this connector */}
                {statusMessages[c.id] && (
                  <div
                    className={cn(
                      "rounded-md border p-2 text-xs",
                      statusMessages[c.id].type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-destructive/50 bg-destructive/10 text-destructive"
                    )}
                  >
                    {statusMessages[c.id].text}
                  </div>
                )}
                {statusMessages[`sync-${c.id}`] && (
                  <div
                    className={cn(
                      "rounded-md border p-2 text-xs",
                      statusMessages[`sync-${c.id}`].type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-destructive/50 bg-destructive/10 text-destructive"
                    )}
                  >
                    {statusMessages[`sync-${c.id}`].text}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(c.id)}
                    disabled={testingId === c.id}
                  >
                    {testingId === c.id ? "测试中..." : "测试连接"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(c.id)}
                    disabled={syncingId === c.id}
                  >
                    {syncingId === c.id ? "同步中..." : "同步"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(c.id)}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default IntegrationHub;
