import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { agentsApi, type Agent, type AgentTask } from "@/lib/api";
import { Bot, Plus, MessageSquare, Brain, Sparkles, Users, FileText, Wrench, Activity, GitBranch, Mail, Calendar, BarChart3, Zap, Clock, CheckCircle2, Search, NotebookPen, Code, ScrollText, DollarSign, Handshake, Truck, Circle, User, Trash2, Settings, Shield, Database, Key, MemoryStick, Cpu, Eye, X } from "lucide-react";
import { PageHeader } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageAgentsTab } from "./PageAgentsTab";

const statusConfig = {
  online: { label: "在线", color: "bg-green-500" },
  busy: { label: "忙碌", color: "bg-yellow-500" },
  offline: { label: "离线", color: "bg-gray-400" },
};

const SKILLS_STORAGE_KEY = "mp_agent_skills";
const SKILLS_DEFAULT = [
  { name: "数据查询", category: "数据" },
  { name: "报表生成", category: "数据" },
  { name: "邮件起草", category: "办公" },
  { name: "会议纪要", category: "办公" },
  { name: "日程安排", category: "办公" },
  { name: "代码生成", category: "技术" },
  { name: "合同审查", category: "法务" },
  { name: "财务核算", category: "财务" },
  { name: "客户分析", category: "销售" },
  { name: "供应链预测", category: "供应链" },
];

const SKILL_ICON_MAP: Record<string, React.ElementType> = {
  "数据查询": Search, "报表生成": BarChart3, "邮件起草": Mail, "会议纪要": NotebookPen,
  "日程安排": Calendar, "代码生成": Code, "合同审查": ScrollText, "财务核算": DollarSign,
  "客户分析": Handshake, "供应链预测": Truck,
};

function loadAgentSkills(): { name: string; category: string }[] {
  try {
    const stored = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return SKILLS_DEFAULT;
}

const COLLAB_STORAGE_KEY = "mp_agent_collab";
const COLLAB_HISTORY_DEFAULT = [
  { id: 1, scenario: "Q3 销售预测报告", agents: ["数据分析", "财务分析", "业务洞察"], duration: "12 分钟", status: "completed", result: "生成报告 1 份 + 风险点 5 个" },
  { id: 2, scenario: "客户流失预警分析", agents: ["客户分析", "数据分析"], duration: "8 分钟", status: "completed", result: "识别 23 个高风险客户" },
  { id: 3, scenario: "采购合同风险审查", agents: ["合同审查", "法务助手"], duration: "20 分钟", status: "running", result: "进行中" },
  { id: 4, scenario: "员工满意度调查分析", agents: ["HR 智能体", "文本分析"], duration: "15 分钟", status: "completed", result: "输出 3 个改进建议" },
];

function loadCollabHistory() {
  try {
    const stored = localStorage.getItem(COLLAB_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return COLLAB_HISTORY_DEFAULT;
}

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", type: "assistant", model: "DeepSeek-V3" });
  const [submitting, setSubmitting] = useState(false);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([]);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await agentsApi.list();
      setAgents(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      setSubmitting(true);
      await agentsApi.create({
        name: form.name,
        description: form.description,
        type: form.type,
        model: form.model,
      });
      setDialogOpen(false);
      setForm({ name: "", description: "", type: "assistant", model: "DeepSeek-V3" });
      await loadAgents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该数字员工？")) return;
    try {
      await agentsApi.delete(id);
      await loadAgents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  function openChat(agent: Agent) {
    setChatAgent(agent);
    setChatMessages([{ role: "system", text: `你好，我是 ${agent.name}，${agent.description || agent.type}。请问有什么可以帮您？` }]);
    setChatInput("");
  }

  function sendChat() {
    if (!chatInput.trim() || !chatAgent) return;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: chatInput },
      { role: "assistant", text: `（模拟回复）已收到您的问题，正在处理中...` },
    ]);
    setChatInput("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="数字员工总数" value={agents.length} icon={Users} />
        <StatCard label="在线" value={agents.filter((a) => a.status === "online").length} icon={Circle} />
        <StatCard label="忙碌" value={agents.filter((a) => a.status === "busy").length} icon={Zap} />
        <StatCard label="离线" value={agents.filter((a) => a.status === "offline").length} icon={Activity} />
      </div>

      {loading && <div className="text-center py-8 text-muted-foreground">加载中...</div>}
      {error && <div className="text-center py-8 text-destructive">{error}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">所有数字员工</CardTitle>
            <CardDescription>每个数字员工是一个独立的智能体</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3 mr-1" />
            新建数字员工
          </Button>
        </CardHeader>
        <CardContent>
          {!loading && agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">暂无数字员工，点击上方按钮创建</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => {
              const s = statusConfig[a.status] || statusConfig.offline;
              return (
                <Card key={a.id} className="cursor-pointer hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Bot className="size-8 text-primary" />
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">{a.name}</CardTitle>
                    <CardDescription>{a.description || a.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Bot className="size-3" />{a.model || "—"}</span>
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openChat(a)}>
                        <MessageSquare className="size-3 mr-1" />
                        对话
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" disabled>
                        <Settings className="size-3 mr-1" />
                        配置
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Agent Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建数字员工</DialogTitle>
            <DialogDescription>创建一个新的 AI 智能体</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：数据助手小秘" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="该智能体的职能描述" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["assistant", "analyst", "coder", "reviewer", "support"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>模型</Label>
                <Select value={form.model} onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["DeepSeek-V3", "Qwen-Max", "GPT-4o", "Claude-3.5", "Qwen-Plus"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.name.trim()}>
              {submitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={!!chatAgent} onOpenChange={(open) => { if (!open) setChatAgent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              {chatAgent?.name}
            </DialogTitle>
            <DialogDescription>{chatAgent?.description || chatAgent?.type}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="输入消息..." />
            <Button onClick={sendChat}>
              <MessageSquare className="size-3" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AgentSkills() {
  const [skills, setSkills] = useState(loadAgentSkills);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("数据");

  /* Persist to localStorage */
  useEffect(() => {
    try { localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(skills)); } catch { /* ignore */ }
  }, [skills]);

  function handleAdd() {
    if (!newSkillName.trim()) return;
    setSkills((prev) => [...prev, { name: newSkillName.trim(), category: newSkillCategory }]);
    setNewSkillName("");
    setNewSkillCategory("数据");
    setAddDialogOpen(false);
  }

  function handleRemove(name: string) {
    setSkills((prev) => prev.filter((s) => s.name !== name));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4" /> 技能广场
          </CardTitle>
          <CardDescription>{skills.length} 类预置技能，可赋予任意数字员工</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新增技能
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {skills.map((s) => {
            const Icon = SKILL_ICON_MAP[s.name] || Wrench;
            return (
              <div key={s.name} className="rounded-lg border p-3 text-center hover:border-primary cursor-pointer group relative">
                <div className="text-2xl"><Icon className="size-6" /></div>
                <div className="font-medium text-sm mt-1">{s.name}</div>
                <Badge variant="outline" className="text-xs mt-1">{s.category}</Badge>
                <Button
                  variant="ghost" size="icon" className="size-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleRemove(s.name); }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增技能</DialogTitle>
            <DialogDescription>添加一个新技能到技能广场</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>技能名称</Label>
              <Input value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="如：数据查询" />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={newSkillCategory} onValueChange={setNewSkillCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["数据", "办公", "技术", "法务", "财务", "销售", "供应链", "其他"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!newSkillName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AgentCollaboration() {
  const [meetings, setMeetings] = useState(loadCollabHistory);
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const [newScenario, setNewScenario] = useState("");
  const [newAgents, setNewAgents] = useState("");

  /* Persist to localStorage */
  useEffect(() => {
    try { localStorage.setItem(COLLAB_STORAGE_KEY, JSON.stringify(meetings)); } catch { /* ignore */ }
  }, [meetings]);

  function handleLogCollaboration() {
    if (!newScenario.trim()) return;
    const agentList = newAgents.split(",").map((s) => s.trim()).filter(Boolean);
    const newEntry = {
      id: Date.now(),
      scenario: newScenario.trim(),
      agents: agentList.length > 0 ? agentList : ["未知智能体"],
      duration: "刚刚",
      status: "running" as const,
      result: "进行中",
    };
    setMeetings((prev: typeof meetings) => [newEntry, ...prev]);
    setNewScenario("");
    setNewAgents("");
    setCollabDialogOpen(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" /> 决策会议
            </CardTitle>
            <CardDescription>多个智能体共同决策</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{meetings.length}</div>
            <p className="text-xs text-muted-foreground">进行中的会议</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="size-4" /> 任务分工
            </CardTitle>
            <CardDescription>基于能力匹配</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">48</div>
            <p className="text-xs text-muted-foreground">本周任务</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> 协同执行
            </CardTitle>
            <CardDescription>委派 + 协同</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">156</div>
            <p className="text-xs text-muted-foreground">本周协同</p>
          </CardContent>
        </Card>
      </div>

      {/* Decision Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> 决策会议记录
          </CardTitle>
          <CardDescription>多智能体协同决策会话</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{m.scenario}</div>
                    <div className="text-xs text-muted-foreground mt-1">耗时: {m.duration}</div>
                  </div>
                  <Badge variant={m.status === "completed" ? "secondary" : "default"} className={m.status === "completed" ? "text-green-600" : ""}>
                    {m.status === "completed" ? "已结束" : "进行中"}
                  </Badge>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {m.agents.map((a: string) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                </div>
                {m.result && m.result !== "进行中" && (
                  <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                    <span className="font-medium">决策结果: </span>{m.result}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">协作历史</CardTitle>
            <CardDescription>多智能体协作执行的场景记录</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCollabDialogOpen(true)}>
            <Plus className="size-3 mr-1" />
            发起协作
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">场景</th>
                <th className="px-4 py-2 font-medium">参与的智能体</th>
                <th className="px-4 py-2 font-medium">耗时</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">结果</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.scenario}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {c.agents.map((ag) => (
                        <Badge key={ag} variant="outline" className="text-xs">{ag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.duration}</td>
                  <td className="px-4 py-3">
                    {c.status === "completed" && <Badge variant="secondary" className="text-green-600"><CheckCircle2 className="size-3 mr-1" />完成</Badge>}
                    {c.status === "running" && <Badge className="bg-blue-500">进行中</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Collaboration Dialog */}
      <Dialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发起多智能体协作</DialogTitle>
            <DialogDescription>记录一次新的智能体协作事件</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>协作场景</Label>
              <Input value={newScenario} onChange={(e) => setNewScenario(e.target.value)} placeholder="如：Q3 销售预测报告" />
            </div>
            <div className="space-y-2">
              <Label>参与智能体（逗号分隔）</Label>
              <Input value={newAgents} onChange={(e) => setNewAgents(e.target.value)} placeholder="如：数据分析, 财务分析" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollabDialogOpen(false)}>取消</Button>
            <Button onClick={handleLogCollaboration} disabled={!newScenario.trim()}>发起协作</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AgentMonitor() {
  const [tasks, setTasks] = useState<(AgentTask & { agentName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const agents = await agentsApi.list();
        const allTasks: (AgentTask & { agentName: string })[] = [];
        for (const agent of agents.slice(0, 5)) {
          try {
            const agentTasks = await agentsApi.listTasks(agent.id);
            agentTasks.forEach((t) => allTasks.push({ ...t, agentName: agent.name }));
          } catch {
            // skip agent if tasks fetch fails
          }
        }
        setTasks(allTasks);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4" /> 运行监控
        </CardTitle>
        <CardDescription>实时智能体活动流（{tasks.length} 条记录）</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-center py-8 text-muted-foreground">加载中...</div>}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">暂无任务记录</div>
        )}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2 border rounded text-sm">
              <Clock className="size-3 text-muted-foreground shrink-0" />
              <Badge variant="outline" className="text-xs">{t.agentName}</Badge>
              <span className="flex-1 truncate">{t.title}</span>
              {t.status === "completed" && <CheckCircle2 className="size-3 text-green-500" />}
              {t.status === "running" && <Activity className="size-3 text-blue-500 animate-pulse" />}
              {t.status === "failed" && <Badge variant="destructive" className="text-xs">失败</Badge>}
              {t.status === "pending" && <Badge variant="outline" className="text-xs">待执行</Badge>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCenter() {
  const [agentCount, setAgentCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    agentsApi.list().then((data) => {
      setAgentCount(data.length);
      setOnlineCount(data.filter((a) => a.status === "online").length);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            数字员工中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            数字员工、技能广场、多智能体协作与运行监控（共 {agentCount} 位，{onlineCount} 位在线）
          </p>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新建数字员工
        </Button>
      </div>

      <Tabs defaultValue="page-agents">
        <TabsList>
          <TabsTrigger value="page-agents">页面员工</TabsTrigger>
          <TabsTrigger value="list">自定义员工</TabsTrigger>
          <TabsTrigger value="skills">技能广场</TabsTrigger>
          <TabsTrigger value="collab">多智能体协作</TabsTrigger>
          <TabsTrigger value="monitor">运行监控</TabsTrigger>
        </TabsList>
        <TabsContent value="page-agents" className="mt-4">
          <PageAgentsTab />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <AgentList />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <AgentSkills />
        </TabsContent>
        <TabsContent value="collab" className="mt-4">
          <AgentCollaboration />
        </TabsContent>
        <TabsContent value="monitor" className="mt-4">
          <AgentMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────── AgentIdentity ─────────────────── */
const AGENT_IDENTITIES = [
  { id: 1, name: "数据分析助手", personality: "严谨、专业", memory: "长期记忆 2,480 条", context: "业务知识 + 历史对话", avatar: "Bot" },
  { id: 2, name: "财务审核员", personality: "细致、合规", memory: "长期记忆 1,820 条", context: "财务制度 + 审批规则", avatar: "Bot" },
  { id: 3, name: "客户画像师", personality: "洞察、主动", memory: "长期记忆 3,240 条", context: "客户数据 + 行为分析", avatar: "Bot" },
];

/* ── Memory Management (F11.5) ── */
const MEMORY_ENTRIES = [
  { id: 1, agent: "数据分析助手", key: "Q3 销售目标", value: "总目标 4.2 亿，华东 1.8 亿", type: "长期", created: "2 天前", lastAccess: "30 分钟前" },
  { id: 2, agent: "数据分析助手", key: "客户分级标准", value: "VIP: >100万, A: >50万, B: >10万", type: "长期", created: "1 周前", lastAccess: "2 小时前" },
  { id: 3, agent: "财务审核员", key: "审批阈值", value: "<1万自动通过, <10万部门经理, >=10万VP", type: "系统", created: "3 天前", lastAccess: "1 小时前" },
  { id: 4, agent: "客户画像师", key: "RFM 模型参数", value: "R=30天, F=3次, M=5000元", type: "长期", created: "5 天前", lastAccess: "4 小时前" },
  { id: 5, agent: "数据分析助手", key: "常用 SQL 模板", value: "SELECT region, SUM(amount) FROM orders...", type: "短期", created: "1 小时前", lastAccess: "刚刚" },
];

export function AgentIdentity() {
  const [memorySearch, setMemorySearch] = useState("");
  const [memories, setMemories] = useState(MEMORY_ENTRIES);
  const filteredMemories = memories.filter((m) => m.key.includes(memorySearch) || m.agent.includes(memorySearch));

  function deleteMemory(id: number) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="身份与记忆" description="管理数字员工的身份设定、记忆系统和上下文配置" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="已配置身份" value={AGENT_IDENTITIES.length} icon={User} />
        <StatCard label="总记忆条数" value="7,540" icon={Brain} />
        <StatCard label="上下文窗口" value="128K" icon={Database} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENT_IDENTITIES.map((a) => (
          <Card key={a.id} className="hover:border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <Bot className="size-8 text-primary" />
                <Button variant="ghost" size="icon" className="size-8"><Settings className="size-4" /></Button>
              </div>
              <CardTitle className="text-base mt-2">{a.name}</CardTitle>
              <CardDescription>性格: {a.personality}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Brain className="size-3" /><span>{a.memory}</span></div>
                <div className="flex items-center gap-2"><Database className="size-3" /><span>上下文: {a.context}</span></div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3">管理记忆</Button>
            </CardContent>
          </Card>
        ))}
      {/* Memory Management Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="size-4" /> 记忆管理
            </CardTitle>
            <CardDescription>管理智能体的长期记忆条目（{memories.length} 条）</CardDescription>
          </div>
          <div className="relative">
            <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)} placeholder="搜索记忆..." className="pl-7 h-8 w-48 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>智能体</TableHead>
                <TableHead>记忆键</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>最近访问</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMemories.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.agent}</TableCell>
                  <TableCell className="font-medium">{m.key}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{m.value}</TableCell>
                  <TableCell><Badge variant={m.type === "系统" ? "default" : m.type === "长期" ? "secondary" : "outline"}>{m.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.lastAccess}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => deleteMemory(m.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </div>
    </div>
  );
}

/* ─────────────────── AgentWorkspace ─────────────────── */
export function AgentWorkspace() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="工作空间" description="为数字员工分配独立的工作空间和资源" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="工作空间" value={5} icon={Wrench} />
        <StatCard label="运行中的任务" value={8} icon={Activity} />
        <StatCard label="存储使用" value="2.4 GB" icon={Database} />
        <StatCard label="API 配额" value="12,480/天" icon={Zap} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> 工作空间列表</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "数据分析空间", agent: "数据分析助手", storage: "1.2 GB", tasks: 3, status: "active" },
              { name: "财务审核空间", agent: "财务审核员", storage: "0.8 GB", tasks: 2, status: "active" },
              { name: "客户画像空间", agent: "客户画像师", storage: "0.4 GB", tasks: 3, status: "active" },
            ].map((w) => (
              <div key={w.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium text-sm">{w.name}</div>
                  <div className="text-xs text-muted-foreground">分配给: {w.agent} / 存储: {w.storage} / 任务: {w.tasks}</div>
                </div>
                <Badge variant="default">运行中</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AgentPermissions ─────────────────── */
export function AgentPermissions() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="权限渠道" description="管理数字员工的数据访问权限和消息推送渠道" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4" /> 数据权限</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { agent: "数据分析助手", access: "只读", data: "销售数据 + 客户数据" },
                { agent: "财务审核员", access: "读写", data: "财务数据 + 审批记录" },
                { agent: "客户画像师", access: "只读", data: "客户数据 + 行为数据" },
              ].map((p) => (
                <div key={p.agent} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium text-sm">{p.agent}</div>
                    <div className="text-xs text-muted-foreground">数据范围: {p.data}</div>
                  </div>
                  <Badge variant={p.access === "读写" ? "default" : "secondary"}>{p.access}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="size-4" /> 消息渠道</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "飞书 Webhook", status: "已配置", agents: "全部" },
                { name: "邮件 SMTP", status: "已配置", agents: "财务审核员" },
                { name: "企业微信", status: "未配置", agents: "-" },
                { name: "短信通知", status: "未配置", agents: "-" },
              ].map((c) => (
                <div key={c.name} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">适用: {c.agents}</div>
                  </div>
                  <Badge variant={c.status === "已配置" ? "default" : "outline"}>{c.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── IM Channel Configuration (F11.6) ── */
export function AgentIMChannel() {
  const [channels, setChannels] = useState([
    { id: 1, name: "飞书 Bot", platform: "飞书", webhook: "https://open.feishu.cn/...", status: "connected", agents: "全部" },
    { id: 2, name: "钉钉机器人", platform: "钉钉", webhook: "https://oapi.dingtalk.com/...", status: "connected", agents: "数据分析助手" },
    { id: 3, name: "企微 Bot", platform: "企微", webhook: "", status: "disconnected", agents: "-" },
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="IM 渠道接入" description="配置飞书、钉钉、企业微信 Bot 接入" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {channels.map((ch) => (
          <Card key={ch.id} className="hover:border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="text-2xl">{ch.platform === "飞书" ? "F" : ch.platform === "钉钉" ? "D" : "W"}</div>
                <Badge variant={ch.status === "connected" ? "default" : "outline"}>{ch.status === "connected" ? "已连接" : "未连接"}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{ch.name}</CardTitle>
              <CardDescription>适用: {ch.agents}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Webhook URL</Label>
                  <Input placeholder="输入 Webhook URL" defaultValue={ch.webhook} className="text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">App ID</Label>
                  <Input placeholder="App ID" className="text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">App Secret</Label>
                  <Input type="password" placeholder="App Secret" className="text-xs" />
                </div>
                <Button size="sm" className="w-full">{ch.status === "connected" ? "更新配置" : "连接"}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── AgentModel ─────────────────── */
export function AgentModel() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="模型及用量" description="管理数字员工的模型配置和 Token 用量监控" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="本月 Token" value="1,248,000" icon={Cpu} />
        <StatCard label="本月费用" value="¥386" icon={DollarSign} />
        <StatCard label="日均调用" value="2,480" icon={Activity} />
        <StatCard label="平均延迟" value="156ms" icon={Clock} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="size-4" /> 模型用量明细</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>数字员工</TableHead><TableHead>模型</TableHead><TableHead>本月 Token</TableHead><TableHead>费用</TableHead><TableHead>日均调用</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { name: "数据分析助手", model: "DeepSeek-V3", tokens: "520K", cost: "¥156", daily: 1040, status: "normal" },
                { name: "财务审核员", model: "Qwen-Max", tokens: "380K", cost: "¥114", daily: 760, status: "normal" },
                { name: "客户画像师", model: "GPT-4o", tokens: "348K", cost: "¥116", daily: 680, status: "warning" },
              ].map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-mono text-xs">{m.model}</Badge></TableCell>
                  <TableCell>{m.tokens}</TableCell>
                  <TableCell>{m.cost}</TableCell>
                  <TableCell>{m.daily}</TableCell>
                  <TableCell><Badge variant={m.status === "normal" ? "default" : "outline"} className={m.status === "warning" ? "text-orange-500" : ""}>{m.status === "normal" ? "正常" : "接近上限"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}