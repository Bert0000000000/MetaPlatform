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
import { Bot, Plus, MessageSquare, Brain, Sparkles, Users, FileText, Wrench, Activity, GitBranch, Mail, Calendar, BarChart3, Zap, Clock, CheckCircle2, Search, NotebookPen, Code, ScrollText, DollarSign, Handshake, Truck, Circle, User, Trash2, Settings } from "lucide-react";

const statusConfig = {
  online: { label: "在线", color: "bg-green-500" },
  busy: { label: "忙碌", color: "bg-yellow-500" },
  offline: { label: "离线", color: "bg-gray-400" },
};

const SKILLS = [
  { name: "数据查询", icon: Search, category: "数据" },
  { name: "报表生成", icon: BarChart3, category: "数据" },
  { name: "邮件起草", icon: Mail, category: "办公" },
  { name: "会议纪要", icon: NotebookPen, category: "办公" },
  { name: "日程安排", icon: Calendar, category: "办公" },
  { name: "代码生成", icon: Code, category: "技术" },
  { name: "合同审查", icon: ScrollText, category: "法务" },
  { name: "财务核算", icon: DollarSign, category: "财务" },
  { name: "客户分析", icon: Handshake, category: "销售" },
  { name: "供应链预测", icon: Truck, category: "供应链" },
];

const COLLAB_HISTORY = [
  { id: 1, scenario: "Q3 销售预测报告", agents: ["数据分析", "财务分析", "业务洞察"], duration: "12 分钟", status: "completed", result: "生成报告 1 份 + 风险点 5 个" },
  { id: 2, scenario: "客户流失预警分析", agents: ["客户分析", "数据分析"], duration: "8 分钟", status: "completed", result: "识别 23 个高风险客户" },
  { id: 3, scenario: "采购合同风险审查", agents: ["合同审查", "法务助手"], duration: "20 分钟", status: "running", result: "进行中" },
  { id: 4, scenario: "员工满意度调查分析", agents: ["HR 智能体", "文本分析"], duration: "15 分钟", status: "completed", result: "输出 3 个改进建议" },
];

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="size-4" /> 技能广场
        </CardTitle>
        <CardDescription>10 类预置技能，可赋予任意数字员工</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {SKILLS.map((s) => (
            <div key={s.name} className="rounded-lg border p-3 text-center hover:border-primary cursor-pointer">
              <div className="text-2xl"><s.icon className="size-6" /></div>
              <div className="font-medium text-sm mt-1">{s.name}</div>
              <Badge variant="outline" className="text-xs mt-1">{s.category}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCollaboration() {
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
            <div className="text-xl font-semibold">12</div>
            <p className="text-xs text-muted-foreground">本周会议数</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">协作历史</CardTitle>
          <CardDescription>多智能体协作执行的场景记录</CardDescription>
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
              {COLLAB_HISTORY.map((c) => (
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

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">数字员工</TabsTrigger>
          <TabsTrigger value="skills">技能广场</TabsTrigger>
          <TabsTrigger value="collab">多智能体协作</TabsTrigger>
          <TabsTrigger value="monitor">运行监控</TabsTrigger>
        </TabsList>
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