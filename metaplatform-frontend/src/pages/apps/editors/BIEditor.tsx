import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Bot, Clock, Database, BarChart3, Settings,
  Plus, Trash2, Play, Pause, RefreshCw, Activity,
  Cpu, HardDrive, Zap, Target,
} from "lucide-react";
import type { BaseEditorProps, PageComponent } from "./types";

// ── Agent definition ──
interface AgentDef {
  id: string;
  name: string;
  model: string;
  status: "active" | "draft" | "error";
  description: string;
}

// ── Training task definition ──
interface TrainingTask {
  id: string;
  name: string;
  schedule: string;
  status: "active" | "draft" | "running";
  lastRun?: string;
}

// ── Dashboard metric definition ──
interface DashboardMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  trend: "up" | "down" | "flat";
  icon: string;
}

const DEFAULT_AGENTS: AgentDef[] = [
  { id: "a1", name: "销售助手", model: "GPT-4", status: "active", description: "辅助销售团队进行客户跟进和商机管理" },
  { id: "a2", name: "客服机器人", model: "GPT-3.5", status: "draft", description: "处理客户咨询和常见问题回复" },
  { id: "a3", name: "数据分析员", model: "GPT-4", status: "active", description: "自动生成数据分析报告和洞察" },
];

const DEFAULT_TASKS: TrainingTask[] = [
  { id: "t1", name: "每日销售报表", schedule: "每天 08:00", status: "active", lastRun: "2024-01-15 08:00" },
  { id: "t2", name: "周度客户分析", schedule: "每周一 09:00", status: "active", lastRun: "2024-01-15 09:00" },
  { id: "t3", name: "月度模型微调", schedule: "每月 1 日 02:00", status: "draft" },
];

const DEFAULT_METRICS: DashboardMetric[] = [
  { id: "m1", name: "API 调用量", value: "12,345", unit: "次/天", trend: "up", icon: "zap" },
  { id: "m2", name: "平均响应时间", value: "230", unit: "ms", trend: "down", icon: "clock" },
  { id: "m3", name: "模型准确率", value: "94.2", unit: "%", trend: "up", icon: "target" },
  { id: "m4", name: "活跃 Agent", value: "2", unit: "个", trend: "flat", icon: "bot" },
  { id: "m5", name: "数据处理量", value: "1.2", unit: "GB/天", trend: "up", icon: "database" },
  { id: "m6", name: "GPU 利用率", value: "67", unit: "%", trend: "down", icon: "cpu" },
];

const METRIC_ICONS: Record<string, any> = {
  zap: Zap, clock: Clock, target: Target, bot: Bot,
  database: Database, cpu: Cpu, activity: Activity, harddrive: HardDrive,
};

const STATUS_CONFIG = {
  active:  { label: "运行中", variant: "default" as const, color: "text-green-600" },
  draft:   { label: "草稿",   variant: "secondary" as const, color: "text-muted-foreground" },
  running: { label: "运行中", variant: "default" as const, color: "text-blue-600" },
  error:   { label: "异常",   variant: "destructive" as const, color: "text-destructive" },
};

/**
 * BIEditor -- Business Intelligence & Agent editor
 *
 * Enhancements over PageEditor.tsx:
 * - Full agent management with description, model selection, status toggle
 * - Training task management with last-run info
 * - Data dashboard configuration with metric cards
 * - Proper TypeScript types
 * - Connected to parent state via setComponents
 */
export function BIEditor({ components, setComponents, setDirty }: BaseEditorProps) {
  const existingData = components?.[0]?.props;
  const [agents, setAgents] = useState<AgentDef[]>(existingData?.agents || DEFAULT_AGENTS);
  const [tasks, setTasks] = useState<TrainingTask[]>(existingData?.tasks || DEFAULT_TASKS);
  const [metrics] = useState<DashboardMetric[]>(existingData?.metrics || DEFAULT_METRICS);

  /** Persist to parent */
  const persist = (a: AgentDef[], t: TrainingTask[], m: DashboardMetric[]) => {
    setComponents((prev: PageComponent[]) => {
      if (prev.length === 0) {
        return [{ id: "bi-config", type: "bi-config", label: "BI配置", props: { agents: a, tasks: t, metrics: m } }];
      }
      return prev.map((c, i) =>
        i === 0 ? { ...c, props: { ...c.props, agents: a, tasks: t, metrics: m } } : c
      );
    });
    setDirty(true);
  };

  // ── Agent CRUD ──
  const addAgent = () => {
    const newAgent: AgentDef = {
      id: `agent-${Date.now()}`,
      name: "新 Agent",
      model: "GPT-3.5",
      status: "draft",
      description: "",
    };
    const next = [...agents, newAgent];
    setAgents(next);
    persist(next, tasks, metrics);
  };

  const deleteAgent = (id: string) => {
    const next = agents.filter((a) => a.id !== id);
    setAgents(next);
    persist(next, tasks, metrics);
  };

  const toggleAgentStatus = (id: string) => {
    const next = agents.map((a) =>
      a.id === id
        ? { ...a, status: (a.status === "active" ? "draft" : "active") as AgentDef["status"] }
        : a
    );
    setAgents(next);
    persist(next, tasks, metrics);
  };

  const updateAgent = (id: string, patch: Partial<AgentDef>) => {
    const next = agents.map((a) => (a.id === id ? { ...a, ...patch } : a));
    setAgents(next);
    persist(next, tasks, metrics);
  };

  // ── Training Task CRUD ──
  const addTask = () => {
    const newTask: TrainingTask = {
      id: `task-${Date.now()}`,
      name: "新任务",
      schedule: "每天 00:00",
      status: "draft",
    };
    const next = [...tasks, newTask];
    setTasks(next);
    persist(agents, next, metrics);
  };

  const deleteTask = (id: string) => {
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);
    persist(agents, next, metrics);
  };

  const toggleTaskStatus = (id: string) => {
    const next = tasks.map((t) =>
      t.id === id
        ? { ...t, status: (t.status === "active" ? "draft" : "active") as TrainingTask["status"] }
        : t
    );
    setTasks(next);
    persist(agents, next, metrics);
  };

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-[calc(100vh-200px)] min-h-[400px]">
      {/* ═══ Section 1: Dashboard Metrics ═══ */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <BarChart3 className="size-3.5" /> 数据看板
          </h4>
          <Badge variant="outline" className="text-[10px]">实时数据</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => {
            const Icon = METRIC_ICONS[m.icon] || Activity;
            return (
              <div key={m.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground">{m.name}</span>
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold">{m.value}</span>
                  <span className="text-[10px] text-muted-foreground">{m.unit}</span>
                </div>
                <div className={`text-[10px] mt-1 ${
                  m.trend === "up" ? "text-green-600" : m.trend === "down" ? "text-red-500" : "text-muted-foreground"
                }`}>
                  {m.trend === "up" ? "↑ 上升" : m.trend === "down" ? "↓ 下降" : "-- 持平"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Section 2: Agent Management ═══ */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Bot className="size-3.5" /> 数字员工 / Agent
          </h4>
          <Button size="sm" className="h-6 text-[10px] gap-0.5" onClick={addAgent}>
            <Plus className="size-2.5" /> 创建
          </Button>
        </div>
        <div className="space-y-2">
          {agents.map((agent) => {
            const statusCfg = STATUS_CONFIG[agent.status];
            return (
              <div key={agent.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="size-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{agent.name}</span>
                        <Badge variant={statusCfg.variant} className="text-[10px] py-0">
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {agent.description || "暂无描述"} | 模型: {agent.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAgentStatus(agent.id)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={agent.status === "active" ? "暂停" : "启动"}
                    >
                      {agent.status === "active" ? (
                        <Pause className="size-3 text-amber-500" />
                      ) : (
                        <Play className="size-3 text-green-500" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      title="删除"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {agents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              暂无 Agent，点击上方按钮创建
            </p>
          )}
        </div>
      </div>

      {/* ═══ Section 3: Training Tasks ═══ */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Clock className="size-3.5" /> 定期训练任务
          </h4>
          <Button size="sm" className="h-6 text-[10px] gap-0.5" onClick={addTask}>
            <Plus className="size-2.5" /> 创建
          </Button>
        </div>
        <div className="space-y-2">
          {tasks.map((task) => {
            const statusCfg = STATUS_CONFIG[task.status];
            return (
              <div key={task.id} className="flex items-center justify-between px-3 py-2.5 border rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded bg-muted flex items-center justify-center">
                    {task.status === "running" ? (
                      <RefreshCw className="size-3.5 animate-spin text-blue-500" />
                    ) : (
                      <Clock className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{task.name}</span>
                      <Badge variant={statusCfg.variant} className="text-[10px] py-0">
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        计划: {task.schedule}
                      </span>
                      {task.lastRun && (
                        <span className="text-[10px] text-muted-foreground/60">
                          上次运行: {task.lastRun}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title={task.status === "active" ? "暂停" : "启动"}
                  >
                    {task.status === "active" ? (
                      <Pause className="size-3 text-amber-500" />
                    ) : (
                      <Play className="size-3 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    title="删除"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              暂无训练任务，点击上方按钮创建
            </p>
          )}
        </div>
      </div>

      {/* ═══ Section 4: Data Source Config ═══ */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Database className="size-3.5" /> 数据源配置
          </h4>
          <Badge variant="outline" className="text-[10px]">系统设置</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">数据刷新频率</Label>
            <select className="w-full h-7 text-xs border rounded px-2 mt-0.5">
              <option>实时</option>
              <option>每 5 分钟</option>
              <option>每 30 分钟</option>
              <option>每小时</option>
              <option>每天</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">数据保留周期</Label>
            <select className="w-full h-7 text-xs border rounded px-2 mt-0.5">
              <option>7 天</option>
              <option>30 天</option>
              <option>90 天</option>
              <option>365 天</option>
              <option>永久</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">API 限流 (次/分钟)</Label>
            <Input defaultValue="1000" className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">并发任务数</Label>
            <Input defaultValue="5" className="h-7 text-xs mt-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
