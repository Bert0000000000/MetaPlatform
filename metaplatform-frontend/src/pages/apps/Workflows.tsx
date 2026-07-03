import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Plus, GitBranch, FileCode, Boxes, Settings, ChevronRight } from "lucide-react";

const eventTypes = [
  { type: "开始事件", icon: "🟢", desc: "6 种触发器" },
  { type: "中间事件", icon: "⏸️", desc: "捕获/抛出/链接" },
  { type: "结束事件", icon: "🔴", desc: "8 种结果" },
  { type: "边界事件", icon: "🛡️", desc: "中断/非中断" },
];

const taskTypes = [
  { type: "用户任务", icon: "👤", desc: "6 参与者 + 4 任务模式 + 10 按钮" },
  { type: "服务任务", icon: "⚙️", desc: "6 大适配器" },
  { type: "脚本任务", icon: "📜", desc: "Groovy/JS/Python" },
  { type: "业务规则", icon: "⚖️", desc: "DMN 决策表" },
];

const gatewayTypes = [
  { type: "排他网关", icon: "✕", desc: "XOR 决策/合并" },
  { type: "包容网关", icon: "○", desc: "OR 决策/合并" },
  { type: "并行网关", icon: "+", desc: "AND 分叉/连接" },
  { type: "事件网关", icon: "⏰", desc: "事件驱动" },
  { type: "复杂网关", icon: "✱", desc: "自定义" },
];

const subProcessTypes = [
  { type: "嵌入式子流程", desc: "在父流程中" },
  { type: "事件子流程", desc: "触发后执行" },
  { type: "事务子流程", desc: "事务性" },
  { type: "调用活动", desc: "引用全局流程" },
];

const dataElements = [
  { type: "数据对象", icon: "📄" },
  { type: "数据输入", icon: "⬇️" },
  { type: "数据输出", icon: "⬆️" },
  { type: "数据存储", icon: "💾" },
];

const connectingTypes = [
  { type: "顺序流", icon: "→", desc: "实线箭头" },
  { type: "消息流", icon: "⇢", desc: "虚线箭头（跨泳池）" },
  { type: "关联", icon: "···", desc: "点线" },
  { type: "数据关联", icon: "📊", desc: "数据流向" },
];

export default function Workflows() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="流程"
        description="BPMN 2.0 规范 · 业务流程 + 审批流程 + 服务编排"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <FileCode className="size-4" /> 导入 BPMN XML
            </Button>
            <Button className="gap-2">
              <Plus className="size-4" /> 新建流程
            </Button>
          </div>
        }
      />

      {/* 流对象（Flow Objects） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">流对象（Flow Objects）</CardTitle>
          <CardDescription>BPMN 2.0 规范的三大基础元素</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 事件 */}
          <div>
            <h4 className="text-sm font-medium mb-3">事件（Events）</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eventTypes.map((e) => (
                <div key={e.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="text-2xl mb-1">{e.icon}</div>
                  <div className="font-medium text-sm">{e.type}</div>
                  <div className="text-xs text-muted-foreground">{e.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 活动（任务） */}
          <div>
            <h4 className="text-sm font-medium mb-3">活动（Activities）- 任务</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {taskTypes.map((t) => (
                <div key={t.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="font-medium text-sm">{t.type}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 子流程 */}
          <div>
            <h4 className="text-sm font-medium mb-3">子流程（Sub-Process）</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {subProcessTypes.map((s) => (
                <div key={s.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="font-medium text-sm">{s.type}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 网关 */}
          <div>
            <h4 className="text-sm font-medium mb-3">网关（Gateways）</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {gatewayTypes.map((g) => (
                <div key={g.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="text-2xl mb-1">{g.icon}</div>
                  <div className="font-medium text-sm">{g.type}</div>
                  <div className="text-xs text-muted-foreground">{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据（Data）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dataElements.map((d) => (
              <div key={d.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                <div className="text-2xl mb-1">{d.icon}</div>
                <div className="font-medium text-sm">{d.type}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 连接对象 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">连接对象（Connecting Objects）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {connectingTypes.map((c) => (
              <div key={c.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="font-medium text-sm">{c.type}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 泳道 & Artifacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">泳道（Swimlanes）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">泳池（Pool）</div>
                <div className="text-xs text-muted-foreground">参与者</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">泳道（Lane）</div>
                <div className="text-xs text-muted-foreground">角色/部门</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">制品（Artifacts）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">组（Group）</div>
                <div className="text-xs text-muted-foreground">黄色虚线框</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">文本注释</div>
                <div className="text-xs text-muted-foreground">附加文本说明</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}