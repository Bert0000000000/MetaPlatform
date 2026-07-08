/**
 * F4.1.6 / F4.1.7 — New Application 4-step Wizard
 *
 *   Step 1: 选择创建方式 (空白模板 / 行业模板 / 复制现有)
 *   Step 2: 选择具体模板（blank 时跳过；clone 时跳到下拉选现有应用）
 *   Step 3: 基本信息（名称 / 类别 / 图标 / 描述 / 初始环境）
 *   Step 4: 确认 → 提交
 *
 * The wizard is a controlled Dialog. State is one big object so a user
 * can navigate backwards without losing input.
 *
 * Backend wiring:
 *   • templates list  → GET  /api/apps/templates/list
 *   • create blank   → POST /api/apps { createType:'blank', name, … }
 *   • create template→ POST /api/apps { createType:'template', template:key, … }
 *   • create clone   → POST /api/apps/clone { sourceAppId, name, … }
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, ArrowRight, Check, Copy, Layers, Plus, Sparkles, Loader2, FileBox, Rocket,
} from "lucide-react";
import { appsApi, type Application, type AppTemplate } from "@/lib/api";

type CreateType = "blank" | "template" | "clone";
type DataSource = "internal" | "external" | "hybrid";

interface Draft {
  createType: CreateType;
  templateKey: string | null;
  sourceAppId: string | null;
  name: string;
  description: string;
  category: string;
  icon: string;
  environment: "dev" | "test" | "staging" | "prod";
  dataSource: DataSource;
}

const DEFAULT_DRAFT: Draft = {
  createType: "blank",
  templateKey: null,
  sourceAppId: null,
  name: "",
  description: "",
  category: "",
  icon: "Box",
  environment: "dev",
  dataSource: "internal",
};

const ICON_OPTIONS = ["Box", "Briefcase", "Layers", "Database", "Users", "BarChart3", "Workflow", "FileBox", "Sparkles"];

const CATEGORY_OPTIONS = [
  { value: "business",   label: "业务应用" },
  { value: "hr",         label: "人力资源" },
  { value: "crm",        label: "客户关系 (CRM)" },
  { value: "erp",        label: "ERP/进销存" },
  { value: "oa",         label: "OA/审批" },
  { value: "ops",        label: "运维" },
  { value: "ai",         label: "AI/智能体" },
  { value: "data",       label: "数据" },
  { value: "template",   label: "模板" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (app: Application) => void;
}

export function NewAppWizard({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [existingApps, setExistingApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates + existing apps list once when dialog opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft(DEFAULT_DRAFT);
    setError(null);
    setLoading(true);
    Promise.all([
      appsApi.templates().catch(() => []),
      appsApi.list().catch(() => []),
    ]).then(([tpl, apps]) => {
      setTemplates(Array.isArray(tpl) ? tpl : []);
      setExistingApps(Array.isArray(apps) ? apps : []);
    }).finally(() => setLoading(false));
  }, [open]);

  const canAdvance = (): boolean => {
    if (step === 0) return true; // createType is always set
    if (step === 1) {
      if (draft.createType === "template") return Boolean(draft.templateKey);
      if (draft.createType === "clone")    return Boolean(draft.sourceAppId);
      return true; // blank skips step 1
    }
    if (step === 2) return draft.name.trim().length > 0 && draft.category.trim().length > 0;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let created: Application;
      if (draft.createType === "clone") {
        created = await appsApi.clone({
          sourceAppId: draft.sourceAppId!,
          name: draft.name.trim(),
          description: draft.description,
          category: draft.category,
          icon: draft.icon,
          environment: draft.environment,
        });
      } else {
        const body: Record<string, unknown> = {
          name: draft.name.trim(),
          description: draft.description,
          category: draft.category,
          icon: draft.icon,
          environment: draft.environment,
          dataSource: draft.dataSource,
          template: draft.createType === "template" ? draft.templateKey : undefined,
        };
        created = await appsApi.create(body as Partial<Application>);
      }
      onCreated?.(created);
      onOpenChange(false);
      // Navigate to the newly created app's detail page.
      navigate(`/apps/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
            新建应用
          </DialogTitle>
          <DialogDescription>
            4 步引导式向导：选择方式 → 选择模板 → 基本信息 → 确认创建
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <ol className="flex items-center gap-2 text-xs">
          {[0, 1, 2, 3].map((i) => {
            const labels = ["方式", "模板", "基本信息", "确认"];
            const active = i === step;
            const done = i < step;
            return (
              <li key={i} className="flex items-center gap-2 flex-1">
                <span className={
                  "flex items-center justify-center size-6 rounded-full text-[10px] font-medium " +
                  (done ? "bg-green-500 text-white" :
                   active ? "bg-violet-500 text-white" : "bg-slate-200 text-slate-500")
                }>
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={active ? "font-medium text-slate-900" : "text-slate-500"}>
                  {labels[i]}
                </span>
                {i < 3 && <span className="flex-1 h-px bg-slate-200" />}
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="size-4 animate-spin" />加载模板中…
          </div>
        ) : (
          <div className="min-h-[300px]">
            {step === 0 && <StepCreateType draft={draft} setDraft={setDraft} />}
            {step === 1 && (
              <StepPickTemplate
                draft={draft}
                setDraft={setDraft}
                templates={templates}
                existingApps={existingApps}
              />
            )}
            {step === 2 && <StepBasicInfo draft={draft} setDraft={setDraft} />}
            {step === 3 && <StepConfirm draft={draft} templates={templates} existingApps={existingApps} />}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
              <ArrowLeft className="size-3 mr-1" />上一步
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                下一步<ArrowRight className="size-3 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Rocket className="size-3 mr-1" />}
                创建应用
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Step 0: createType ─────────────────── */
function StepCreateType({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const OPTIONS: Array<{ value: CreateType; label: string; description: string; icon: React.ReactNode }> = [
    {
      value: "blank", label: "空白应用",
      description: "从零开始，自己定义对象 / 页面 / 流程",
      icon: <Plus className="size-5" />,
    },
    {
      value: "template", label: "行业模板",
      description: "基于 CRM/HR/Ops 等预置模板快速初始化",
      icon: <Layers className="size-5" />,
    },
    {
      value: "clone", label: "复制现有",
      description: "复制一个已有应用的全部内容作为起点",
      icon: <Copy className="size-5" />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
      {OPTIONS.map((o) => (
        <Card
          key={o.value}
          onClick={() => setDraft({ ...draft, createType: o.value, templateKey: null, sourceAppId: null })}
          className={
            "p-4 cursor-pointer hover:border-violet-400 transition " +
            (draft.createType === o.value ? "border-violet-500 bg-violet-50" : "")
          }
        >
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            {o.icon}
            <span className="font-medium">{o.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{o.description}</p>
        </Card>
      ))}
    </div>
  );
}

/* ─────────────── Step 1: pick template ─────────────────── */
function StepPickTemplate({
  draft, setDraft, templates, existingApps,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  templates: AppTemplate[];
  existingApps: Application[];
}) {
  if (draft.createType === "blank") {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <FileBox className="size-8 mx-auto mb-2 text-slate-400" />
        空白模板无需选择模板，直接点下一步填写基本信息
      </div>
    );
  }
  if (draft.createType === "template") {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-3">
          可用模板（{templates.length} 个）
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto">
          {templates.map((t) => (
            <Card
              key={t.key}
              onClick={() => setDraft({ ...draft, templateKey: t.key, category: t.category, icon: t.icon })}
              className={
                "p-3 cursor-pointer hover:border-violet-400 transition " +
                (draft.templateKey === t.key ? "border-violet-500 bg-violet-50" : "")
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{t.label}</span>
                <code className="text-[10px] text-muted-foreground">({t.key})</code>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">
                  {t.objects.length} 对象
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">
                  {t.pages.length} 页面
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">
                  {t.flows.length} 流程
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  // clone
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        选择要复制的应用（{existingApps.length} 个）
      </p>
      <div className="max-h-[320px] overflow-y-auto divide-y border rounded">
        {existingApps.slice(0, 100).map((a) => (
          <button
            key={a.id}
            onClick={() => setDraft({ ...draft, sourceAppId: a.id, category: a.category, icon: a.icon ?? "Box" })}
            className={
              "w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 " +
              (draft.sourceAppId === a.id ? "bg-violet-50" : "")
            }
          >
            <span className="font-medium text-sm flex-1 truncate">{a.name}</span>
            <code className="text-[10px] text-muted-foreground">{a.id}</code>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">{a.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Step 2: basic info ─────────────────── */
function StepBasicInfo({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      <div className="col-span-2">
        <Label className="text-sm">应用名称 <span className="text-red-500">*</span></Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="例如：销售机会管理、合同审批"
          autoFocus
        />
      </div>
      <div>
        <Label className="text-sm">分类 <span className="text-red-500">*</span></Label>
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">请选择</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-sm">图标</Label>
        <select
          value={draft.icon}
          onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm bg-white"
        >
          {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <Label className="text-sm">初始环境</Label>
        <select
          value={draft.environment}
          onChange={(e) => setDraft({ ...draft, environment: e.target.value as Draft["environment"] })}
          className="w-full border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="dev">开发 (dev)</option>
          <option value="test">测试 (test)</option>
          <option value="staging">预发 (staging)</option>
          <option value="prod">生产 (prod)</option>
        </select>
      </div>
      <div>
        <Label className="text-sm">数据源</Label>
        <select
          value={draft.dataSource}
          onChange={(e) => setDraft({ ...draft, dataSource: e.target.value as DataSource })}
          className="w-full border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="internal">内置数据库</option>
          <option value="external">外部数据源</option>
          <option value="hybrid">混合</option>
        </select>
      </div>
      <div className="col-span-2">
        <Label className="text-sm">描述</Label>
        <Input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="一句话说明这个应用的用途"
        />
      </div>
    </div>
  );
}

/* ─────────────── Step 3: confirm ─────────────────── */
function StepConfirm({ draft, templates, existingApps }: {
  draft: Draft;
  templates: AppTemplate[];
  existingApps: Application[];
}) {
  const tpl = templates.find((t) => t.key === draft.templateKey);
  const src = existingApps.find((a) => a.id === draft.sourceAppId);
  return (
    <div className="space-y-3 pt-2 text-sm">
      <Row k="创建方式" v={draft.createType === "blank" ? "空白应用"
        : draft.createType === "template" ? "行业模板"
        : "复制现有"} />
      {tpl && <Row k="模板" v={`${tpl.label}（${tpl.objects.length} 对象 / ${tpl.pages.length} 页面 / ${tpl.flows.length} 流程）`} />}
      {src && <Row k="源应用" v={`${src.name}（${src.id}）`} />}
      <Row k="名称" v={draft.name} />
      <Row k="分类" v={CATEGORY_OPTIONS.find((c) => c.value === draft.category)?.label ?? draft.category} />
      <Row k="图标" v={draft.icon} />
      <Row k="初始环境" v={draft.environment} />
      <Row k="数据源" v={draft.dataSource} />
      {draft.description && <Row k="描述" v={draft.description} />}
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
        ⚠️ 创建后状态为 draft，需到应用详情完成业务建模/页面/流程后才能发布。
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[120px,1fr] items-baseline">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}