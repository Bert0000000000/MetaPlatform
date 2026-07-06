import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Save, Play, Download, Copy, Settings, Plus, Trash2, Circle, Square, Diamond, GitBranch, GitMerge,
  User, Mail, Database, Cloud, Zap, Code, FileText, Clock, ArrowRight, Check, AlertTriangle, Pause, MoreHorizontal, Search, Bot,
  CircleDot, ArrowUp, RotateCcw, Radio, Hand, Ruler, Send, Package, Phone, CreditCard, X,
  type LucideIcon,
} from "lucide-react";

// BPMN 节点库（与 Workflows 页面对齐）
const NODE_LIBRARY: { category: string; items: { id: string; name: string; icon: LucideIcon; color: string }[] }[] = [
  { category: "事件 (Events)", items: [
    { id: "start", name: "开始事件", icon: Circle, color: "bg-green-500" },
    { id: "end", name: "结束事件", icon: CircleDot, color: "bg-red-500" },
    { id: "intermediate", name: "中间事件", icon: Circle, color: "bg-yellow-500" },
    { id: "timer", name: "定时事件", icon: Clock, color: "bg-orange-500" },
    { id: "message", name: "消息事件", icon: Mail, color: "bg-blue-500" },
    { id: "signal", name: "信号事件", icon: Radio, color: "bg-purple-500" },
    { id: "error", name: "错误事件", icon: AlertTriangle, color: "bg-red-600" },
    { id: "escalation", name: "升级事件", icon: ArrowUp, color: "bg-indigo-500" },
    { id: "compensate", name: "补偿事件", icon: RotateCcw, color: "bg-pink-500" },
  ]},
  { category: "活动 (Activities)", items: [
    { id: "user-task", name: "用户任务", icon: User, color: "bg-blue-500" },
    { id: "service-task", name: "服务任务", icon: Settings, color: "bg-purple-500" },
    { id: "script-task", name: "脚本任务", icon: FileText, color: "bg-green-500" },
    { id: "manual-task", name: "手工任务", icon: Hand, color: "bg-orange-500" },
    { id: "business-rule", name: "业务规则", icon: Ruler, color: "bg-pink-500" },
    { id: "send-task", name: "发送任务", icon: Send, color: "bg-cyan-500" },
    { id: "receive-task", name: "接收任务", icon: Download, color: "bg-indigo-500" },
  ]},
  { category: "子流程 (Sub-Process)", items: [
    { id: "subprocess", name: "嵌入式子流程", icon: Package, color: "bg-slate-500" },
    { id: "call-activity", name: "调用活动", icon: Phone, color: "bg-slate-600" },
    { id: "transaction", name: "事务子流程", icon: CreditCard, color: "bg-emerald-500" },
  ]},
  { category: "网关 (Gateways)", items: [
    { id: "exclusive", name: "排他网关", icon: X, color: "bg-yellow-500" },
    { id: "parallel", name: "并行网关", icon: Plus, color: "bg-blue-500" },
    { id: "inclusive", name: "包容网关", icon: Circle, color: "bg-cyan-500" },
    { id: "event-based", name: "事件网关", icon: Diamond, color: "bg-orange-500" },
    { id: "complex", name: "复杂网关", icon: Settings, color: "bg-gray-500" },
  ]},
  { category: "数据 (Data)", items: [
    { id: "data-object", name: "数据对象", icon: FileText, color: "bg-gray-400" },
    { id: "data-store", name: "数据存储", icon: Database, color: "bg-gray-500" },
  ]},
];

// Mock 画布节点
const CANVAS_NODES = [
  { id: "n1", type: "start", label: "订单创建", x: 60, y: 200 },
  { id: "n2", type: "user-task", label: "提交订单", x: 200, y: 180 },
  { id: "n3", type: "exclusive", label: "金额 > 1万?", x: 380, y: 200 },
  { id: "n4", type: "user-task", label: "主管审批", x: 560, y: 120 },
  { id: "n5", type: "service-task", label: "自动审核", x: 560, y: 280 },
  { id: "n6", type: "parallel", label: "并行通知", x: 740, y: 200 },
  { id: "n7", type: "service-task", label: "通知财务", x: 920, y: 120 },
  { id: "n8", type: "service-task", label: "通知仓库", x: 920, y: 200 },
  { id: "n9", type: "service-task", label: "通知客户", x: 920, y: 280 },
  { id: "n10", type: "end", label: "流程结束", x: 1100, y: 200 },
];

// Mock 流程实例
const INSTANCES = [
  { id: "INST-001", process: "采购审批流程", state: "running", start: "10:32", duration: "32 分钟", currentNode: "主管审批", assignee: "李娜" },
  { id: "INST-002", process: "订单审批流程", state: "completed", start: "09:18", duration: "12 分钟", currentNode: "已完成", assignee: "王强" },
  { id: "INST-003", process: "采购审批流程", state: "running", start: "今早", duration: "1 小时 8 分", currentNode: "法务审核", assignee: "刘敏" },
  { id: "INST-004", process: "请假审批", state: "suspended", start: "昨天", duration: "—", currentNode: "HR 审批（暂停）", assignee: "陈红" },
  { id: "INST-005", process: "报销审批", state: "failed", start: "昨天", duration: "—", currentNode: "失败：金额校验不通过", assignee: "张伟" },
];

function ProcessCanvas() {
  const nodeMap = Object.fromEntries(NODE_LIBRARY.flatMap((c) => c.items).map((n) => [n.id, n]));
  return (
    <div className="relative h-[500px] bg-muted/20 rounded-lg border overflow-auto">
      <svg width="1200" height="500" className="bg-grid-pattern">
        {/* 网格背景 */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>
        <rect width="1200" height="500" fill="url(#grid)" />

        {/* 连线 */}
        <g stroke="#64748b" strokeWidth="1.5" fill="none">
          <line x1="80" y1="200" x2="180" y2="180" markerEnd="url(#arrow)" />
          <line x1="220" y1="180" x2="360" y2="200" markerEnd="url(#arrow)" />
          <path d="M 400 220 Q 480 270, 540 280" markerEnd="url(#arrow)" />
          <path d="M 400 200 Q 480 130, 540 120" markerEnd="url(#arrow)" />
          <line x1="580" y1="120" x2="720" y2="200" markerEnd="url(#arrow)" />
          <line x1="580" y1="280" x2="720" y2="200" markerEnd="url(#arrow)" />
          <line x1="760" y1="200" x2="900" y2="120" markerEnd="url(#arrow)" />
          <line x1="760" y1="200" x2="900" y2="200" markerEnd="url(#arrow)" />
          <line x1="760" y1="200" x2="900" y2="280" markerEnd="url(#arrow)" />
          <line x1="940" y1="120" x2="1080" y2="200" markerEnd="url(#arrow)" />
          <line x1="940" y1="200" x2="1080" y2="200" markerEnd="url(#arrow)" />
          <line x1="940" y1="280" x2="1080" y2="200" markerEnd="url(#arrow)" />

          {/* 条件标签 */}
          <text x="440" y="265" fontSize="10" fill="#dc2626">是</text>
          <text x="440" y="135" fontSize="10" fill="#16a34a">否</text>
        </g>

        {/* 节点 */}
        {CANVAS_NODES.map((n, i) => {
          const meta = nodeMap[n.type];
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer">
              <rect x="0" y="0" width="120" height="40" rx="4" fill="white" stroke={meta?.color?.replace("bg-", "#") || "#64748b"} strokeWidth="2" />
              <text x="60" y="20" textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="500">{n.label}</text>
              <text x="60" y="34" textAnchor="middle" fontSize="9" fill="#64748b">{n.type}</text>
              {n.type === "start" && <circle cx="0" cy="20" r="6" fill="#22c55e" />}
              {n.type === "end" && <circle cx="120" cy="20" r="6" fill="#ef4444" />}
              {n.type === "exclusive" && <polygon points="60,5 115,20 60,35 5,20" fill="white" stroke="#eab308" strokeWidth="2" transform="translate(0, 0)" opacity="0.4" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodePanel() {
  return (
    <div className="space-y-4">
      {NODE_LIBRARY.map((cat) => (
        <div key={cat.category}>
          <div className="text-xs font-medium text-muted-foreground mb-2">{cat.category}</div>
          <div className="space-y-1">
            {cat.items.map((n) => {
              const NodeIcon = n.icon;
              return (
                <div
                  key={n.id}
                  draggable
                  className="flex items-center gap-2 p-2 border rounded cursor-move hover:border-primary bg-white text-sm"
                >
                  <span className={`${n.color} size-6 rounded text-white flex items-center justify-center`}>
                    <NodeIcon className="size-3" />
                  </span>
                  <span>{n.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertiesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">节点属性</CardTitle>
        <CardDescription>主管审批节点</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">节点 ID</div>
          <div className="font-mono">UserTask_0a3b8e</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">节点名称</div>
          <div>主管审批</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">审批人</div>
          <div>李娜（财务主管）</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">审批策略</div>
          <div>会签（全部同意）</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">超时</div>
          <div>24 小时（自动通过）</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">通知渠道</div>
          <div className="flex gap-1 mt-1">
            <Badge variant="outline">邮件</Badge>
            <Badge variant="outline">钉钉</Badge>
            <Badge variant="outline">短信</Badge>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">表单</div>
          <div>采购审批单（已绑定）</div>
        </div>
        <Button size="sm" className="w-full">
          <Save className="size-3 mr-1" />
          保存修改
        </Button>
      </CardContent>
    </Card>
  );
}

function ProcessInstances() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="size-4" /> 流程实例监控
        </CardTitle>
        <CardDescription>所有运行中/暂停/失败的流程实例</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>实例 ID</TableHead>
              <TableHead>流程</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>开始</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>当前节点</TableHead>
              <TableHead>处理人</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INSTANCES.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.id}</TableCell>
                <TableCell className="font-medium">{i.process}</TableCell>
                <TableCell>
                  {i.state === "running" && <Badge className="bg-blue-500">运行中</Badge>}
                  {i.state === "completed" && <Badge variant="secondary" className="text-green-600">完成</Badge>}
                  {i.state === "suspended" && <Badge variant="outline" className="text-orange-500">暂停</Badge>}
                  {i.state === "failed" && <Badge variant="destructive">失败</Badge>}
                </TableCell>
                <TableCell className="text-xs">{i.start}</TableCell>
                <TableCell className="text-xs">{i.duration}</TableCell>
                <TableCell className="text-xs">{i.currentNode}</TableCell>
                <TableCell className="text-xs">{i.assignee}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ProcessDesigner() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">流程设计器</h1>
          <p className="text-sm text-muted-foreground">采购审批流程 v3.1 · BPMN 2.0 规范</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Bot className="size-3 mr-1" />AI 助手</Button>
          <Button variant="outline" size="sm"><Download className="size-3 mr-1" />导出 BPMN</Button>
          <Button variant="outline" size="sm"><Play className="size-3 mr-1" />试运行</Button>
          <Button size="sm"><Save className="size-3 mr-1" />保存</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">节点库</CardTitle>
            </CardHeader>
            <CardContent>
              <NodePanel />
            </CardContent>
          </Card>
        </div>
        <div className="col-span-8">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">画布</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-8"><Search className="size-3" /></Button>
                <Button variant="ghost" size="icon" className="size-8"><Settings className="size-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <ProcessCanvas />
            </CardContent>
          </Card>
        </div>
        <div className="col-span-2">
          <PropertiesPanel />
        </div>
      </div>

      <ProcessInstances />
    </div>
  );
}