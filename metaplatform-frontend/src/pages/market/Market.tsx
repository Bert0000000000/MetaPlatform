import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockTemplates } from "@/lib/mock-data";
import { Star, Download, Boxes, Sparkles, Workflow, BookOpen, Code, Plus, Package, Bot, Store, Users, DollarSign, Check } from "lucide-react";

const priceVariant = {
  免费: "default" as const,
  付费: "secondary" as const,
  订阅: "outline" as const,
};

const AGENT_MARKET = [
  { id: 1, name: "财务月结智能体", desc: "自动跑账、生成报表、异常告警", author: "MetaPlatform 官方", installs: 4820, rating: 4.9, price: "免费", category: "财务" },
  { id: 2, name: "客户画像分析", desc: "基于 RFM + 标签体系的客户分群", author: "数澜科技", installs: 2840, rating: 4.8, price: "订阅", category: "营销" },
  { id: 3, name: "合同审查助手", desc: "自动比对合同条款、识别风险点", author: "法智 AI", installs: 1820, rating: 4.7, price: "付费", category: "法务" },
  { id: 4, name: "供应链预测", desc: "基于历史销量的需求预测", author: "供应链实验室", installs: 1240, rating: 4.6, price: "订阅", category: "供应链" },
  { id: 5, name: "HR 简历筛选", desc: "自动评估候选人匹配度", author: "招聘专家", installs: 980, rating: 4.5, price: "付费", category: "HR" },
];

const MY_SUBSCRIPTIONS = [
  { id: 1, name: "数据可视化 Pro", author: "MetaPlatform", price: "¥299/月", nextBill: "2026-08-01", status: "active", usage: "本月调用 1,248 次" },
  { id: 2, name: "AI 翻译接口", author: "TranslateAI", price: "¥0.02/千字", nextBill: "按用量", status: "active", usage: "本月翻译 12,400 字" },
  { id: 3, name: "OCR 识别服务", author: "视觉智能", price: "¥0.1/次", nextBill: "按用量", status: "active", usage: "本月识别 348 次" },
  { id: 4, name: "高级图表库", author: "ChartPro", price: "¥99/月", nextBill: "2026-07-15", status: "expiring", usage: "续费提醒" },
];

const DEVELOPERS = [
  { rank: 1, name: "数澜科技", apps: 18, downloads: 28400, revenue: "¥86,400", badge: "👑" },
  { rank: 2, name: "MetaPlatform 官方", apps: 24, downloads: 24600, revenue: "¥0", badge: "🏢" },
  { rank: 3, name: "法智 AI", apps: 12, downloads: 18420, revenue: "¥42,800", badge: "⭐" },
  { rank: 4, name: "供应链实验室", apps: 8, downloads: 12400, revenue: "¥18,200", badge: "💼" },
  { rank: 5, name: "招聘专家", apps: 6, downloads: 9800, revenue: "¥12,600", badge: "🌱" },
];

export function OntologyTemplates() {
  const templates = mockTemplates.filter((t) => t.type === "本体模板" || t.type === "工作流");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="size-4" /> 本体行业模板
        </CardTitle>
        <CardDescription>按行业 / 场景划分的本体模板</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>行业</TableHead>
              <TableHead className="text-right">下载</TableHead>
              <TableHead>评分</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>作者</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                <TableCell>{t.industry}</TableCell>
                <TableCell className="text-right">{t.downloads.toLocaleString()}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                    {t.rating}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={priceVariant[t.price]}>{t.price}</Badge>
                </TableCell>
                <TableCell>{t.author}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm">安装</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AgentMarket() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4" /> AI 智能体市场
        </CardTitle>
        <CardDescription>已上架 38 个企业级 AI 智能体</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AGENT_MARKET.map((a) => (
            <div key={a.id} className="rounded-lg border p-4 hover:border-primary">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-xl">
                    🤖
                  </div>
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.author}</div>
                  </div>
                </div>
                <Badge variant={priceVariant[a.price as keyof typeof priceVariant]}>{a.price}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{a.desc}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Download className="size-3" />{a.installs.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" />{a.rating}</span>
                  <Badge variant="outline" className="text-xs">{a.category}</Badge>
                </div>
                <Button size="sm">
                  <Check className="size-3 mr-1" />
                  安装
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MySubscriptions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="size-4" /> 我的订阅
        </CardTitle>
        <CardDescription>已订阅的付费服务与应用</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>服务名</TableHead>
              <TableHead>提供方</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>用量</TableHead>
              <TableHead>下次计费</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MY_SUBSCRIPTIONS.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.author}</TableCell>
                <TableCell className="text-xs">{s.price}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.usage}</TableCell>
                <TableCell className="text-xs">{s.nextBill}</TableCell>
                <TableCell>
                  {s.status === "active" && <Badge variant="secondary" className="text-green-600">生效中</Badge>}
                  {s.status === "expiring" && <Badge variant="outline" className="text-orange-500">即将到期</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">续费</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DeveloperRank() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4" /> 开发者排行榜
        </CardTitle>
        <CardDescription>本月云市场最活跃的开发者</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>排名</TableHead>
              <TableHead>开发者</TableHead>
              <TableHead className="text-right">应用数</TableHead>
              <TableHead className="text-right">下载量</TableHead>
              <TableHead className="text-right">收入</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEVELOPERS.map((d) => (
              <TableRow key={d.rank}>
                <TableCell>
                  <span className="text-2xl">{d.badge}</span>
                  <span className="ml-2 font-mono">#{d.rank}</span>
                </TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-right">{d.apps}</TableCell>
                <TableCell className="text-right">{d.downloads.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-sm">{d.revenue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function MarketDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="模板总数" value={245} icon="📦" />
        <StatCard label="本月下载" value={12480} trend={18.5} icon="⬇️" />
        <StatCard label="活跃开发者" value={186} icon="👨‍💻" />
        <StatCard label="已安装应用" value={32} icon="✅" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="ontology">本体模板</TabsTrigger>
          <TabsTrigger value="agents">智能体</TabsTrigger>
          <TabsTrigger value="subs">我的订阅</TabsTrigger>
          <TabsTrigger value="rank">开发者排行</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "本体模板", count: 86, icon: Boxes, color: "bg-blue-500" },
              { name: "Skill", count: 42, icon: Sparkles, color: "bg-purple-500" },
              { name: "Agent", count: 38, icon: Workflow, color: "bg-green-500" },
              { name: "工作流", count: 28, icon: Package, color: "bg-yellow-500" },
              { name: "知识包", count: 32, icon: BookOpen, color: "bg-red-500" },
              { name: "API", count: 19, icon: Code, color: "bg-indigo-500" },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.name} className="cursor-pointer hover:border-primary">
                  <CardContent className="p-4 text-center">
                    <div className={`${c.color} text-white size-12 rounded-lg flex items-center justify-center mx-auto`}>
                      <Icon className="size-6" />
                    </div>
                    <div className="font-medium text-sm mt-2">{c.name}</div>
                    <div className="text-2xl font-semibold mt-1">{c.count}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <OntologyTemplates />
        </TabsContent>

        <TabsContent value="ontology" className="mt-4">
          <OntologyTemplates />
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <AgentMarket />
        </TabsContent>

        <TabsContent value="subs" className="mt-4">
          <MySubscriptions />
        </TabsContent>

        <TabsContent value="rank" className="mt-4">
          <DeveloperRank />
        </TabsContent>
      </Tabs>
    </div>
  );
}