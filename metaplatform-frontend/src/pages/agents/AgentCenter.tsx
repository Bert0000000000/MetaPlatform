import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mockAgents } from "@/lib/mock-data";
import { Bot, Plus, MessageSquare, Brain, Sparkles, Users, FileText, Wrench, Activity, GitBranch, Mail, Calendar, BarChart3, Zap, Clock, CheckCircle2 } from "lucide-react";

const statusConfig = {
  online: { label: "在线", color: "bg-green-500" },
  busy: { label: "忙碌", color: "bg-yellow-500" },
  offline: { label: "离线", color: "bg-gray-400" },
};

const SKILLS = [
  { name: "数据查询", icon: "🔍", category: "数据" },
  { name: "报表生成", icon: "📊", category: "数据" },
  { name: "邮件起草", icon: "📧", category: "办公" },
  { name: "会议纪要", icon: "📝", category: "办公" },
  { name: "日程安排", icon: "📅", category: "办公" },
  { name: "代码生成", icon: "💻", category: "技术" },
  { name: "合同审查", icon: "📜", category: "法务" },
  { name: "财务核算", icon: "💰", category: "财务" },
  { name: "客户分析", icon: "🤝", category: "销售" },
  { name: "供应链预测", icon: "🚚", category: "供应链" },
];

const COLLAB_HISTORY = [
  { id: 1, scenario: "Q3 销售预测报告", agents: ["数据分析", "财务分析", "业务洞察"], duration: "12 分钟", status: "completed", result: "生成报告 1 份 + 风险点 5 个" },
  { id: 2, scenario: "客户流失预警分析", agents: ["客户分析", "数据分析"], duration: "8 分钟", status: "completed", result: "识别 23 个高风险客户" },
  { id: 3, scenario: "采购合同风险审查", agents: ["合同审查", "法务助手"], duration: "20 分钟", status: "running", result: "进行中" },
  { id: 4, scenario: "员工满意度调查分析", agents: ["HR 智能体", "文本分析"], duration: "15 分钟", status: "completed", result: "输出 3 个改进建议" },
];

export function AgentList() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="数字员工总数" value={mockAgents.length} icon="👥" />
        <StatCard label="在线" value={mockAgents.filter((a) => a.status === "online").length} icon="🟢" />
        <StatCard label="今日对话" value={1864} trend={15.2} icon="💬" />
        <StatCard label="Token 用量" value="2.4M" icon="⚡" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">所有数字员工</CardTitle>
            <CardDescription>每个数字员工是一个独立的智能体</CardDescription>
          </div>
          <Button size="sm">
            <Plus className="size-3 mr-1" />
            新建数字员工
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAgents.map((a) => {
              const s = statusConfig[a.status];
              return (
                <Card key={a.id} className="cursor-pointer hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <span className="text-4xl">{a.avatar}</span>
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">{a.name}</CardTitle>
                    <CardDescription>{a.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>🤖 {a.model}</span>
                      <span>💬 {a.conversations.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      👤 {a.owner}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <MessageSquare className="size-3 mr-1" />
                        对话
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        配置
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
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
              <div className="text-2xl">{s.icon}</div>
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
            <div className="text-2xl font-semibold">12</div>
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
            <div className="text-2xl font-semibold">48</div>
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
            <div className="text-2xl font-semibold">156</div>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4" /> 运行监控
        </CardTitle>
        <CardDescription>实时智能体活动流</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {[
            { time: "12:48:32", agent: "小秘", action: "完成：起草客户拜访纪要", status: "ok" },
            { time: "12:48:18", agent: "数据分析", action: "查询：上月订单总额", status: "ok" },
            { time: "12:48:05", agent: "智能体助手", action: "对话：解答业务问题", status: "ok" },
            { time: "12:47:55", agent: "VibeCoding", action: "生成：销售报表 3 张", status: "ok" },
            { time: "12:47:42", agent: "财务分析", action: "分析：Q3 销售预测报告", status: "running" },
            { time: "12:47:30", agent: "HR 助手", action: "完成：员工满意度分析", status: "ok" },
            { time: "12:47:15", agent: "供应链", action: "失败：API 调用超时", status: "error" },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-2 border rounded text-sm">
              <Clock className="size-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{e.time}</span>
              <Badge variant="outline" className="text-xs">{e.agent}</Badge>
              <span className="flex-1 truncate">{e.action}</span>
              {e.status === "ok" && <CheckCircle2 className="size-3 text-green-500" />}
              {e.status === "running" && <Activity className="size-3 text-blue-500 animate-pulse" />}
              {e.status === "error" && <Badge variant="destructive" className="text-xs">失败</Badge>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCenter() {
  return (
    <div className="space-y-4">
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