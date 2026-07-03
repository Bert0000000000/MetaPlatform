import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const http = axios.create({ baseURL: "/api/v1" });

interface ConfigItem {
  key: string;
  value: string;
  description?: string;
  configType?: string;
  updatedBy?: string;
  updatedAt?: string;
}

const PlatformConfig: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await http.get("/configs");
      setConfigs(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const { data } = await http.get("/health");
      setHealth(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConfigs(); loadHealth(); }, [loadConfigs, loadHealth]);

  const handleSave = async (key: string) => {
    try {
      await http.put(`/configs/${encodeURIComponent(key)}`, {
        value: editValue,
        description: configs.find(c => c.key === key)?.description || "",
      });
      setEditKey(null);
      await loadConfigs();
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  const handleAdd = async () => {
    if (!newKey) return;
    try {
      await http.post("/configs", {
        key: newKey,
        value: newValue,
        description: newDesc,
      });
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
      setNewDesc("");
      await loadConfigs();
    } catch (e) {
      console.error("Failed to add config:", e);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除配置 ${key}？`)) return;
    try {
      await http.delete(`/configs/${encodeURIComponent(key)}`);
      await loadConfigs();
    } catch (e) {
      console.error("Failed to delete config:", e);
    }
  };

  const isFeatureFlag = (key: string) => key.startsWith("feature.");
  const isBooleanValue = (val: string) => val === "true" || val === "false";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">平台配置中心</h1>
          <p className="text-sm text-muted-foreground mt-1">管理系统配置、功能开关和健康状态</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          + 新增配置
        </Button>
      </div>

      {/* Health status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">系统健康状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(health).filter(([k]) => k !== "status").map(([name, status]) => {
                const isHealthy = String(status) === "UP" || String(status) === "ok";
                return (
                  <div
                    key={name}
                    className={cn(
                      "rounded-lg border p-3 text-center",
                      isHealthy ? "border-green-200 bg-green-50" : "border-destructive/50 bg-destructive/10"
                    )}
                  >
                    <div className="text-sm font-medium">{name}</div>
                    <div className={cn("text-xs mt-1", isHealthy ? "text-green-600" : "text-destructive")}>
                      {String(status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Config list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">系统配置 ({configs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">配置键</TableHead>
                  <TableHead className="w-[120px]">类型</TableHead>
                  <TableHead>值</TableHead>
                  <TableHead className="w-[200px]">描述</TableHead>
                  <TableHead className="w-[100px]">更新人</TableHead>
                  <TableHead className="w-[140px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.key} className={isFeatureFlag(config.key) ? "bg-muted/30" : ""}>
                    <TableCell>
                      <code className="text-xs font-mono">{config.key}</code>
                      {isFeatureFlag(config.key) && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">功能开关</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{config.configType || "string"}</TableCell>
                    <TableCell>
                      {editKey === config.key ? (
                        isBooleanValue(config.value) ? (
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                          >
                            <option value="true">true (启用)</option>
                            <option value="false">false (禁用)</option>
                          </select>
                        ) : (
                          <Input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="h-8"
                          />
                        )
                      ) : (
                        <span
                          className={cn(
                            "text-sm",
                            config.value === "true" && "text-green-600 font-medium",
                            config.value === "false" && "text-destructive font-medium"
                          )}
                        >
                          {config.value}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{config.description || "-"}</TableCell>
                    <TableCell className="text-sm">{config.updatedBy || "-"}</TableCell>
                    <TableCell>
                      {editKey === config.key ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleSave(config.key)}>保存</Button>
                          <Button variant="outline" size="sm" onClick={() => setEditKey(null)}>取消</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => { setEditKey(config.key); setEditValue(config.value); }}>
                            编辑
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(config.key)}>
                            删除
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add config dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>配置键 *</Label>
              <Input
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="例如: feature.new_feature"
              />
            </div>
            <div className="space-y-2">
              <Label>值</Label>
              <Input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="配置值"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="配置说明"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!newKey}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformConfig;
