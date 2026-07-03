import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockAgents } from "@/lib/mock-data";
import { Bot, Plus, MessageSquare, Brain, Sparkles, Users, FileText } from "lucide-react";

const statusConfig = {
  online: { label: "在线", color: "bg-green-500" },
  busy: { label: "忙碌", color: "bg-yellow-500" },
  offline: { label: "离线", color: "bg-gray-400" },
};

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
        <CardHeader>
          <CardTitle className="text-base">所有数字员工</CardTitle>
          <CardDescription>每个数字员工是一个独立的智能体</CardDescription>
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

export function AgentCollaboration() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="多智能体协作"
        description="智能体决策会议 + 委派 + 协同"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">决策会议</CardTitle>
            <CardDescription>多个智能体共同决策</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">12</div>
            <p className="text-xs text-muted-foreground">本周会议数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">任务分工</CardTitle>
            <CardDescription>基于能力匹配</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">48</div>
            <p className="text-xs text-muted-foreground">本周任务</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">协同执行</CardTitle>
            <CardDescription>委派 + 协同</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">156</div>
            <p className="text-xs text-muted-foreground">本周协同</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}