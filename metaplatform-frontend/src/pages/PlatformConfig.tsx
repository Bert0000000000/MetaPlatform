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
    if (!confirm(`\u786E\u5B9A\u5220\u9664\u914D\u7F6E ${key}\uFF1F`)) return;
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
          <h1 className="text-2xl font-semibold tracking-tight">\u5E73\u53F0\u914D\u7F6E\u4E2D\u5FC3</h1>
          <p className="text-sm text-muted-foreground mt-1">\u7BA1\u7406\u7CFB\u7EDF\u914D\u7F6E\u3001\u529F\u80FD\u5F00\u5173\u548C\u5065\u5EB7\u72B6\u6001</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          + \u65B0\u589E\u914D\u7F6E
        </Button>
      </div>

      {/* Health status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">\u7CFB\u7EDF\u5065\u5EB7\u72B6\u6001</CardTitle>
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
          \u52A0\u8F7D\u4E2D...
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">\u7CFB\u7EDF\u914D\u7F6E ({configs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">\u914D\u7F6E\u952E</TableHead>
                  <TableHead className="w-[120px]">\u7C7B\u578B</TableHead>
                  <TableHead>\u503C</TableHead>
                  <TableHead className="w-[200px]">\u63CF\u8FF0</TableHead>
                  <TableHead className="w-[100px]">\u66F4\u65B0\u4EBA</TableHead>
                  <TableHead className="w-[140px]">\u64CD\u4F5C</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.key} className={isFeatureFlag(config.key) ? "bg-muted/30" : ""}>
                    <TableCell>
                      <code className="text-xs font-mono">{config.key}</code>
                      {isFeatureFlag(config.key) && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">\u529F\u80FD\u5F00\u5173</Badge>
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
                            <option value="true">true (\u542F\u7528)</option>
                            <option value="false">false (\u7981\u7528)</option>
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
                          <Button size="sm" onClick={() => handleSave(config.key)}>\u4FDD\u5B58</Button>
                          <Button variant="outline" size="sm" onClick={() => setEditKey(null)}>\u53D6\u6D88</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => { setEditKey(config.key); setEditValue(config.value); }}>
                            \u7F16\u8F91
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(config.key)}>
                            \u5220\u9664
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
            <DialogTitle>\u65B0\u589E\u914D\u7F6E</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>\u914D\u7F6E\u952E *</Label>
              <Input
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="\u4F8B\u5982: feature.new_feature"
              />
            </div>
            <div className="space-y-2">
              <Label>\u503C</Label>
              <Input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="\u914D\u7F6E\u503C"
              />
            </div>
            <div className="space-y-2">
              <Label>\u63CF\u8FF0</Label>
              <Input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="\u914D\u7F6E\u8BF4\u660E"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>\u53D6\u6D88</Button>
            <Button onClick={handleAdd} disabled={!newKey}>\u521B\u5EFA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformConfig;
