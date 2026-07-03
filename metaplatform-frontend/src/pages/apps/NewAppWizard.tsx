import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronLeft, ChevronRight, Sparkles, Database, Wand2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const CREATE_TYPES = [
  { id: "blank", title: "空白应用", desc: "从零开始，完全自定义数据模型与流程", icon: "📝" },
  { id: "template", title: "模板创建", desc: "从行业模板快速构建（CRM/ERP/OA...）", icon: "📚" },
  { id: "ontology", title: "本体驱动", desc: "先定义业务对象，自动生成页面与流程", icon: "🧬" },
  { id: "ai", title: "AI 对话创建", desc: "用自然语言描述需求，AI 自动生成", icon: "🤖" },
];

const TEMPLATES = [
  { id: "crm", name: "客户关系管理", icon: "🤝", category: "销售" },
  { id: "erp", name: "进销存管理", icon: "📦", category: "供应链" },
  { id: "oa", name: "协同办公", icon: "🏢", category: "通用" },
  { id: "hr", name: "人力资源", icon: "👥", category: "人事" },
  { id: "project", name: "项目管理", icon: "📋", category: "通用" },
  { id: "bi", name: "业务分析", icon: "📊", category: "数据" },
];

const DATA_SOURCES = [
  { id: "ds-mysql", name: "MySQL 主库", type: "MySQL", status: "已连接" },
  { id: "ds-pg", name: "PostgreSQL 分析库", type: "PostgreSQL", status: "已连接" },
  { id: "ds-api", name: "第三方 API 网关", type: "REST API", status: "已连接" },
  { id: "new-mysql", name: "新建 MySQL 连接", type: "+", status: "新建" },
];

interface WizardState {
  createType: string;
  template: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  dataSource: string;
  deployEnv: string;
}

const INITIAL: WizardState = {
  createType: "blank",
  template: "",
  name: "",
  icon: "📦",
  description: "",
  category: "通用",
  dataSource: "ds-mysql",
  deployEnv: "dev",
};

export default function NewAppWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(INITIAL);

  const update = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const canNext = () => {
    if (step === 1) return !!state.createType;
    if (step === 2) return !!state.name && state.name.length >= 2;
    if (step === 3) return !!state.dataSource;
    return true;
  };

  const onSubmit = () => {
    navigate(`/apps/app-${Math.floor(Math.random() * 9000 + 1000)}/overview`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">新建应用</h1>
        <p className="text-sm text-muted-foreground mt-1">4 步创建应用：选择方式 → 基本信息 → 数据源 → 确认</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s < step
                  ? "bg-primary text-primary-foreground"
                  : s === step
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="size-4" /> : s}
            </div>
            <div className="flex-1">
              <div className={`text-xs ${s === step ? "font-medium" : "text-muted-foreground"}`}>
                {["创建方式", "基本信息", "数据源", "确认创建"][s - 1]}
              </div>
            </div>
            {s < 4 && <div className={`h-px flex-1 ${s < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: 创建方式 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-base">选择创建方式</CardTitle>
                <CardDescription>不同方式对应不同的初始化策略</CardDescription>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CREATE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update("createType", t.id)}
                    className={`text-left rounded-lg border p-4 transition-all hover:border-primary ${
                      state.createType === t.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{t.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {t.title}
                          {t.id === "ai" && <Badge variant="secondary" className="text-xs"><Sparkles className="size-3 mr-1" />AI</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {state.createType === "template" && (
                <div className="border-t pt-4 mt-4">
                  <Label className="text-sm">选择模板</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          update("template", t.id);
                          update("name", t.name);
                          update("icon", t.icon);
                          update("category", t.category);
                        }}
                        className={`text-left rounded border p-3 transition-all hover:border-primary ${
                          state.template === t.id ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="text-xl">{t.icon}</div>
                        <div className="font-medium text-sm mt-1">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.category}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 基本信息 */}
          {step === 2 && (
            <div className="space-y-4 max-w-xl">
              <div>
                <CardTitle className="text-base">应用基本信息</CardTitle>
                <CardDescription>标识与描述将出现在工作台和应用市场</CardDescription>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">应用名称 *</Label>
                  <Input
                    id="name"
                    placeholder="如：客户关系管理系统"
                    value={state.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">应用描述</Label>
                  <Input
                    id="desc"
                    placeholder="简要说明应用用途"
                    value={state.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="icon">图标（emoji）</Label>
                    <Input
                      id="icon"
                      value={state.icon}
                      onChange={(e) => update("icon", e.target.value)}
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat">分类</Label>
                    <select
                      id="cat"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={state.category}
                      onChange={(e) => update("category", e.target.value)}
                    >
                      <option>通用</option>
                      <option>销售</option>
                      <option>供应链</option>
                      <option>人事</option>
                      <option>数据</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 数据源 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-base">选择数据源</CardTitle>
                <CardDescription>应用数据将存储在所选数据源中（后续可调整）</CardDescription>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {DATA_SOURCES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => update("dataSource", d.id)}
                    className={`text-left rounded-lg border p-3 transition-all hover:border-primary flex items-center gap-3 ${
                      state.dataSource === d.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <Database className="size-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.type} · {d.status}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t pt-4">
                <Label>初始部署环境</Label>
                <div className="flex gap-2 mt-2">
                  {[
                    { id: "dev", name: "开发" },
                    { id: "test", name: "测试" },
                    { id: "staging", name: "预发" },
                    { id: "prod", name: "生产" },
                  ].map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => update("deployEnv", e.id)}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                        state.deployEnv === e.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 确认 */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="size-4 text-primary" />
                  确认创建
                </CardTitle>
                <CardDescription>检查无误后点击「创建」按钮</CardDescription>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <Row label="创建方式" value={CREATE_TYPES.find((t) => t.id === state.createType)?.title ?? ""} />
                {state.template && (
                  <Row label="使用模板" value={TEMPLATES.find((t) => t.id === state.template)?.name ?? ""} />
                )}
                <Row label="应用名称" value={`${state.icon} ${state.name}`} />
                {state.description && <Row label="描述" value={state.description} />}
                <Row label="分类" value={state.category} />
                <Row
                  label="数据源"
                  value={DATA_SOURCES.find((d) => d.id === state.dataSource)?.name ?? ""}
                />
                <Row label="初始环境" value={state.deployEnv.toUpperCase()} />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm flex items-start gap-2">
                <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  创建后系统将自动初始化：3 个示例对象 · 2 个示例页面 · 1 个示例工作流，你可以在应用中随时修改或删除。
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/apps")}>
          <ChevronLeft className="size-4 mr-1" />
          返回应用列表
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ChevronLeft className="size-4 mr-1" />
              上一步
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canNext()}>
              下一步
              <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onSubmit}>
              <Sparkles className="size-4 mr-1" />
              创建应用
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}