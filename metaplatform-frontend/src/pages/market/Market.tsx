import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Download, Boxes, Sparkles, Workflow, BookOpen, Code, Plus, Package, Bot, Store, Users, DollarSign, Check, Crown, Building2, Briefcase, Sprout, X, Search, Eye, FileText, Zap, Globe } from "lucide-react";
import { marketApi } from "@/lib/api";

/* ── 本体模板初始数据（本地状态管理，无 market API） ── */
// TODO: Replace with real API call when backend is ready (no market API exists yet)
const INITIAL_TEMPLATES = [
  { id: "t-1", name: "CRM 通用模板", type: "本体模板", industry: "通用", downloads: 12480, rating: 4.8, price: "免费" as const, author: "百特搭官方" },
  { id: "t-2", name: "HR 全套", type: "本体模板", industry: "通用", downloads: 8921, rating: 4.7, price: "免费" as const, author: "百特搭官方" },
  { id: "t-3", name: "财务记账", type: "工作流", industry: "金融", downloads: 5430, rating: 4.6, price: "免费" as const, author: "生态合作" },
  { id: "t-4", name: "销售智能体", type: "Agent", industry: "通用", downloads: 3210, rating: 4.9, price: "订阅" as const, author: "ISV" },
  { id: "t-5", name: "OCR 文字识别", type: "Skill", industry: "通用", downloads: 9876, rating: 4.5, price: "免费" as const, author: "百特搭官方" },
  { id: "t-6", name: "HR 简历解析", type: "本体模板", industry: "人力资源", downloads: 4210, rating: 4.4, price: "免费" as const, author: "百特搭官方" },
  { id: "t-7", name: "供应链预测", type: "Agent", industry: "供应链", downloads: 2180, rating: 4.7, price: "订阅" as const, author: "供应链实验室" },
  { id: "t-8", name: "合同审查流程", type: "工作流", industry: "法务", downloads: 3560, rating: 4.5, price: "付费" as const, author: "法智 AI" },
];

/* ── Toast helper ── */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

const priceVariant = {
  免费: "default" as const,
  "¥99": "secondary" as const,
  "¥299": "secondary" as const,
  "¥999": "secondary" as const,
  付费: "secondary" as const,
  订阅: "outline" as const,
};

const MOCK_TEMPLATES_WITH_PRICE = [
  { id: "p-1", name: "CRM 通用模板", type: "本体模板", industry: "通用", downloads: 12480, rating: 4.8, price: "免费", author: "百特搭官方" },
  { id: "p-2", name: "HR 全套", type: "本体模板", industry: "通用", downloads: 8921, rating: 4.7, price: "¥99", author: "百特搭官方" },
  { id: "p-3", name: "财务记账", type: "工作流", industry: "金融", downloads: 5430, rating: 4.6, price: "免费", author: "生态合作" },
  { id: "p-4", name: "销售智能体", type: "Agent", industry: "通用", downloads: 3210, rating: 4.9, price: "¥299", author: "ISV" },
  { id: "p-5", name: "OCR 文字识别", type: "Skill", industry: "通用", downloads: 9876, rating: 4.5, price: "免费", author: "百特搭官方" },
  { id: "p-6", name: "供应链预测 Pro", type: "Agent", industry: "供应链", downloads: 2180, rating: 4.7, price: "¥999", author: "供应链实验室" },
];

const AGENT_MARKET = [
  { id: 1, name: "财务月结智能体", desc: "自动跑账、生成报表、异常告警", author: "MetaPlatform 官方", installs: 4820, rating: 4.9, price: "免费", category: "财务" },
  { id: 2, name: "客户画像分析", desc: "基于 RFM + 标签体系的客户分群", author: "数澜科技", installs: 2840, rating: 4.8, price: "订阅", category: "营销" },
  { id: 3, name: "合同审查助手", desc: "自动比对合同条款、识别风险点", author: "法智 AI", installs: 1820, rating: 4.7, price: "付费", category: "法务" },
  { id: 4, name: "供应链预测", desc: "基于历史销量的需求预测", author: "供应链实验室", installs: 1240, rating: 4.6, price: "订阅", category: "供应链" },
  { id: 5, name: "HR 简历筛选", desc: "自动评估候选人匹配度", author: "招聘专家", installs: 980, rating: 4.5, price: "付费", category: "HR" },
];

const MY_SUBSCRIPTIONS_INIT = [
  { id: 1, name: "数据可视化 Pro", author: "MetaPlatform", price: "¥299/月", nextBill: "2026-08-01", status: "active", usage: "本月调用 1,248 次" },
  { id: 2, name: "AI 翻译接口", author: "TranslateAI", price: "¥0.02/千字", nextBill: "按用量", status: "active", usage: "本月翻译 12,400 字" },
  { id: 3, name: "OCR 识别服务", author: "视觉智能", price: "¥0.1/次", nextBill: "按用量", status: "active", usage: "本月识别 348 次" },
  { id: 4, name: "高级图表库", author: "ChartPro", price: "¥99/月", nextBill: "2026-07-15", status: "expiring", usage: "续费提醒" },
];

const DEVELOPERS = [
  { rank: 1, name: "数澜科技", apps: 18, downloads: 28400, revenue: "¥86,400", badge: Crown },
  { rank: 2, name: "MetaPlatform 官方", apps: 24, downloads: 24600, revenue: "¥0", badge: Building2 },
  { rank: 3, name: "法智 AI", apps: 12, downloads: 18420, revenue: "¥42,800", badge: Star },
  { rank: 4, name: "供应链实验室", apps: 8, downloads: 12400, revenue: "¥18,200", badge: Briefcase },
  { rank: 5, name: "招聘专家", apps: 6, downloads: 9800, revenue: "¥12,600", badge: Sprout },
];

const CATEGORIES = [
  { name: "本体模板", count: 86, icon: Boxes, color: "bg-blue-500" },
  { name: "Skill", count: 42, icon: Sparkles, color: "bg-purple-500" },
  { name: "Agent", count: 38, icon: Workflow, color: "bg-green-500" },
  { name: "工作流", count: 28, icon: Package, color: "bg-yellow-500" },
  { name: "知识包", count: 32, icon: BookOpen, color: "bg-red-500" },
  { name: "API", count: 19, icon: Code, color: "bg-indigo-500" },
];

/* ── Category name → template type filter mapping ── */
const CATEGORY_FILTER_MAP: Record<string, string> = {
  "本体模板": "本体模板",
  "Skill": "Skill",
  "Agent": "Agent",
  "工作流": "工作流",
  "知识包": "知识包",
  "API": "API",
};

/* ─────────────────── OntologyTemplates ─────────────────── */
interface OntologyTemplatesProps {
  installedTemplates: Set<string>;
  onInstall: (id: string, name: string) => void;
  filterCategory?: string | null;
}

function OntologyTemplates({ installedTemplates, onInstall, filterCategory }: OntologyTemplatesProps) {
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);

  /* Fetch templates from API */
  useEffect(() => {
    marketApi.listTemplates(filterCategory || undefined).then((data) => {
      if (data && data.length > 0) {
        setTemplates(data.map((t: any) => ({
          id: t.id,
          name: t.name,
          type: t.category || "general",
          industry: t.category || "通用",
          downloads: t.downloads || 0,
          rating: t.rating || 4.5,
          price: t.price === 0 ? "免费" as const : `¥${t.price}` as any,
          author: t.author || "未知",
        })));
      }
    }).catch(() => {});
  }, [filterCategory]);

  let displayTemplates = templates.filter((t) => t.type === "本体模板" || t.type === "工作流");
  if (filterCategory) {
    displayTemplates = templates.filter((t) => t.type === filterCategory);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="size-4" /> 本体行业模板
          {filterCategory && (
            <Badge variant="secondary" className="ml-2">
              筛选: {filterCategory}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>按行业 / 场景划分的本体模板</CardDescription>
      </CardHeader>
      <CardContent>
        {displayTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="size-8 mb-2" />
            <p className="text-sm">该分类暂无模板</p>
          </div>
        ) : (
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
              {displayTemplates.map((t) => {
                const isInstalled = installedTemplates.has(t.id);
                return (
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
                      {isInstalled ? (
                        <Badge variant="secondary" className="text-green-600">
                          <Check className="size-3 mr-1" /> 已安装
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => onInstall(t.id, t.name)}>
                          安装
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────── AgentMarket ─────────────────── */
interface AgentMarketProps {
  installedAgents: Set<number>;
  onInstall: (id: number, name: string) => void;
}

function AgentMarket({ installedAgents, onInstall }: AgentMarketProps) {
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
          {AGENT_MARKET.map((a) => {
            const isInstalled = installedAgents.has(a.id);
            return (
              <div key={a.id} className="rounded-lg border p-4 hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center">
                      <Bot className="size-6" />
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
                  {isInstalled ? (
                    <Badge variant="secondary" className="text-green-600">
                      <Check className="size-3 mr-1" /> 已安装
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => onInstall(a.id, a.name)}>
                      <Check className="size-3 mr-1" />
                      安装
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────── MySubscriptions ─────────────────── */
interface MySubscriptionsProps {
  onRenew: (name: string) => void;
}

function MySubscriptions({ onRenew }: MySubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState(MY_SUBSCRIPTIONS_INIT);

  function handleRenew(id: number, name: string) {
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "active", nextBill: "2026-08-15", usage: "续费成功" } : s
      )
    );
    onRenew(name);
  }

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
            {subscriptions.map((s) => (
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
                  {s.status === "expiring" ? (
                    <Button variant="default" size="sm" onClick={() => handleRenew(s.id, s.name)}>
                      续费
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleRenew(s.id, s.name)}>
                      续费
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─────────────────── DeveloperRank ─────────────────── */
function DeveloperRank() {
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
                  <d.badge className="size-5 inline" />
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

/* ─────────────────── MarketDashboard (main) ─────────────────── */
export function MarketDashboard() {
  const [installedTemplates, setInstalledTemplates] = useState<Set<string>>(new Set());
  const [installedAgents, setInstalledAgents] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const { toast, setToast } = useToast();

  /* Install template handler */
  function handleInstallTemplate(id: string, name: string) {
    marketApi.installTemplate(id).catch(() => {});
    setInstalledTemplates((prev) => new Set(prev).add(id));
    setToast(`安装成功：${name}`);
  }

  /* Install agent handler */
  function handleInstallAgent(id: number, name: string) {
    setInstalledAgents((prev) => new Set(prev).add(id));
    setToast(`安装成功：${name}`);
  }

  /* Renew handler */
  function handleRenew(name: string) {
    setToast(`${name} 续费成功`);
  }

  /* Category card click → filter templates */
  function handleCategoryClick(categoryName: string) {
    const filterType = CATEGORY_FILTER_MAP[categoryName];
    if (filterType) {
      setFilterCategory(filterType);
      setActiveTab("ontology");
    }
  }

  /* Clear filter */
  function handleClearFilter() {
    setFilterCategory(null);
  }

  const totalInstalled = installedTemplates.size + installedAgents.size;

  return (
    <div className="space-y-4 p-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Store className="size-5 text-primary" />
            云市场
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            本体模板、Skill、智能体、工作流、知识包订阅与开发者生态
          </p>
        </div>
        <Button size="sm" onClick={() => setActiveTab("subs")}>
          <Package className="size-3 mr-1" />
          我订阅的
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="模板总数" value={245} icon={Package} />
        <StatCard label="本月下载" value={12480} trend={18.5} icon={Download} />
        <StatCard label="活跃开发者" value={186} icon={Code} />
        <StatCard label="已安装应用" value={32 + totalInstalled} icon={Check} />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "ontology") setFilterCategory(null); }}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="ontology">本体模板</TabsTrigger>
          <TabsTrigger value="agents">智能体</TabsTrigger>
          <TabsTrigger value="subs">我的订阅</TabsTrigger>
          <TabsTrigger value="rank">开发者排行</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <Card
                  key={c.name}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleCategoryClick(c.name)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`${c.color} text-white size-12 rounded-lg flex items-center justify-center mx-auto`}>
                      <Icon className="size-6" />
                    </div>
                    <div className="font-medium text-sm mt-2">{c.name}</div>
                    <div className="text-xl font-semibold mt-1">{c.count}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <OntologyTemplates
            installedTemplates={installedTemplates}
            onInstall={handleInstallTemplate}
            filterCategory={filterCategory}
          />
        </TabsContent>

        <TabsContent value="ontology" className="mt-4">
          {filterCategory && (
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary">当前筛选: {filterCategory}</Badge>
              <Button variant="ghost" size="sm" onClick={handleClearFilter}>
                <X className="size-3 mr-1" />
                清除筛选
              </Button>
            </div>
          )}
          <OntologyTemplates
            installedTemplates={installedTemplates}
            onInstall={handleInstallTemplate}
            filterCategory={filterCategory}
          />
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <AgentMarket
            installedAgents={installedAgents}
            onInstall={handleInstallAgent}
          />
        </TabsContent>

        <TabsContent value="subs" className="mt-4">
          <MySubscriptions onRenew={handleRenew} />
        </TabsContent>

        <TabsContent value="rank" className="mt-4">
          <DeveloperRank />
        </TabsContent>
        <TabsContent value="developer" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="size-4" /> 成为开发者
              </CardTitle>
              <CardDescription>注册成为云市场开发者，发布模板和应用</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>开发者名称</Label><Input placeholder="公司或个人名称" /></div>
                  <div className="space-y-2"><Label>联系邮箱</Label><Input type="email" placeholder="developer@example.com" /></div>
                  <div className="space-y-2"><Label>开发者类型</Label>
                    <Select defaultValue="individual">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">个人开发者</SelectItem>
                        <SelectItem value="enterprise">企业开发者</SelectItem>
                        <SelectItem value="partner">生态合作伙伴</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>擅长领域</Label><Input placeholder="e.g. CRM, 供应链, AI" /></div>
                  <div className="space-y-2"><Label>简介</Label><Textarea placeholder="简要介绍你的开发经验和优势" rows={3} /></div>
                  <Button className="w-full"><Plus className="size-3 mr-1" /> 提交入驻申请</Button>
                </div>
                <div className="space-y-4">
                  <div className="text-lg font-semibold">开发者权益</div>
                  {[
                    { icon: Star, title: "收益分成", desc: "应用销售收入的 70% 归开发者" },
                    { icon: Users, title: "流量扶持", desc: "优质应用获得首页推荐" },
                    { icon: Sparkles, title: "技术支持", desc: "专属技术支持通道" },
                    { icon: Building2, title: "品牌认证", desc: "官方认证开发者标识" },
                  ].map((b) => (
                    <div key={b.title} className="flex items-start gap-3 p-3 border rounded-lg">
                      <b.icon className="size-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{b.title}</div>
                        <div className="text-xs text-muted-foreground">{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Standalone wrapper components for route-level usage (no props needed) ── */
export function OntologyTemplatesPage() {
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const { toast, setToast } = useToast();
  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}
      <OntologyTemplates
        installedTemplates={installed}
        onInstall={(id, name) => { setInstalled((prev) => new Set(prev).add(id)); setToast(`安装成功：${name}`); }}
      />
    </div>
  );
}

export function AgentMarketPage() {
  const [installed, setInstalled] = useState<Set<number>>(new Set());
  const { toast, setToast } = useToast();
  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}
      <AgentMarket
        installedAgents={installed}
        onInstall={(id, name) => { setInstalled((prev) => new Set(prev).add(id)); setToast(`安装成功：${name}`); }}
      />
    </div>
  );
}

export function MySubscriptionsPage() {
  const { toast, setToast } = useToast();
  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}
      <MySubscriptions onRenew={(name) => setToast(`${name} 续费成功`)} />
    </div>
  );
}

export function DeveloperRankPage() {
  return (
    <div className="p-4">
      <DeveloperRank />
    </div>
  );
}

/* ── Skill Market page ── */
const SKILL_MARKET = [
  { id: 1, name: "数据查询 Skill", author: "MetaPlatform", desc: "自然语言查询数据库", installs: 6240, rating: 4.8, price: "免费" },
  { id: 2, name: "文档解析 Skill", author: "数澜科技", desc: "PDF/Word/Excel 智能解析", installs: 4180, rating: 4.7, price: "免费" },
  { id: 3, name: "代码审查 Skill", author: "DevAI", desc: "AI 代码审查与优化建议", installs: 3640, rating: 4.6, price: "订阅" },
  { id: 4, name: "合同分析 Skill", author: "法智 AI", desc: "合同条款提取与风险识别", installs: 2880, rating: 4.9, price: "付费" },
  { id: 5, name: "报表生成 Skill", author: "MetaPlatform", desc: "自动生成 Excel/PDF 报表", installs: 5120, rating: 4.5, price: "免费" },
];

export function SkillMarketPage() {
  const [installed, setInstalled] = useState<Set<number>>(new Set());
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Skill 市场</h1>
          <p className="text-sm text-muted-foreground mt-1">可复用的 AI 技能组件，赋予智能体新能力</p>
        </div>
        <Button size="sm"><Plus className="size-3 mr-1" />发布 Skill</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SKILL_MARKET.map((s) => (
          <Card key={s.id} className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="size-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center"><Sparkles className="size-5" /></div>
                <Badge variant={s.price === "免费" ? "default" : "secondary"}>{s.price}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{s.name}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Download className="size-3" />{s.installs.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" />{s.rating}</span>
                </div>
                {installed.has(s.id) ? (
                  <Badge variant="secondary" className="text-green-600"><Check className="size-3 mr-1" />已安装</Badge>
                ) : (
                  <Button size="sm" onClick={() => setInstalled((prev) => new Set(prev).add(s.id))}>安装</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── Workflow Templates page ── */
const WORKFLOW_TEMPLATES = [
  { id: 1, name: "采购审批流程模板", category: "采购", nodes: 5, author: "MetaPlatform", installs: 3240, rating: 4.7 },
  { id: 2, name: "员工入职流程模板", category: "HR", nodes: 8, author: "HR 专家", installs: 2180, rating: 4.6 },
  { id: 3, name: "合同签署流程模板", category: "法务", nodes: 6, author: "法智 AI", installs: 1860, rating: 4.8 },
  { id: 4, name: "费用报销流程模板", category: "财务", nodes: 4, author: "MetaPlatform", installs: 4520, rating: 4.5 },
  { id: 5, name: "Bug 修复流程模板", category: "研发", nodes: 7, author: "DevAI", installs: 1440, rating: 4.4 },
];

export function WorkflowTemplatesPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Workflow className="size-5 text-primary" /> 工作流模板</h1>
          <p className="text-sm text-muted-foreground mt-1">开箱即用的业务流程模板，一键导入</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Workflow className="size-4" /> 模板列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>分类</TableHead><TableHead>节点数</TableHead><TableHead>作者</TableHead><TableHead>下载量</TableHead><TableHead>评分</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {WORKFLOW_TEMPLATES.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                  <TableCell>{t.nodes}</TableCell>
                  <TableCell className="text-xs">{t.author}</TableCell>
                  <TableCell>{t.installs.toLocaleString()}</TableCell>
                  <TableCell><span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" />{t.rating}</span></TableCell>
                  <TableCell className="text-right"><Button size="sm">安装</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Knowledge Packages page ── */
const KNOWLEDGE_PACKAGES = [
  { id: 1, name: "制造业知识包", docs: 248, author: "行业专家", installs: 1840, category: "制造业" },
  { id: 2, name: "零售业知识包", docs: 186, author: "零售研究院", installs: 1320, category: "零售" },
  { id: 3, name: "金融合规知识包", docs: 320, author: "合规 AI", installs: 2460, category: "金融" },
  { id: 4, name: "HR 政策知识包", docs: 124, author: "HR 专家", installs: 960, category: "人力资源" },
];

export function KnowledgePackagesPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><BookOpen className="size-5 text-primary" /> 知识包资源库</h1>
          <p className="text-sm text-muted-foreground mt-1">行业知识包，可直接订阅并应用于智能体</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {KNOWLEDGE_PACKAGES.map((k) => (
          <Card key={k.id} className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="size-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 text-white flex items-center justify-center"><BookOpen className="size-5" /></div>
                <Badge variant="secondary">{k.category}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{k.name}</CardTitle>
              <CardDescription>{k.docs} 篇文档 / {k.author}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground"><Download className="size-3 inline mr-1" />{k.installs.toLocaleString()} 次安装</span>
                <Button size="sm">订阅</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── API Library page ── */
const API_LIBRARY = [
  { id: 1, name: "订单管理 API", category: "电商", endpoints: 12, author: "MetaPlatform", version: "v2.1" },
  { id: 2, name: "客户管理 API", category: "CRM", endpoints: 8, author: "MetaPlatform", version: "v1.8" },
  { id: 3, name: "支付接口 API", category: "支付", endpoints: 6, author: "PayTech", version: "v3.0" },
  { id: 4, name: "短信通知 API", category: "通知", endpoints: 4, author: "阿里云", version: "v1.2" },
  { id: 5, name: "OCR 识别 API", category: "AI", endpoints: 5, author: "视觉智能", version: "v2.5" },
];

export function APILibraryPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Code className="size-5 text-primary" /> API 动作库</h1>
          <p className="text-sm text-muted-foreground mt-1">标准化 API 接口，可直接集成到流程和智能体</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code className="size-4" /> API 列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>分类</TableHead><TableHead>端点数</TableHead><TableHead>作者</TableHead><TableHead>版本</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {API_LIBRARY.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                  <TableCell>{a.endpoints}</TableCell>
                  <TableCell className="text-xs">{a.author}</TableCell>
                  <TableCell className="font-mono text-xs">{a.version}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm"><Eye className="size-3 mr-1" />查看</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
