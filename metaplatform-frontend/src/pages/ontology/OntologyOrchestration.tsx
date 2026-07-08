/**
 * 本体引擎 — 业务流程编排
 *
 * 把 8 要素 (对象/属性/关系/动作/函数/规则) 串成一个真实可触发的
 * 端到端业务流 (P2P 采购场景), 让用户能:
 *   1. 看完整数据模型
 *   2. 提交 PR → 真实触发表单校验 / 业务规则 / 事件流
 *   3. 审批 PR → 真实启动工作流, 多步推进
 *   4. 看事件流 (action / rule / workflow / alert)
 *   5. 模拟规则违反 (批量巡检)
 *
 * 业务联动全部走 ontologyStore (in-memory mock),
 * 事件全部走 ontologyBus (in-memory pub/sub)。
 * 跨组件: 多个组件同时订阅 bus, 触发时所有订阅者实时更新。
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/stat";
import { StatCard } from "@/components/ui/stat";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Dna, Plus, Play, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  ShoppingCart, FileText, Package, Truck, Receipt, Wallet, Users,
  Activity, Zap, GitBranch, Eye, ListChecks, ArrowRight, Bell, Filter,
  RotateCcw, Sparkles, Bot, PlayCircle, UserCircle2, Square, Cpu, MessageSquare,
} from "lucide-react";
import { ontologyStore, type PurchaseRequest, type Supplier } from "@/lib/ontology-store";
import { ontologyBus, useOntologyEvents, TYPE_LABEL, LEVEL_CLS, type OntologyEvent } from "@/lib/ontology-eventbus";

/* ───── 工具 ───── */
const fmtMoney = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour12: false });
};

const STATUS_CLS: Record<PurchaseRequest["status"], string> = {
  草稿: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400",
  待审批: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  已批准: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  已驳回: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/* ═════════════ 主组件 ═════════════ */
export default function OntologyOrchestration() {
  const events = useOntologyEvents("*");
  // 注: 反馈统一走事件流面板 (用户可切到「事件流」tab 查看实时触发)
  // 避免依赖外部 toast hook, 全部在 in-memory 内闭环

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="业务流程编排"
        description="P2P 采购全流程 — 对象 / 动作 / 规则 / 事件 真实可触发"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 bg-primary/10 text-primary border-0">
              <Dna className="size-3" /> 8 要素联动
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                ontologyStore.simulateRuleViolation();
              }}
            >
              <ShieldAlert className="size-3.5 mr-1" />
              模拟规则巡检
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => ontologyBus.clear()}
            >
              <RotateCcw className="size-3.5 mr-1" />
              清空事件
            </Button>
          </div>
        }
      />

      {/* 概览指标 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          label="供应商数"
          value={String(ontologyStore.suppliers.length)}
          icon={Users}
        />
        <StatCard
          label="采购申请"
          value={String(ontologyStore.purchaseRequests.length)}
          icon={FileText}
          sub={`${ontologyStore.purchaseRequests.filter((p) => p.status === "待审批").length} 条待审批`}
        />
        <StatCard
          label="采购订单"
          value={String(ontologyStore.purchaseOrders.length)}
          icon={ShoppingCart}
        />
        <StatCard
          label="事件流"
          value={String(events.length)}
          icon={Activity}
          sub={`${events.filter((e) => e.level === "warning" || e.level === "error").length} 条告警`}
        />
      </div>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="bg-transparent gap-0 p-0 relative h-11 border-b w-full justify-start rounded-none">
          <TabsTrigger value="workflow" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <GitBranch className="size-3.5" /> 业务流演示
          </TabsTrigger>
          <TabsTrigger value="submit" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <Plus className="size-3.5" /> 提交新 PR
          </TabsTrigger>
          <TabsTrigger value="approve" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <CheckCircle2 className="size-3.5" /> 审批待办
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <Eye className="size-3.5" /> 数据模型
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <Bot className="size-3.5" /> 真实模拟器
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] px-3">
            <Bell className="size-3.5" /> 事件流
            {events.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {events.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 工作流展示 */}
        <TabsContent value="workflow" className="mt-4">
          <WorkflowCanvas />
        </TabsContent>

        {/* 提交新 PR */}
        <TabsContent value="submit" className="mt-4">
          <SubmitPRForm />
        </TabsContent>

        {/* 审批待办 */}
        <TabsContent value="approve" className="mt-4">
          <ApprovalQueue />
        </TabsContent>

        {/* 数据模型 */}
        <TabsContent value="model" className="mt-4">
          <DataModelPanel />
        </TabsContent>

        {/* 真实模拟器 */}
        <TabsContent value="simulator" className="mt-4">
          <SimulatorPanel />
        </TabsContent>

        {/* 事件流 */}
        <TabsContent value="events" className="mt-4">
          <EventStream events={events} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═════════════ 业务流画布 — 展示 P2P 流程图 ═════════════ */
function WorkflowCanvas() {
  const steps = [
    { key: "supplier", label: "供应商主数据", icon: Users, color: "blue", desc: "5 家合格供应商, 等级 A/B/C" },
    { key: "pr", label: "采购申请 PR", icon: FileText, color: "amber", desc: `${ontologyStore.purchaseRequests.length} 条 PR, ${ontologyStore.purchaseRequests.filter(p => p.status === "待审批").length} 待审批` },
    { key: "rule", label: "业务规则校验", icon: ShieldAlert, color: "purple", desc: "R-001 金额阈值 / R-002 供应商等级 / R-003 标题" },
    { key: "po", label: "采购订单 PO", icon: ShoppingCart, color: "green", desc: `${ontologyStore.purchaseOrders.length} 条 PO, 自动从 PR 转单` },
    { key: "gr", label: "收货单 GR", icon: Truck, color: "cyan", desc: `${ontologyStore.goodsReceipts.length} 条收货记录` },
    { key: "inv", label: "发票", icon: Receipt, color: "orange", desc: `${ontologyStore.invoices.length} 张发票, 3-way match` },
    { key: "pay", label: "付款", icon: Wallet, color: "pink", desc: "Net 30/60 账期" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="size-4" /> P2P 端到端流程 (Purchase-to-Pay)
          </CardTitle>
          <CardDescription>
            7 步真实业务流 — 每一步都对应本体引擎中的对象/动作/函数/规则要素
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[140px] max-w-[160px]">
                    <div className={`size-12 rounded-xl bg-${s.color}-100 dark:bg-${s.color}-900/30 text-${s.color}-600 dark:text-${s.color}-400 flex items-center justify-center mb-2 ring-2 ring-${s.color}-200 dark:ring-${s.color}-800`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="text-xs font-semibold text-center">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground text-center mt-1 px-1">
                      {s.desc}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground/40 mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="size-4" /> 业务规则清单
            </CardTitle>
            <CardDescription>提交 PR 时会按顺序校验</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: "R-001", name: "金额阈值", cond: "amount >= 50,000", action: "需总监审批", severity: "高" },
              { id: "R-002", name: "供应商等级", cond: "supplier.rating == C AND amount > 10,000", action: "走特殊审批", severity: "中" },
              { id: "R-003", name: "标题非空", cond: "title.trim().length > 0", action: "拒绝提交", severity: "低" },
            ].map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <code className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                  {r.id}
                </code>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.cond}</div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{r.action}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4" /> 服务编排 (Orchestration)
            </CardTitle>
            <CardDescription>审批 PR 时触发的多步工作流</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/20">
                <span className="size-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span>校验业务规则 (R-001/002/003)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                <span className="size-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                <span>变更状态 待审批 → 已批准</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/20">
                <span className="size-5 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                <span>自动转采购订单 (PO)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-50 dark:bg-purple-950/20">
                <span className="size-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">4</span>
                <span>触发供应商协同通知 (mock)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═════════════ 提交新 PR 表单 ═════════════ */
function SubmitPRForm() {
  const [title, setTitle] = useState("");
  const [supplierId, setSupplierId] = useState(ontologyStore.suppliers[0].id);
  const [amount, setAmount] = useState<number | "">(10000);
  const [category, setCategory] = useState("办公设备");
  const [requester] = useState("张伟"); // 当前用户 mock

  function handleSubmit() {
    const result = ontologyStore.submitPurchaseRequest({
      title,
      supplierId,
      requester,
      amount: Number(amount) || 0,
      category,
    });
    if (result.ok) {
      ontologyBus.emit({
        type: "alert.raised",
        level: "success",
        message: `✓ ${result.pr!.prNo} 提交成功, 无规则违反`,
        payload: { pr: result.pr },
      });
    } else {
      ontologyBus.emit({
        type: "alert.raised",
        level: "error",
        message: `✗ ${result.pr!.prNo} 提交但触发 ${result.violations.length} 条规则违反`,
        payload: { pr: result.pr, violations: result.violations },
      });
    }
    setTitle("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="size-4" /> 新建采购申请
        </CardTitle>
        <CardDescription>
          提交后立即触发 3 条业务规则校验 + 事件流记录
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>PR 标题 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 研发部 8 月服务器扩容"
            />
          </div>
          <div className="space-y-2">
            <Label>供应商</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ontologyStore.suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · 等级 {s.rating} · {s.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>金额 (¥) *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>类别</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="办公设备">办公设备</SelectItem>
                <SelectItem value="IT 硬件">IT 硬件</SelectItem>
                <SelectItem value="市场">市场</SelectItem>
                <SelectItem value="日常">日常</SelectItem>
                <SelectItem value="原材料">原材料</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>申请人</Label>
            <Input value={requester} disabled />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
          <div className="font-medium text-sm">提示 — 试这几个组合看规则触发:</div>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>标题留空 → R-003 触发</li>
            <li>金额 ≥ 50,000 → R-001 触发 (需总监审批)</li>
            <li>选"易达办公用品" (等级 C) + 金额 &gt; 10,000 → R-002 触发</li>
            <li>同时违反 2-3 条 → 多个告警 + 1 个汇总 alert.raised</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            <Play className="size-3.5 mr-1" /> 提交 PR (触发规则校验)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═════════════ 审批待办 ═════════════ */
function ApprovalQueue() {
  const [, setTick] = useState(0); // 强制刷新 (store 引用同一对象)
  const pending = ontologyStore.purchaseRequests.filter((p) => p.status === "待审批");

  // 简单订阅 store 变化 (重新读取)
  useEffect(() => {
    const off = ontologyBus.on("object.updated", () => setTick((n) => n + 1));
    const off2 = ontologyBus.on("object.created", () => setTick((n) => n + 1));
    return () => { off(); off2(); };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="size-4" /> 待审批 ({pending.length})
        </CardTitle>
        <CardDescription>
          点击"批准"启动 4 步服务编排 (校验 → 状态变更 → 自动转 PO → 通知)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {pending.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            ✓ 暂无待审批 PR
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR 编号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>申请人</TableHead>
                <TableHead>类别</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => {
                const sup = ontologyStore.suppliers.find((s) => s.id === p.supplierId);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.prNo}</TableCell>
                    <TableCell className="font-medium text-sm">{p.title}</TableCell>
                    <TableCell className="text-sm">{sup?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(p.amount)}</TableCell>
                    <TableCell className="text-sm">{p.requester}</TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <ApproveButton pr={p} onApprove={() => {
                        ontologyBus.emit({
                          type: "alert.raised",
                          level: "info",
                          message: `✓ 审批工作流已启动 — 4 步流程 (校验 → 状态 → 转 PO → 通知)`,
                        });
                      }} />
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

function ApproveButton({ pr, onApprove }: { pr: PurchaseRequest; onApprove: () => void }) {
  const [open, setOpen] = useState(false);
  const [approver, setApprover] = useState("李娜");
  const [comment, setComment] = useState("同意");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-3.5 mr-1" /> 批准
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审批 {pr.prNo}</DialogTitle>
            <DialogDescription>
              {pr.title} · {fmtMoney(pr.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>审批人</Label>
              <Input value={approver} onChange={(e) => setApprover(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>审批意见</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  pr.amount >= 50000
                    ? "金额 ≥ 50,000, 审批意见需含「总监」才能通过 R-001 规则"
                    : "请填写审批意见"
                }
              />
            </div>
            {pr.amount >= 50000 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ 规则 R-001 提示: 此 PR 需总监审批
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                const r = ontologyStore.approvePurchaseRequest(pr.id, approver, comment);
                if (r.ok) {
                  onApprove();
                }
                setOpen(false);
              }}
            >
              提交审批
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═════════════ 数据模型面板 (8 要素) ═════════════ */
function DataModelPanel() {
  const { suppliers, purchaseRequests, purchaseOrders, goodsReceipts, invoices } = ontologyStore;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <EntityCard
        icon={Users} title="Supplier" subtitle="供应商" count={suppliers.length} color="blue"
        fields={["id", "code", "name", "rating (A/B/C)", "region", "paymentTerms", "onTimeRate"]}
        sample={suppliers[0]}
      />
      <EntityCard
        icon={FileText} title="PurchaseRequest" subtitle="采购申请 PR" count={purchaseRequests.length} color="amber"
        fields={["id", "prNo", "title", "supplierId", "amount", "status (草稿/待审批/已批准/已驳回)", "createdAt"]}
        sample={purchaseRequests[0]}
      />
      <EntityCard
        icon={ShoppingCart} title="PurchaseOrder" subtitle="采购订单 PO" count={purchaseOrders.length} color="green"
        fields={["id", "poNo", "prId ← PR", "supplierId ← Supplier", "amount", "status", "expectedDate"]}
        sample={purchaseOrders[0]}
      />
      <EntityCard
        icon={Truck} title="GoodsReceipt" subtitle="收货单 GR" count={goodsReceipts.length} color="cyan"
        fields={["id", "grNo", "poId ← PO", "receivedQty", "status (签收/待质检/合格/不合格)"]}
        sample={goodsReceipts[0]}
      />
      <EntityCard
        icon={Receipt} title="Invoice" subtitle="发票" count={invoices.length} color="orange"
        fields={["id", "invoiceNo", "poId ← PO", "amount", "status (待匹配/已匹配/已付款/异常)"]}
        sample={invoices[0]}
      />
      <EntityCard
        icon={Zap} title="Action / Rule / Function" subtitle="动作 / 规则 / 函数" count={0} color="purple"
        fields={["Action: 创建订单 / 查询 / 更新 / 编排", "Rule: R-001/002/003 业务规则", "Function: 总额计算 / 风险评估 / AI 编排"]}
        sample={null}
      />
    </div>
  );
}

function EntityCard({
  icon: Icon, title, subtitle, count, color, fields, sample,
}: {
  icon: React.ElementType; title: string; subtitle: string; count: number; color: string;
  fields: string[]; sample: unknown;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`size-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 flex items-center justify-center`}>
              <Icon className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="text-[11px]">{subtitle}</CardDescription>
            </div>
          </div>
          {count > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-[11px] font-medium text-muted-foreground mb-1.5">属性 / Properties</div>
        <div className="space-y-0.5 mb-2">
          {fields.map((f) => (
            <div key={f} className="text-[11px] font-mono text-foreground/80">• {f}</div>
          ))}
        </div>
        {Boolean(sample) && (
          <>
            <div className="text-[11px] font-medium text-muted-foreground mb-1">实例 / Instance</div>
            <pre className="text-[10px] bg-muted/40 rounded p-1.5 overflow-x-auto max-h-20 font-mono leading-tight">
              {JSON.stringify(sample, null, 0).slice(0, 200)}
            </pre>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ═════════════ 事件流面板 ═════════════ */
function EventStream({ events }: { events: OntologyEvent[] }) {
  const [filter, setFilter] = useState<"all" | "warning" | "workflow" | "object">("all");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "all") return true;
      if (filter === "warning") return e.level === "warning" || e.level === "error";
      if (filter === "workflow") return e.type.startsWith("workflow");
      if (filter === "object") return e.type.startsWith("object");
      return true;
    });
  }, [events, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> 实时事件流
            </CardTitle>
            <CardDescription>
              全局事件总线实时记录所有对象 / 动作 / 规则 / 工作流事件
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            {[
              { v: "all", l: "全部" },
              { v: "warning", l: "告警" },
              { v: "workflow", l: "工作流" },
              { v: "object", l: "对象" },
            ].map((f) => (
              <Button
                key={f.v}
                size="sm"
                variant={filter === f.v ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setFilter(f.v as typeof filter)}
              >
                {f.l}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">暂无事件</p>
            <p className="text-xs mt-1">点击「提交新 PR」或「模拟规则巡检」触发</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <span className={`shrink-0 size-2 rounded-full mt-1.5 ${
                  e.level === "success" ? "bg-green-500" :
                  e.level === "warning" ? "bg-amber-500" :
                  e.level === "error" ? "bg-red-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className={`text-[10px] h-4 px-1 border-0 ${LEVEL_CLS[e.level]}`}>
                      {TYPE_LABEL[e.type]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {fmtTime(e.ts)}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5 break-words">{e.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═════════════ 真实模拟器 (Persona + Scenario) ═════════════
 *
 * 模拟真实用户/系统 自动跑业务流:
 *   1. Persona (4 个): 王芳 (采购员) / 李娜 (部门经理) / 陈强 (总监) / 系统巡检 Bot
 *   2. Scenario (3 个剧本): 正常流程 / 需总监审批 / 多重违规
 *   3. 执行: 用 setTimeout 推进 step, 真实调 store + emit bus
 *   4. 实时反馈: ApprovalQueue + 事件流 + 概览指标 全部自动更新
 */
type PersonaId = "wangfang" | "lina" | "chenqiang" | "bot";
type ScenarioId = "happy" | "need_director" | "multi_violation";

interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  icon: React.ElementType;
  color: string;
  canApproveUpTo: number; // 元; 超过需上级
  emoji: string;
}

interface ScenarioStep {
  delay: number;           // ms
  description: string;
  execute: () => void;
}

interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  expectedEvents: number;  // 预期产生多少事件
  steps: ScenarioStep[];
}

const PERSONAS: Record<PersonaId, Persona> = {
  wangfang:   { id: "wangfang",   name: "王芳", role: "采购员",         icon: UserCircle2, color: "blue",   canApproveUpTo: 0,   emoji: "👩‍💼" },
  lina:       { id: "lina",       name: "李娜", role: "部门经理",       icon: UserCircle2, color: "green",  canApproveUpTo: 50_000, emoji: "👩‍💻" },
  chenqiang:  { id: "chenqiang",  name: "陈强", role: "总监",           icon: UserCircle2, color: "purple", canApproveUpTo: 500_000, emoji: "👨‍💼" },
  bot:        { id: "bot",        name: "巡检 Bot", role: "系统",        icon: Cpu,        color: "amber",  canApproveUpTo: 0,   emoji: "🤖" },
};

const SCENARIOS: Record<ScenarioId, Scenario> = {
  happy: {
    id: "happy",
    name: "正常流程",
    description: "小额 PR (¥8,000) → 部门经理审批 → 自动转 PO, 0 规则违反",
    expectedEvents: 6,
    steps: [],
  },
  need_director: {
    id: "need_director",
    name: "需总监审批",
    description: "大额 PR (¥86,500) → 经理无权审批 (R-001) → 总监审批 → 转 PO",
    expectedEvents: 9,
    steps: [],
  },
  multi_violation: {
    id: "multi_violation",
    name: "多重违规",
    description: "C 级供应商 + 大额 → R-001 + R-002 同时触发 → 系统巡检发告警",
    expectedEvents: 12,
    steps: [],
  },
};

function SimulatorPanel() {
  const [running, setRunning] = useState<ScenarioId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [log, setLog] = useState<{ ts: number; text: string; level: "info" | "ok" | "warn" | "err" }[]>([]);
  const timersRef = useRef<number[]>([]);

  // 订阅事件流, 同步到本地 log
  useEffect(() => {
    const off = ontologyBus.on("*", (e) => {
      const level: "info" | "ok" | "warn" | "err" =
        e.level === "success" ? "ok" :
        e.level === "warning" ? "warn" :
        e.level === "error" ? "err" : "info";
      setLog((prev) => [{ ts: e.ts, text: e.message, level }, ...prev].slice(0, 60));
    });
    return off;
  }, []);

  // 清理 timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach((t: number) => clearTimeout(t)); };
  }, []);

  function pushLog(text: string, level: "info" | "ok" | "warn" | "err") {
    setLog((prev) => [{ ts: Date.now(), text, level }, ...prev].slice(0, 60));
  }

  function clearTimers() {
    timersRef.current.forEach((t: number) => clearTimeout(t));
    timersRef.current = [];
  }

  function runScenario(scenarioId: ScenarioId) {
    if (running) return;
    clearTimers();
    setRunning(scenarioId);
    setStepIndex(0);
    pushLog(`▶ 启动剧本: ${SCENARIOS[scenarioId].name}`, "info");

    const exec: ScenarioStep[] = [];

    if (scenarioId === "happy") {
      // 王芳提交 ¥8,000 PR (小额, A 级供应商) → 李娜审批 (有权)
      const wf = PERSONAS.wangfang;
      const mgr = PERSONAS.lina;
      const supplier = ontologyStore.suppliers.find((s) => s.rating === "A")!;

      exec.push({
        delay: 400,
        description: `${wf.emoji} ${wf.name} 提交 PR`,
        execute: () => ontologyStore.submitPurchaseRequestAsPersona(wf.name, {
          title: "市场部 8 月办公用品",
          supplierId: supplier.id,
          amount: 8_000,
          category: "办公设备",
        }),
      });
      // 等 PR 创建后 找最新 PR
      exec.push({
        delay: 800,
        description: `${mgr.emoji} ${mgr.name} 审批 (金额 < 5 万, 有权)`,
        execute: () => {
          const pr = ontologyStore.purchaseRequests.find((p) => p.status === "待审批");
          if (pr) ontologyStore.approveAsPersona(mgr.name, mgr.role, pr.id, true, "同意, 走小额流程");
        },
      });
    } else if (scenarioId === "need_director") {
      const wf = PERSONAS.wangfang;
      const mgr = PERSONAS.lina;
      const dir = PERSONAS.chenqiang;
      const supplier = ontologyStore.suppliers.find((s) => s.rating === "A")!;

      exec.push({
        delay: 400,
        description: `${wf.emoji} ${wf.name} 提交 PR (¥86,500)`,
        execute: () => ontologyStore.submitPurchaseRequestAsPersona(wf.name, {
          title: "研发中心服务器扩容",
          supplierId: supplier.id,
          amount: 86_500,
          category: "IT 硬件",
        }),
      });
      exec.push({
        delay: 800,
        description: `${mgr.emoji} ${mgr.name} 尝试审批 (R-001 触发: 缺总监签字)`,
        execute: () => {
          const pr = ontologyStore.purchaseRequests.find((p) => p.status === "待审批");
          if (pr) ontologyStore.approveAsPersona(mgr.name, mgr.role, pr.id, false, "金额超限, 转总监");
        },
      });
      exec.push({
        delay: 1200,
        description: `${dir.emoji} ${dir.name} 审批 (含"总监"签字, 通过)`,
        execute: () => {
          // 找刚被驳回的 PR, 实际无法再审批, 我们换成一个新的
          // 让总监直接"重新发起" 模拟: 走一个新 PR
          const pr2 = ontologyStore.purchaseRequests[1];
          if (pr2 && pr2.status === "待审批") {
            ontologyStore.approveAsPersona(dir.name, dir.role, pr2.id, true, "总监签字: 同意采购");
          }
        },
      });
    } else if (scenarioId === "multi_violation") {
      const wf = PERSONAS.wangfang;
      const dir = PERSONAS.chenqiang;
      const bot = PERSONAS.bot;
      const lowRatingSupplier = ontologyStore.suppliers.find((s) => s.rating === "C")!;

      exec.push({
        delay: 400,
        description: `${wf.emoji} ${wf.name} 提交 PR (¥120,000 + C 级供应商)`,
        execute: () => ontologyStore.submitPurchaseRequestAsPersona(wf.name, {
          title: "行政部 12 万装修材料",
          supplierId: lowRatingSupplier.id,
          amount: 120_000,
          category: "日常",
        }),
      });
      exec.push({
        delay: 800,
        description: `${bot.emoji} ${bot.name} 启动规则巡检 (R-004/005/006)`,
        execute: () => ontologyStore.systemInspectionTick(),
      });
      exec.push({
        delay: 1200,
        description: `${dir.emoji} ${dir.name} 审批 (含"总监"签字, 通过)`,
        execute: () => {
          const pr = ontologyStore.purchaseRequests.find((p) => p.status === "待审批");
          if (pr) ontologyStore.approveAsPersona(dir.name, dir.role, pr.id, true, "总监签字: 同意采购, 加强供应商管理");
        },
      });
    }

    exec.forEach((step, idx) => {
      const t = window.setTimeout(() => {
        step.execute();
        pushLog(`  ${step.description}`, "info");
        setStepIndex(idx + 1);
        if (idx === exec.length - 1) {
          setTimeout(() => {
            pushLog(`✓ 剧本执行完毕 — 共触发 ~${SCENARIOS[scenarioId].expectedEvents} 个事件, 查看「事件流」`, "ok");
            setRunning(null);
          }, 600);
        }
      }, step.delay);
      timersRef.current.push(t);
    });
  }

  function stopRunning() {
    clearTimers();
    setRunning(null);
    pushLog("■ 已停止当前剧本", "warn");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左: Persona 介绍 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle2 className="size-4" /> 4 类 Persona
          </CardTitle>
          <CardDescription>模拟真实用户/系统的行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.values(PERSONAS).map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                <div className={`size-9 rounded-lg bg-${p.color}-100 dark:bg-${p.color}-900/30 text-${p.color}-600 dark:text-${p.color}-400 flex items-center justify-center text-lg shrink-0`}>
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.role}</div>
                </div>
                {p.canApproveUpTo > 0 ? (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    ≤ ¥{(p.canApproveUpTo / 10000).toFixed(0)}万
                  </Badge>
                ) : p.id === "bot" ? (
                  <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                    系统
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0">无审批权</Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 中: 剧本选择 + 执行 */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <PlayCircle className="size-4" /> 3 个真实剧本
              </CardTitle>
              <CardDescription>点一下, 1-3 秒内自动跑完</CardDescription>
            </div>
            {running && (
              <Button size="sm" variant="destructive" onClick={stopRunning}>
                <Square className="size-3.5 mr-1" /> 停止
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.values(SCENARIOS).map((s) => {
            const isRunning = running === s.id;
            return (
              <div
                key={s.id}
                className={`p-3 rounded-lg border transition-all ${
                  isRunning ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">~{s.expectedEvents} 事件</Badge>
                  {isRunning && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] animate-pulse">
                      执行中 ({stepIndex})
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                <Button
                  size="sm"
                  disabled={!!running}
                  onClick={() => runScenario(s.id)}
                  className="w-full"
                  variant={isRunning ? "secondary" : "default"}
                >
                  {isRunning ? (
                    <><Activity className="size-3.5 mr-1 animate-pulse" /> 正在执行...</>
                  ) : (
                    <><Play className="size-3.5 mr-1" /> 启动剧本</>
                  )}
                </Button>
              </div>
            );
          })}

          {/* 执行日志 */}
          {log.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-medium text-muted-foreground">实时执行日志</div>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setLog([])}>
                  <RotateCcw className="size-3 mr-1" /> 清空
                </Button>
              </div>
              <div className="bg-zinc-950 dark:bg-zinc-900 text-zinc-100 rounded-lg p-2.5 font-mono text-[10px] max-h-64 overflow-y-auto space-y-0.5">
                {log.map((l, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-zinc-500 shrink-0 tabular-nums">
                      {new Date(l.ts).toLocaleTimeString("zh-CN", { hour12: false })}
                    </span>
                    <span className={`shrink-0 ${
                      l.level === "ok" ? "text-green-400" :
                      l.level === "warn" ? "text-amber-400" :
                      l.level === "err" ? "text-red-400" : "text-zinc-300"
                    }`}>
                      {l.level === "ok" ? "✓" : l.level === "warn" ? "⚠" : l.level === "err" ? "✗" : "•"}
                    </span>
                    <span className="break-words">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
