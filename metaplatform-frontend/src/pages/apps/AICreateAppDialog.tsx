/**
 * AI Create-App Dialog
 * --------------------------------------------------------------------------
 * 应用中心"使用 AI 创建应用"入口对应的对话框.
 *
 * 流程:
 *   1. 用户输入一段业务描述 + 选 1 个场景标签 (CRM/HR/OA/ERP/数据/AI/数字员工...).
 *   2. 点击"AI 生成" → 调用 `generateAppDraft(prompt, scene)` 在前端拼装出
 *      {name, category, description, icon} (本地启发式, 不依赖后端 LLM;
 *      后续可平滑替换为真实 LLM 调用).
 *   3. 用户可在表单里**继续修改**生成结果.
 *   4. 点击"创建并进入" → appsApi.create() → 跳到 /apps/:id/overview.
 *
 * 之所以不直接走 4 步 NewAppWizard: AI 模式的目标是 1 句话生成, 不应让用户
 * 反复点"下一步". 创建后再到应用详情里继续完善.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Loader2, Wand2, Bot, Users, Briefcase, Database,
  BarChart3, Workflow, FileBox, Rocket,
} from "lucide-react";
import { appsApi, type Application } from "@/lib/api";

/* ── 场景标签 ── */
interface SceneOption {
  value: string;
  label: string;
  category: string;     // 映射到后端 Application.category
  icon: string;         // 映射到 Application.icon
  Icon: typeof Bot;
  hint: string;
}

const SCENE_OPTIONS: SceneOption[] = [
  { value: "crm",       label: "客户关系 (CRM)", category: "crm",  icon: "Users",      Icon: Users,    hint: "客户档案、跟进、商机、合同" },
  { value: "hr",        label: "人力资源 (HR)",   category: "hr",   icon: "Briefcase",  Icon: Briefcase, hint: "员工档案、考勤、招聘、绩效" },
  { value: "oa",        label: "OA 审批",         category: "oa",   icon: "FileBox",    Icon: FileBox,  hint: "请假、报销、用印、流程审批" },
  { value: "erp",       label: "ERP/进销存",      category: "erp",  icon: "Database",   Icon: Database, hint: "采购、库存、销售、订单" },
  { value: "data",      label: "数据分析",        category: "data", icon: "BarChart3",  Icon: BarChart3, hint: "报表、KPI、仪表盘、商业智能" },
  { value: "ai",        label: "AI/智能体",       category: "ai",   icon: "Bot",        Icon: Bot,      hint: "智能问答、Agent 协作、知识库" },
  { value: "workforce", label: "数字员工",        category: "ai",   icon: "Sparkles",   Icon: Sparkles, hint: "每个数字员工是一个独立应用" },
  { value: "ops",       label: "运维监控",        category: "ops",  icon: "Workflow",   Icon: Workflow, hint: "告警、巡检、工单、变更" },
];

/* ── AI 生成 (前端启发式) ── */
interface AIGeneratedDraft {
  name: string;
  category: string;
  icon: string;
  description: string;
  /** 数字员工类型: 仅当用户描述里出现"数字员工/Agent"时返回 */
  workforceRole?: string;
}

function generateAppDraft(prompt: string, scene: SceneOption | null): AIGeneratedDraft {
  const text = prompt.trim();
  const sceneMeta = scene ?? SCENE_OPTIONS[0];

  // 名称: 优先取描述里最像"应用名"的前 12 个字
  let name = text;
  // 把常见的描述性前缀去掉: "我想要一个", "帮我做一个", "请创建", "需要一个" 等
  const prefixPatterns = [
    /^我[想需]要(一个|一款|一套)?/, /^帮我(做|创建|搭建)(一个|一款|一套)?/,
    /^请(创建|帮我创建|搭建|做一个)(一个|一款|一套)?/, /^需要一个/, /^做一个/,
  ];
  for (const re of prefixPatterns) name = name.replace(re, "");
  // 截断过长的名称
  if (name.length > 16) name = name.slice(0, 16);
  // 名称为空时, 用场景标签 + 默认后缀
  if (!name) name = `${sceneMeta.label.replace(/\s*\(.+\)$/, "")}应用`;

  // 描述: 直接用 prompt 原文 (截断到 80 字)
  const description = text.length > 80 ? text.slice(0, 80) + "…" : text;

  // 数字员工识别
  const isWorkforce = /数字员工|智能体|Agent|ai\s*助手|ai\s*agent/i.test(text) || scene?.value === "workforce";

  return {
    name,
    category: sceneMeta.category,
    icon: sceneMeta.icon,
    description,
    workforceRole: isWorkforce ? extractWorkforceRole(text) : undefined,
  };
}

function extractWorkforceRole(text: string): string {
  // 简单匹配"XX数字员工/XX助手"中的角色名
  const m = text.match(/(.{1,12}?)\s*(数字员工|智能体|助手|Agent)/);
  return m ? m[1].trim() : "通用助手";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 可选: 预选场景 (例如从"AI 原生"/"数字员工"快捷卡片点进来) */
  initialScene?: string;
  onCreated?: (app: Application) => void;
}

export function AICreateAppDialog({ open, onOpenChange, initialScene, onCreated }: Props) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [sceneValue, setSceneValue] = useState<string | null>(initialScene ?? null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AIGeneratedDraft | null>(null);

  // 打开对话框时重置
  const reset = () => {
    setPrompt("");
    setSceneValue(initialScene ?? null);
    setGenerating(false);
    setSubmitting(false);
    setError(null);
    setDraft(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("请先输入应用描述");
      return;
    }
    setError(null);
    setGenerating(true);
    // 模拟一点点"AI 思考"延迟, 让交互更自然
    await new Promise((r) => setTimeout(r, 400));
    const scene = SCENE_OPTIONS.find((s) => s.value === sceneValue) ?? null;
    const result = generateAppDraft(prompt, scene);
    setDraft(result);
    setGenerating(false);
  };

  const handleCreate = async () => {
    if (!draft) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await appsApi.create({
        name: draft.name.trim(),
        description: draft.description,
        category: draft.category,
        icon: draft.icon,
        // 数字员工场景: 用名称前缀标记, 方便列表里识别
        ...(draft.workforceRole
          ? { name: `${draft.name.trim()} · 数字员工`, config: { workforceRole: draft.workforceRole } }
          : {}),
      });
      onCreated?.(created);
      onOpenChange(false);
      reset();
      navigate(`/apps/${created.id}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
            使用 AI 创建应用
          </DialogTitle>
          <DialogDescription>
            用一句话告诉 AI 你想做什么样的应用, 它会自动生成应用名称 / 分类 / 描述, 你仍可在创建前继续修改.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* 步骤 1: 输入业务描述 + 选场景 */}
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-sm">应用描述 *</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如: 我想做一个客户跟进系统, 让销售记录客户基本信息、跟进历史和合同状态; 另外, 我还想让一个数字员工自动给客户发生日祝福."
              rows={4}
              className="resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              提示: 描述越具体 (角色 / 业务对象 / 流程), AI 生成的应用越贴近你的需求.
            </p>
          </div>

          <div>
            <Label className="text-sm">应用场景 (可选, 帮助 AI 更精准地推荐)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCENE_OPTIONS.map((s) => {
                const active = sceneValue === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSceneValue(active ? null : s.value)}
                    className={
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors " +
                      (active
                        ? "bg-primary text-white border-violet-500"
                        : "bg-background text-muted-foreground border-border hover:border-violet-400 hover:text-violet-600")
                    }
                    title={s.hint}
                  >
                    <s.Icon className="size-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Wand2 className="size-4 mr-1" />}
              {generating ? "AI 生成中..." : "AI 生成应用"}
            </Button>
          </div>
        </div>

        {/* 步骤 2: AI 生成结果 (可编辑) */}
        {draft && (
          <div className="border rounded-lg p-4 bg-primary/50 space-y-3">
            <div className="flex items-center gap-2 text-violet-700 text-sm font-medium">
              <Sparkles className="size-4" /> AI 生成结果 (可继续修改)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">应用名称 *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                {draft.workforceRole && (
                  <p className="mt-1 text-xs text-violet-600">
                    已识别为「数字员工」, 角色: {draft.workforceRole}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs">应用描述</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div>
                <Label className="text-xs">分类</Label>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                >
                  {SCENE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.category}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">图标</Label>
                <select
                  value={draft.icon}
                  onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                >
                  {Array.from(new Set(SCENE_OPTIONS.map((s) => s.icon))).map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!draft || submitting}>
            {submitting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Rocket className="size-4 mr-1" />}
            {submitting ? "创建中..." : "创建并进入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
