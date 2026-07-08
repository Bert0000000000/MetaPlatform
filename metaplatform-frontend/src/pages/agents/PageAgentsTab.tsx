import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PAGE_AGENTS,
  AGENT_OBJECTS, AGENT_PROPERTIES, AGENT_LINKS, AGENT_ACTIONS,
  AGENT_FUNCTIONS, AGENT_RULES, AGENT_ORCHESTRATION, AGENT_SECURITY,
  AGENT_GOVERNANCE,
} from "@/components/PageAgents";
import type { PageAgentConfig } from "@/components/PageAgents";
import {
  Bot, Edit3, Save, RotateCcw, Power, CircleDot,
  MessageSquare, Settings, Trash2, Plus, CheckCircle2,
  Circle, Activity, Settings2,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * PageAgentsTab: 数字员工中心 - 页面员工 Tab
 *
 * 设计风格与「自定义员工」Tab (AgentList) 一致:
 *   - 4 个统计卡: 总数 / 在线 / 忙碌 / 离线
 *   - 大 Card 容器: Header + 标题 + 描述 + 「新建」按钮 (此处用「重置全部」)
 *   - 内部 grid-cols-3 卡片
 *   - 每张卡: Bot icon (size-8, primary) + 状态点 + 名字 + 描述
 *            + 模型/empId + type Badge
 *            + [对话/呼叫] [配置] [删除/停用]
 *   - 配置 Dialog: 编辑字段
 *
 * 数据保存: localStorage
 * ════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "mp_page_agents_overrides";
const DISABLED_KEY = "mp_page_agents_disabled";

const ALL_PAGE_AGENTS: PageAgentConfig[] = [
  AGENT_OBJECTS, AGENT_PROPERTIES, AGENT_LINKS,
  AGENT_ACTIONS, AGENT_FUNCTIONS, AGENT_RULES,
  AGENT_ORCHESTRATION, AGENT_SECURITY, AGENT_GOVERNANCE,
];

type AgentOverride = Partial<PageAgentConfig>;

function loadOverrides(): Record<string, AgentOverride> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

function loadDisabled(): Set<string> {
  try {
    const stored = localStorage.getItem(DISABLED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

function applyOverrides(base: PageAgentConfig, override: AgentOverride | undefined): PageAgentConfig {
  if (!override) return base;
  return { ...base, ...override };
}

// 状态映射 (与自定义员工 statusConfig 一致)
const statusConfig = {
  online:   { color: "bg-green-500",  label: "在线" },
  busy:     { color: "bg-yellow-500", label: "忙碌" },
  offline:  { color: "bg-gray-400",   label: "离线" },
} as const;

export function PageAgentsTab() {
  const [overrides, setOverrides] = useState<Record<string, AgentOverride>>(loadOverrides);
  const [disabled, setDisabled] = useState<Set<string>>(loadDisabled);
  const [editing, setEditing] = useState<PageAgentConfig | null>(null);
  const [editForm, setEditForm] = useState<AgentOverride>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);
  useEffect(() => {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(Array.from(disabled)));
  }, [disabled]);

  const callEmployee = useCallback((empId: string) => {
    const a = ALL_PAGE_AGENTS.find((a) => a.empId === empId);
    if (!a) return;
    const path = a.id.replace("ontology-", "/ontology/");
    window.location.href = path;
  }, []);

  const openEdit = (agent: PageAgentConfig) => {
    setEditing(agent);
    const ov = overrides[agent.id] || {};
    setEditForm({
      name: agent.name,
      role: agent.role,
      tagline: agent.tagline,
      systemPrompt: agent.systemPrompt,
      ...ov,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    setOverrides((o) => ({ ...o, [editing.id]: editForm }));
    setEditing(null);
  };

  const resetOne = (id: string) => {
    if (!confirm("确定恢复默认配置？")) return;
    setOverrides((o) => {
      const next = { ...o };
      delete next[id];
      return next;
    });
  };

  const resetAll = () => {
    if (!confirm("确定恢复所有 9 个员工的默认配置？")) return;
    setOverrides({});
  };

  // 计算状态 (已停用 = 离线, 启用 = 在线)
  const stats = {
    total: ALL_PAGE_AGENTS.length,
    online: ALL_PAGE_AGENTS.length - disabled.size,
    busy: 0,
    offline: disabled.size,
  };

  return (
    <div className="space-y-4">
      {/* 4 个统计卡 (与自定义员工一致) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="数字员工总数" value={stats.total} icon={Users} />
        <StatCard label="在线" value={stats.online} icon={Circle} />
        <StatCard label="忙碌" value={stats.busy} icon={Activity} />
        <StatCard label="离线" value={stats.offline} icon={Power} />
      </div>

      {/* 大 Card 容器: 标题 + 重置按钮 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">页面级数字员工</CardTitle>
            <CardDescription>每个本体引擎页面的专属 AI 助手 (DE-001 ~ DE-009)</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={resetAll}>
            <RotateCcw className="size-3 mr-1" />
            重置全部默认
          </Button>
        </CardHeader>
        <CardContent>
          {ALL_PAGE_AGENTS.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">暂无数字员工</div>
          )}
          {/* grid-cols-3 (与自定义员工一致) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PAGE_AGENTS.map((base) => {
              const agent = applyOverrides(base, overrides[base.id]);
              const isDisabled = disabled.has(base.id);
              const isCustomized = !!overrides[base.id];
              // 状态: 停用 = 离线, 启用 = 在线
              const status: "online" | "busy" | "offline" = isDisabled ? "offline" : "online";
              const s = statusConfig[status];
              return (
                <Card
                  key={base.id}
                  className={`cursor-pointer hover:border-primary ${
                    isDisabled ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Bot className="size-8 text-primary" />
                      <div className="flex items-center gap-1">
                        {isCustomized && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-primary/10 text-primary border-0">
                            已定制
                          </Badge>
                        )}
                        <div className={`size-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">
                      {agent.name} <span className="text-xs text-muted-foreground font-mono font-normal">{agent.empId}</span>
                    </CardTitle>
                    <CardDescription>{agent.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bot className="size-3" />
                        {agent.avatar} · {agent.capabilities.length} 项能力
                      </span>
                      <Badge variant="outline" className="text-xs">{agent.empId}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => callEmployee(agent.empId)}
                        disabled={isDisabled}
                      >
                        <MessageSquare className="size-3 mr-1" />
                        对话
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openEdit(agent)}
                      >
                        <Settings className="size-3 mr-1" />
                        配置
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (isDisabled) {
                            setDisabled((s) => {
                              const n = new Set(s); n.delete(base.id); return n;
                            });
                          } else {
                            if (!confirm(`确定停用 ${agent.name}?`)) return;
                            setDisabled((s) => new Set(s).add(base.id));
                          }
                        }}
                        title={isDisabled ? "启用" : "停用"}
                      >
                        {isDisabled ? <CheckCircle2 className="size-3" /> : <Trash2 className="size-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 配置 Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置数字员工</DialogTitle>
            <DialogDescription>
              自定义 {editing?.name} ({editing?.empId}) 的信息
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>名字</Label>
                <Input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Input
                  value={editForm.role || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>标语</Label>
                <Input
                  value={editForm.tagline || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, tagline: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>系统提示词</Label>
                <Textarea
                  value={editForm.systemPrompt || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  className="min-h-[150px] font-mono text-xs"
                  rows={8}
                />
              </div>
              {overrides[editing.id] && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resetOne(editing.id)}
                >
                  <RotateCcw className="size-3 mr-1" />
                  重置该项默认
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={saveEdit}>
              <Save className="size-3 mr-1" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 统计卡 (跟 AgentList 的 StatCard 保持一致风格)
function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          <span>{label}</span>
        </div>
        <div className="text-2xl font-bold mt-1 font-mono tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

// 注入 Users 图标
import { Users } from "lucide-react";
