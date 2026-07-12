/**
 * PublicForm.tsx — 公开表单填写页 (P8-2 品牌化重设)
 * 不需鉴权 — 调用 /api/public/forms/:formId 拉 schema,
 * 提交也直接走 /api/public/forms/:formId/submit.
 *
 * 视觉: 渐变 hero (品牌色) + 卡片表单 + 友好成功/失败 toast
 * 字段: 支持 text / email / number / textarea / select / date / checkbox
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Check, AlertCircle, ArrowLeft, Send, Sparkles, Globe,
  ShieldCheck, User, Mail, Calendar,
} from "lucide-react";

const PUBLIC_BASE = (import.meta.env?.VITE_API_BASE || "/api").replace(/\/$/, "");

async function fetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    credentials: "omit",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

function pickInitialValues(schema: any) {
  const fields: any[] = Array.isArray(schema?.fields) ? schema.fields
    : (Array.isArray(schema?.sections) ? schema.sections.flatMap((s: any) => s.fields || []) : []);
  const init: Record<string, string> = {};
  for (const f of fields) {
    if (f?.name) init[f.name] = "";
  }
  return init;
}

export default function PublicForm() {
  const { appId } = useParams<{ appId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const formId = params.get("formId");
  const [schema, setSchema] = useState<any>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!appId || !formId) { setError("Missing formId"); setLoading(false); return; }
    (async () => {
      try {
        const data = await fetchPublic<any>(`/public/forms/${encodeURIComponent(formId)}`);
        setSchema(data);
        setValues(pickInitialValues(data.schema || data));
      } catch (e) {
        setError((e as Error).message);
      } finally { setLoading(false); }
    })();
  }, [appId, formId]);

  const fields: any[] = Array.isArray(schema?.schema?.fields) ? schema.schema.fields
    : (Array.isArray(schema?.schema?.sections) ? schema.schema.sections.flatMap((s: any) => s.fields || [])
    : (Array.isArray(schema?.fields) ? schema.fields
    : (Array.isArray(schema?.sections) ? schema.sections.flatMap((s: any) => s.fields || []) : [])));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId) return;
    setSubmitting(true);
    try {
      await fetchPublic<{ id: string }>(`/public/forms/${encodeURIComponent(formId)}/submit`, {
        method: "POST",
        body: JSON.stringify({
          values,
          submitterEmail: values._email || undefined,
          submitterName: values._name || undefined,
        }),
      });
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">正在加载表单…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-8">
        <Card className="max-w-md shadow-xl border-rose-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertCircle className="size-5" /> 加载失败
            </CardTitle>
            <CardDescription className="text-rose-600">{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-3 mr-1" /> 返回
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-8">
        <Card className="max-w-md shadow-xl border-emerald-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-16 rounded-full bg-primary flex items-center justify-center mb-3 shadow-lg">
              <Check className="size-9 text-white" strokeWidth={3} />
            </div>
            <CardTitle className="text-xl">提交成功 🎉</CardTitle>
            <CardDescription>感谢您的填写，表单已成功提交。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground text-center">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              数据已加密存储
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles className="size-3.5" />
              提交时间: {new Date().toLocaleString("zh-CN")}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 justify-center">
            <Button
              onClick={() => {
                setSubmitted(false);
                setValues(pickInitialValues(schema.schema || schema));
              }}
              variant="outline"
            >
              再提交一份
            </Button>
            <Button variant="outline" onClick={() => navigate(`/public/forms/${formId}/submissions`)}>
              查看提交记录
            </Button>
            <Button onClick={() => navigate("/apps")}>
              返回应用中心
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const formTitle = schema?.name || "公开表单";
  const formDescription = schema?.description || "请填写以下表单，提交后系统会自动记录。";

  const requiredCount = fields.filter((f: any) => f.required).length;
  const fieldTypes = Array.from(new Set<string>(fields.map((f: any) => f.type).filter(Boolean)));

  const fieldIcon = (type: string) => {
    if (type === "email") return <Mail className="size-3.5" />;
    if (type === "date") return <Calendar className="size-3.5" />;
    if (type === "textarea") return <Sparkles className="size-3.5" />;
    if (type === "select") return <Globe className="size-3.5" />;
    if (type === "checkbox") return <Check className="size-3.5" />;
    if (type === "number") return <Sparkles className="size-3.5" />;
    return <User className="size-3.5" />;
  };

  return (
    <div className="min-h-screen bg-primary py-10 px-4">
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5">
        {/* P8-2 品牌 Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-xl">
          <div className="absolute -top-12 -right-12 size-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-2">
              <Globe className="size-3.5" />
              公开访问 · 来自 MetaPlatform
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{formTitle}</h1>
            <p className="text-sm text-white/85 mt-1 max-w-prose">{formDescription}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                {fields.length} 个字段
              </Badge>
              {requiredCount > 0 && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  {requiredCount} 个必填
                </Badge>
              )}
              {fieldTypes.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="bg-white/15 text-white border-white/25 hover:bg-white/25">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-violet-100">
          <CardHeader className="border-b bg-primary/30">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" />
              填写表单
            </CardTitle>
            <CardDescription>带 * 为必填项</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {fields.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">此表单暂未配置字段。</div>
            ) : fields.map((f, idx) => (
              <div key={f.name || f.id} className="group">
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5 text-slate-700">
                  <span className="size-5 rounded bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-mono shrink-0">
                    {idx + 1}
                  </span>
                  {fieldIcon(f.type)}
                  <span>{f.label || f.name}</span>
                  {f.required && <span className="text-rose-500">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    placeholder={f.placeholder || ""}
                    required={f.required}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition w-full resize-none"
                    rows={4}
                  />
                ) : f.type === "number" ? (
                  <Input
                    type="number"
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    placeholder={f.placeholder || ""}
                    required={f.required}
                    className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    required={f.required}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition w-full"
                  >
                    <option value="">— 请选择 —</option>
                    {Array.isArray(f.options) ? f.options.map((opt: any) => {
                      const v = typeof opt === 'string' ? opt : opt.value;
                      const l = typeof opt === 'string' ? opt : opt.label;
                      return <option key={v} value={v}>{l}</option>;
                    }) : null}
                  </select>
                ) : f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none p-2 rounded hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!values[f.name]}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                      className="size-4 accent-violet-600"
                    />
                    {f.placeholder || "同意"}
                  </label>
                ) : f.type === "date" ? (
                  <Input
                    type="date"
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    required={f.required}
                    className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                  />
                ) : (
                  <Input
                    type={f.type === "email" ? "email" : "text"}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    placeholder={f.placeholder || ""}
                    required={f.required}
                    className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                  />
                )}
                {f.description && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
                    <span className="shrink-0">💡</span>
                    <span>{f.description}</span>
                  </p>
                )}
              </div>
            ))}

            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                <User className="size-3.5" /> 联系信息（可选，用于系统通知）
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="姓名 (选填)"
                  value={values._name ?? ""}
                  onChange={(e) => setValues({ ...values, _name: e.target.value })}
                  className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                />
                <Input
                  type="email"
                  placeholder="邮箱 (选填)"
                  value={values._email ?? ""}
                  onChange={(e) => setValues({ ...values, _email: e.target.value })}
                  className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-slate-50/50 flex flex-col gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:from-violet-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              {submitting ? (
                <><Loader2 className="size-4 animate-spin mr-2" />提交中…</>
              ) : (
                <><Send className="size-4 mr-2" />立即提交</>
              )}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              <ShieldCheck className="inline-block size-3 mr-1" />
              提交即表示您同意数据用于本次表单的目的。Powered by MetaPlatform
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
