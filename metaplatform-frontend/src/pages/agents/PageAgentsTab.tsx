import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/DigitalEmployee";
import {
  PAGE_AGENTS,
  AGENT_OBJECTS, AGENT_PROPERTIES, AGENT_LINKS, AGENT_ACTIONS,
  AGENT_FUNCTIONS, AGENT_RULES, AGENT_ORCHESTRATION, AGENT_SECURITY,
  AGENT_GOVERNANCE,
} from "@/components/PageAgents";
import type { PageAgentConfig } from "@/components/PageAgents";
import {
  Bot, Edit3, Save, RotateCcw, Sparkles, Power, CheckCircle2,
  MessageCircle, Calendar, Phone, PhoneOff, Settings2, Activity,
  BookOpen, CircleDot, X, Plus,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * PageAgentsTab: 数字员工中心 - 页面员工 Tab
 *
 * 显示 9 个内置数字员工 (DE-001 ~ DE-009), 每个:
 *   - 卡片: 半圆矩形头像 + 名字 + 工号 + 角色 + 性格 + 能力 + 状态
 *   - 操作: 配置 (打开 Dialog 编辑) / 启用停用 / 重置默认 / 立即呼叫
 *   - 配置 Dialog: 编辑 emoji 头像/名字/角色/性格/能力/系统提示词
 *
 * 数据保存: localStorage (key: mp_page_agents_overrides)
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

export function PageAgentsTab() {
  const [overrides, setOverrides] = useState<Record<string, AgentOverride>>(loadOverrides);
  const [disabled, setDisabled] = useState<Set<string>>(loadDisabled);
  const [editing, setEditing] = useState<PageAgentConfig | null>(null);
  const [editForm, setEditForm] = useState<AgentOverride>({});
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);
  useEffect(() => {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(Array.from(disabled)));
  }, [disabled]);

  // 通话: 路由跳转 + 打开数字员工
  const callEmployee = useCallback((empId: string) => {
    const a = ALL_PAGE_AGENTS.find((a) => a.empId === empId);
    if (!a) return;
    const path = a.id.replace("ontology-", "/ontology/");
    window.location.hash = `#${path}`;
    window.location.href = path;
  }, []);

  const toggleDisabled = (id: string) => {
    setDisabled((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openEdit = (agent: PageAgentConfig) => {
    setEditing(agent);
    const ov = overrides[agent.id] || {};
    setEditForm({
      name: agent.name,
      role: agent.role,
      avatar: agent.avatar,
      tagline: agent.tagline,
      personality: agent.personality,
      capabilities: agent.capabilities,
      systemPrompt: agent.systemPrompt,
      accentColor: agent.accentColor,
      ...ov,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    setOverrides((o) => ({ ...o, [editing.id]: editForm }));
    setEditing(null);
  };

  const resetOne = (id: string) => {
    if (!confirm("确定恢复默认配置？所有自定义修改将丢失。")) return;
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

  // 过滤
  const filtered = ALL_PAGE_AGENTS.filter((a) => {
    if (filter === "enabled") return !disabled.has(a.id);
    if (filter === "disabled") return disabled.has(a.id);
    return true;
  });

  // 统计
  const enabledCount = ALL_PAGE_AGENTS.length - disabled.size;
  const disabledCount = disabled.size;
  const customizedCount = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      {/* 顶部统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>总员工数</span>
            </div>
            <div className="text-2xl font-bold mt-1 font-mono tabular-nums">{ALL_PAGE_AGENTS.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">DE-001 ~ DE-009</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-green-500" />
              <span>已启用</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600 font-mono tabular-nums">{enabledCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">出现在页面右下角</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Power className="size-3.5 text-gray-400" />
              <span>已停用</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-gray-500 font-mono tabular-nums">{disabledCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">不出现</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Edit3 className="size-3.5 text-primary" />
              <span>已定制</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-primary font-mono tabular-nums">{customizedCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">修改过默认配置</div>
          </CardContent>
        </Card>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border bg-muted/30">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "enabled" | "disabled")}>
          <TabsList>
            <TabsTrigger value="all">全部 ({ALL_PAGE_AGENTS.length})</TabsTrigger>
            <TabsTrigger value="enabled">已启用 ({enabledCount})</TabsTrigger>
            <TabsTrigger value="disabled">已停用 ({disabledCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex gap-2">
          {customizedCount > 0 && (
            <Button size="sm" variant="outline" onClick={resetAll}>
              <RotateCcw className="size-3.5 mr-1" /> 全部重置默认
            </Button>
          )}
        </div>
      </div>

      {/* 员工卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((base) => {
          const agent = applyOverrides(base, overrides[base.id]);
          const isDisabled = disabled.has(base.id);
          const isCustomized = !!overrides[base.id];
          return (
            <Card
              key={base.id}
              className={`relative overflow-hidden transition-all ${
                isDisabled ? "opacity-50 grayscale" : "hover:shadow-md"
              }`}
            >
              {/* 渐变顶条 */}
              <div
                className="h-1.5 w-full"
                style={{ background: agent.accentColor || "linear-gradient(90deg, #2563eb, #7c3aed)" }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <EmployeeAvatar avatar={agent.avatar} size={56} online={!isDisabled} empId={agent.empId} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-base">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{agent.empId}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{agent.role}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {isCustomized && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-0">
                          已定制
                        </Badge>
                      )}
                      {isDisabled ? (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-gray-200 text-gray-500 border-0">
                          <Power className="size-2 mr-0.5" /> 已停用
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-green-100 text-green-700 border-0">
                          <CircleDot className="size-2 mr-0.5 animate-pulse" /> 在线
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-2 pb-4 space-y-3">
                {/* 标语 */}
                <p className="text-xs text-muted-foreground italic">{agent.tagline}</p>

                {/* 性格标签 */}
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Activity className="size-2.5" /> 性格
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {agent.personality.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] h-5 px-1.5">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 能力列表 */}
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <BookOpen className="size-2.5" /> 能力 ({agent.capabilities.length})
                  </div>
                  <ul className="text-[11px] space-y-0.5 max-h-16 overflow-hidden text-ellipsis">
                    {agent.capabilities.slice(0, 3).map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-1">{c}</span>
                      </li>
                    ))}
                    {agent.capabilities.length > 3 && (
                      <li className="text-[10px] text-muted-foreground">+{agent.capabilities.length - 3} 项更多</li>
                    )}
                  </ul>
                </div>

                <Separator />

                {/* 操作 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs gap-1"
                    onClick={() => callEmployee(agent.empId)}
                    disabled={isDisabled}
                  >
                    <Phone className="size-3" /> 呼叫
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => openEdit(agent)}
                  >
                    <Settings2 className="size-3" /> 配置
                  </Button>
                  <Button
                    size="sm"
                    variant={isDisabled ? "default" : "ghost"}
                    className="h-7 text-xs gap-1"
                    onClick={() => toggleDisabled(base.id)}
                  >
                    <Power className="size-3" /> {isDisabled ? "启用" : "停用"}
                  </Button>
                  {isCustomized && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => resetOne(base.id)}
                      title="恢复默认"
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 配置 Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-5" />
              配置数字员工
            </DialogTitle>
            <DialogDescription>
              自定义 {editing?.name} ({editing?.empId}) 的形象、性格、能力与系统提示词
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              {/* 头像预览 */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <EmployeeAvatar avatar={editForm.avatar || editing.avatar} size={56} empId={editing.empId} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{editForm.name || editing.name}</div>
                  <div className="text-xs text-muted-foreground">{editForm.role || editing.role}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{editing.empId}</div>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">头像 Emoji</Label>
                  <Input
                    value={editForm.avatar || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, avatar: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="🧱"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-xs">名字</Label>
                  <Input
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="砖小妹"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">角色 / 职位</Label>
                  <Input
                    value={editForm.role || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="对象建模专员"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">一句话标语</Label>
                  <Input
                    value={editForm.tagline || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, tagline: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="你的对象建模专员, 一砖一瓦搭业务"
                  />
                </div>
              </div>

              {/* 性格 */}
              <div>
                <Label className="text-xs">性格 (逗号分隔)</Label>
                <Input
                  value={(editForm.personality || []).join(", ")}
                  onChange={(e) => setEditForm((f) => ({
                    ...f,
                    personality: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }))}
                  className="h-8 text-sm"
                  placeholder="严谨细致, 结构化思维, 爱用 ASCII 图"
                />
              </div>

              {/* 能力 */}
              <div>
                <Label className="text-xs">能力 (每行一条)</Label>
                <Textarea
                  value={(editForm.capabilities || []).join("\n")}
                  onChange={(e) => setEditForm((f) => ({
                    ...f,
                    capabilities: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  }))}
                  className="text-sm min-h-[100px] font-mono"
                  rows={5}
                />
              </div>

              {/* 系统提示词 */}
              <div>
                <Label className="text-xs">系统提示词 (LLM prompt)</Label>
                <Textarea
                  value={editForm.systemPrompt || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  className="text-xs min-h-[150px] font-mono"
                  rows={8}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  此 prompt 会在用户向 {editing.name} 提问时发送给 LLM
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={saveEdit}>
              <Save className="size-3.5 mr-1" /> 保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 注入 Users 图标 (从 lucide-react)
import { Users } from "lucide-react";
